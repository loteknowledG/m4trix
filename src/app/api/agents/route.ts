import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Basic agent identifiers used by the demo UI.
// You can freely change or extend this list as you evolve your system.
type AgentId = "researcher" | "critic" | "summarizer"

export type Agent = {
  id: AgentId
  name: string
  description: string
}

export type OrchestratedMessage = {
  id: string
  from: "user" | "agent"
  text: string
  /**
   * Which agent produced this message (if from === "agent").
   * The client can use this to render badges/avatars.
   */
  agentId?: AgentId
}

export type AgentsRequest = {
  /**
   * The user instruction / query the team of agents should work on.
   */
  prompt: string
  /**
   * Optional maximum number of agent turns you want the coordinator to take.
   * Not used in the demo implementation, but kept for future logic.
   */
  maxTurns?: number
  /**
   * Optional model identifier to use for this run.
   * When provided and Zen is configured, overrides ZEN_MODEL.
   */
  model?: string
}

export type AgentsResponse = {
  agents: Agent[]
  messages: OrchestratedMessage[]
  mode: "demo" | "live"
  error?: string
}

// In a real implementation you would:
// - Map AgentId -> model + system prompt
// - Use the `ai` SDK (or any other client) to call those models
// - Implement a loop where agents take turns, possibly with a coordinator
// For now we keep it simple and just return a deterministic script so the UI
// has a concrete shape to integrate with.
const DEMO_AGENTS: Agent[] = [
  {
    id: "researcher",
    name: "Researcher",
    description: "Finds facts, breaks down the problem, and proposes options.",
  },
  {
    id: "critic",
    name: "Critic",
    description: "Challenges assumptions, looks for risks and edge cases.",
  },
  {
    id: "summarizer",
    name: "Summarizer",
    description: "Condenses the discussion into a concise plan.",
  },
]

