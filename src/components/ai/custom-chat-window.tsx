import React, { useRef, useEffect } from 'react';
import { FaCompass } from 'react-icons/fa';
import { FaArrowRight } from 'react-icons/fa6';
import { FiVolume2, FiVolumeX } from 'react-icons/fi';
import { MdOutlineEditNote } from 'react-icons/md';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConnectionSheet } from '@/components/connection-sheet';
import { speakWithJennyVoice } from '@/lib/tts';
import { cn } from '@/lib/utils';

/** Identical square footprint for chat footer voice + send (border-box). */
const CHAT_FOOTER_ICON_BOX: React.CSSProperties = {
  boxSizing: 'border-box',
  width: '2.5rem',
  height: '2.5rem',
  minWidth: '2.5rem',
  maxWidth: '2.5rem',
  minHeight: '2.5rem',
  maxHeight: '2.5rem',
};

const chatFooterIconLayoutClass =
  'inline-flex shrink-0 flex-none items-center justify-center gap-0 rounded-md p-0 [&_svg]:size-4 [&_svg]:shrink-0';

export interface CustomChatMessage {
  id: string;
  from: 'user' | 'agent';
  text: string;
  name?: string;
  avatarUrl?: string;
  details?: string[];
}

interface CustomChatWindowProps {
  messages: CustomChatMessage[];
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onEditMessage?: (messageId: string, nextText: string) => void;
  onMessageEdited?: (messageId: string, nextText: string) => void;
  onSteerMessage?: (messageId: string, nextText: string) => void;
  onContinueMessage?: (messageId: string) => void;
  steerInstruction?: string;
  disabled?: boolean;
  // Optional icon to use for the send button (renders an icon button when provided)
  sendIcon?: React.ReactNode;
  sendIconAriaLabel?: string;
  // When provided, renders a connection icon + model label on the left side of the send row.
  connected?: boolean;
  connectionModel?: string | null;
  // Optional compact prompter-mode selector (no visible label) rendered above the send control
  prompterMode?: 'tell' | 'do' | 'think';
  onPrompterModeChange?: (v: 'tell' | 'do' | 'think') => void;
  ttsProfile?: string;
  /** Visual-novel overlay: dialogue sits on the scene instead of a side panel. */
  variant?: 'default' | 'visualNovel';
}

