'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useMomentsContext } from '@/context/moments-collection';
import { normalizeMomentSrc } from '@/lib/moments';
import { safeDel, safeGet, safeKeys, safeSet } from '@/lib/storage-compat';
import { X, ArrowLeft, ArrowRight } from '@/components/icons';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FaTags } from 'react-icons/fa';
import { MdTitle, MdOutlinePhotoAlbum } from 'react-icons/md';
import MomentClassifier from '@/components/ai/moment-classifier';

const noop = () => {};

export default function CollectionOverlay() {
  const ctx = useMomentsContext();
  const collection = ctx?.collection ?? [];
  const currentId = ctx?.currentId ?? null;
  // Track if this moment is the title moment for the current story
  const [isTitleMoment, setIsTitleMoment] = useState(false);

  // Get story id from URL if possible
  const storyId = (() => {
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/stories\/(.+?)(\/|$)/);
      return match ? match[1] : null;
    }
    return null;
  })();

  // Check if this moment is the title moment on mount or when currentId/storyId changes
  useEffect(() => {
    if (!storyId || !currentId) return;
    (async () => {
      const storyKey = `story:${storyId}`;
      const stored = (await safeGet<any>(storyKey)) || {};
      let titleMomentId = stored.titleMomentId;
      if (!titleMomentId && Array.isArray(stored)) {
        // fallback: check stories metadata
        const storiesMeta = (await safeGet<any[]>('stories')) || [];
        const meta = storiesMeta.find((s: any) => s.id === storyId);
        titleMomentId = meta?.titleMomentId;
      }
      setIsTitleMoment(titleMomentId === currentId);
    })();
  }, [storyId, currentId]);
  const close = ctx?.close ?? noop;
  const next = ctx?.next ?? noop;
  const prev = ctx?.prev ?? noop;
  const isOpen = ctx?.isOpen ?? false;
  const [editing, setEditing] = useState(false);
  const [tagging, setTagging] = useState(false);
  const [text, setText] = useState('');
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [font, setFont] = useState('system');
  const [fontSize, setFontSize] = useState(40);
  const [textWidth, setTextWidth] = useState(60);
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fontColor, setFontColor] = useState('#ffffff');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [highlightedSuggestion, setHighlightedSuggestion] = useState<number>(-1);
  const [pixelWidth, setPixelWidth] = useState<number | null>(null);
  const pixelWidthRef = useRef<number | null>(null);

  const posRef = useRef(pos);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const skipPersistRef = useRef(false);

  // compute pixel width from percent and container size so wrapping is stable
  const computePixelWidth = useCallback(() => {
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
  }, [textWidth]);

  // load saved overlay text for the current item from IndexedDB
  useEffect(() => {
    if (!currentId) return;
    // Prevent saving the previous moment's tag state into the new moment while we load.
    skipPersistRef.current = true;

    (async () => {
      try {
        const v = await safeGet(`overlay:text:${currentId}`);
        if (!v) {
          setText('');
          setPos({ x: 0.5, y: 0.5 });
          setStrokeWidth(0);
          setStrokeColor('#000000');
          setTags([]);
          return;
        }

        const parsed = typeof v === 'string' ? JSON.parse(v) : v;
        if (parsed && typeof parsed === 'object' && 'text' in parsed) {
          setText(parsed.text || '');
          setPos({ x: parsed.x ?? 0.5, y: parsed.y ?? 0.5 });
          setFont(parsed.font ?? 'system');
          setFontSize(parsed.fontSize ?? 40);
          setTextWidth(parsed.textWidth ?? 60);
          setStrokeWidth(parsed.strokeWidth ?? 0);
          setStrokeColor(parsed.strokeColor ?? '#000000');
          setFontColor(parsed.fontColor ?? '#ffffff');
          setTags(Array.isArray(parsed.tags) ? parsed.tags : []);
        } else {
          // legacy plain-string value
          setText(String(v));
          setPos({ x: 0.5, y: 0.5 });
          setFont('system');
          setFontSize(40);
          setTextWidth(60);
          setStrokeWidth(0);
          setStrokeColor('#000000');
          setFontColor('#ffffff');
          setTags([]);
        }
      } catch (e) {
        setText('');
        setPos({ x: 0.5, y: 0.5 });
        setStrokeWidth(0);
        setStrokeColor('#000000');
        setTags([]);
      }
    })();
  }, [currentId]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await safeGet('overlay:tags');
        if (Array.isArray(stored)) {
          setAllTags(stored);
        }
      } catch {
        setAllTags([]);
      }
    })();
  }, []);

  useEffect(() => {
    const lower = tagInput.trim().toLowerCase();
    if (!lower) {
      setTagSuggestions([]);
      setHighlightedSuggestion(-1);
      return;
    }

    const matches = allTags
      .filter(t => t.toLowerCase().includes(lower))
      .filter(t => !tags.includes(t))
      .slice(0, 7);

    setTagSuggestions(matches);
    setHighlightedSuggestion(matches.length ? 0 : -1);
  }, [tagInput, allTags, tags]);

  // Keep global tag list in sync with every moment's stored tags.
  // If a tag is removed from all moments, it should no longer appear in autocomplete.
  const refreshAllTagsFromStorage = useCallback(() => {
    (async () => {
      try {
        const allKeys = await safeKeys();
        const tagSet = new Set<string>();
        const overlayKeys = (allKeys as any[])
          .filter(k => typeof k === 'string' && k.startsWith('overlay:text:'))
          .map(k => String(k));

        await Promise.all(
          overlayKeys.map(async key => {
            try {
              const stored = await safeGet(key);
              if (stored && Array.isArray((stored as any).tags)) {
                for (const t of (stored as any).tags) {
                  if (typeof t === 'string' && t.trim()) tagSet.add(t);
                }
              }
            } catch {
              // ignore parse errors
            }
          })
        );

        setAllTags(Array.from(tagSet).sort((a, b) => a.localeCompare(b)));
      } catch {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    refreshAllTagsFromStorage();
  }, [refreshAllTagsFromStorage, isOpen, currentId, tags]);

  useEffect(() => {
    computePixelWidth();
    const onResize = () => computePixelWidth();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computePixelWidth]);

  const persistOverlayData = (payload: {
    text: string;
    x: number;
    y: number;
    font: string;
    fontSize: number;
    textWidth: number;
    strokeWidth: number;
    strokeColor: string;
    fontColor: string;
    tags: string[];
  }) => {
    // Store overlay text in IndexedDB for import/export consistency.
    (async () => {
      try {
        await safeSet(`overlay:text:${currentId}`, payload);
      } catch (e) {
        /* ignore */
      }
    })();

    // Persist global tag list in indexedDB so it can be exported/imported with the rest of the app state.
    (async () => {
      try {
        const existing = (await safeGet('overlay:tags')) || [];
        const merged = Array.from(
          new Set([...(Array.isArray(existing) ? existing : []), ...(payload.tags || [])])
        );
        await safeSet('overlay:tags', merged);
      } catch (e) {
        /* ignore */
      }
    })();
  };

  const saveText = (
    t: string,
    p?: { x: number; y: number },
    f?: string,
    size?: number,
    width?: number,
    sWidth?: number,
    sColor?: string,
    fontColorParam?: string,
    newTags?: string[]
  ) => {
    const payload = {
      text: t,
      x: p?.x ?? pos.x,
      y: p?.y ?? pos.y,
      font: f ?? font,
      fontSize: size ?? fontSize,
      textWidth: width ?? textWidth,
      strokeWidth: sWidth ?? strokeWidth,
      strokeColor: sColor ?? strokeColor,
      fontColor: fontColorParam ?? fontColor,
      tags: newTags ?? tags,
    };

    if (t || (newTags && newTags.length)) {
      persistOverlayData(payload);
    } else {
      (async () => {
        try {
          await safeDel(`overlay:text:${currentId}`);
        } catch {
          /* ignore */
        }
      })();
    }

    setText(t);
    if (p) setPos(p);
    if (f) setFont(f);
    if (size) setFontSize(size);
    if (width) setTextWidth(width);
    if (sWidth != null) setStrokeWidth(sWidth);
    if (sColor) setStrokeColor(sColor);
    if (fontColorParam) setFontColor(fontColorParam);
    if (newTags) setTags(newTags);
  };

  const savePosition = (p: { x: number; y: number }) => {
    try {
      const payload = {
        text,
        x: p.x,
        y: p.y,
        font,
        fontSize,
        textWidth,
        strokeWidth,
        strokeColor,
        fontColor,
      };
      if (text) localStorage.setItem(`overlay:text:${currentId}`, JSON.stringify(payload));
    } catch (e) {
      /* ignore */
    }
    setPos(p);
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
    const end = () => {
      draggingRef.current = false;
      try {
        // persist when drag ends
        savePosition(posRef.current);
      } catch (e) {
        /* ignore */
      }
      // unlock pixel width and recompute based on container
      pixelWidthRef.current = null;
      computePixelWidth();
      window.removeEventListener('mousemove', move as any);
      window.removeEventListener('touchmove', move as any);
      window.removeEventListener('mouseup', end as any);
      window.removeEventListener('touchend', end as any);
    };
    window.addEventListener('mousemove', move as any);
    window.addEventListener('touchmove', move as any, { passive: false } as any);
    window.addEventListener('mouseup', end as any);
    window.addEventListener('touchend', end as any);

    // lock current pixel width for stable wrapping while dragging
    pixelWidthRef.current = pixelWidth;
  };

  useEffect(() => {
    if (!ctx || !isOpen) return;
    const prevOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      try {
        document.body.style.overflow = prevOverflow;
      } catch (e) {
        /* ignore */
      }
    };
  }, [ctx, isOpen, close, next, prev]);

  // close overlay when the route changes to avoid leaving a full-screen
  // overlay active after navigation (e.g., sidebar link clicks)
  const pathname = usePathname();
  const prevPathRef = useRef<string | null>(pathname);
  const overlayFontFamily =
    font === 'serif'
      ? 'serif'
      : font === 'mono'
        ? 'monospace'
        : font === 'cursive'
          ? 'cursive'
          : font === 'mrs'
            ? '"Mrs Saint Delafield", cursive'
            : font === 'satisfy'
              ? '"Satisfy", cursive'
              : 'system-ui, sans-serif';
  useEffect(() => {
    if (!ctx || !isOpen) {
      prevPathRef.current = pathname;
      return;
    }
    // only close when the pathname has actually changed (ignore initial mount)
    if (prevPathRef.current && prevPathRef.current !== pathname) {
      close();
    }
    prevPathRef.current = pathname;
  }, [ctx, isOpen, close, pathname]);
  useEffect(() => {
    if (!currentId) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    saveText(text, undefined, font, fontSize, textWidth, strokeWidth, strokeColor, fontColor, tags);
  }, [tags, currentId, text, font, fontSize, textWidth, strokeWidth, strokeColor, fontColor]);

  useEffect(() => {
    if (!isOpen || !currentId) return;
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    persistOverlayData({
      text,
      x: pos.x,
      y: pos.y,
      font,
      fontSize,
      textWidth,
      strokeWidth,
      strokeColor,
      fontColor,
      tags,
    });
  }, [
    isOpen,
    currentId,
    text,
    pos.x,
    pos.y,
    font,
    fontSize,
    textWidth,
    strokeWidth,
    strokeColor,
    fontColor,
    tags,
  ]);

  if (!ctx || !isOpen || !currentId) return null;
  const item = collection.find((m: any) => m.id === currentId);
  if (!item) return null;
  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/90 flex items-center justify-center"
      onClick={e => {
        e.stopPropagation();
      }}
      onMouseDown={e => {
        e.stopPropagation();
      }}
    >
      <button
        onClick={e => {
          e.stopPropagation();
          e.preventDefault();
          close();
        }}
        className="absolute left-4 top-4 inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white z-10"
        aria-label="Close"
      >
        <X size={18} />
      </button>

      <div className="absolute right-4 top-4 flex items-center gap-2 z-10">
        <button
          onClick={async e => {
            e.stopPropagation();
            e.preventDefault();
            if (!storyId || !currentId) return;
            // Update story object in IndexedDB
            const storyKey = `story:${storyId}`;
            let stored = (await safeGet<any>(storyKey)) || {};
            if (Array.isArray(stored)) {
              stored = { items: stored };
            }
            stored.titleMomentId = currentId;
            await safeSet(storyKey, stored);
            // Also update stories metadata
            const storiesMeta = (await safeGet<any[]>('stories')) || [];
            const idx = storiesMeta.findIndex((s: any) => s.id === storyId);
            if (idx > -1) {
              storiesMeta[idx].titleMomentId = currentId;
              await safeSet('stories', storiesMeta);
            }
            setIsTitleMoment(true);
            window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id: storyId } }));
          }}
          className={`inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white${
            isTitleMoment
              ? ' ring-2 ring-violet-500 shadow-[0_0_12px_2px_rgba(139,92,246,0.7)]'
              : ''
          }`}
          aria-label="Set title moment"
          title="Set title moment"
        >
          <MdOutlinePhotoAlbum size={18} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            setEditing(true);
          }}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white"
          aria-label="Edit overlay title"
        >
          <MdTitle size={18} />
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            e.preventDefault();
            setTagging(true);
          }}
          className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white"
          aria-label="Manage tags"
        >
          <FaTags size={18} />
        </button>
      </div>

      {collection.length > 1 && (
        <>
          <button
            onClick={e => {
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
            onClick={e => {
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

      <div
        ref={containerRef}
        className="max-h-full max-w-full flex items-center justify-center relative"
      >
        <div className="flex items-center justify-center w-full">
          <img
            src={normalizeMomentSrc(item.src)}
            alt={item.name || 'Moment preview'}
            className="h-screen max-w-full object-contain rounded"
            onClick={e => {
              e.stopPropagation();
              e.preventDefault();
            }}
          />
        </div>

        {text ? (
          <div
            onMouseDown={e => onStartDrag(e)}
            onTouchStart={e => onStartDrag(e)}
            onDragStart={e => e.preventDefault()}
            className="absolute z-30 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-grab pointer-events-auto select-none touch-none"
            role="presentation"
          >
            <span
              className="block px-4 text-center break-words whitespace-pre-wrap leading-tight select-none"
              style={{
                fontFamily: overlayFontFamily,
                fontSize: `${fontSize}px`,
                color: fontColor,
                width: pixelWidth ? `${pixelWidth}px` : `${textWidth}%`,
                maxWidth: `${textWidth}%`,
                WebkitTextStroke: strokeWidth > 0 ? `${strokeWidth}px ${strokeColor}` : undefined,
                textShadow:
                  strokeWidth > 0
                    ? `0 0 1px ${strokeColor}, 0 0 2px ${strokeColor}`
                    : '0 2px 8px rgba(0,0,0,0.85)',
              }}
            >
              {text}
            </span>
          </div>
        ) : null}
      </div>

      {/* Editor action buttons removed per request */}

      <div
        className={`fixed right-0 top-0 h-full w-80 max-w-full bg-black/85 text-white z-[1250] transform transition-transform duration-300 ease-in-out ${
          editing ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-hidden={editing ? 'false' : 'true'}
      >
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium">Edit Overlay Text</h3>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-transparent hover:bg-white/5 text-white z-10"
              aria-label="Close editor"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-auto space-y-3">
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              className="w-full px-2 py-1 text-sm rounded bg-white/90 text-black"
              placeholder="Overlay text"
            />

            <label htmlFor="font-family-select" className="sr-only">
              Font family
            </label>
            <select
              id="font-family-select"
              value={font}
              onChange={e => setFont(e.target.value)}
              className="w-full px-2 py-1 text-sm rounded bg-white/90 text-black"
              aria-label="Font family"
            >
              <option value="system">System Sans</option>
              <option value="serif">Serif</option>
              <option value="mono">Monospace</option>
              <option value="cursive">Cursive</option>
              <option value="mrs">Mrs Saint Delafield</option>
              <option value="satisfy">Satisfy</option>
            </select>

            <div className="flex items-center justify-between gap-2">
              <label htmlFor="font-size-range" className="text-xs text-white/80">
                Size
              </label>
              <input
                id="font-size-range"
                type="range"
                min={16}
                max={96}
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-white w-14 text-right">{fontSize}px</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label htmlFor="text-width-range" className="text-xs text-white/80">
                Width
              </label>
              <input
                id="text-width-range"
                type="range"
                min={20}
                max={100}
                value={textWidth}
                onChange={e => setTextWidth(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-white w-14 text-right">{textWidth}%</span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <label htmlFor="stroke-width-range" className="text-xs text-white/80">
                Stroke
              </label>
              <input
                id="stroke-width-range"
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={strokeWidth}
                onChange={e => setStrokeWidth(Number(e.target.value))}
                className="w-full"
              />
              <span className="text-sm text-white w-14 text-right">{strokeWidth}px</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="color"
                value={strokeColor}
                onChange={e => setStrokeColor(e.target.value)}
                className="w-10 h-10 p-0 border-0 bg-transparent"
                title="Stroke color"
              />
              <span className="text-sm text-white">Stroke color</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={fontColor}
                onChange={e => setFontColor(e.target.value)}
                className="w-10 h-10 p-0 border-0 bg-transparent"
                title="Font color"
              />
              <span className="text-sm text-white">Font color</span>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={tagging} onOpenChange={setTagging}>
        <DialogContent
          className="z-[1300] w-[min(92vw,520px)] max-h-[85vh] overflow-hidden border-white/15 bg-black/90 text-white"
          onClick={e => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-medium text-white">Tags & Suggestions</DialogTitle>
            <DialogDescription className="text-xs text-white/70">
              Add tags to this moment and choose from existing suggestions.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto space-y-3 pr-1">
            <div className="flex items-center gap-2">
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    e.stopPropagation();
                    setHighlightedSuggestion(prev => Math.min(prev + 1, tagSuggestions.length - 1));
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    e.stopPropagation();
                    setHighlightedSuggestion(prev => Math.max(prev - 1, 0));
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    const selected =
                      highlightedSuggestion >= 0 && highlightedSuggestion < tagSuggestions.length
                        ? tagSuggestions[highlightedSuggestion]
                        : tagInput.trim();
                    if (selected) {
                      const next = selected.trim();
                      if (!tags.includes(next)) {
                        setTags(prev => [...prev, next]);
                      }
                      setTagInput('');
                    }
                  }
                }}
                className="flex-1 px-2 py-1 text-sm rounded bg-white/90 text-black"
                placeholder="Add tag (e.g. chapter.1)"
              />
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  const next = tagInput.trim();
                  if (next && !tags.includes(next)) {
                    setTags(prev => [...prev, next]);
                  }
                  setTagInput('');
                }}
                className="px-3 py-1 rounded bg-primary text-primary-foreground text-sm"
              >
                Add
              </button>
            </div>

            {tagSuggestions.length > 0 && (
              <div className="rounded bg-black/70 border border-white/10 p-2">
                {tagSuggestions.map((s, index) => (
                  <button
                    key={s}
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      if (!tags.includes(s)) setTags(prev => [...prev, s]);
                      setTagInput('');
                    }}
                    className={`w-full text-left text-sm py-1 ${
                      highlightedSuggestion === index ? 'bg-white/20' : 'hover:bg-white/10'
                    } text-white rounded`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {tags.map(t => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-white text-xs"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => setTags(prev => prev.filter(x => x !== t))}
                    className="text-xs text-white/70 hover:text-white"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4">
              <h4 className="text-xs text-white/70 mb-2">Auto-tag</h4>
              <MomentClassifier
                imageSrc={normalizeMomentSrc(item.src)}
                onAddTags={newTags => {
                  setTags(prev => Array.from(new Set([...prev, ...newTags])));
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