async function callProvider(
  prompt: string,
  agent: Agent,
  options: { url: string; apiKey: string; model: string; providerName: string },
): Promise<string> {
  const { url, apiKey, model, providerName } = options

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `You are ${agent.name}. ${agent.description} Respond concisely as this agent only.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => "")
    throw new Error(`${providerName} error ${response.status}: ${text || response.statusText}`)
  }

  const data = (await response.json()) as any

  // Some providers (like Zen) may return text in different fields:
  // - message.content (string or rich object)
  // - message.reasoning_content
  // Try a few reasonable fallbacks before treating the response as invalid.
  const message = data?.choices?.[0]?.message

  let content: string | undefined

  if (typeof message?.content === "string" && message.content.trim().length > 0) {
    content = message.content
  } else if (typeof message?.reasoning_content === "string" && message.reasoning_content.trim().length > 0) {
    content = message.reasoning_content
  } else if (Array.isArray(message?.content)) {
    // Handle content as an array of parts, e.g. [{ type: "text", text: "..." }]
    const textParts = message.content
      .map((part: any) => {
        if (!part) return ""
        if (typeof part === "string") return part
        if (typeof part.text === "string") return part.text
        return ""
      })
      .filter(Boolean)
    const joined = textParts.join(" ").trim()
    if (joined) {
      content = joined
    }
  }

  if (!content) {
    const errorMessage =
      data?.error?.message ||
      data?.error?.error ||
      (typeof data?.error === "string" ? data.error : undefined)

    if (errorMessage) {
      throw new Error(`${providerName} error: ${errorMessage}`)
    }

    const debugSnippet = (() => {
      try {
        const raw = JSON.stringify(data)
        return raw.length > 400 ? `${raw.slice(0, 400)}…` : raw
      } catch {
        return "<unserializable payload>"
      }
    })()

    throw new Error(`${providerName} response missing content. Raw payload: ${debugSnippet}`)
  }

  return content.trim()
}

async function callOpenAIForAgent(
  prompt: string,
  agent: Agent,
  modelOverride?: string,
): Promise<string> {
  // Prefer OpenCode Zen; on Zen rate-limit (429) and if OpenAI is
  // configured, fall back to OpenAI so the UI can still run live.
  const zenApiUrl = process.env.ZEN_API_URL
  const zenApiKey = process.env.ZEN_API_KEY
  const zenModelFromEnv = process.env.ZEN_MODEL
  const openaiApiKey = process.env.OPENAI_API_KEY

  const zenModelToUse = modelOverride || zenModelFromEnv

  const zenConfigured = Boolean(zenApiUrl && zenApiKey && zenModelToUse)

  if (!zenConfigured && !openaiApiKey) {
    throw new Error(
      "No API key configured: set either ZEN_API_KEY/ ZEN_API_URL / ZEN_MODEL or OPENAI_API_KEY.",
    )
  }

  // Try Zen first if configured.
  if (zenConfigured) {
    try {
      return await callProvider(prompt, agent, {
        url: zenApiUrl!,
        apiKey: zenApiKey!,
        model: zenModelToUse!,
        providerName: "Zen",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const isRateLimit = message.includes("429") || /Rate limit/i.test(message)
      const isServerError = /error\s+5\d{2}/i.test(message)
      const shouldFallback = isRateLimit || isServerError

      if (!openaiApiKey || !shouldFallback) {
        throw error
      }

      console.warn("Zen unavailable, falling back to OpenAI", message)
      // fall through to OpenAI call below
    }
  }

  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured")
  }

  return await callProvider(prompt, agent, {
    url: "https://api.openai.com/v1/chat/completions",
    apiKey: openaiApiKey,
    model: "gpt-4o-mini",
    providerName: "OpenAI",
  })
}

function buildDemoTranscript(prompt: string): OrchestratedMessage[] {
  const baseId = Date.now().toString(36)

  return [
    {
      id: `${baseId}-u0`,
      from: "user",
      text: prompt,
    },
    {
      id: `${baseId}-r1`,
      from: "agent",
      agentId: "researcher",
      text:
        "We should expose agents as objects with name, role, and model, then route messages through a coordinator.",
    },
    {
      id: `${baseId}-c2`,
      from: "agent",
      agentId: "critic",
      text:
        "We also need safeguards: max turns, cost limits, and a way for the user to stop the loop.",
    },
    {
      id: `${baseId}-r3`,
      from: "agent",
      agentId: "researcher",
      text:
        "Implementation‑wise, a single API route can orchestrate multiple model calls sequentially or in small batches.",
    },
    {
      id: `${baseId}-s4`,
      from: "agent",
      agentId: "summarizer",
      text:
        "Summary: define agents, add a coordinator, and stream the transcript back to the client UI.",
    },
  ]
}

async function buildModelTranscript(
  prompt: string,
  modelOverride?: string,
): Promise<OrchestratedMessage[]> {
  const baseId = Date.now().toString(36)

  const messages: OrchestratedMessage[] = [
    {
      id: `${baseId}-u0`,
      from: "user",
      text: prompt,
    },
  ]

  // Use a v2-compatible OpenAI model ID.
  // You can change this to any supported model, e.g. "gpt-4.1".
  // Call OpenAI once per agent, in parallel, and map
  const agentReplies = await Promise.all(
    DEMO_AGENTS.map(async (agent) => {
      const text = await callOpenAIForAgent(prompt, agent, modelOverride)
      return { agent, text }
    }),
  )

  for (const { agent, text } of agentReplies) {
    messages.push({
      id: `${baseId}-${agent.id}`,
      from: "agent",
      agentId: agent.id,
      text,
    })
  }

  return messages
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as AgentsRequest | null

    if (!body || typeof body.prompt !== "string" || !body.prompt.trim()) {
      return new Response("Missing or invalid `prompt` in request body", {
        status: 400,
      })
    }

    const prompt = body.prompt.trim()
    const modelOverride = typeof body.model === "string" && body.model.trim() ? body.model.trim() : undefined

    const hasApiKey = Boolean(process.env.OPENAI_API_KEY)

    let messages: OrchestratedMessage[]
    let mode: AgentsResponse["mode"] = "demo"
    let error: string | undefined

    if (!hasApiKey) {
      messages = buildDemoTranscript(prompt)
    } else {
      try {
        messages = await buildModelTranscript(prompt, modelOverride)
        mode = "live"
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e)
        console.error("/api/agents OpenAI error", err)
        error = err
        // Fall back to deterministic demo transcript so the
        // UI still works instead of surfacing a server error.
        messages = buildDemoTranscript(prompt)
      }
    }

    const payload: AgentsResponse = {
      agents: DEMO_AGENTS,
      messages,
      mode,
      ...(error ? { error } : {}),
    }

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Internal error"

    return new Response(message, {
      status: 500,
    })
  }
}
