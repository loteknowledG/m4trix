import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared line-breaking for timed dialog overlay text. */
export const CUE_TEXT_WRAP_CLASS =
  'min-w-0 whitespace-pre-wrap text-pretty break-normal [overflow-wrap:break-word] [word-break:normal]';

/** Keep letter/character effects from wrapping in the middle of a word. */
export function CueTextByWords({
  text,
  className,
  children,
}: {
  text: string;
  className?: string;
  children: (word: string, wordIndex: number) => ReactNode;
}) {
  const tokens = text.match(/\S+|\s+/g) ?? (text ? [text] : []);
  let wordIndex = 0;

  return (
    <span className={cn('inline min-w-0', className)}>
      {tokens.map((token, index) => {
        if (/^\s+$/.test(token)) {
          return <Fragment key={`ws-${index}`}>{token}</Fragment>;
        }

        const currentWordIndex = wordIndex;
        wordIndex += 1;

        return (
          <span
            key={`w-${currentWordIndex}-${token}`}
            className="inline-block max-w-full whitespace-nowrap align-bottom"
          >
            {children(token, currentWordIndex)}
          </span>
        );
      })}
    </span>
  );
}
