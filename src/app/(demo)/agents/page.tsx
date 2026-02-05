"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai/conversation"
import { Message, MessageContent } from "@/components/ai/message"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type AgentId = "researcher" | "critic" | "summarizer"

type Agent = {
  id: AgentId
  name: string
  description: string
  badgeVariant?: "default" | "secondary" | "outline" | "destructive" | "ghost" | "link" | null
}

type ChatMessage = {
  id: string
  from: AgentId | "user"
  text: string
}

type OrchestratedMessage = {
  id: string
  from: "user" | "agent"
  text: string
  agentId?: AgentId
}

type AgentsResponse = {
  agents: Agent[]
  messages: OrchestratedMessage[]
  mode: "demo" | "live"
  error?: string
}

const AGENTS: Agent[] = [
  {
    id: "researcher",
    name: "",
    description: "",
    badgeVariant: "default",
  },
  {
    id: "critic",
    name: "",
    description: "",
    badgeVariant: "secondary",
  },
  {
    id: "summarizer",
    name: "",
    description: "",
    badgeVariant: "outline",
  },
]

const MODEL_OPTIONS = [
  { id: "claude-opus-4-5", label: "claude-opus-4-5" },
  { id: "claude-opus-4-1", label: "claude-opus-4-1" },
  { id: "claude-sonnet-4", label: "claude-sonnet-4" },
  { id: "claude-sonnet-4-5", label: "claude-sonnet-4-5" },
  { id: "claude-3-5-haiku", label: "claude-3-5-haiku" },
  { id: "claude-haiku-4-5", label: "claude-haiku-4-5" },
  { id: "gemini-3-pro", label: "gemini-3-pro" },
  { id: "gemini-3-flash", label: "gemini-3-flash" },
  { id: "gpt-5.2", label: "gpt-5.2" },
  { id: "gpt-5.2-codex", label: "gpt-5.2-codex" },
  { id: "gpt-5.1", label: "gpt-5.1" },
  { id: "gpt-5.1-codex-max", label: "gpt-5.1-codex-max" },
  { id: "gpt-5.1-codex", label: "gpt-5.1-codex" },
  { id: "gpt-5.1-codex-mini", label: "gpt-5.1-codex-mini" },
  { id: "gpt-5", label: "gpt-5" },
  { id: "gpt-5-codex", label: "gpt-5-codex" },
  { id: "gpt-5-nano", label: "gpt-5-nano" },
  { id: "qwen3-coder", label: "qwen3-coder" },
  { id: "glm-4.7", label: "glm-4.7" },
  { id: "glm-4.6", label: "glm-4.6" },
  { id: "minimax-m2.1", label: "minimax-m2.1" },
  { id: "minimax-m2.1-free", label: "minimax-m2.1-free" },
  { id: "kimi-k2.5", label: "kimi-k2.5" },
  { id: "kimi-k2.5-free", label: "kimi-k2.5-free" },
  { id: "kimi-k2", label: "kimi-k2" },
  { id: "kimi-k2-thinking", label: "kimi-k2-thinking" },
  { id: "trinity-large-preview-free", label: "trinity-large-preview-free" },
  { id: "glm-4.7-free", label: "glm-4.7-free" },
  { id: "big-pickle", label: "big-pickle" },
]

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>(AGENTS)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0]?.id ?? "minimax-m2.1-free")
  const [prompterBackstory, setPrompterBackstory] = useState("")
  const [zenApiKey, setZenApiKey] = useState("")
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.sessionStorage.getItem("ZEN_API_KEY_SESSION")
    if (stored) {
      setZenApiKey(stored)
      setIsConnected(true)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (zenApiKey) {
      window.sessionStorage.setItem("ZEN_API_KEY_SESSION", zenApiKey)
    } else {
      window.sessionStorage.removeItem("ZEN_API_KEY_SESSION")
    }
  }, [zenApiKey])

  const agentsById = useMemo(() => {
    return agents.reduce<Record<AgentId, Agent>>((acc, agent) => {
      acc[agent.id] = agent
      return acc
    }, {} as Record<AgentId, Agent>)
  }, [agents])

  const activeAgentId = useMemo<AgentId | null>(() => {
    const last = [...messages].reverse().find((m) => m.from !== "user")
    return last && last.from !== "user" ? last.from : null
  }, [messages])

  const clearScriptTimeouts = () => {
    if (timeoutsRef.current.length) {
      for (const id of timeoutsRef.current) {
        clearTimeout(id)
      }
      timeoutsRef.current = []
    }
  }

  const updateAgent = (id: AgentId, updates: Partial<Pick<Agent, "name" | "description">>) => {
    setAgents((prev) =>
      prev.map((agent) => (agent.id === id ? { ...agent, ...updates } : agent)),
    )
  }

  const connectWithKey = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault()
    }

    setConnectionError(null)

    const key = zenApiKey.trim()
    if (!key) {
      setConnectionError("Please paste your OpenCode API key.")
      return
    }

    setIsConnecting(true)
    try {
      const res = await fetch("/api/models", {
        method: "GET",
        headers: {
          "x-zen-api-key": key,
        },
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Failed to validate key (status ${res.status})`)
      }

      setIsConnected(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to validate API key."
      setConnectionError(msg)
      setIsConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const runDemo = async (promptText?: string) => {
    clearScriptTimeouts()
    setError(null)
    setMessages([])
    setIsRunning(true)

    try {
      const effectivePrompt = (promptText ?? prompt).trim()

      if (!effectivePrompt) {
        throw new Error("Please enter a prompt for the agents.")
      }

      if (!zenApiKey.trim()) {
        throw new Error("Please enter your OpenCode API key for this session.")
      }

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: effectivePrompt,
          maxTurns: 4,
          model,
          agents: agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            description: agent.description,
          })),
          prompterBackstory,
          zenApiKey,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Request failed with status ${res.status}`)
      }

      const data = (await res.json()) as AgentsResponse

      setAgents(data.agents && data.agents.length ? data.agents : AGENTS)

      if (data.error) {
        setError(data.error)
      }

      const mapped: ChatMessage[] = data.messages.map((m) => {
        if (m.from === "user") {
          return {
            id: m.id,
            from: "user",
            text: m.text,
          }
        }

        const fallbackAgentId: AgentId = "researcher"

        return {
          id: m.id,
          from: (m.agentId as AgentId | undefined) ?? fallbackAgentId,
          text: m.text,
        }
      })

      setMessages(mapped)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
      setError(msg)
    } finally {
      setIsRunning(false)
    }
  }

  const stopDemo = () => {
    clearScriptTimeouts()
    setIsRunning(false)
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Agents playground</h1>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Live / Demo hybrid
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            Experiment with multiple agents talking to each other. This demo calls a server
            coordinator at <code>POST /api/agents</code>, which uses the OpenCode gateway
            (via your OpenCode API key and selected model) to talk to LLMs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isConnected ? (
            <form
              className="flex flex-1 items-center gap-2"
              onSubmit={connectWithKey}
            >
              <Input
                type="password"
                className="h-8 w-[260px] text-xs"
                placeholder="Paste your OpenCode API key to connect"
                value={zenApiKey}
                onChange={(e) => setZenApiKey(e.target.value)}
              />
              <Button disabled={isConnecting} size="sm" type="submit">
                {isConnecting ? "Connecting..." : "Connect OpenCode"}
              </Button>
            </form>
          ) : (
            <>
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault()
                  await runDemo(prompt)
                }}
              >
                <Select disabled={isRunning} onValueChange={setModel} value={model}>
                  <SelectTrigger className="h-8 w-[240px] text-xs">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_OPTIONS.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={isRunning} size="sm" type="submit">
                  {isRunning ? "Running" : messages.length ? "Run again" : "Run demo"}
                </Button>
              </form>
              <Button
                variant="ghost"
                size="xs"
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setIsConnected(false)
                  setZenApiKey("")
                  setConnectionError(null)
                }}
              >
                Change key
              </Button>
            </>
          )}
          <Button disabled={!isRunning} onClick={stopDemo} size="sm" variant="outline">
            Stop
          </Button>
        </div>
      </header>

      {!isConnected && connectionError && (
        <div className="mx-auto w-full max-w-2xl rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {connectionError}
        </div>
      )}

      {error && (
        <div className="mx-auto w-full max-w-2xl rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          Error: {error}
        </div>
      )}

      <div className="grid flex-1 gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="relative flex min-h-[280px] max-h-[65vh] flex-col rounded-xl border bg-background/40">
          <div className="flex-1 overflow-y-auto">
            <Conversation className="flex-1">
            {messages.length === 0 ? (
              <ConversationEmptyState
                description="Run the demo to see how multiple agents can talk in this UI."
                title="No conversation yet"
              />
            ) : (
              <ConversationContent>
                {messages.map((message) => {
                  const isUser = message.from === "user"
                  const agent = !isUser && message.from !== "user" ? agentsById[message.from] : null

                  return (
                    <Message from={isUser ? "user" : "assistant"} key={message.id}>
                      <MessageContent>
                        {!isUser && agent ? (
                          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Badge size="sm" variant={agent.badgeVariant ?? "secondary"}>
                              {agent.name}
                            </Badge>
                            <span className="truncate">speaks</span>
                          </div>
                        ) : null}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
                      </MessageContent>
                    </Message>
                  )
                })}
              </ConversationContent>
            )}
              <ConversationScrollButton />
            </Conversation>
          </div>
          {error && (
            <div className="border-t border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </section>

        <aside className="flex max-h-[65vh] flex-col gap-4 self-start overflow-y-auto rounded-xl border bg-background/40 p-4">
          <div className="flex flex-col gap-3">
            {agents.map((agent) => {
              const isActive = activeAgentId === agent.id
              return (
                <div
                  className={
                    "flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm transition-colors " +
                    (isActive ? "border-primary/70 bg-primary/5" : "border-border bg-background/60")
                  }
                  key={agent.id}
                >
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                        Speaking
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-col gap-1">
                    <Input
                      className="h-7 text-xs"
                      placeholder="Role name (shown in messages)"
                      value={agent.name}
                      onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                    />
                    <Textarea
                      className="min-h-[60px] text-[11px]"
                      placeholder="Describe how this agent should think and speak..."
                      value={agent.description}
                      onChange={(e) => updateAgent(agent.id, { description: e.target.value })}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="mt-2 flex flex-col gap-2 rounded-xl border bg-background/80 p-3 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prompter
            </p>
            <Textarea
              autoComplete="off"
              className="min-h-[120px] text-xs"
              disabled={isRunning}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want the agent team to work on..."
              value={prompt}
            />
            <Textarea
              autoComplete="off"
              className="min-h-[80px] text-[11px]"
              disabled={isRunning}
              onChange={(e) => setPrompterBackstory(e.target.value)}
              placeholder="Optional: what's the backstory or persona of the prompter (you)?"
              value={prompterBackstory}
            />
            {error ? (
              <p className="text-[11px] text-destructive break-words">
                Error: {error}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Edit your prompt here, then use the Run / Stop controls at the top.
              </p>
            )}
          </div>

        </aside>
      </div>
    </div>
  )
}

