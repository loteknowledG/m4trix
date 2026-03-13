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
    const repeatCountRef = React.useRef(6);
    const [repeatCount, setRepeatCount] = React.useState(6);

    const computeRepeatCount = React.useCallback(() => {
      const containerWidth = containerRef.current?.offsetWidth ?? 0;
      const firstChildWidth =
        innerRef.current?.firstElementChild?.getBoundingClientRect().width ?? 0;

      if (!containerWidth || !firstChildWidth) return;

      // Ensure enough copies exist to keep the scroll continuous.
      // Buffer by 2x container width so the animation never exposes an empty gap.
      const needed = Math.ceil((containerWidth * 2) / firstChildWidth);
      const next = Math.max(needed, 2);
      if (next !== repeatCountRef.current) {
        repeatCountRef.current = next;
        setRepeatCount(next);
      }
    }, []);

    React.useLayoutEffect(() => {
      computeRepeatCount();
      const handleResize = () => requestAnimationFrame(computeRepeatCount);

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [computeRepeatCount]);

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
            '--marquee-duration': duration,
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
