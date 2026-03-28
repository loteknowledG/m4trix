export type AgentId = string;

export type Agent = {
  id: AgentId;
  name: string;
  description: string;
  avatarUrl?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'black' | null;
};

export type ChatMessage = {
  id: string;
  from: AgentId | 'user';
  text: string;
};

export type OrchestratedMessage = {
  id: string;
  from: 'user' | 'agent';
  text: string;
  agentId?: AgentId;
};

export type AgentsResponse = {
  agents: Agent[];
  messages: OrchestratedMessage[];
  mode: 'demo' | 'live';
  error?: string;
};
