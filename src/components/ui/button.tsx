import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'pushable-effect border-2 border-border bg-primary text-primary-foreground hover:bg-primary/90',
        destructive:
          'pushable-effect border-2 border-border bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'pushable-effect border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:
          'pushable-effect border-2 border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        raised:
          'pushable-effect border-2 border-border bg-background text-foreground relative rounded-full group focus-visible:outline-none',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-full px-3 text-xs',
        lg: 'h-10 rounded-full px-8',
        icon: 'h-10 w-10 min-h-10 min-w-10 shrink-0 p-0',
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
    return (
      <Comp className={cn(buttonVariants({ variant, size }), className)} ref={ref} {...props}>
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
