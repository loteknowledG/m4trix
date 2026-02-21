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
  prompterMode,
  onPrompterModeChange,
}) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);

  // background gif state
  const [bgGifUrl, setBgGifUrl] = React.useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // keep list scrolled to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Ref for the textarea input
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
        className="overflow-y-auto p-6 space-y-6 bg-background/60 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900"
        style={{ maxHeight: '100%' }}
      >
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
              } gap-3`}
            >
              {msg.from === 'agent' && (
                <Avatar noContainer className="h-8 w-8 shrink-0">
                  {msg.avatarUrl ? (
                    <AvatarImage src={msg.avatarUrl} />
                  ) : (
                    <AvatarFallback>
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  )}
                </Avatar>
              )}

              <div
                className={`rounded-xl px-4 py-3 max-w-[70%] shadow text-sm whitespace-pre-line ${
                  msg.from === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                {msg.text}
              </div>

              {msg.from === 'user' && (
                <Avatar noContainer className="h-8 w-8 shrink-0">
                  {msg.avatarUrl ? (
                    <AvatarImage src={msg.avatarUrl} />
                  ) : (
                    <AvatarFallback>
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  )}
                </Avatar>
              )}
            </div>
          ))
        )}
      </div>

      <div ref={footerRef} className="flex-none bg-zinc-950/90 border-t border-zinc-800 p-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
            rows={2}
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
                // Refocus the textarea after sending
                setTimeout(() => {
                  textareaRef.current?.focus();
                }, 0);
              }
            }}
            disabled={disabled}
            placeholder="Type your message..."
          />

          {/* right-side compact controls: small prompter-mode selector above send */}
          <div className="flex flex-col items-end gap-2">
            {prompterMode !== undefined && onPrompterModeChange && (
              <Select
                value={prompterMode}
                onValueChange={(v: string) => onPrompterModeChange(v as 'tell' | 'do' | 'think')}
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
            )}

            <div className="flex items-center gap-2">
              <button
                className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
                onClick={() => fileInputRef.current?.click()}
                title="Choose background GIF"
                type="button"
              >
                🖼️
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/gif"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setBgGifUrl(url);
                  }
                  // reset
                  e.target.value = '';
                }}
              />

              {sendIcon ? (
                <button
                  className="rounded-md bg-primary text-primary-foreground p-2 disabled:opacity-50"
                  onClick={onSend}
                  disabled={disabled || !input.trim()}
                  aria-label={sendIconAriaLabel ?? 'Send message'}
                >
                  {sendIcon}
                </button>
              ) : (
                <button
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
                  onClick={onSend}
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