export const CustomChatWindow: React.FC<CustomChatWindowProps> = ({
  messages,
  input,
  onInputChange,
  onSend,
  onEditMessage,
  onMessageEdited,
  onSteerMessage,
  onContinueMessage,
  steerInstruction,
  disabled,
  sendIcon,
  sendIconAriaLabel,
  connected,
  connectionModel,
  prompterMode,
  onPrompterModeChange,
  ttsProfile: _ttsProfile,
  variant = 'default',
}) => {
  const isVn = variant === 'visualNovel';
  const speakText = async (text: string) => {
    await speakWithJennyVoice(text);
  };

  const outerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  // textarea for user input
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const steerTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const bubbleRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [voiceEnabled, setVoiceEnabled] = React.useState(true);
  const [storyDetailsOpen, setStoryDetailsOpen] = React.useState(false);

  const lastSpokenIdRef = useRef<string | null>(null);
  const speakTimerRef = useRef<number | null>(null);
  const speakSequenceRef = useRef(0);
  const wasInputDisabledRef = useRef(false);
  const storyOpeningMessage = messages.find((msg) => msg.id === 'story-opening');
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState('');
  const [editingBubbleHeight, setEditingBubbleHeight] = React.useState<number | null>(null);
  const [steeringMessageId, setSteeringMessageId] = React.useState<string | null>(null);
  const [steeringText, setSteeringText] = React.useState('');
  const isPendingAgentMessage = (msg: CustomChatMessage) =>
    msg.id.startsWith('pending-') || /^Working on that request\b/i.test(msg.text.trim());
  const latestAgentMessage = [...messages]
    .reverse()
    .find((msg) => msg.from === 'agent' && msg.id !== 'story-opening' && !isPendingAgentMessage(msg));

  const textForSpeech = (value: string) => {
    const raw = typeof value === 'string' ? value : '';
    if (!raw.trim()) return '';
    if (typeof document === 'undefined') {
      return raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    const container = document.createElement('div');
    container.innerHTML = raw;
    return (container.textContent || '').replace(/\u00a0/g, ' ').trim();
  };

  // keep list scrolled to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!voiceEnabled) return;
    if (!messages || messages.length === 0) return;

    if (speakTimerRef.current) {
      window.clearTimeout(speakTimerRef.current);
      speakTimerRef.current = null;
    }

    const latest = latestAgentMessage;
    if (!latest) return;
    if (latest.id === lastSpokenIdRef.current) return;
    if (latest.id.startsWith('pending-') || latest.id.startsWith('streaming-')) return;
    if (/^Working on that request\b/i.test(latest.text.trim())) return;

    const sequence = ++speakSequenceRef.current;
    speakTimerRef.current = window.setTimeout(() => {
      if (sequence !== speakSequenceRef.current) return;

      const currentLatest = [...messages]
        .reverse()
        .find((msg) => msg.from === 'agent' && msg.id !== 'story-opening' && !isPendingAgentMessage(msg));
      if (!currentLatest || currentLatest.id !== latest.id) return;

      const speechText = textForSpeech(currentLatest.text);
      if (!speechText) return;

      lastSpokenIdRef.current = currentLatest.id;
      void speakText(speechText);
    }, 350);

    return () => {
      if (speakTimerRef.current) {
        window.clearTimeout(speakTimerRef.current);
        speakTimerRef.current = null;
      }
    };
  }, [latestAgentMessage?.id, latestAgentMessage?.text, messages, voiceEnabled]);

  useEffect(() => {
    if (voiceEnabled || typeof window === 'undefined') return;
    if (typeof window.speechSynthesis === 'undefined') return;
    window.speechSynthesis.cancel();
  }, [voiceEnabled]);

  // Restore focus only after a submit/work cycle re-enables the input — not on mount,
  // or focus steals from other fields and the caret feels "stuck" to the chat box.
  useEffect(() => {
    const isDisabled = Boolean(disabled);
    if (!isDisabled && wasInputDisabledRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
    wasInputDisabledRef.current = isDisabled;
  }, [disabled]);

  const handleSend = () => {
    onSend();
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  const beginEdit = (message: CustomChatMessage) => {
    const bubble = bubbleRefs.current[message.id];
    setEditingBubbleHeight(bubble?.offsetHeight ?? null);
    setEditingMessageId(message.id);
    setEditingText(message.text);
  };

  const beginSteer = (message: CustomChatMessage) => {
    const bubble = bubbleRefs.current[message.id];
    setEditingBubbleHeight(bubble?.offsetHeight ?? null);
    setSteeringMessageId(message.id);
    setSteeringText('');
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
    setEditingBubbleHeight(null);
  };

  const cancelSteer = () => {
    setSteeringMessageId(null);
    setSteeringText('');
    setEditingBubbleHeight(null);
  };

  const saveEdit = () => {
    if (!editingMessageId || !onEditMessage) {
      cancelEdit();
      return;
    }

    onEditMessage(editingMessageId, editingText);
    onMessageEdited?.(editingMessageId, editingText);
    cancelEdit();
  };

  const saveSteer = () => {
    if (!steeringMessageId || !onSteerMessage) {
      cancelSteer();
      return;
    }

    onSteerMessage(steeringMessageId, steeringText);
    cancelSteer();
  };

  useEffect(() => {
    if (!editingMessageId) return;
    requestAnimationFrame(() => {
      editTextareaRef.current?.focus();
      editTextareaRef.current?.setSelectionRange(
        editTextareaRef.current.value.length,
        editTextareaRef.current.value.length,
      );
    });
  }, [editingMessageId]);

  useEffect(() => {
    if (!steeringMessageId) return;
    requestAnimationFrame(() => {
      steerTextareaRef.current?.focus();
      steerTextareaRef.current?.setSelectionRange(
        steerTextareaRef.current.value.length,
        steerTextareaRef.current.value.length,
      );
    });
  }, [steeringMessageId]);

  // Message list is constrained by CSS grid (minmax(0,1fr)); no manual maxHeight needed.

  return (
    <div
      ref={outerRef}
      className={cn(
        'grid h-full min-h-0 w-full grid-rows-[minmax(0,1fr)_auto] overflow-hidden',
        isVn ? 'border-0' : 'border border-transparent',
      )}
    >
      <div
        ref={scrollRef}
        className={cn(
          'min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent',
          isVn ? 'bg-transparent' : 'bg-background/60 scrollbar-track-zinc-900',
        )}
        style={{ scrollbarGutter: 'stable' }}
      >
        <div className={cn(isVn ? 'space-y-4 px-1 py-2 sm:px-2' : 'space-y-6 p-6')}>
          {messages.length === 0 ? (
            <div
              className={cn(
                'text-center text-sm opacity-70',
                isVn ? 'py-4 text-white/70' : 'py-8 text-muted-foreground',
              )}
            >
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map(msg => {
              const speakerName =
                msg.name?.trim() ||
                (msg.from === 'user' ? 'You' : msg.id === 'story-opening' ? 'Story' : 'Narrator');

              return (
              <div
                key={msg.id}
                className={cn(
                  'flex w-full gap-3',
                  isVn
                    ? 'items-start justify-start'
                    : `items-end ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`,
                )}
              >
                <div
                  ref={(el) => {
                    bubbleRefs.current[msg.id] = el;
                  }}
                  className={cn(
                    'whitespace-pre-line text-sm',
                    isVn
                      ? cn(
                          'w-full px-0 py-0',
                          msg.id === 'story-opening'
                            ? 'text-amber-50/95'
                            : isPendingAgentMessage(msg)
                              ? 'text-zinc-200'
                              : msg.from === 'user'
                                ? 'text-white/90'
                                : 'text-white',
                        )
                      : cn(
                          'px-4 py-3',
                          msg.id === 'story-opening'
                            ? 'w-full rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-950/80 to-zinc-900/80 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_20px_45px_rgba(0,0,0,0.45)]'
                            : isPendingAgentMessage(msg)
                              ? 'mr-auto inline-flex max-w-[70%] items-center gap-2 rounded-2xl rounded-bl-none border border-zinc-700 bg-zinc-900/90 text-zinc-200 shadow'
                              : msg.from === 'user'
                                ? 'relative ml-auto inline-block max-w-[70%] rounded-2xl rounded-br-none border border-violet-500 bg-violet-700 text-right text-white shadow'
                                : 'mr-auto -ml-5 w-full max-w-[calc(100%+20px)] text-left text-muted-foreground',
                        ),
                  )}
                >
                  {isVn && msg.id !== 'story-opening' ? (
                    <div
                      className={cn(
                        'mb-1 text-sm font-bold uppercase tracking-wide',
                        msg.from === 'user' ? 'text-sky-300' : 'text-lime-400',
                      )}
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.85)' }}
                    >
                      {speakerName}
                    </div>
                  ) : null}
                  {msg.id === 'story-opening' ? (
                    <div className="space-y-2">
                      <div
                        className={cn(
                          'flex items-center gap-2 text-[11px] uppercase tracking-[0.22em]',
                          isVn ? 'font-bold text-lime-400' : 'text-amber-200/80',
                        )}
                      >
                        {!isVn ? (
                          <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
                        ) : null}
                        Story Opening
                      </div>
                      <div
                        className={cn(
                          'story-opening-html text-sm leading-6 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_li]:mb-1 [&_strong]:font-semibold [&_em]:italic',
                          isVn ? 'text-white/95' : 'text-amber-50/95',
                        )}
                        style={isVn ? { textShadow: '0 1px 2px rgba(0,0,0,0.75)' } : undefined}
                        dangerouslySetInnerHTML={{ __html: msg.text }}
                      />
                      {msg.details?.length ? (
                        <button
                          type="button"
                          onClick={() => setStoryDetailsOpen(true)}
                          className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-amber-100 transition-colors hover:bg-amber-400/20"
                        >
                          Story details
                        </button>
                      ) : null}
                    </div>
                  ) : isPendingAgentMessage(msg) ? (
                    <div className="flex items-center gap-3">
                      <span className={isVn ? 'text-white/85' : 'text-zinc-300'}>{msg.text}</span>
                      <span
                        className={cn(
                          'flex items-center gap-1.5',
                          isVn ? 'text-white/60' : 'text-zinc-400',
                        )}
                        aria-label="Loading"
                      >
                        <span
                          className="h-2 w-2 rounded-full bg-current animate-bounce"
                          style={{ animationDelay: '0ms', animationDuration: '1s' }}
                        />
                        <span
                          className="h-2 w-2 rounded-full bg-current animate-bounce"
                          style={{ animationDelay: '150ms', animationDuration: '1s' }}
                        />
                        <span
                          className="h-2 w-2 rounded-full bg-current animate-bounce"
                          style={{ animationDelay: '300ms', animationDuration: '1s' }}
                        />
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {editingMessageId === msg.id ? (
                        <textarea
                          ref={editTextareaRef}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          style={
                            editingBubbleHeight
                              ? { minHeight: `${editingBubbleHeight - 24}px` }
                              : undefined
                          }
                          className="w-full resize-none rounded-md border border-violet-500 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-400"
                        />
                      ) : (
                        <div
                          className={cn(isVn && 'leading-relaxed')}
                          style={
                            isVn ? { textShadow: '0 1px 2px rgba(0,0,0,0.75)' } : undefined
                          }
                        >
                          {msg.text}
                        </div>
                      )}
                      {msg.from === 'agent' &&
                      msg.id !== 'story-opening' &&
                      msg.id === latestAgentMessage?.id ? (
                        <div className="flex justify-end gap-2">
                          {editingMessageId === msg.id ? (
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={saveEdit}
                                className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                              <button
                                type="button"
                                onClick={() => beginEdit(msg)}
                                className={cn(
                                  'inline-flex h-8 w-8 items-center justify-center rounded-md border',
                                  isVn
                                    ? 'border-white/25 bg-black/35 text-white/80 hover:bg-black/55 hover:text-white'
                                    : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                                )}
                                aria-label="Edit response"
                                title="Edit response"
                              >
                                <MdOutlineEditNote className="h-4 w-4" />
                              </button>
                            )}
                          {steeringMessageId === msg.id ? (
                            <div className="w-full space-y-2">
                              <textarea
                                ref={steerTextareaRef}
                                value={steeringText}
                                onChange={(e) => setSteeringText(e.target.value)}
                                rows={4}
                                style={
                                  editingBubbleHeight
                                    ? { minHeight: `${Math.max(96, Math.floor((editingBubbleHeight - 24) / 2))}px` }
                                    : undefined
                                }
                                className="w-full resize-none rounded-md border border-cyan-500 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-400"
                                placeholder="Suggest what should happen next..."
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelSteer}
                                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={saveSteer}
                                  className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onContinueMessage?.(msg.id)}
                                className={cn(
                                  'inline-flex h-8 w-8 items-center justify-center rounded-md border',
                                  isVn
                                    ? 'border-white/25 bg-black/35 text-white/80 hover:bg-black/55 hover:text-white'
                                    : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                                )}
                                aria-label="Continue response"
                                title="Continue response"
                              >
                                <FaArrowRight className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => beginSteer(msg)}
                                className={cn(
                                  'inline-flex h-8 w-8 items-center justify-center rounded-md border',
                                  isVn
                                    ? 'border-white/25 bg-black/35 text-white/80 hover:bg-black/55 hover:text-white'
                                    : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                                )}
                                aria-label="Steer next response"
                                title="Steer next response"
                              >
                                <FaCompass className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            );
            })
          )}
        </div>
      </div>

      <Dialog open={storyDetailsOpen} onOpenChange={setStoryDetailsOpen}>
        <DialogContent className="max-w-xl border-amber-500/30 bg-zinc-950 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_30px_80px_rgba(0,0,0,0.7)]">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 text-amber-100">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
              Story details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 rounded-2xl border border-amber-500/15 bg-black/20 p-4 text-sm text-amber-100/90">
            {storyOpeningMessage?.details?.map(detail => (
              <div key={detail} className="leading-6">
                {detail}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div
        ref={footerRef}
        className={cn(
          'relative z-20 flex-none',
          isVn ? 'border-t border-white/15 bg-transparent pt-3' : 'border-t border-zinc-800 bg-zinc-950/90 p-4',
        )}
      >
        <div className="space-y-2">
          <div
            className={cn(
              'cursor-text overflow-hidden',
              isVn
                ? 'rounded-sm border border-white/20 bg-black/35'
                : 'rounded-md border border-zinc-800 bg-zinc-900/60',
            )}
            onMouseDown={(e) => {
              // Focus the textarea when clicking the bordered composer chrome,
              // but don't steal clicks from footer controls.
              const target = e.target as HTMLElement | null;
              if (!target) return;
              if (target.closest('button, a, input, select, textarea, [role="button"], [role="combobox"]')) {
                return;
              }
              e.preventDefault();
              textareaRef.current?.focus();
            }}
          >
            <textarea
              ref={textareaRef}
              className={cn(
                'w-full resize-none bg-transparent px-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-0',
                isVn ? 'py-2' : 'min-h-[5.5rem] py-3',
              )}
              rows={isVn ? 1 : 3}
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={disabled}
              placeholder="Type your message..."
            />

              <div
                className={cn(
                  'flex items-center justify-between gap-2 p-2',
                  isVn ? 'border-t border-white/10' : 'border-t border-zinc-800',
                )}
              >
                <div className="flex items-center gap-2">
                <ConnectionSheet
                  side="bottom"
                  triggerClassName="aspect-square h-10 w-10 min-h-10 min-w-10 max-h-10 max-w-10 shrink-0 gap-0 rounded-md p-0"
                />
                {connected && connectionModel ? (
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isVn ? 'text-white/70' : 'text-muted-foreground',
                    )}
                  >
                    {connectionModel}
                  </span>
                ) : null}

                {prompterMode !== undefined && onPrompterModeChange && (
                  <div>
                    <Select
                      value={prompterMode}
                      onValueChange={(v: string) =>
                        onPrompterModeChange(v as 'tell' | 'do' | 'think')
                      }
                    >
                      <SelectTrigger aria-label="Prompter mode" className="h-7 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tell">Tell</SelectItem>
                        <SelectItem value="do">Do</SelectItem>
                        <SelectItem value="think">Think</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                </div>

                <div className="flex items-center gap-2">
                  {steerInstruction?.trim() ? (
                    <div className="flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                      <span className="font-medium">Steer:</span>
                      <span className="max-w-[14rem] truncate">{steerInstruction}</span>
                      {onSteerMessage ? (
                        <button
                          type="button"
                          onClick={() => onSteerMessage('__clear__', '')}
                          className="rounded-full px-1 text-cyan-100/80 hover:bg-cyan-500/20 hover:text-cyan-50"
                          aria-label="Clear steer note"
                          title="Clear steer note"
                        >
                          ×
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <Button
                    variant="outline"
                    size="icon"
                    style={{
                      ...CHAT_FOOTER_ICON_BOX,
                      // ON: pressed in. OFF: popped out.
                      transform: voiceEnabled ? 'translateY(4px)' : 'translate(-1px, -1px)',
                      boxShadow: voiceEnabled
                        ? '0 2px 0 hsl(var(--foreground))'
                        : '0 0 0 1px rgba(255, 255, 255, 0.03) inset, 0 8px 0 hsl(var(--foreground))',
                    }}
                    className={cn(
                      chatFooterIconLayoutClass,
                      voiceEnabled
                        ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700',
                    )}
                    onClick={() => setVoiceEnabled(prev => !prev)}
                    type="button"
                    aria-label={voiceEnabled ? 'Voice on' : 'Voice off'}
                    title={voiceEnabled ? 'Voice on' : 'Voice off'}
                  >
                    {voiceEnabled ? (
                      <FiVolume2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <FiVolumeX className="h-4 w-4 shrink-0" />
                    )}
                  </Button>
                  {sendIcon ? (
                    <Button
                      variant="default"
                      size="icon"
                      className="mb-px shrink-0 rounded-full"
                      onClick={handleSend}
                      disabled={disabled || !input.trim()}
                      aria-label={sendIconAriaLabel ?? 'Send message'}
                    >
                      {sendIcon}
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      size="icon"
                      className="mb-px shrink-0 rounded-full"
                      onClick={handleSend}
                      disabled={disabled || !input.trim()}
                      aria-label="Send message"
                      title="Send"
                    >
                      <FaArrowRight className="h-4 w-4 shrink-0" />
                    </Button>
                  )}
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
};
