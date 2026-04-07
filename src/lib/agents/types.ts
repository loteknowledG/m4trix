export type AgentId = "researcher" | "critic" | "summarizer";

export type Agent = {
  id: AgentId;
  name: string;
  description: string;
  avatarUrl?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
};

export type OrchestratedMessage = {
  id: string;
  from: "user" | "agent";
  text: string;
  /**
   * Which agent produced this message (if from === "agent").
   * The client can use this to render badges/avatars.
   */
  agentId?: AgentId;
  /** If a message is relayed (agent spoke for another agent) this records the origin. */
  relayedBy?: AgentId;
};

export type AgentsRequest = {
  /**
   * The user instruction / query the team of agents should work on.
   */
  prompt: string;
  /**
   * Optional maximum number of agent turns you want the coordinator to take.
   * Not used in the demo implementation, but kept for future logic.
   */
  maxTurns?: number;
  /**
   * Optional model identifier to use for this run.
   * When provided and Zen is configured, overrides ZEN_MODEL.
   */
  model?: string;
  provider?: "zen" | "google" | "hf" | "huggingface" | "nvidia" | "lmstudio";
  lmstudioUrl?: string;
  zenApiKey?: string;
  googleApiKey?: string;
  hfApiKey?: string;
  nvidiaApiKey?: string;
  /**
   * Optional character (the assigned NPC) to use instead of default agents.
   */
  character?: {
    id: string;
    name: string;
    description: string;
  };
  /**
   * Optional agents configuration provided by the client.
   * When present, overrides the default DEMO_AGENTS for this call.
   */
  agents?: Agent[];
  /**
   * Optional global story context / persona for the agents.
   * When provided, it is included in the system prompt so agents
   * can tailor their responses to that background.
   */
  story?: string;
  /**
   * Optional agent persona for the coordinator (user acting as a role).
   */
  coordinatorAgent?: Agent;
  /**
   * Optional conversation history (client-side). When provided and
   * `stateless` is false, this will be used to seed the running
   * transcript so agents can remember prior turns.
   */
  history?: OrchestratedMessage[];
  /**
   * Coordinator mode controls how the user's input should be interpreted by agents.
   * - "tell": the coordinator is speaking (dialogue)
   * - "do": the coordinator is describing actions
   * - "think": expand the sentence into a detailed story
   */
  coordinatorMode?: "tell" | "do" | "think";
  /**
   * Orchestration mode for this run. "auto" lets the server decide
   * (default). "sequential" forces turn-taking; "parallel" runs
   * all agents independently.
   */
  orchestration?: "auto" | "sequential" | "parallel";
  /**
   * Interaction mode for agent dynamics: "neutral" (default),
   * "cooperative" (agents collaborate), or "competitive" (agents compete).
   */
  interactionMode?: "neutral" | "cooperative" | "competitive";
  /**
   * When true, agents will NOT receive prior-turn history; each agent only
   * sees the current user prompt (stateless run).
   */
  stateless?: boolean;
};

export type AgentsResponse = {
  agents: Agent[];
  messages: OrchestratedMessage[];
  mode: "demo" | "live";
  error?: string;
  debug?: {
    provider: string;
    model: string;
    runs: Array<{
      agentId: string;
      agentName: string;
      prompt: string;
      systemPrompt: string;
      messages: Array<{
        role: string;
        content: string;
      }>;
    }>;
  };
};
