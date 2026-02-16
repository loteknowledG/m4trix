import React, { useRef, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User as UserIcon } from 'lucide-react';

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
}

export const CustomChatWindow: React.FC<CustomChatWindowProps> = ({
  messages,
  input,
  onInputChange,
  onSend,
  disabled,
}) => {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);

  // keep list scrolled to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
                <Avatar className="h-8 w-8 shrink-0 overflow-hidden">
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
                <Avatar className="h-8 w-8 shrink-0 overflow-hidden">
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
            className="flex-1 resize-none rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
            rows={2}
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={disabled}
            placeholder="Type your message..."
          />
          <button
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
            onClick={onSend}
            disabled={disabled || !input.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
