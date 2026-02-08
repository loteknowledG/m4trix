"use client"

import type { ToolUIPart } from "ai"
import type { SetStateAction, RefObject } from "react"
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai/conversation"
import {
  Message,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
} from "@/components/ai/message"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorLogoGroup,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai/model-selector"
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai/prompt-input"
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai/reasoning"
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai/sources"
import { Suggestion, Suggestions } from "@/components/ai/suggestion"
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai/attachments"
import { CheckIcon, GlobeIcon, MicIcon } from "lucide-react"

export interface ChatWindowMessage {
  key: string
  from: "user" | "assistant"
  sources?: { href: string; title: string }[]
  versions: {
    id: string
    content: string
  }[]
  reasoning?: {
    content: string
    duration: number
  }
  tools?: {
    name: string
    description: string
    status: ToolUIPart["state"]
    parameters: Record<string, unknown>
    result: string | undefined
    error: string | undefined
  }[]
}

export interface ChatWindowModel {
  id: string
  name: string
  chef: string
  chefSlug: string
  providers: string[]
}

const PromptInputAttachmentsDisplay = () => {
  const attachments = usePromptInputAttachments()

  if (attachments.files.length === 0) {
    return null
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  )
}

export type ChatWindowProps = {
  messages: ChatWindowMessage[]
  models: ChatWindowModel[]
  suggestions: string[]
  stickyHeight: number
  stickyRef: RefObject<HTMLDivElement>
  text: string
  status: "submitted" | "streaming" | "ready" | "error"
  useWebSearch: boolean
  useMicrophone: boolean
  model: string
  modelSelectorOpen: boolean
  selectedModelData: ChatWindowModel | undefined
  onSuggestionClick: (suggestion: string) => void
  onSubmit: (message: PromptInputMessage) => void
  onTextChange: (value: string) => void
  onToggleWebSearch: () => void
  onToggleMicrophone: () => void
  onSelectModel: (id: string) => void
  onModelSelectorOpenChange: (open: boolean) => void
  showInput?: boolean
  showSuggestions?: boolean
}

