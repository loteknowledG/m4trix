"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useMomentsContext } from "@/context/moments-collection";
import { X, ArrowLeft, ArrowRight } from "lucide-react";

export default function CollectionOverlay() {
  const ctx = useMomentsContext();
  const collection = ctx?.collection ?? [];
  const currentId = ctx?.currentId ?? null;
  const close = ctx?.close ?? (() => {});
  const next = ctx?.next ?? (() => {});
  const prev = ctx?.prev ?? (() => {});
  const isOpen = ctx?.isOpen ?? false;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [font, setFont] = useState("system");
  const [fontSize, setFontSize] = useState(40);
  const [textWidth, setTextWidth] = useState(60);
  const [pixelWidth, setPixelWidth] = useState<number | null>(null);
  const pixelWidthRef = useRef<number | null>(null);
  
  const posRef = useRef(pos);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // load saved overlay text for the current item from localStorage
  useEffect(() => {
    if (!currentId) return;
    try {
      const v = localStorage.getItem(`overlay:text:${currentId}`) || "";
      if (!v) {
        setText("");
        setPos({ x: 0.5, y: 0.5 });
        return;
      }
      try {
        const parsed = JSON.parse(v);
        if (parsed && typeof parsed === "object" && "text" in parsed) {
          setText(parsed.text || "");
          setPos({ x: parsed.x ?? 0.5, y: parsed.y ?? 0.5 });
          setFont(parsed.font ?? "system");
          setFontSize(parsed.fontSize ?? 40);
          setTextWidth(parsed.textWidth ?? 60);
        } else {
          // legacy plain-string value
          setText(String(v));
          setPos({ x: 0.5, y: 0.5 });
          setFont("system");
          setFontSize(40);
          setTextWidth(60);
        }
      } catch (e) {
        // not JSON, treat as legacy string
        setText(String(v));
        setPos({ x: 0.5, y: 0.5 });
        setFont("system");
        setFontSize(40);
        setTextWidth(60);
      }
    } catch (e) {
      setText("");
      setPos({ x: 0.5, y: 0.5 });
    }
  }, [currentId]);

  // keep a ref of the latest position so the drag end handler can persist
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // compute pixel width from percent and container size so wrapping is stable
  const computePixelWidth = () => {
    try {
      if (!containerRef.current) return setPixelWidth(null);
      // if a drag has locked the width, respect the locked value
      if (pixelWidthRef.current != null) {
        setPixelWidth(pixelWidthRef.current);
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      setPixelWidth(Math.max(50, Math.round((textWidth / 100) * rect.width)));
    } catch (e) {
      setPixelWidth(null);
    }
  };

  useEffect(() => {
    computePixelWidth();
    const onResize = () => computePixelWidth();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [textWidth]);

  const saveText = (t: string, p?: { x: number; y: number }, f?: string, size?: number, width?: number) => {
    try {
      if (t) {
        const payload = {
          text: t,
          x: p?.x ?? pos.x,
          y: p?.y ?? pos.y,
          font: f ?? font,
          fontSize: size ?? fontSize,
          textWidth: width ?? textWidth,
        };
        localStorage.setItem(`overlay:text:${currentId}`, JSON.stringify(payload));
      } else {
        localStorage.removeItem(`overlay:text:${currentId}`);
      }
    } catch (e) {}
    setText(t);
    if (p) setPos(p);
    if (f) setFont(f);
    if (size) setFontSize(size);
    if (width) setTextWidth(width);
    setEditing(false);
  };

  const clearText = () => {
    try {
      localStorage.removeItem(`overlay:text:${currentId}`);
    } catch (e) {}
    setText("");
    setEditing(false);
  };

  const savePosition = (p: { x: number; y: number }) => {
    try {
      const payload = { text, x: p.x, y: p.y, font, fontSize, textWidth };
      if (text) localStorage.setItem(`overlay:text:${currentId}`, JSON.stringify(payload));
    } catch (e) {}
    setPos(p);
  };

  const resetPosition = () => {
    const p = { x: 0.5, y: 0.5 };
    savePosition(p);
  };

  const onStartDrag = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    draggingRef.current = true;
    const move = (ev: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      let clientX = 0,
        clientY = 0;
      if (ev instanceof TouchEvent) {
        clientX = ev.touches[0]?.clientX ?? 0;
        clientY = ev.touches[0]?.clientY ?? 0;
      } else {
        clientX = (ev as MouseEvent).clientX;
        clientY = (ev as MouseEvent).clientY;
      }
      const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
      setPos({ x, y });
      posRef.current = { x, y };
    };
    const end = (ev?: Event) => {
      draggingRef.current = false;
      try {
        // persist when drag ends
        savePosition(posRef.current);
      } catch (e) {}
      // unlock pixel width and recompute based on container
      pixelWidthRef.current = null;
      computePixelWidth();
      window.removeEventListener("mousemove", move as any);
      window.removeEventListener("touchmove", move as any);
      window.removeEventListener("mouseup", end as any);
      window.removeEventListener("touchend", end as any);
    };
    window.addEventListener("mousemove", move as any);
    window.addEventListener("touchmove", move as any, { passive: false } as any);
    window.addEventListener("mouseup", end as any);
    window.addEventListener("touchend", end as any);

    // lock current pixel width for stable wrapping while dragging
    pixelWidthRef.current = pixelWidth;
  };

  useEffect(() => {
    if (!ctx || !isOpen) return;
    const prevOverflow = document.body.style.overflow || "";
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      try {
        document.body.style.overflow = prevOverflow;
      } catch (e) {}
    };
  }, [ctx, isOpen, close, next, prev]);

  // close overlay when the route changes to avoid leaving a full-screen
  // overlay active after navigation (e.g., sidebar link clicks)
  const pathname = usePathname();
  useEffect(() => {
    if (!ctx || !isOpen) return;
    // close immediately on any pathname change
    close();
  }, [pathname]);
  if (!ctx || !isOpen || !currentId) return null;
  const item = collection.find((m: any) => m.id === currentId);
  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/90 flex items-center justify-center"
      onClick={(e) => {
        // Do not close the overlay when the backdrop is clicked — only
        // the close button should dismiss it. Prevent clicks from
        // reaching underlying elements.
        e.stopPropagation();
        e.preventDefault();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          close();
        }}
        className="absolute left-4 top-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white z-10"
        aria-label="Close"
      >
        <X size={18} />
      </button>

      <div className="max-w-6xl w-full h-full flex items-center justify-center">
        <div className="w-full h-full flex items-center justify-center relative">
          {collection.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  prev();
                }}
                aria-label="Previous"
                className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white z-20"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  next();
                }}
                aria-label="Next"
                className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/40 hover:bg-black/60 text-white z-20"
              >
                <ArrowRight size={20} />
              </button>
            </>
          )}

          <div ref={containerRef} className="max-h-full max-w-full flex items-center justify-center relative">
            <div className="flex items-center justify-center w-full">
              <img
                src={item.src}
                alt={item.name || "Moment preview"}
                className="h-screen max-w-full object-contain rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
              />
            </div>
            {/* Text overlay (positioned and draggable) */}
            {text ? (
              <div
                onMouseDown={(e) => onStartDrag(e)}
                onTouchStart={(e) => onStartDrag(e)}
                className="absolute z-30"
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  cursor: "grab",
                  pointerEvents: "auto",
                }}
                role="presentation"
              >
                <span
                  className="text-white drop-shadow-lg px-4"
                  style={{
                    display: "block",
                    textAlign: "center",
                    wordBreak: "break-word",
                    width: pixelWidth ? `${pixelWidth}px` : undefined,
                    maxWidth: pixelWidth ? `${pixelWidth}px` : undefined,
                    fontFamily: (
                      font === "serif" ? "Georgia, 'Times New Roman', Times, serif" :
                      font === "mono" ? "SFMono-Regular, Menlo, Monaco, 'Courier New', monospace" :
                      font === "cursive" ? "'Brush Script MT', 'Segoe Script', cursive" :
                      "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
                    ),
                    fontSize: `${fontSize}px`,
                    lineHeight: 1.1,
                    whiteSpace: "normal",
                    hyphens: "auto",
                  }}
                >
                  {text}
                </span>
              </div>
            ) : null}
          </div>
          {/* Editor controls */}
          <div className="absolute right-4 bottom-6 z-40 flex items-center gap-2">
            {editing ? (
              <div className="flex items-center gap-2 bg-black/60 p-2 rounded">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="px-2 py-1 text-sm rounded bg-white/90 text-black"
                  placeholder="Overlay text"
                />
                <select
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                  className="px-2 py-1 text-sm rounded bg-white/90 text-black"
                >
                  <option value="system">System Sans</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Monospace</option>
                  <option value="cursive">Cursive</option>
                </select>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/80">Size</label>
                  <input
                    type="range"
                    min={16}
                    max={96}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-28"
                  />
                  <span className="text-sm text-white">{fontSize}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/80">Width</label>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={textWidth}
                    onChange={(e) => setTextWidth(Number(e.target.value))}
                    className="w-28"
                  />
                  <span className="text-sm text-white">{textWidth}%</span>
                </div>
                {/* font-weight removed */}
                <button
                  onClick={() => saveText(text, undefined, font, fontSize)}
                  className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => { setEditing(false); }}
                  className="px-3 py-1 rounded border text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => resetPosition()}
                  className="px-3 py-1 rounded border text-sm"
                >
                  Reset Position
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1 rounded bg-secondary text-secondary-foreground text-sm"
                >
                  Edit Text
                </button>
                <button
                  onClick={() => clearText()}
                  className="px-3 py-1 rounded bg-destructive text-destructive-foreground text-sm"
                >
                  Clear
                </button>
                <button
                  onClick={() => resetPosition()}
                  className="px-3 py-1 rounded border text-sm"
                >
                  Reset Position
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
