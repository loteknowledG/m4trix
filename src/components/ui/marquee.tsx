import * as React from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: string;
}

export const Marquee = React.forwardRef<HTMLDivElement, MarqueeProps>(
  ({ className, children, gap = '2rem', ...props }, ref) => {
    // always duplicate content and animate
    return (
      <div ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
        {/* duplicate twice so animation can loop seamlessly */}
        <div className="flex animate-marquee whitespace-nowrap">
          <span className="inline-block whitespace-nowrap">{children}</span>
          <span style={{ paddingLeft: gap }} className="inline-block whitespace-nowrap">
            {children}
          </span>
          <span style={{ paddingLeft: gap }} className="inline-block whitespace-nowrap">
            {children}
          </span>
        </div>
      </div>
    );
  }
);
Marquee.displayName = 'Marquee';
