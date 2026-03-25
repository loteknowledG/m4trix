import React, { useRef, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';
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

  // background gif state
  const [bgGifUrl, setBgGifUrl] = React.useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const lastSpokenIdRef = useRef<string | null>(null);

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

    lastSpokenIdRef.current = latest.id;

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: latest.text }),
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

  // apply gif background style if set
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      if (bgGifUrl) {
        el.style.backgroundImage = `url(${bgGifUrl})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundPosition = 'center';
      } else {
        el.style.backgroundImage = '';
      }
    }
  }, [bgGifUrl]);

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
                    msg.from === 'user'
                      ? 'relative ml-auto inline-block max-w-[70%] text-right bg-violet-700 text-white border border-violet-500 rounded-2xl rounded-br-none shadow'
                      : 'w-full mr-auto max-w-[calc(100%+20px)] -ml-5 text-left text-muted-foreground'
                  }`}
                >
                  {msg.text}
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
