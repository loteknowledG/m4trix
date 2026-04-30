"use client"

import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable"
import type { ComponentProps, ReactNode } from "react"

type ContentEditableProps = {
  className?: string
}

export function ContentEditable({
  className,
}: ContentEditableProps) {
  return (
    // @ts-expect-error - using Lexical's ContentEditable directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <LexicalContentEditable as any
      className={[
        "min-h-[180px] w-full rounded-md border border-zinc-800 bg-transparent px-4 py-3 text-sm outline-none",
        "selection:bg-primary selection:text-primary-foreground focus:outline-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  )
}
