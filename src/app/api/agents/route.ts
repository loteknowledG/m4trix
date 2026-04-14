import fs from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";

import {
  type Agent,
  type AgentsRequest,
  type AgentsResponse,
  buildProviderRequest,
  callProvider,
  getProviderConfig,
  runOrchestration,
} from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_MARKDOWN_DIR = path.join(process.cwd(), "agents");

const AGENT_DEFAULT_NAMES: Record<string, string> = {
  researcher: "Researcher",
  critic: "Critic",
  summarizer: "Summarizer",
};

const AGENT_FALLBACK_DESCRIPTIONS: Record<string, string> = {
  researcher: "Finds facts, breaks down the problem, and proposes options.",
  critic: "Challenges assumptions, looks for risks and edge cases.",
  summarizer: "Condenses the discussion into a concise plan.",
};

function normalizeProvider(provider?: string) {
  if (provider === "huggingface") return "hf";
  return provider;
}

const textEncoder = new TextEncoder();

async function streamOpenAiCompatibleResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  const body = response.body;

  if (!body) {
    return new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
  }

  if (!contentType.includes("text/event-stream")) {
    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const text = await response.text();
          if (text) controller.enqueue(textEncoder.encode(text));
        } finally {
          controller.close();
        }
      },
    });
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const emit = (text: string) => {
        if (!text) return;
        controller.enqueue(textEncoder.encode(text));
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || !line.startsWith("data:")) continue;

            const data = line.slice(5).trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const delta =
                parsed?.choices?.[0]?.delta?.content ??
                parsed?.choices?.[0]?.message?.content ??
                "";

              if (typeof delta === "string") {
                emit(delta);
                continue;
              }

              if (Array.isArray(delta)) {
                const text = delta
                  .map((part: any) => {
                    if (!part) return "";
                    if (typeof part === "string") return part;
                    if (typeof part.text === "string") return part.text;
                    return "";
                  })
                  .filter(Boolean)
                  .join("");
                emit(text);
                continue;
              }
            } catch {
              emit(data);
            }
          }
        }

        const remaining = buffer.trim();
        if (remaining) {
          const payload = remaining.startsWith("data:") ? remaining.slice(5).trim() : remaining;
          emit(payload);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function loadAgentDescriptionFromMarkdown(agentId: string): Promise<string | null> {
  try {
    const filePath = path.join(AGENT_MARKDOWN_DIR, `${agentId}.md`);
    const raw = await fs.readFile(filePath, "utf8");
    return raw.trim();
  } catch {
    return null;
  }
}

async function getDefaultAgents(): Promise<Agent[]> {
  const ids = ["researcher", "critic", "summarizer"];

  const agents: Agent[] = [];
  for (const id of ids) {
    const descriptionFromFile = await loadAgentDescriptionFromMarkdown(id);
    agents.push({
      id: id as any,
      name: AGENT_DEFAULT_NAMES[id],
      description: descriptionFromFile ?? AGENT_FALLBACK_DESCRIPTIONS[id],
    });
  }

  return agents;
}

export async function POST(req: NextRequest) {
  let body: AgentsRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    prompt,
    model: modelOverride,
    character,
    agents: agentsOverride,
    story,
    coordinatorAgent,
    history,
    coordinatorMode = "tell",
    orchestration = "auto",
    interactionMode = "neutral",
    stateless = false,
    stream = false,
    provider: providerOverride,
    lmstudioUrl,
  } = body;

  // Validate required fields
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    return Response.json({ error: "Missing or empty prompt" }, { status: 400 });
  }

  // Load agents
  let agents: Agent[];
  if (character && character.id && character.name) {
    agents = [
      {
        id: character.id as any,
        name: character.name,
        description: character.description || "",
      },
    ];
  } else if (agentsOverride && Array.isArray(agentsOverride) && agentsOverride.length) {
    agents = agentsOverride;
  } else {
    agents = await getDefaultAgents();
  }

  // Orchestration mode
  let orchestrationMode: "sequential" | "parallel";
  if (orchestration === "auto") {
    const { decideOrchestrationAuto } = await import("@/lib/agents");
    orchestrationMode = decideOrchestrationAuto(prompt, agents);
  } else {
    orchestrationMode = orchestration;
  }

  // Provider config
  const zenApiKey = body.zenApiKey || process.env.ZEN_API_KEY;
  const googleApiKey = body.googleApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const hfApiKey = body.hfApiKey || process.env.HUGGINGFACE_API_KEY;
  const nvidiaApiKey = body.nvidiaApiKey || process.env.NVIDIA_API_KEY;

  let effectiveProvider = normalizeProvider(providerOverride) || "zen";
  if (lmstudioUrl) {
    effectiveProvider = "lmstudio";
  }

  let providerConfig;
  try {
    providerConfig = getProviderConfig(effectiveProvider, {
      model: modelOverride,
      lmstudioUrl,
      zenApiKey,
      googleApiKey,
      hfApiKey,
      nvidiaApiKey,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Invalid provider configuration" },
      { status: 400 },
    );
  }

  const isLmstudio = effectiveProvider === "lmstudio";
  if (isLmstudio && !providerConfig.model) {
    return Response.json(
      { error: "LM Studio model is missing. Select a model before sending a request." },
      { status: 400 },
    );
  }

  const agentsToRun = isLmstudio ? agents.slice(0, 1) : agents;
  const debugRuns: NonNullable<AgentsResponse["debug"]>["runs"] = [];

  if (stream && agentsToRun.length === 1) {
    try {
      const requestDebug = buildProviderRequest(prompt, agentsToRun[0], {
        model: providerConfig.model,
        story,
        coordinatorAgent,
        coordinatorMode,
        interactionMode,
        history: stateless ? undefined : history,
        temperature: 0.7,
      });

      debugRuns.push({
        agentId: agentsToRun[0].id,
        agentName: agentsToRun[0].name,
        prompt,
        systemPrompt: requestDebug.systemPrompt,
        messages: requestDebug.apiMessages.map((message) => ({
          role: message.role,
          content:
            typeof message.content === "string" ? message.content : JSON.stringify(message.content),
        })),
      });

      const providerController = new AbortController();
      const timeoutMs = isLmstudio ? 90000 : 60000;
      const timeout = setTimeout(() => providerController.abort(), timeoutMs);

      const providerResponse = await fetch(providerConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(providerConfig.apiKey ? { Authorization: `Bearer ${providerConfig.apiKey}` } : {}),
        },
        body: JSON.stringify({
          ...requestDebug.providerPayload,
          stream: true,
        }),
        signal: providerController.signal,
      }).finally(() => clearTimeout(timeout));

      if (!providerResponse.ok) {
        const text = await providerResponse.text().catch(() => "");
        return Response.json(
          { error: `${effectiveProvider} error ${providerResponse.status}: ${text || providerResponse.statusText}` },
          { status: 502 },
        );
      }

      return new Response(await streamOpenAiCompatibleResponse(providerResponse), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get response from LLM";
      console.error("[api/agents][stream][error]", {
        provider: effectiveProvider,
        model: providerConfig.model,
        message: errorMessage,
      });
      return Response.json({ error: errorMessage }, { status: 502 });
    }
  }

  // Run orchestration
  let messages;
  try {
    const result = await runOrchestration(prompt, agentsToRun, {
      orchestration: orchestrationMode,
      stateless,
      story,
      coordinatorAgent,
      coordinatorMode,
      interactionMode,
      history,
      callProvider: async (promptForAgent, agent, options) => {
        const requestDebug = buildProviderRequest(promptForAgent, agent, {
          ...options,
          model: providerConfig.model,
        });

        debugRuns.push({
          agentId: agent.id,
          agentName: agent.name,
          prompt: promptForAgent,
          systemPrompt: requestDebug.systemPrompt,
          messages: requestDebug.apiMessages.map((message) => ({
            role: message.role,
            content:
              typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content),
          })),
        });

        return callProvider(promptForAgent, agent, {
          ...options,
          url: providerConfig.url,
          apiKey: providerConfig.apiKey || "",
          model: providerConfig.model,
          providerName: effectiveProvider,
        });
      },
    });
    messages = result.messages;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Failed to get response from LLM";
    console.error("[api/agents][orchestration][error]", {
      provider: effectiveProvider,
      model: providerConfig.model,
      message: errorMessage,
    });
    return Response.json({ error: errorMessage }, { status: 502 });
  }

  const response: AgentsResponse = {
    agents,
    messages,
    mode: "live",
    debug: {
      provider: effectiveProvider,
      model: providerConfig.model,
      runs: debugRuns,
    },
  };

  return Response.json(response);
}