export function ChatWindow({
  messages,
  models,
  suggestions,
  stickyHeight,
  stickyRef,
  text,
  status,
  useWebSearch,
  useMicrophone,
  model,
  modelSelectorOpen,
  selectedModelData,
  onSuggestionClick,
  onSubmit,
  onTextChange,
  onToggleWebSearch,
  onToggleMicrophone,
  onSelectModel,
  onModelSelectorOpenChange,
  showInput = true,
  showSuggestions = true,
}: ChatWindowProps) {

  return (
    <div className="flex-1 flex flex-col min-h-0 h-full overflow-hidden">
      <Conversation style={{ height: `calc(100% - ${stickyHeight}px)` }} className="min-h-0 border-b">
        <ConversationContent className="min-h-0">
          {messages.map(({ versions, ...message }) => (
            <MessageBranch defaultBranch={0} key={message.key}>
              <MessageBranchContent>
                {versions.map((version) => (
                  <Message from={message.from} key={`${message.key}-${version.id}`}>
                    <div>
                      {message.sources?.length && (
                        <Sources>
                          <SourcesTrigger count={message.sources.length} />
                          <SourcesContent>
                            {message.sources.map((source) => (
                              <Source href={source.href} key={source.href} title={source.title} />
                            ))}
                          </SourcesContent>
                        </Sources>
                      )}
                      {message.reasoning && (
                        <Reasoning duration={message.reasoning.duration}>
                          <ReasoningTrigger />
                          <ReasoningContent>{message.reasoning.content}</ReasoningContent>
                        </Reasoning>
                      )}
                      <MessageContent>
                        <MessageResponse>{version.content}</MessageResponse>
                      </MessageContent>
                    </div>
                  </Message>
                ))}
              </MessageBranchContent>
              {versions.length > 1 && (
                <MessageBranchSelector from={message.from}>
                  <MessageBranchPrevious />
                  <MessageBranchPage />
                  <MessageBranchNext />
                </MessageBranchSelector>
              )}
            </MessageBranch>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      {((showSuggestions && suggestions.length > 0) || showInput) && (
        <div
          ref={stickyRef}
          className="sticky bottom-0 z-20 bg-zinc-900/95 backdrop-blur-sm shrink-0 space-y-4 pt-4"
        >
          {showSuggestions && suggestions.length > 0 && (
            <Suggestions className="px-4">
              {suggestions.map((suggestion) => (
                <Suggestion
                  key={suggestion}
                  onClick={() => onSuggestionClick(suggestion)}
                  suggestion={suggestion}
                />
              ))}
            </Suggestions>
          )}
          {showInput && (
            <div className="w-full px-4 pb-4">
              <PromptInput globalDrop multiple onSubmit={onSubmit}>
                <PromptInputHeader>
                  <PromptInputAttachmentsDisplay />
                </PromptInputHeader>
                <PromptInputBody>
                  <PromptInputTextarea
                    onChange={(event: { target: { value: SetStateAction<string> } }) =>
                      onTextChange(event.target.value as string)
                    }
                    value={text}
                  />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputTools>
                    {/* Autoscroll always enabled; toggle removed */}
                    <PromptInputActionMenu>
                      <PromptInputActionMenuTrigger />
                      <PromptInputActionMenuContent>
                        <PromptInputActionAddAttachments />
                      </PromptInputActionMenuContent>
                    </PromptInputActionMenu>
                    <PromptInputButton onClick={onToggleMicrophone} variant={useMicrophone ? "default" : "ghost"}>
                      <MicIcon size={16} />
                      <span className="sr-only">Microphone</span>
                    </PromptInputButton>
                    <PromptInputButton onClick={onToggleWebSearch} variant={useWebSearch ? "default" : "ghost"}>
                      <GlobeIcon size={16} />
                      <span>Search</span>
                    </PromptInputButton>
                    <ModelSelector onOpenChange={onModelSelectorOpenChange} open={modelSelectorOpen}>
                      <ModelSelectorTrigger asChild>
                        <PromptInputButton>
                          {selectedModelData?.chefSlug && (
                            <ModelSelectorLogo provider={selectedModelData.chefSlug} />
                          )}
                          {selectedModelData?.name && (
                            <ModelSelectorName>{selectedModelData.name}</ModelSelectorName>
                          )}
                        </PromptInputButton>
                      </ModelSelectorTrigger>
                      <ModelSelectorContent>
                        <ModelSelectorInput placeholder="Search models..." />
                        <ModelSelectorList>
                          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                          {["OpenAI", "Anthropic", "Google"].map((chef) => (
                            <ModelSelectorGroup heading={chef} key={chef}>
                              {models
                                .filter((m) => m.chef === chef)
                                .map((m) => (
                                  <ModelSelectorItem
                                    key={m.id}
                                    onSelect={() => {
                                      onSelectModel(m.id)
                                      onModelSelectorOpenChange(false)
                                    }}
                                    value={m.id}
                                  >
                                    <ModelSelectorLogo provider={m.chefSlug} />
                                    <ModelSelectorName>{m.name}</ModelSelectorName>
                                    <ModelSelectorLogoGroup>
                                      {m.providers.map((provider) => (
                                        <ModelSelectorLogo key={provider} provider={provider} />
                                      ))}
                                    </ModelSelectorLogoGroup>
                                    {model === m.id ? (
                                      <CheckIcon className="ml-auto size-4" />
                                    ) : (
                                      <div className="ml-auto size-4" />
                                    )}
                                  </ModelSelectorItem>
                                ))}
                            </ModelSelectorGroup>
                          ))}
                        </ModelSelectorList>
                      </ModelSelectorContent>
                    </ModelSelector>
                  </PromptInputTools>
                  <PromptInputSubmit
                    disabled={!(text.trim() || status) || status === "streaming"}
                    status={status}
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
