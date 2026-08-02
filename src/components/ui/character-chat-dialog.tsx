"use client"

import * as React from "react"
import { X } from "@/components/icons"
import { FaCog, FaTimes } from "react-icons/fa"
import { cn } from "@/lib/utils"
import type { CustomChatMessage } from "@/components/ai/custom-chat-window"

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
  textOptions?: TextOptions
  onTextOptionsChange?: (options: TextOptions) => void
}

export type TextOptions = {
  font: string
  fontSize: number
  textColor: string
  bgColor: string
}

const DEFAULT_TEXT_OPTIONS: TextOptions = {
  font: 'system',
  fontSize: 14,
  textColor: '#ffffff',
  bgColor: 'transparent',
}

function resolveFontFamily(font?: string): string {
  switch (font) {
    case 'serif':
      return 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
    case 'mono':
      return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    case 'cursive':
      return 'cursive';
    case 'mrs':
      return '"Mrs Saint Delafield", cursive';
    case 'satisfy':
      return 'Satisfy, cursive';
    case 'crafty':
      return '"Crafty Girls", cursive';
    default:
      return 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  }
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
  textOptions = DEFAULT_TEXT_OPTIONS,
  onTextOptionsChange,
}: CharacterChatDialogProps) {
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null)
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)
  const [showSettings, setShowSettings] = React.useState(false)
  const draggingRef = React.useRef<{ startX: number; startY: number; left: number; top: number } | null>(null)
  const resizingRef = React.useRef<{ startX: number; startY: number; width: number; height: number } | null>(null)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)

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
    // Don't start drag if clicking a button inside the header
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && input.trim()) {
        onSend()
      }
    }
  }

  const activeBorderColor = isActive ? 'border-l-4 border-l-cyan-400' : ''

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
          {/* Avatar */}
          {avatarUrl && (
            <img src={avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
          )}
          {/* Click area for activation */}
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
        {isActive && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setShowSettings(true);
            }}
            className="absolute top-1 right-1 z-10 h-6 w-6 flex items-center justify-center rounded-full bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-white/20"
            aria-label="Text settings"
            title="Text settings"
          >
            <FaCog className="h-3 w-3" />
          </button>
        )}

        {messages.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm py-8">
            {isActive ? "Type a message to start the conversation..." : "Waiting for other characters..."}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "rounded-lg px-3 py-2 max-w-[85%]",
                msg.from === 'user'
                  ? "ml-auto"
                  : "mr-auto"
              )}
              style={{
                fontFamily: resolveFontFamily(textOptions.font),
                fontSize: `${textOptions.fontSize}px`,
                color: textOptions.textColor,
                backgroundColor: textOptions.bgColor,
              }}
            >
              <div className="text-xs opacity-60 mb-0.5">{msg.from === 'user' ? characterName : 'AI'}</div>
              <div className="whitespace-pre-wrap break-words">{msg.text}</div>
            </div>
          ))
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && isActive && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-64 rounded-lg bg-zinc-900 border border-zinc-700 p-4 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-200">Text Format</span>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-zinc-400 hover:text-white"
              >
                <FaTimes className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400">Font</label>
              <select
                value={textOptions.font}
                onChange={(e) => onTextOptionsChange?.({ ...textOptions, font: e.target.value })}
                className="w-full px-2 py-1 text-xs rounded bg-zinc-800 text-white border border-zinc-600"
              >
                <option value="system">System Sans</option>
                <option value="serif">Serif</option>
                <option value="mono">Monospace</option>
                <option value="cursive">Cursive</option>
                <option value="mrs">Mrs Saint Delafield</option>
                <option value="satisfy">Satisfy</option>
                <option value="crafty">Crafty Girls</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400">Size: {textOptions.fontSize}px</label>
              <input
                type="range"
                min={10}
                max={32}
                value={textOptions.fontSize}
                onChange={(e) => onTextOptionsChange?.({ ...textOptions, fontSize: Number(e.target.value) })}
                className="w-full"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400">Text Color</label>
              <div className="flex gap-1 flex-wrap">
                {['#ffffff', '#000000', '#ff5555', '#55ff55', '#5555ff', '#ffff55', '#ff55ff', '#55ffff'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onTextOptionsChange?.({ ...textOptions, textColor: c })}
                    className={cn(
                      "w-6 h-6 rounded border-2",
                      textOptions.textColor === c ? "border-cyan-400" : "border-zinc-600"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Text color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400">Background</label>
              <div className="flex gap-1 flex-wrap">
                {['transparent', '#000000', '#1f2937', '#374151', '#7c3aed', '#dc2626', '#059669'].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onTextOptionsChange?.({ ...textOptions, bgColor: c })}
                    className={cn(
                      "w-6 h-6 rounded border-2",
                      textOptions.bgColor === c ? "border-cyan-400" : "border-zinc-600",
                      c === 'transparent' && "bg-[linear-gradient(45deg,#ccc_25%,transparent_25%,transparent_75%,#ccc_75%)]"
                    )}
                    style={c !== 'transparent' ? { backgroundColor: c } : {}}
                    aria-label={`Background ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-700">
              <p className="text-[10px] text-zinc-500">Changes apply to messages in this dialog.</p>
            </div>
          </div>
        </div>
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
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Speak as ${characterName}...`}
              disabled={disabled}
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
