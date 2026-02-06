"use client"

/**
 * @title React AI Chatbot
 * @credit {"name": "Vercel", "url": "https://ai-sdk.dev/elements", "license": {"name": "Apache License 2.0", "url": "https://www.apache.org/licenses/LICENSE-2.0"}}
 * @description React AI chatbot component showcasing a complete chat interface with messages, model selection, and prompt input
 */
import { ChatWindow, type ChatWindowMessage, type ChatWindowModel } from "@/components/ai/chat-window"
import { type PromptInputMessage } from "@/components/ai/prompt-input"
import { MessageCircle } from "lucide-react"
import { nanoid } from "nanoid"
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import DraggableDialog from "@/components/ui/draggable-dialog"
import { Button } from "@/components/ui/button"
import { useStickToBottomContext } from "use-stick-to-bottom"
import { toast } from "sonner"

const initialMessages: ChatWindowMessage[] = [
  {
    key: nanoid(),
    from: "user",
    versions: [
      {
        id: nanoid(),
        content: "Can you explain how to use React hooks effectively?",
      },
    ],
  },
  {
    key: nanoid(),
    from: "assistant",
    sources: [
      {
        href: "https://react.dev/reference/react",
        title: "React Documentation",
      },
      {
        href: "https://react.dev/reference/react-dom",
        title: "React DOM Documentation",
      },
    ],
    versions: [
      {
        id: nanoid(),
        content: '',
      },
    ],
  },
  {
    key: nanoid(),
    from: "user",
    versions: [
      {
        id: nanoid(),
        content:
          "Yes, could you explain useCallback and useMemo in more detail? When should I use one over the other?",
      },
      {
        id: nanoid(),
        content:
          "I'm particularly interested in understanding the performance implications of useCallback and useMemo. Could you break down when each is most appropriate?",
      },
      {
        id: nanoid(),
        content:
          "Thanks for the overview! Could you dive deeper into the specific use cases where useCallback and useMemo make the biggest difference in React applications?",
      },
    ],
  },
  {
    key: nanoid(),
    from: "assistant",
    reasoning: {
      content: `The user is asking for a detailed explanation of useCallback and useMemo. I should provide a clear and concise explanation of each hook's purpose and how they differ.

The useCallback hook is used to memoize functions to prevent unnecessary re-renders of child components that receive functions as props.

The useMemo hook is used to memoize values to avoid expensive recalculations on every render.

Both hooks help with performance optimization, but they serve different purposes.`,
      duration: 10,
    },
    versions: [
      {
        id: nanoid(),
        content: ''
      },
    ],
  },
]

const models: ChatWindowModel[] = [
  {
    id: "gpt-4o",
    name: "GPT-4o",
    chef: "OpenAI",
    chefSlug: "openai",
    providers: ["openai", "azure"],
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    chef: "OpenAI",
    chefSlug: "openai",
    providers: ["openai", "azure"],
  },
  {
    id: "claude-opus-4-20250514",
    name: "Claude 4 Opus",
    chef: "Anthropic",
    chefSlug: "anthropic",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude 4 Sonnet",
    chef: "Anthropic",
    chefSlug: "anthropic",
    providers: ["anthropic", "azure", "google", "amazon-bedrock"],
  },
  {
    id: "gemini-2.0-flash-exp",
    name: "Gemini 2.0 Flash",
    chef: "Google",
    chefSlug: "google",
    providers: ["google"],
  },
]

const suggestions = [
  "What are the latest trends in AI?",
  "How does machine learning work?",
  "Explain quantum computing",
  "Best practices for React development",
  "Tell me about TypeScript benefits",
  "How to optimize database queries?",
  "What is the difference between SQL and NoSQL?",
  "Explain cloud computing basics",
]

const mockResponses = [
  "That's a great question! Let me help you understand this concept better. The key thing to remember is that proper implementation requires careful consideration of the underlying principles and best practices in the field.",
  "I'd be happy to explain this topic in detail. From my understanding, there are several important factors to consider when approaching this problem. Let me break it down step by step for you.",
  "This is an interesting topic that comes up frequently. The solution typically involves understanding the core concepts and applying them in the right context. Here's what I recommend...",
  "Great choice of topic! This is something that many developers encounter. The approach I'd suggest is to start with the fundamentals and then build up to more complex scenarios.",
  "That's definitely worth exploring. From what I can see, the best way to handle this is to consider both the theoretical aspects and practical implementation details.",
]

