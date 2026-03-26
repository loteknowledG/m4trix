import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 pushable-effect',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        raised:
          'relative p-0 border-none bg-transparent rounded-md group focus-visible:outline-none',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    if (variant === 'raised') {
      const [state, setState] = React.useState<'rest' | 'hover' | 'active'>('rest');
      // Movement values
      const frontTransforms = {
        rest: 'translateY(-4px)',
        hover: 'translateY(-6px)',
        active: 'translateY(-2px)',
      };
      const shadowTransforms = {
        rest: 'translateY(2px)',
        hover: 'translateY(4px)',
        active: 'translateY(1px)',
      };
      return (
        <Comp
          className={cn(buttonVariants({ variant, size, className }), 'pushable')}
          data-state={state}
          ref={ref}
          onMouseEnter={() => setState('hover')}
          onMouseLeave={() => setState('rest')}
          onMouseDown={e => {
            e.preventDefault();
            setState('active');
          }}
          onMouseUp={() => setState('hover')}
          onBlur={() => setState('rest')}
          {...props}
        >
          <span
            className="shadow absolute inset-0 rounded-md bg-black/25 will-change-transform pointer-events-none"
            aria-hidden="true"
          />
          <span
            className="edge absolute inset-0 rounded-md pointer-events-none"
            aria-hidden="true"
          />
          <span className="front relative block rounded-md px-4 py-2 text-base font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 will-change-transform select-none">
            {children}
          </span>
        </Comp>
      );
    }
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {children}
      </Comp>
    );
  }
);
// 3D button effect styles
// These should be in a CSS/SCSS file, but for clarity, here are the classnames:
// .pushable { position: relative; border: none; background: transparent; padding: 0; cursor: pointer; outline-offset: 4px; transition: filter 250ms; }
// .pushable:hover { filter: brightness(110%); }
// .shadow { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 12px; background: rgba(0,0,0,0.25); filter: blur(4px); will-change: transform; transform: translateY(2px); transition: transform 600ms cubic-bezier(0.3,0.7,0.4,1); }
// .pushable:hover .shadow { transform: translateY(4px); transition: transform 250ms cubic-bezier(0.3,0.7,0.4,1.5); }
// .pushable:active .shadow { transform: translateY(1px); transition: transform 34ms; }
// .edge { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 12px; }
// .front { display: block; position: relative; border-radius: 12px; padding: 12px 42px; font-size: 1.25rem; color: white; background: hsl(345deg 100% 47%); will-change: transform; transform: translateY(-4px); transition: transform 600ms cubic-bezier(0.3,0.7,0.4,1); }
// .pushable:hover .front { transform: translateY(-6px); transition: transform 250ms cubic-bezier(0.3,0.7,0.4,1.5); }
// .pushable:active .front { transform: translateY(-2px); transition: transform 34ms; }
Button.displayName = 'Button';

export { Button, buttonVariants };
