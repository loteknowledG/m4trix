"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type DraggableDialogProps = React.PropsWithChildren<{
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title?: React.ReactNode
  className?: string
}>;

export function DraggableDialog({ open, onOpenChange, title, children, className }: DraggableDialogProps) {
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null)
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)
  const draggingRef = React.useRef<{ startX: number; startY: number; left: number; top: number } | null>(null)
  const resizingRef = React.useRef<{ startX: number; startY: number; width: number; height: number } | null>(null)

  React.useEffect(() => {
    if (open && pos === null) {
      const left = Math.max(48, window.innerWidth / 2 - 480 / 2)
      const top = Math.max(48, window.innerHeight / 2 - 360 / 2)
      setPos({ left, top })
      setSize({ width: Math.min(960, Math.floor(window.innerWidth * 0.9)), height: Math.max(240, Math.floor(window.innerHeight * 0.6)) })
    }
  }, [open, pos])

  React.useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!draggingRef.current) return
      const dx = e.clientX - draggingRef.current.startX
      const dy = e.clientY - draggingRef.current.startY
      setPos({ left: draggingRef.current.left + dx, top: draggingRef.current.top + dy })
    }
    const handleUp = () => {
      draggingRef.current = null
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
    }
  }, [])

  // Resize handlers
  React.useEffect(() => {
    const handleResizeMove = (e: PointerEvent) => {
      if (!resizingRef.current) return
      const dx = e.clientX - resizingRef.current.startX
      const dy = e.clientY - resizingRef.current.startY
      const newWidth = Math.max(320, resizingRef.current.width + dx)
      const newHeight = Math.max(200, resizingRef.current.height + dy)
      const maxW = Math.floor(window.innerWidth * 0.95)
      const maxH = Math.floor(window.innerHeight * 0.95)
      setSize({ width: Math.min(newWidth, maxW), height: Math.min(newHeight, maxH) })
    }
    const handleResizeUp = () => {
      resizingRef.current = null
    }
    window.addEventListener("pointermove", handleResizeMove)
    window.addEventListener("pointerup", handleResizeUp)
    return () => {
      window.removeEventListener("pointermove", handleResizeMove)
      window.removeEventListener("pointerup", handleResizeUp)
    }
  }, [])

  const handlePointerDown = (e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest("[data-dialog-content]") as HTMLElement | null
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    draggingRef.current = { startX: e.clientX, startY: e.clientY, left: rect.left, top: rect.top }
  }

  const handleResizePointerDown = (e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest("[data-dialog-content]") as HTMLElement | null
    if (!el) return
    el.setPointerCapture(e.pointerId)
    const rect = el.getBoundingClientRect()
    resizingRef.current = { startX: e.clientX, startY: e.clientY, width: rect.width, height: rect.height }
    e.stopPropagation()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <DialogPrimitive.Content
          data-dialog-content
          onPointerDown={() => {}}
          className={cn("fixed z-50 bg-background shadow-xl border p-0 overflow-hidden rounded-lg", className)}
          style={
            pos
              ? { left: pos.left, top: pos.top, width: size?.width ?? 960, height: size?.height ?? Math.floor(window.innerHeight * 0.6) }
              : { left: "50%", top: "50%", transform: "translate(-50%,-50%)" }
          }
        >
          {title && <DialogTitle className="sr-only">{title}</DialogTitle>}
          <div className="flex items-center justify-between bg-muted/80 px-4 py-2 cursor-grab" onPointerDown={handlePointerDown}>
            <div className="text-sm font-medium">{title}</div>
            <DialogPrimitive.Close asChild>
              <button className="rounded-md p-1 hover:bg-muted/60">
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
          <div className="p-4" style={{ height: 'calc(100% - 40px)', overflow: 'auto' }}>
            {children}
          </div>
          {/* Resize grip */}
          <div
            className="absolute right-2 bottom-2 z-60 h-3 w-3 cursor-se-resize rounded-sm bg-muted/60"
            onPointerDown={handleResizePointerDown}
            aria-hidden
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export default DraggableDialog
