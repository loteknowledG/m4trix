"use client"

import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable"
import type { ComponentProps } from "react"

type ContentEditableProps = ComponentProps<typeof LexicalContentEditable>

export function ContentEditable({
  className,
  ...props
}: ContentEditableProps) {
  return (
    <LexicalContentEditable
      {...props}
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
