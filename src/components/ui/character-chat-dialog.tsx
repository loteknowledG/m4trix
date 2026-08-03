"use client"

import * as React from "react"
import { X } from "@/components/icons"
import { VideoCueTextEffectView } from "@/components/text/video-cue-text-effect-view"
import { cn } from "@/lib/utils"
import type { CustomChatMessage } from "@/components/ai/custom-chat-window"
import {
  characterDialogFontSize,
  resolveCharacterDialogStyle,
  type CharacterDialogStyle,
} from "@/lib/character-dialog-style"
import type { CharacterTtsVoice } from "@/lib/character-tts-profile"
import { speakWithCharacterTtsVoice } from "@/lib/tts"
import { videoCueTextEffectsKey } from "@/lib/video-cue-text-effects"
import {
  buildCueTextShadow,
  resolveVideoCueFontFamily,
} from "@/lib/video-timed-cues"

type CharacterChatDialogProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title?: React.ReactNode
  characterName: string
  avatarUrl?: string
  messages: CustomChatMessage[]
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onEditMessage?: (id: string, text: string) => void
  onSteerMessage?: (id: string, text: string) => void
  disabled?: boolean
  isActive?: boolean
  onActivate?: () => void
  className?: string
  style?: React.CSSProperties
  playerMode?: 'say' | 'do' | 'think'
  onPlayerModeChange?: (mode: 'say' | 'do' | 'think') => void
  dialogStyle?: CharacterDialogStyle
  /** Style for incoming agent lines (the other character speaking in this panel). */
  agentDialogStyle?: CharacterDialogStyle
  ttsVoice?: CharacterTtsVoice
  /** Voice for incoming agent lines in this panel. */
  agentTtsVoice?: CharacterTtsVoice
  /** Twitter-style character cap for the input (shown with counter). */
  inputMaxLength?: number
}

const PANEL_STORAGE_KEY = 'm4trix:game-panel-state'

function loadPanelState(characterName: string): { left: number; top: number; width: number; height: number } | null {
  try {
    const stored = localStorage.getItem(PANEL_STORAGE_KEY)
    if (stored) {
      const all = JSON.parse(stored)
      return all[characterName] || null
    }
  } catch { /* ignore */ }
  return null
}

