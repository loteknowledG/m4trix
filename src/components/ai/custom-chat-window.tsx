import React, { useRef, useEffect } from 'react';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { ConnectionSheet } from '@/components/connection-sheet';

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
}

export const CustomChatWindow: React.FC<CustomChatWindowProps> = ({
  messages,
  input,
  onInputChange,
  onSend,
  disabled,
  sendIcon,
  sendIconAriaLabel,
  connected,
  connectionModel,
  prompterMode,
  onPrompterModeChange,
}) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  // textarea for user input
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [voiceEnabled, setVoiceEnabled] = React.useState(true);

  const lastSpokenIdRef = useRef<string | null>(null);
  const isPendingAgentMessage = (msg: CustomChatMessage) =>
    msg.id.startsWith('pending-') || /^Working on that request\b/i.test(msg.text.trim());

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

    const latest = messages[messages.length - 1];
    if (latest.from !== 'agent') return;
    if (latest.id === lastSpokenIdRef.current) return;
    if (latest.id.startsWith('pending-') || latest.id.startsWith('streaming-')) return;
    if (/^Working on that request\b/i.test(latest.text.trim())) return;

    lastSpokenIdRef.current = latest.id;
    const speechText = textForSpeech(latest.text);
    if (!speechText) return;

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: speechText }),
    }).catch(err => {
      console.warn('[tts] failed to speak text', err);
    });
  }, [messages, voiceEnabled]);

  // restore focus after submit cycles that temporarily disable the input
  useEffect(() => {
    if (!disabled) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, [disabled]);

  const handleSend = () => {
    onSend();
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  };

  // ensure the message list is height-constrained (parent height - footer height)
  useEffect(() => {
    const resize = () => {
      const outer = outerRef.current;
      const list = scrollRef.current;
      const footer = footerRef.current;
      if (!outer || !list || !footer) return;
      const max = outer.clientHeight - footer.offsetHeight;
      list.style.maxHeight = `${Math.max(0, max)}px`;
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div
      ref={outerRef}
      className="grid h-full min-h-0 w-full grid-rows-[1fr_auto] border border-transparent"
    >
      <div
        ref={scrollRef}
        className="overflow-y-auto bg-background/60 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900"
        style={{ maxHeight: '100%', scrollbarGutter: 'stable' }}
      >
        <div className="p-6 space-y-6">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm opacity-70 py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex items-end ${
                  msg.from === 'user' ? 'justify-end' : 'justify-start'
                } gap-3 w-full`}
              >
                <div
                  className={`px-4 py-3 text-sm whitespace-pre-line ${
                    msg.id === 'story-opening'
                      ? 'w-full rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-950/80 to-zinc-900/80 text-amber-50 shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_20px_45px_rgba(0,0,0,0.45)]'
                      : isPendingAgentMessage(msg)
                        ? 'mr-auto inline-flex max-w-[70%] items-center gap-2 rounded-2xl rounded-bl-none border border-zinc-700 bg-zinc-900/90 text-zinc-200 shadow'
                      : msg.from === 'user'
                        ? 'relative ml-auto inline-block max-w-[70%] text-right bg-violet-700 text-white border border-violet-500 rounded-2xl rounded-br-none shadow'
                        : 'w-full mr-auto max-w-[calc(100%+20px)] -ml-5 text-left text-muted-foreground'
                  }`}
                >
                  {msg.id === 'story-opening' ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-amber-200/80">
                        <span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]" />
                        Story Opening
                      </div>
                      <div
                        className="story-opening-html text-sm leading-6 text-amber-50/95 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:ml-5 [&_ul]:list-disc [&_ol]:ml-5 [&_ol]:list-decimal [&_li]:mb-1 [&_strong]:font-semibold [&_em]:italic"
                        dangerouslySetInnerHTML={{ __html: msg.text }}
                      />
                      {msg.details?.length ? (
                        <div className="space-y-2">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-amber-100/60">
                            Story details
                          </div>
                          <div className="space-y-1 rounded-xl border border-amber-500/15 bg-black/20 p-3 text-xs text-amber-100/85">
                            {msg.details.map(detail => (
                              <div key={detail} className="leading-5">
                                {detail}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : isPendingAgentMessage(msg) ? (
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-300">{msg.text}</span>
                      <span className="flex items-center gap-1.5 text-zinc-400" aria-label="Loading">
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
                    msg.text
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div ref={footerRef} className="flex-none bg-zinc-950/90 border-t border-zinc-800 p-4">
        <div className="space-y-2">
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <textarea
              ref={textareaRef}
              className="w-full resize-none bg-transparent px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-0"
              rows={2}
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

            <div className="flex items-center justify-between gap-2 border-t border-zinc-800 p-2">
              <div className="flex items-center gap-2">
                <ConnectionSheet side="bottom" />
                {connected && connectionModel ? (
                  <span className="text-xs font-medium text-muted-foreground">
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

              <button
                className={
                  'rounded-md border border-zinc-700 px-3 py-1 text-xs ' +
                  (voiceEnabled ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-200')
                }
                onClick={() => setVoiceEnabled(prev => !prev)}
                type="button"
              >
                Voice: {voiceEnabled ? 'On' : 'Off'}
              </button>
              {sendIcon ? (
                <button
                  className="rounded-md bg-white text-black p-2 hover:bg-black hover:text-white active:bg-[#ddd] active:text-[#333] disabled:opacity-50"
                  onClick={handleSend}
                  disabled={disabled || !input.trim()}
                  aria-label={sendIconAriaLabel ?? 'Send message'}
                >
                  {sendIcon}
                </button>
              ) : (
                <button
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
                  onClick={handleSend}
                  disabled={disabled || !input.trim()}
                >
                  Send
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
