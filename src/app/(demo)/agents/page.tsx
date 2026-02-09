"use client"

import { FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { ChatWindow, type ChatWindowMessage, type ChatWindowModel } from "@/components/ai/chat-window"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChevronLeft, Download, FileUp, Loader2, PanelRightClose, PanelRightOpen, Send, User } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type AgentId = string

type Agent = {
  id: AgentId
  name: string
  description: string
  badgeVariant?: "default" | "secondary" | "outline" | "destructive" | "black" | null
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



type ModelOption = {
  id: string
  label: string
  provider: "zen" | "google" | "huggingface"
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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([AGENTS[0]])

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prompt, setPrompt] = useState("")
  const promptInputRef = useRef<HTMLTextAreaElement>(null)
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([])
  const [model, setModel] = useState<string>("")
  const [story, setStory] = useState("")
  const [activeProvider, setActiveProvider] = useState<"zen" | "google" | "huggingface">("zen")
  const [zenApiKey, setZenApiKey] = useState("")
  const [googleApiKey, setGoogleApiKey] = useState("")
  const [hfApiKey, setHfApiKey] = useState("")
  const [zenConnected, setZenConnected] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [hfConnected, setHfConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [showBackstory, setShowBackstory] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [prompterAgent, setPrompterAgent] = useState<Agent | null>(null)
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [customModelId, setCustomModelId] = useState("")
  const timeoutsRef = useRef<number[]>([])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedZen = window.sessionStorage.getItem("ZEN_API_KEY_SESSION")
    const storedGoogle = window.sessionStorage.getItem("GOOGLE_API_KEY_SESSION")
    const storedHf = window.sessionStorage.getItem("HF_API_KEY_SESSION")
    const storedProvider = window.sessionStorage.getItem("ACTIVE_PROVIDER_SESSION") as "zen" | "google" | "huggingface" | null
    
    if (storedZen) {
      setZenApiKey(storedZen)
      validateAndFetchModels("zen", storedZen)
    }
    if (storedGoogle) {
      setGoogleApiKey(storedGoogle)
      validateAndFetchModels("google", storedGoogle)
    }
    if (storedHf) {
      setHfApiKey(storedHf)
      validateAndFetchModels("huggingface", storedHf)
    }
    if (storedProvider) setActiveProvider(storedProvider)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (zenApiKey) {
      window.sessionStorage.setItem("ZEN_API_KEY_SESSION", zenApiKey)
    } else {
      window.sessionStorage.removeItem("ZEN_API_KEY_SESSION")
    }
    if (googleApiKey) {
      window.sessionStorage.setItem("GOOGLE_API_KEY_SESSION", googleApiKey)
    } else {
      window.sessionStorage.removeItem("GOOGLE_API_KEY_SESSION")
    }
    if (hfApiKey) {
      window.sessionStorage.setItem("HF_API_KEY_SESSION", hfApiKey)
    } else {
      window.sessionStorage.removeItem("HF_API_KEY_SESSION")
    }
    window.sessionStorage.setItem("ACTIVE_PROVIDER_SESSION", activeProvider)
  }, [zenApiKey, googleApiKey, hfApiKey, activeProvider])



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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    for (const file of Array.from(files)) {
      if (!file.name.endsWith(".md")) {
        toast.error(`File ${file.name} is not a Markdown file.`)
        continue
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        if (!content) return

        const id = file.name.replace(/\.md$/, "")
        const firstHeadingLine = content
          .split(/\r?\n/)
          .find((line) => line.trim().startsWith("#"))

        const label = firstHeadingLine
          ? firstHeadingLine.replace(/^#+\s*/, "").trim() || id
          : id

        const newAgent: Agent = {
          id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: label,
          description: content.trim(),
          badgeVariant: "outline",
        }
        
        setAgents((prev) => [...prev, newAgent])
        
        toast.success(`Agent "${label}" imported successfully!`)
      }
      reader.readAsText(file)
    }
    // reset input
    event.target.value = ""
  }

  const addAgent = () => {
    const newId = `agent-${Date.now()}`
    const newAgent: Agent = {
      id: newId,
      name: "",
      description: "",
      badgeVariant: "outline",
    }
    setAgents((prev) => [...prev, newAgent])
  }

  const removeAgent = (id: AgentId) => {
    if (agents.length <= 1) {
      toast.error("You must have at least one agent.")
      return
    }
    setAgents((prev) => prev.filter((a) => a.id !== id))
  }

  const exportAgent = (agent: Agent) => {
    const name = agent.name || "Agent"
    const description = agent.description || ""
    
    const content = `# ${name}\n\n${description}`
    const blob = new Blob([content], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const filename = name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-") || "agent-skill"
    a.download = `${filename}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast.success(`Agent skill "${name}" exported!`)
  }

  const updateAgent = (id: AgentId, updates: Partial<Pick<Agent, "name" | "description">>) => {
    setAgents((prev) =>
      prev.map((agent) => (agent.id === id ? { ...agent, ...updates } : agent)),
    )
  }

  const assumeAgent = (agent: Agent) => {
    setPrompterAgent(agent)
    setAgents((prev) => prev.filter((a) => a.id !== agent.id))
    setShowBackstory(true)
    toast.success(`You have assumed the role of ${agent.name || "this agent"}`)
  }

  const unassumeAgent = () => {
    if (prompterAgent) {
      setAgents((prev) => [prompterAgent, ...prev])
      setPrompterAgent(null)
    }
  }

  const updatePrompterAgent = (updates: Partial<Pick<Agent, "name" | "description">>) => {
    if (prompterAgent) {
      setPrompterAgent({ ...prompterAgent, ...updates })
    }
  }

  const streamMessageText = async (messageId: string, fullText: string) => {
    const words = fullText.split(" ")
    let current = ""

    for (let i = 0; i < words.length; i++) {
      current += (i > 0 ? " " : "") + words[i]

      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, text: current } : msg)),
      )

      await new Promise((resolve) => setTimeout(resolve, Math.random() * 60 + 20))
    }
  }

  const validateAndFetchModels = async (provider: "zen" | "google" | "huggingface", keyToUse: string) => {
    const trimmedKey = keyToUse.trim()
    if (!trimmedKey) return

    setConnectionError(null)
    setIsConnecting(true)
    try {
      const headers: Record<string, string> = {}
      if (provider === "zen") {
        headers["x-zen-api-key"] = trimmedKey
      } else if (provider === "google") {
        headers["x-google-api-key"] = trimmedKey
      } else {
        headers["x-hf-api-key"] = trimmedKey
      }

      const res = await fetch("/api/models", {
        method: "GET",
        headers,
      })

      if (!res.ok) {
        const text = await res.text()
        throw new Error(text || `Failed to validate key (status ${res.status})`)
      }

      const payload = (await res.json().catch(() => null)) as any
      const rawModels: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
            ? payload.models
            : []

      const options: (ModelOption & { provider: "zen" | "google" | "huggingface" })[] = rawModels
        .map((m: any) => {
          const id =
            (typeof m?.id === "string" && m.id) ||
            (typeof m?.model_id === "string" && m.model_id) ||
            (typeof m?.name === "string" && m.name)

          if (!id) return null

          const label =
            (typeof m?.display_name === "string" && m.display_name) ||
            (typeof m?.name === "string" && m.name) ||
            id

          return { id, label, provider }
        })
        .filter((m: any): m is any => Boolean(m))

      setModelOptions((prev) => {
        // Filter out existing models for the same provider to avoid duplicates
        const filtered = prev.filter(p => p.provider !== provider)
        const combined = [...filtered, ...options]
        return combined
      })

      if (options.length && !model) {
        setModel(options[0]!.id)
      }

      if (provider === "zen") setZenConnected(true)
      else if (provider === "google") setGoogleConnected(true)
      else setHfConnected(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Failed to validate ${provider} API key.`
      setConnectionError(msg)
      if (provider === "zen") setZenConnected(false)
      else if (provider === "google") setGoogleConnected(false)
      else setHfConnected(false)
    } finally {
      setIsConnecting(false)
    }
  }

  const connectWithKey = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault()
    }
    const key = activeProvider === "zen" ? zenApiKey : activeProvider === "google" ? googleApiKey : hfApiKey
    await validateAndFetchModels(activeProvider, key)
  }

  const runDemo = async (promptText?: string) => {
    clearScriptTimeouts()
    setError(null)
    setIsRunning(true)

    try {
      const effectivePrompt = (promptText ?? prompt).trim()

      if (!effectivePrompt) {
        throw new Error("Please enter a prompt for the agents.")
      }

      if (!model.trim()) {
        throw new Error("Please select a model for the agents.")
      }

      if (activeProvider === "zen" && !zenApiKey.trim()) {
        throw new Error("Please enter your OpenCode API key for this session.")
      }
      
      if (activeProvider === "google" && !googleApiKey.trim()) {
        throw new Error("Please enter your Google API key for this session.")
      }

      if (activeProvider === "huggingface" && !hfApiKey.trim()) {
        throw new Error("Please enter your Hugging Face API token for this session.")
      }

      const selectedModel = modelOptions.find(o => o.id === model)
      const modelProvider = selectedModel?.provider || activeProvider

      const temporaryUserMessageId = `user-${Date.now()}`
      setMessages((prev) => [
        ...prev,
        {
          id: temporaryUserMessageId,
          from: "user",
          text: effectivePrompt,
        },
      ])
      setPrompt("")

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
              name: agent.name || "Agent",
              description: agent.description || "",
            })),
            story,
            prompterAgent,
            zenApiKey: modelProvider === "zen" ? zenApiKey : undefined,
            googleApiKey: modelProvider === "google" ? googleApiKey : undefined,
            hfApiKey: modelProvider === "huggingface" ? hfApiKey : undefined,
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

      const userMessages = mapped.filter((m) => m.from === "user")
      const agentMessages = mapped.filter((m) => m.from !== "user")

      // Replace our temporary user message with the official one from the API
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== temporaryUserMessageId)
        return [...filtered, ...userMessages]
      })

      for (const agentMessage of agentMessages) {
        setMessages((prev) => [...prev, { ...agentMessage, text: "" }])
        await streamMessageText(agentMessage.id, agentMessage.text)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong"
      setError(msg)
    } finally {
      setIsRunning(false)
    }
  }



  const chatMessages = useMemo<ChatWindowMessage[]>(
    () =>
      messages.map((message) => {
        const isUser = message.from === "user"
        const agent = !isUser && message.from !== "user" ? agentsById[message.from] : null

        let prefix = ""
        if (isUser && prompterAgent && prompterAgent.name) {
          prefix = `${prompterAgent.name} (You): `
        } else if (!isUser && agent?.name) {
          prefix = `${agent.name}: `
        }

        return {
          key: message.id,
          from: isUser ? "user" : "assistant",
          versions: [
            {
              id: message.id,
              content: `${prefix}${message.text}`,
            },
          ],
        }
      }),
    [agentsById, messages, prompterAgent]
  )

  const emptyModels: ChatWindowModel[] = []
  const stickyRef = useRef<HTMLDivElement>(null)

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
            Experiment with multiple agents talking to each other.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {!zenConnected || !googleConnected || !hfConnected ? (
              <form
                className="flex items-center gap-2"
                onSubmit={connectWithKey}
              >
                <Select value={activeProvider} onValueChange={(v: any) => setActiveProvider(v)}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!zenConnected && <SelectItem value="zen">OpenCode</SelectItem>}
                    {!googleConnected && <SelectItem value="google">Google Gemini</SelectItem>}
                    {!hfConnected && <SelectItem value="huggingface">Hugging Face</SelectItem>}
                  </SelectContent>
                </Select>
                <Input
                  type="password"
                  className="h-8 w-[200px] text-xs"
                  placeholder={`Paste ${activeProvider === "zen" ? "OpenCode" : activeProvider === "google" ? "Google" : "Hugging Face"} key`}
                  value={activeProvider === "zen" ? zenApiKey : activeProvider === "google" ? googleApiKey : hfApiKey}
                  onChange={(e) => {
                    const val = e.target.value
                    if (activeProvider === "zen") setZenApiKey(val)
                    else if (activeProvider === "google") setGoogleApiKey(val)
                    else setHfApiKey(val)
                  }}
                />
                <Button disabled={isConnecting} size="sm" type="submit">
                  {isConnecting ? "..." : "Connect"}
                </Button>
              </form>
            ) : null}

            {(zenConnected || googleConnected || hfConnected) && (
              <form
                className="flex items-center gap-2"
                onSubmit={async (event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault()
                  await runDemo(prompt)
                }}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {useCustomModel ? (
                      <Input
                        className="h-8 w-[220px] text-xs"
                        placeholder="e.g. zai-org/GLM-4.5"
                        value={customModelId}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            promptInputRef.current?.focus()
                            toast.success(`Broadcasting to ${customModelId}`)
                          }
                        }}
                        onChange={(e) => {
                          setCustomModelId(e.target.value)
                          setModel(e.target.value)
                        }}
                      />
                    ) : (
                      <Select
                        disabled={isRunning || !modelOptions.length}
                        onValueChange={setModel}
                        value={model}
                      >
                        <SelectTrigger className="h-8 w-[220px] text-xs">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent>
                          {modelOptions.length ? (
                            <>
                              {modelOptions.some(o => o.provider === "zen") && (
                                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">OpenCode</div>
                              )}
                              {modelOptions.filter(o => o.provider === "zen").map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))}
                              {modelOptions.some(o => o.provider === "google") && (
                                <div className="mt-2 px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t">Google Gemini</div>
                              )}
                              {modelOptions.filter(o => o.provider === "google").map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))}
                              {modelOptions.some(o => o.provider === "huggingface") && (
                                <div className="mt-2 px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t">Hugging Face</div>
                              )}
                              {modelOptions.filter(o => o.provider === "huggingface").map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </>
                          ) : (
                            <SelectItem value="__no-models__" disabled>
                              No models available
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    )}
                    <Button disabled={isRunning} size="sm" type="submit">
                      {isRunning ? "Running" : messages.length ? "Run again" : "Run demo"}
                    </Button>
                  </div>
                  {hfConnected && (
                    <button 
                      type="button"
                      onClick={() => setUseCustomModel(!useCustomModel)}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/30 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-all"
                    >
                      {useCustomModel ? "← Back to listed models" : "Can't find your model? Enter HF ID manually"}
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          {(zenConnected || googleConnected || hfConnected) && (
            <div className="flex items-center gap-3 border-l pl-4">
              {zenConnected && (
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[11px] font-medium text-muted-foreground">OpenCode</span>
                  <button 
                    onClick={() => { setZenConnected(false); setZenApiKey(""); setModelOptions(m => m.filter(o => o.provider !== 'zen')); }}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              )}
              {googleConnected && (
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[11px] font-medium text-muted-foreground">Gemini</span>
                  <button 
                    onClick={() => { setGoogleConnected(false); setGoogleApiKey(""); setModelOptions(m => m.filter(o => o.provider !== 'google')); }}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              )}
              {hfConnected && (
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[11px] font-medium text-muted-foreground">HF</span>
                  <button 
                    onClick={() => { setHfConnected(false); setHfApiKey(""); setModelOptions(m => m.filter(o => o.provider !== 'huggingface')); }}
                    className="text-[10px] text-muted-foreground hover:text-destructive"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {connectionError && (
        <div className="mx-auto w-full max-w-2xl rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {connectionError}
        </div>
      )}



      <div className={`flex flex-1 overflow-hidden transition-all duration-300 relative ${sidebarOpen ? "gap-6" : "gap-0"}`}>
        <div 
          className="absolute z-50 top-1/2 -translate-y-1/2 transition-all duration-300"
          style={{ right: sidebarOpen ? "284px" : "-16px" }}
        >
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8 rounded-full shadow-md bg-background hover:bg-accent"
          >
            <ChevronLeft
              className={cn(
                "h-4 w-4 transition-transform duration-500",
                !sidebarOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </Button>
        </div>
        <section className="relative flex min-h-[280px] max-h-[90vh] flex-1 flex-col rounded-xl border bg-background/40 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Run the demo to see how multiple agents can talk in this UI.
              </div>
            ) : (
              <ChatWindow
                messages={chatMessages}
                models={emptyModels}
                suggestions={[]}
                stickyHeight={0}
                stickyRef={stickyRef}
                text=""
                status="ready"
                useWebSearch={false}
                useMicrophone={false}
                model=""
                modelSelectorOpen={false}
                selectedModelData={undefined}
                onSuggestionClick={() => {}}
                onSubmit={() => {}}
                onTextChange={() => {}}
                onToggleWebSearch={() => {}}
                onToggleMicrophone={() => {}}
                onSelectModel={() => {}}
                onModelSelectorOpenChange={() => {}}
                showInput={false}
                showSuggestions={false}
              />
            )}
          </div>
          {error && (
            <div className="border-t border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="mt-auto border-t bg-background/60 p-4">
            <div className="flex flex-col gap-3">
              <div className="relative flex items-end gap-2">
                <div className="relative flex-1">
                  <Textarea
                    ref={promptInputRef}
                    autoComplete="off"
                    className="min-h-[60px] resize-none pr-12 text-sm shadow-sm"
                    disabled={isRunning}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        runDemo(prompt)
                      }
                    }}
                    placeholder="Message the agent team..."
                    value={prompt}
                  />
                  <Button
                    className="absolute right-2 bottom-2 h-8 w-8 rounded-full"
                    disabled={isRunning || !prompt.trim()}
                    onClick={() => runDemo(prompt)}
                    size="icon"
                  >
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowBackstory(!showBackstory)}
                >
                  <User className="h-3 w-3" />
                  {showBackstory ? "Hide Story" : "Set Story"}
                </button>
                
                {showBackstory && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Your Persona
                        </p>
                        {prompterAgent && (
                          <button
                            onClick={unassumeAgent}
                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                          >
                            Unassume
                          </button>
                        )}
                      </div>
                      
                      <Input
                        className="h-7 text-xs"
                        placeholder="Your name (shown in messages)"
                        value={prompterAgent?.name || ""}
                        onChange={(e) => {
                          if (prompterAgent) {
                            updatePrompterAgent({ name: e.target.value })
                          } else {
                            setPrompterAgent({ id: 'user-agent', name: e.target.value, description: '' })
                          }
                        }}
                      />
                      <Textarea
                        className="min-h-[60px] text-[11px]"
                        placeholder="Describe your role and how you interact..."
                        value={prompterAgent?.description || ""}
                        onChange={(e) => {
                          if (prompterAgent) {
                            updatePrompterAgent({ description: e.target.value })
                          } else {
                            setPrompterAgent({ id: 'user-agent', name: '', description: e.target.value })
                          }
                        }}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                       <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Global Story Context
                      </p>
                      <Textarea
                        autoComplete="off"
                        className="min-h-[80px] bg-muted/30 text-[11px] placeholder:italic"
                        disabled={isRunning}
                        onChange={(e) => setStory(e.target.value)}
                        placeholder="Provide global story context or character details for the agents..."
                        value={story}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside 
          className={`flex max-h-[90vh] flex-col gap-4 self-start overflow-y-auto rounded-xl border bg-background/40 p-4 transition-all duration-300 ease-in-out ${
            sidebarOpen ? "w-[300px] opacity-100" : "w-0 p-0 border-0 opacity-0 pointer-events-none"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Import Agents (.md)
              </p>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-4 transition-colors hover:border-primary/50 hover:bg-primary/5">
                <div className="flex flex-col items-center justify-center pt-1 pb-1">
                  <FileUp className="mb-2 h-5 w-5 text-muted-foreground" />
                  <p className="text-[10px] text-muted-foreground">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                  </p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".md" 
                  multiple 
                  onChange={handleFileUpload} 
                />
              </label>

              <Button 
                onClick={addAgent}
                size="sm" 
                variant="outline" 
                className="h-8 w-full border-dashed text-[11px]"
              >
                + Add Agent
              </Button>
            </div>

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
                  <div className="flex items-center justify-between">
                    {isActive && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                        Speaking
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => assumeAgent(agent)}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        title="Assume this Agent Role"
                      >
                        Assume
                      </button>
                      <button
                        onClick={() => exportAgent(agent)}
                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        title="Export Agent Skill"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => removeAgent(agent.id)}
                        className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove Agent"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 flex flex-col gap-1">
                    <Input
                      className="h-7 text-xs"
                      placeholder="Agent name (shown in messages)"
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
        </aside>
      </div>
    </div>
  )
}
