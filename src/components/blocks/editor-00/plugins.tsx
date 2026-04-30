import { useRef } from "react"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"

import { ContentEditable } from "@/components/editor/editor-ui/content-editable"

export function Plugins() {
  const floatingAnchorRef = useRef<HTMLDivElement | null>(null)

  const onRef = (el: HTMLDivElement) => {
    floatingAnchorRef.current = el
  }

  return (
    <div className="relative">
      {/* toolbar plugins */}
      <div className="relative">
        <RichTextPlugin
          contentEditable={
            <div className="">
              <div className="" ref={onRef}>
                <ContentEditable />
              </div>
            </div>
          }
          placeholder={
            <div className="pointer-events-none absolute left-4 top-3 text-sm text-zinc-500">
              Start typing ...
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        {/* editor plugins */}
      </div>
      {/* actions plugins */}
    </div>
  )
}
