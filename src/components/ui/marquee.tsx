import * as React from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: string;
  duration?: string;
}

const MarqueeInner = React.forwardRef<HTMLDivElement, MarqueeProps>(
  ({ className, children, gap = '2rem', duration = '24s', ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const innerRef = React.useRef<HTMLDivElement | null>(null);

    // Start with a high repeat count so short titles still scroll smoothly.
    const [repeatCount, setRepeatCount] = React.useState(10);

    const durationValue = React.useMemo(() => {
      if (duration && duration !== '24s') return duration;

      // A fixed duration makes the scroll speed consistent.
      return '3s';
    }, [duration]);

    React.useLayoutEffect(() => {
      const containerWidth = containerRef.current?.offsetWidth ?? 0;
      const firstChildWidth =
        innerRef.current?.firstElementChild?.getBoundingClientRect().width ?? 0;

      if (!containerWidth || !firstChildWidth) return;

      const neededCopies = Math.max(10, Math.ceil(containerWidth / firstChildWidth) + 1);
      setRepeatCount(neededCopies);
    }, [children, gap]);

    const items = React.useMemo(
      () =>
        Array.from({ length: repeatCount }).map((_, idx) => (
          <span
            key={idx}
            style={{ paddingLeft: idx === 0 ? 0 : gap }}
            className="inline-block whitespace-nowrap"
          >
            {children}
          </span>
        )),
      [children, gap, repeatCount]
    );

    return (
      <div
        ref={ref}
        className={cn('relative overflow-hidden', className)}
        style={
          {
            ...((props.style ?? {}) as React.CSSProperties),
            '--marquee-duration': durationValue,
            '--marquee-repeat': repeatCount,
          } as React.CSSProperties
        }
        {...props}
      >
        <div ref={containerRef} className="flex animate-marquee whitespace-nowrap" aria-hidden>
          <div ref={innerRef} className="flex whitespace-nowrap">
            {items}
          </div>
        </div>
      </div>
    );
  }
);

export const Marquee = React.memo(MarqueeInner);
Marquee.displayName = 'Marquee';
