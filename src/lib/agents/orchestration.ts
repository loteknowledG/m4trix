import type { Agent, OrchestratedMessage } from "./types";

const HISTORY_LIMIT = 6;

export function sliceHistory(
  fullHistory?: OrchestratedMessage[],
): OrchestratedMessage[] | undefined {
  if (!Array.isArray(fullHistory) || fullHistory.length === 0) return undefined;
  const start = Math.max(0, fullHistory.length - HISTORY_LIMIT);
  return fullHistory.slice(start);
}

/**
 * Heuristic to detect agent->agent instructions in the user's prompt.
 * If true, we prefer sequential orchestration so the addressed agent
 * can see and respond to the prior agent's output.
 */
export function looksLikeAgentToAgentInstruction(prompt: string, agents: Agent[]): boolean {
  if (!prompt || !agents || !agents.length) return false;

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const ids = agents.map((a) => escape(a.id)).join("|");
  const names = agents
    .map((a) => escape((a.name || "").toLowerCase()))
    .filter(Boolean)
    .join("|");

  // explicit @mentions: @critic, @researcher, etc.
  const mentionRegex = new RegExp(`@(${ids})\\b`, "i");
  if (mentionRegex.test(prompt)) return true;

  // direct instruction to an agent: "tell the critic to", "ask summarizer to"
  const directInstrRegex = new RegExp(
    `\\b(?:tell|ask|instruct|have|order|request|direct)\\b[\\s\\S]{0,60}?\\b(${ids}|${names})\\b`,
    "i",
  );
  if (directInstrRegex.test(prompt)) return true;

  // agent-to-agent patterns: "critic, respond to researcher" or "researcher asks critic to"
  const agentPairRegex = new RegExp(
    `\\b(${ids}|${names})\\b[\\s\\S]{0,60}?(?:to|ask|tell|instruct|respond|reply|evaluate|criticize)[\\s\\S]{0,60}?\\b(${ids}|${names})\\b`,
    "i",
  );
  if (agentPairRegex.test(prompt)) return true;

  return false;
}

/**
 * Decide orchestration deterministically per the user's rule:
 * - If agents are being instructed to talk to each other => sequential
 * - Otherwise => parallel
 */
export function decideOrchestrationAuto(
  prompt: string,
  agents: Agent[],
): "sequential" | "parallel" {
  return looksLikeAgentToAgentInstruction(prompt, agents) ? "sequential" : "parallel";
}

type AgentRunContext = {
  story?: string;
  coordinatorAgent?: Agent;
  coordinatorMode?: "tell" | "do" | "think";
  history?: OrchestratedMessage[];
  interactionMode?: "neutral" | "cooperative" | "competitive";
};

export async function runOrchestration(
  prompt: string,
  agents: Agent[],
  options: {
    orchestration: "sequential" | "parallel";
    stateless: boolean;
    story?: string;
    coordinatorAgent?: Agent;
    coordinatorMode?: "tell" | "do" | "think";
    interactionMode?: "neutral" | "cooperative" | "competitive";
    history?: OrchestratedMessage[];
    callProvider: (prompt: string, agent: Agent, options: AgentRunContext) => Promise<string>;
  },
): Promise<{ messages: OrchestratedMessage[]; agents: Agent[] }> {
  const baseId = `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const messages: OrchestratedMessage[] = [];

  const historyForAgents = options.stateless ? undefined : sliceHistory(options.history);

  if (options.orchestration === "sequential") {
    // Sequential: each agent sees prior agents' responses
    let accumulated = "";

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      const promptToAgent = i === 0 ? prompt : `${accumulated}\n\nUser's follow-up: ${prompt}`;

      const text = await options.callProvider(promptToAgent, agent, {
        story: options.story,
        coordinatorAgent: options.coordinatorAgent,
        coordinatorMode: options.coordinatorMode,
        interactionMode: options.interactionMode,
        history: historyForAgents,
      });

      const msg: OrchestratedMessage = {
        id: `${baseId}-a${i}`,
        from: "agent",
        text,
        agentId: agent.id as any,
      };
      messages.push(msg);
      accumulated += `\n\n${agent.name}: ${text}`;
    }
  } else {
    // Parallel: all agents respond to the same prompt
    const results = await Promise.all(
      agents.map((agent, i) =>
        options
          .callProvider(prompt, agent, {
            story: options.story,
            coordinatorAgent: options.coordinatorAgent,
            coordinatorMode: options.coordinatorMode,
            interactionMode: options.interactionMode,
            history: historyForAgents,
          })
          .then((text) => ({ agent, text, i })),
      ),
    );

    for (const { agent, text, i } of results) {
      const msg: OrchestratedMessage = {
        id: `${baseId}-a${i}`,
        from: "agent",
        text,
        agentId: agent.id as any,
      };
      messages.push(msg);
    }
  }

  return { messages, agents };
}
