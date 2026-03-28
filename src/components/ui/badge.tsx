import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center border-2 border-border text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 shadow-[2px_2px_0_0_hsl(var(--foreground))]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        black: "bg-black text-white",
      },
      shape: {
        normal: "rounded-md px-2.5 py-0.5",
        circle: "rounded-full w-7 h-7 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      shape: "normal",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants(props), className)} {...props} />
  )
}

export { Badge, badgeVariants }