function savePanelState(characterName: string, state: { left: number; top: number; width: number; height: number }) {
  try {
    const stored = localStorage.getItem(PANEL_STORAGE_KEY)
    const all = stored ? JSON.parse(stored) : {}
    all[characterName] = state
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

export function CharacterChatDialog({
  open = true,
  onOpenChange,
  title,
  characterName,
  avatarUrl,
  messages,
  input,
  onInputChange,
  onSend,
  onEditMessage,
  onSteerMessage,
  disabled = false,
  isActive = false,
  onActivate,
  className,
  style,
  playerMode = 'say',
  onPlayerModeChange,
  dialogStyle,
  agentDialogStyle,
  ttsVoice,
  agentTtsVoice,
  inputMaxLength,
}: CharacterChatDialogProps) {
  const resolvedPanelStyle = resolveCharacterDialogStyle(dialogStyle)
  const resolvedAgentPanelStyle = resolveCharacterDialogStyle(agentDialogStyle ?? dialogStyle)
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null)
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)
  const draggingRef = React.useRef<{ startX: number; startY: number; left: number; top: number } | null>(null)
  const resizingRef = React.useRef<{ startX: number; startY: number; width: number; height: number } | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const lastSpokenIdRef = React.useRef<string | null>(null)
  const speakTimerRef = React.useRef<number | null>(null)
  const speakSequenceRef = React.useRef(0)

  const DEFAULT_WIDTH = 360
  const DEFAULT_HEIGHT = 480
  const MIN_WIDTH = 280
  const MIN_HEIGHT = 150

  React.useEffect(() => {
    if (!open) return
    const saved = loadPanelState(characterName)
    if (saved) {
      setPos({ left: saved.left, top: saved.top })
      setSize({ width: saved.width, height: saved.height })
    } else {
      const idx = ['protagonist', 'antagonist', 'narrator'].indexOf(characterName)
      const offsetX = idx * 30
      const offsetY = idx * 30
      setPos({
        left: Math.max(48, (window.innerWidth - DEFAULT_WIDTH) / 2 + offsetX),
        top: Math.max(48, (window.innerHeight - DEFAULT_HEIGHT) / 2 + offsetY)
      })
      setSize({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
    }
  }, [open, characterName])

  React.useEffect(() => {
    if (pos && size) {
      savePanelState(characterName, { ...pos, ...size })
    }
  }, [pos, size, characterName])

  React.useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - draggingRef.current.startX
      const dy = e.clientY - draggingRef.current.startY
      const newLeft = Math.max(0, Math.min(draggingRef.current.left + dx, window.innerWidth - 100))
      const newTop = Math.max(0, Math.min(draggingRef.current.top + dy, window.innerHeight - 100))
      setPos({ left: newLeft, top: newTop })
    }
    const handleUp = () => {
      draggingRef.current = null
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [])

  React.useEffect(() => {
    const handleResizeMove = (e: PointerEvent) => {
      if (!resizingRef.current) return
      const dx = e.clientX - resizingRef.current.startX
      const dy = e.clientY - resizingRef.current.startY
      const newWidth = Math.max(MIN_WIDTH, resizingRef.current.width + dx)
      const newHeight = Math.max(MIN_HEIGHT, resizingRef.current.height + dy)
      const maxW = Math.floor(window.innerWidth * 0.95)
      const maxH = Math.floor(window.innerHeight * 0.95)
      setSize({ width: Math.min(newWidth, maxW), height: Math.min(newHeight, maxH) })
    }
    const handleResizeUp = () => {
      resizingRef.current = null
    }
    window.addEventListener("pointermove", handleResizeMove)
    window.addEventListener("pointerup", handleResizeUp)
    return () => {
      window.removeEventListener("pointermove", handleResizeMove)
      window.removeEventListener("pointerup", handleResizeUp)
    }
  }, [])

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    if (target.closest('textarea, input')) return;

    e.preventDefault();
    const el = (e.currentTarget as HTMLElement).closest("[data-dialog-content]") as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      left: rect.left,
      top: rect.top,
    };
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest("[data-dialog-content]") as HTMLElement | null
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    resizingRef.current = { startX: e.clientX, startY: e.clientY, width: rect.width, height: rect.height }
    e.stopPropagation()
  }

  const handleInputChange = (value: string) => {
    if (inputMaxLength != null && value.length > inputMaxLength) {
      onInputChange(value.slice(0, inputMaxLength))
      return
    }
    onInputChange(value)
  }

  const inputLength = input.length
  const inputNearLimit =
    inputMaxLength != null && inputLength >= Math.max(0, inputMaxLength - 20)
  const inputOverLimit = inputMaxLength != null && inputLength >= inputMaxLength

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && input.trim()) {
        onSend()
      }
    }
  }

  const activeBorderColor = isActive ? 'border-l-4 border-l-cyan-400' : ''

  const latestSpeakableMessage = [...messages]
    .reverse()
    .find(
      (msg) =>
        (msg.from === "user" || msg.from === "agent") &&
        !msg.id.startsWith("pending-") &&
        !msg.id.startsWith("streaming-") &&
        msg.text.trim() &&
        msg.text.trim() !== "…",
    )

  React.useEffect(() => {
    if (!latestSpeakableMessage) return

    if (speakTimerRef.current) {
      window.clearTimeout(speakTimerRef.current)
      speakTimerRef.current = null
    }

    if (latestSpeakableMessage.id === lastSpokenIdRef.current) return

    const sequence = ++speakSequenceRef.current
    speakTimerRef.current = window.setTimeout(() => {
      if (sequence !== speakSequenceRef.current) return
      const speechText = latestSpeakableMessage.text.trim()
      if (!speechText || speechText === "…") return

      lastSpokenIdRef.current = latestSpeakableMessage.id
      const messageVoice =
        latestSpeakableMessage.from === "user"
          ? latestSpeakableMessage.ttsVoice ?? ttsVoice
          : latestSpeakableMessage.ttsVoice ?? agentTtsVoice ?? ttsVoice
      const legacyProfile = latestSpeakableMessage.ttsVoice?.profileId
        ? undefined
        : latestSpeakableMessage.ttsProfile
      void speakWithCharacterTtsVoice(
        speechText,
        messageVoice ?? undefined,
        legacyProfile,
        { allowFallback: true },
      )
    }, 350)

    return () => {
      if (speakTimerRef.current) {
        window.clearTimeout(speakTimerRef.current)
        speakTimerRef.current = null
      }
    }
  }, [
    agentTtsVoice,
    latestSpeakableMessage?.from,
    latestSpeakableMessage?.id,
    latestSpeakableMessage?.text,
    messages,
    ttsVoice,
  ])

  const resolveMessageStyle = (msg: CustomChatMessage) => {
    if (msg.dialogStyle) return resolveCharacterDialogStyle(msg.dialogStyle)
    return msg.from === 'agent' ? resolvedAgentPanelStyle : resolvedPanelStyle
  }

  if (!open) return null

  return (
    <div
      data-dialog-content
      className={cn(
        "fixed z-50 flex flex-col bg-transparent border border-zinc-700/50 shadow-2xl overflow-hidden rounded-lg backdrop-blur-sm",
        "backdrop-blur-sm",
        activeBorderColor,
        className
      )}
      style={
        pos && size
          ? {
              left: pos.left,
              top: pos.top,
              width: size.width,
              height: size.height,
              ...style,
            }
          : {
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: DEFAULT_WIDTH,
              height: DEFAULT_HEIGHT,
              ...style,
            }
      }
    >
      {/* Title bar */}
      <div
        className={cn(
          "flex items-center justify-between bg-transparent px-3 py-2 select-none shrink-0 backdrop-blur-sm border-b border-zinc-700/30",
          isActive ? "border-b border-cyan-400/30" : ""
        )}
      >
        <div
          className="flex items-center gap-2 min-w-0 flex-1 cursor-grab"
          onMouseDown={handleHeaderMouseDown}
        >
          {avatarUrl && (
            <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
          )}
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onActivate?.();
            }}
            className={cn(
              "flex items-center gap-2 px-2 py-1 rounded text-xs shrink-0 cursor-pointer hover:bg-zinc-700/50 transition-colors",
              isActive ? "bg-cyan-500/20 text-cyan-400" : "bg-zinc-700/50 text-zinc-400"
            )}
          >
            <span className={cn("text-sm font-medium", isActive ? "text-cyan-400" : "text-zinc-200")}>
              {characterName}
            </span>
            {isActive ? (
              <span>Message Mode</span>
            ) : (
              <span>Read Mode</span>
            )}
          </button>
        </div>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => onOpenChange?.(false)}
          className="rounded-md p-1 hover:bg-zinc-700/60 shrink-0"
        >
          <X className="h-3.5 w-3.5 text-zinc-400" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 relative">
        {messages.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm py-8">
            {isActive ? "Type a message to start the conversation..." : "Waiting for other characters..."}
          </div>
        ) : (
          messages.map((msg) => {
            const messageStyle = resolveMessageStyle(msg)
            const messageFontSize = characterDialogFontSize(messageStyle.fontScale, true)
            const speakerColor =
              messageStyle.speakerColor ??
              (characterName === 'Narrator' ? '#fcd34d' : '#7dd3fc')
            const speakerLabel =
              msg.name?.trim() ||
              (msg.from === 'user' ? characterName : 'AI')

            return (
            <div
              key={msg.id}
              className={cn(
                "rounded-lg px-3 py-2 max-w-[85%]",
                msg.from === 'user'
                  ? "ml-auto"
                  : "mr-auto"
              )}
            >
              <div
                className="text-xs font-bold uppercase tracking-wide mb-0.5 opacity-90"
                style={{
                  color: speakerColor,
                  textShadow: buildCueTextShadow(messageStyle.shadowColor),
                }}
              >
                {speakerLabel}
              </div>
              <div
                className="whitespace-pre-wrap break-words leading-relaxed"
                style={{
                  fontFamily: resolveVideoCueFontFamily(messageStyle.font),
                  fontSize: messageFontSize,
                  color: messageStyle.color,
                  textShadow: buildCueTextShadow(messageStyle.shadowColor),
                }}
              >
                <VideoCueTextEffectView
                  key={videoCueTextEffectsKey(messageStyle.textEffects)}
                  text={msg.text}
                  effects={messageStyle.textEffects}
                />
              </div>
            </div>
            )
          })
        )}
      </div>

      {/* Input area - only show if active */}
      {isActive && (
        <div className="shrink-0 border-t border-zinc-700/50 p-2">
          <div className="flex gap-1 mb-2">
            {(['say', 'do', 'think'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onPlayerModeChange?.(mode)}
                className={cn(
                  "text-xs px-2 py-1 rounded capitalize",
                  playerMode === mode
                    ? "bg-cyan-600 text-white"
                    : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                inputMaxLength != null
                  ? `Speak as ${characterName} (max ${inputMaxLength} chars)...`
                  : `Speak as ${characterName}...`
              }
              disabled={disabled}
              maxLength={inputMaxLength}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-cyan-500 disabled:opacity-50"
              rows={2}
            />
            <button
              onClick={onSend}
              disabled={disabled || !input.trim()}
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded text-sm font-medium shrink-0"
            >
              Send
            </button>
          </div>
          {inputMaxLength != null ? (
            <div
              className={cn(
                "mt-1 text-right text-[10px] tabular-nums",
                inputOverLimit
                  ? "text-red-400"
                  : inputNearLimit
                    ? "text-amber-400"
                    : "text-zinc-500",
              )}
              aria-live="polite"
            >
              {inputLength}/{inputMaxLength}
            </div>
          ) : null}
        </div>
      )}

      {/* Resize grip */}
      <div
        className="absolute right-1 bottom-1 h-4 w-4 cursor-se-resize text-zinc-600 hover:text-zinc-400 flex items-center justify-center text-xs font-bold"
        onPointerDown={handleResizePointerDown}
        aria-hidden
      >
        ⋮
      </div>
    </div>
  )
}

export default CharacterChatDialog