export function ChatbotDemo() {
  const [model, setModel] = useState<string>(models[0].id)
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [text, setText] = useState<string>("")
  const [useWebSearch, setUseWebSearch] = useState<boolean>(false)
  const [useMicrophone, setUseMicrophone] = useState<boolean>(false)
  const [status, setStatus] = useState<"submitted" | "streaming" | "ready" | "error">("ready")
  const [messages, setMessages] = useState<ChatWindowMessage[]>(initialMessages)
  const [_streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  const stickyRef = useRef<HTMLDivElement>(null)
  const [stickyHeight, setStickyHeight] = useState(0)

  const selectedModelData = models.find((m) => m.id === model)

  const streamResponse = useCallback(async (messageId: string, content: string) => {
    setStatus("streaming")
    setStreamingMessageId(messageId)

    const words = content.split(" ")
    let currentContent = ""

    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? " " : "") + words[i]

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.versions.some((v) => v.id === messageId)) {
            return {
              ...msg,
              versions: msg.versions.map((v) =>
                v.id === messageId ? { ...v, content: currentContent } : v
              ),
            }
          }
          return msg
        })
      )

      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100 + 50))
    }

    setStatus("ready")
    setStreamingMessageId(null)
  }, [])

  const addUserMessage = useCallback(
    (content: string) => {
      const userMessage: ChatWindowMessage = {
        key: `user-${Date.now()}`,
        from: "user",
        versions: [
          {
            id: `user-${Date.now()}`,
            content,
          },
        ],
      }

      setMessages((prev) => [...prev, userMessage])

      setTimeout(() => {
        const assistantMessageId = `assistant-${Date.now()}`
        const randomResponse = mockResponses[Math.floor(Math.random() * mockResponses.length)]

        const assistantMessage: ChatWindowMessage = {
          key: `assistant-${Date.now()}`,
          from: "assistant",
          versions: [
            {
              id: assistantMessageId,
              content: "",
            },
          ],
        }

        setMessages((prev) => [...prev, assistantMessage])
        streamResponse(assistantMessageId, randomResponse)
      }, 500)
    },
    [streamResponse]
  )

  const handleSubmit = (message: PromptInputMessage) => {
    const hasText = Boolean(message.text)
    const hasAttachments = Boolean(message.files?.length)

    if (!(hasText || hasAttachments)) {
      return
    }

    setStatus("submitted")

    if (message.files?.length) {
      toast.success("Files attached", {
        description: `${message.files.length} file(s) attached to message`,
      })
    }

    addUserMessage(message.text || "Sent with attachments")
    setText("")
  }

  const handleSuggestionClick = (suggestion: string) => {
    setStatus("submitted")
    addUserMessage(suggestion)
  }

  useLayoutEffect(() => {
    const measure = () => {
      const h = stickyRef.current?.offsetHeight ?? 0
      setStickyHeight(h)
    }

    measure()
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [messages])

  // Auto-scrolling is always enabled; rely on StickToBottom default behavior.
  // Auto-scrolling is always enabled; rely on StickToBottom default behavior.

  const chat = (
    <ChatWindow
      messages={messages}
      models={models}
      suggestions={suggestions}
      stickyHeight={stickyHeight}
      stickyRef={stickyRef}
      text={text}
      status={status}
      useWebSearch={useWebSearch}
      useMicrophone={useMicrophone}
      model={model}
      modelSelectorOpen={modelSelectorOpen}
      selectedModelData={selectedModelData}
      onSuggestionClick={handleSuggestionClick}
      onSubmit={handleSubmit}
      onTextChange={(value) => setText(value)}
      onToggleWebSearch={() => setUseWebSearch(!useWebSearch)}
      onToggleMicrophone={() => setUseMicrophone(!useMicrophone)}
      onSelectModel={(id) => setModel(id)}
      onModelSelectorOpenChange={setModelSelectorOpen}
    />
  )

  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      {!modalOpen && chat}

      <Button
        className="fixed right-6 bottom-6 z-50 shadow-lg"
        size="icon"
        variant="default"
        onClick={() => setModalOpen(true)}
        aria-label="Open Chat"
      >
        <MessageCircle />
      </Button>

      <DraggableDialog open={modalOpen} onOpenChange={setModalOpen} title={"Skunkworx Chat"}>
        {chat}
      </DraggableDialog>
    </>
  )
}

export default ChatbotDemo

