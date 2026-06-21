"use client";

import { get, set } from "idb-keyval";
import { ChevronLeft, SquarePen, Trash2, Upload } from "@/components/icons";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GrUserFemale } from "react-icons/gr";
import { IoBanOutline } from "react-icons/io5";
import { LuNotebookText } from "react-icons/lu";
import { SiLevelsdotfyi } from "react-icons/si";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import CollectionOverlay from "@/components/collection-overlay";
import { DescriptionEditor } from "@/components/description-editor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ErrorBoundary from "@/components/error-boundary";
import MomentsGrid from "@/components/moments-grid";
import { Marquee } from "@/components/ui/marquee";
import { SelectionHeaderBar } from "@/components/ui/selection-header-bar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MomentsProvider } from "@/context/moments-collection";
import useSelection from "@/hooks/use-selection";
import { useSidebar } from "@/hooks/use-sidebar";
import { parseStoryArcJson, type StoryArc, type StoryArcStage } from "@/lib/game/story-arc";
import {
  type CheckpointObjective,
  type ObjectiveInteractionType,
  type ObjectiveType,
  type SceneObject,
  createObjective,
  createSceneObject,
} from "@/lib/game/objectives";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

const STORY_STAGE_PALETTES = [
  { bg: "#ffffff", fg: "#000000" },
  { bg: "#000000", fg: "#ffffff" },
  { bg: "#dddddd", fg: "#333333" },
  { bg: "#333333", fg: "#dddddd" },
  { bg: "#ffff00", fg: "#ffffff" },
  { bg: "#000000", fg: "#ffff00" },
  { bg: "#00ffff", fg: "#ffffff" },
  { bg: "#000000", fg: "#00ffff" },
  { bg: "#ff00ff", fg: "#ffffff" },
  { bg: "#000000", fg: "#ff00ff" },
] as const;

function getStagePalette(index: number) {
  return STORY_STAGE_PALETTES[index % STORY_STAGE_PALETTES.length];
}

type StageEditForm = {
  name: string;
  shortDesc: string;
  emotionalState: string;
  powerDynamic: string;
  keyTags: string;
  passTest: string;
  exampleDialogTone: string;
  objectives: CheckpointObjective[];
  sceneObjects: SceneObject[];
};

function parseListField(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatListField(items: string[]): string {
  return items.join("\n");
}

function createEmptyStageEditForm(): StageEditForm {
  return {
    name: "",
    shortDesc: "",
    emotionalState: "",
    powerDynamic: "",
    keyTags: "",
    passTest: "",
    exampleDialogTone: "",
    objectives: [],
    sceneObjects: [],
  };
}

type Moment = { id: string; src: string; name?: string; fingerprint?: string };
type StagedMomentsByStage = Record<number, string[]>;
type Character = { id: string; name?: string; avatarUrl?: string };
type StoryMeta = {
  id: string;
  title?: string;
  description?: string;
  count?: number;
  npcId?: string;
  playerId?: string;
  npcAppearance?: string;
  playerAppearance?: string;
  storyArc?: unknown;
  storyArcCurrentStage?: number;
  stagedMomentsByStage?: StagedMomentsByStage;
  npcKnowsPlayer?: boolean;
  directorNotes?: string;
};

function normalizeStagedMomentsByStage(value: unknown): StagedMomentsByStage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: StagedMomentsByStage = {};
  for (const [rawKey, rawIds] of Object.entries(value)) {
    const stageNumber = Number(rawKey);
    if (!Number.isFinite(stageNumber) || !Array.isArray(rawIds)) continue;
    const ids = rawIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    if (ids.length > 0) next[stageNumber] = Array.from(new Set(ids));
  }
  return next;
}

function normalizeDescription(value: string) {
  if (!value) return "";

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ");
}

export default function StoryPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const routeId = params?.id as string | undefined;
  const id = routeId === "new" ? searchParams?.get("story") || undefined : routeId;

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [storyInfoOpen, setStoryInfoOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [stageEditTarget, setStageEditTarget] = useState<number | null>(null);
  const [stageEditForm, setStageEditForm] = useState<StageEditForm>(createEmptyStageEditForm);
  const [storyArcCurrentStage, setStoryArcCurrentStage] = useState<number | null>(null);
  const [assignNpcOpen, setAssignNpcOpen] = useState(false);
  const [assignPlayerOpen, setAssignPlayerOpen] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assignedNpcId, setAssignedNpcId] = useState<string | null>(null);
  const [assignedPlayerId, setAssignedPlayerId] = useState<string | null>(null);
  const [assignedNpcAppearance, setAssignedNpcAppearance] = useState("");
  const [assignedPlayerAppearance, setAssignedPlayerAppearance] = useState("");
  const [storyDescription, setStoryDescription] = useState("");
  const [storyArcText, setStoryArcText] = useState("");
  const [storyArcError, setStoryArcError] = useState<string | null>(null);
  const [stagedMomentsByStage, setStagedMomentsByStage] = useState<StagedMomentsByStage>({});
  const [npcKnowsPlayer, setNpcKnowsPlayer] = useState(false);
  const [directorNotes, setDirectorNotes] = useState("");
  const assignedNpcCharacter = assignedNpcId
    ? characters.find((character) => character.id === assignedNpcId) || null
    : null;
  const assignedPlayerCharacter = assignedPlayerId
    ? characters.find((character) => character.id === assignedPlayerId) || null
    : null;

  const selectedIds = useSelection((s) => s.selections["stories"] || []);
  const toggleSelect = useSelection((s) => s.toggle);
  const setSelectionStore = useSelection((s) => s.set);
  const clearSelection = useSelection((s) => s.clear);
  const scope = "stories";

  const dragIndexRef = useRef<number | null>(null);
  const arcUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const scrollDirectionRef = useRef<number | null>(null);
  const scrollAnimRef = useRef<number | null>(null);

  const saveStoryItems = useCallback(
    async (nextItems: any[]) => {
      if (!id) return;
      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || [];
      if (Array.isArray(stored)) {
        await set(storyKey, nextItems);
      } else if (stored && typeof stored === "object") {
        await set(storyKey, { ...stored, items: nextItems });
      } else {
        await set(storyKey, nextItems);
      }
    },
    [id],
  );


  useEffect(() => {
    let mounted = true;
    if (!id) {
      setMoments([]);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const stored = (await get<any>(`story:${id}`)) || null;
        if (!mounted) return;

        let loadedMoments: Moment[] = [];
        if (Array.isArray(stored)) {
          loadedMoments = stored.map((s: any) => ({
            id: s.id || s,
            src: s.src || s,
            name: s.name,
          }));
        } else if (stored && Array.isArray(stored.items)) {
          loadedMoments = stored.items.map((s: any) => ({
            id: s.id || s,
            src: s.src || s,
            name: s.name,
          }));
        }

        setMoments(loadedMoments);

        // try to get title from stored object or stories metadata
        let t = stored && stored.title ? stored.title : "";
        const storedArc =
          stored && typeof stored === "object" && !Array.isArray(stored) ? stored.storyArc : null;
        const storedStaged =
          stored && typeof stored === "object" && !Array.isArray(stored)
            ? stored.stagedMomentsByStage
            : null;
        try {
          const saved = (await get<StoryMeta[]>("stories")) || [];
          const meta = saved.find((m: any) => m.id === id);
          if (meta && meta.title) t = meta.title;
          setAssignedNpcId(meta?.npcId || null);
          setAssignedPlayerId(meta?.playerId || null);
          setAssignedNpcAppearance(meta?.npcAppearance || "");
          setAssignedPlayerAppearance(meta?.playerAppearance || "");
          setStoryDescription(normalizeDescription(meta?.description || ""));
          const arcValue = meta?.storyArc ?? storedArc ?? null;
          setStoryArcText(arcValue ? JSON.stringify(arcValue, null, 2) : "");
          setStoryArcError(null);
          setStoryArcCurrentStage(
            typeof meta?.storyArcCurrentStage === "number" ? meta.storyArcCurrentStage : null,
          );
          setStagedMomentsByStage(
            normalizeStagedMomentsByStage(meta?.stagedMomentsByStage ?? storedStaged),
          );
          setNpcKnowsPlayer(meta?.npcKnowsPlayer === true);
          setDirectorNotes(typeof meta?.directorNotes === "string" ? meta.directorNotes : "");
        } catch (e) {
          /* ignore */
        }
        setTitle(t);
      } catch (err) {
        logger.error("Failed to load story items", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  // refresh assignedNpcId when stories-updated event fires
  useEffect(() => {
    if (!id) return;
    const handler = async () => {
      try {
        const saved = (await get<StoryMeta[]>("stories")) || [];
        const meta = saved.find((m: any) => m.id === id);
        setAssignedNpcId(meta?.npcId || null);
        setAssignedPlayerId(meta?.playerId || null);
        setAssignedNpcAppearance(meta?.npcAppearance || "");
        setAssignedPlayerAppearance(meta?.playerAppearance || "");
        setStoryDescription(normalizeDescription(meta?.description || ""));
        setStoryArcText(meta?.storyArc ? JSON.stringify(meta.storyArc, null, 2) : "");
        setStoryArcError(null);
        setStoryArcCurrentStage(
          typeof meta?.storyArcCurrentStage === "number" ? meta.storyArcCurrentStage : null,
        );
        setStagedMomentsByStage(normalizeStagedMomentsByStage(meta?.stagedMomentsByStage));
        setNpcKnowsPlayer(meta?.npcKnowsPlayer === true);
        setDirectorNotes(typeof meta?.directorNotes === "string" ? meta.directorNotes : "");
      } catch (e) {
        /* ignore */
      }
    };
    window.addEventListener("stories-updated", handler);
    return () => window.removeEventListener("stories-updated", handler);
  }, [id]);

  // listen for toolbar actions dispatched from navbar
  useEffect(() => {
    const handler = async (e: Event) => {
      const ev = e as CustomEvent;
      const action = ev?.detail?.action;
      if (!action) return;
      const ids = Array.from(selectedIds || []);
      if (!ids.length) return;

      try {
        if (action === "move-to-heap") {
          const heap = (await get<any[]>("heap-moments")) || (await get<any[]>("heap-gifs")) || [];
          const moving = moments.filter((g) => ids.includes(g.id));
          const newHeap = [...heap, ...moving];
          await set("heap-moments", newHeap);
          // remove from story
          const storyKey = `story:${id}`;
          const stored = (await get<any>(storyKey)) || [];
          let remaining: any[] = [];
          if (Array.isArray(stored)) {
            try {
              window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
            } catch (e) {
              /* ignore */
            }
          } else if (stored && Array.isArray(stored.items)) {
            remaining = stored.items.filter((s: any) => !ids.includes(s.id || s));
          }
          await saveStoryItems(remaining);
          // update local state
          setMoments((prev) => prev.filter((g) => !ids.includes(g.id)));
          // update stories metadata count
          try {
            const saved = (await get<any>("stories")) || [];
            const idx = saved.findIndex((s: any) => s.id === id);
            if (idx > -1) {
              saved[idx].count = Math.max(0, (saved[idx].count || 0) - ids.length);
              await set("stories", saved);
              try {
                window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
              } catch (e) {
                /* ignore */
              }
            }
          } catch (e) {
            /* ignore */
          }
          try {
            window.dispatchEvent(
              new CustomEvent("moments-updated", { detail: { count: newHeap.length } }),
            );
          } catch (e) {
            /* ignore */
          }
        }

        if (action === "move-to-trash") {
          const trash =
            (await get<any[]>("trash-moments")) || (await get<any[]>("trash-gifs")) || [];
          const moving = moments.filter((g) => ids.includes(g.id));
          const newTrash = [...trash, ...moving];
          await set("trash-moments", newTrash);
          // remove from story (same as above)
          const storyKey = `story:${id}`;
          const stored = (await get<any>(storyKey)) || [];
          let remaining: any[] = [];
          try {
            window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
          } catch (e) {
            /* ignore */
          }
          if (Array.isArray(stored)) {
            remaining = stored.filter((s: any) => !ids.includes(s.id || s));
          } else if (stored && Array.isArray(stored.items)) {
            remaining = stored.items.filter((s: any) => !ids.includes(s.id || s));
          }
          await saveStoryItems(remaining);
          try {
            clearSelection(scope);
          } catch (e) {
            /* ignore */
          }
          setMoments((prev) => prev.filter((g) => !ids.includes(g.id)));
          try {
            const saved = (await get<any>("stories")) || [];
            const idx = saved.findIndex((s: any) => s.id === id);
            if (idx > -1) {
              saved[idx].count = Math.max(0, (saved[idx].count || 0) - ids.length);
              await set("stories", saved);
              try {
                window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
              } catch (e) {
                /* ignore */
              }
            }
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        logger.error("Failed to perform story action", e);
      } finally {
        // clear selection
        try {
          clearSelection(scope);
        } catch (e) {
          /* ignore */
        }
      }
    };
    window.addEventListener("story-action", handler as EventListener);
    return () => window.removeEventListener("story-action", handler as EventListener);
  }, [selectedIds, moments, id, clearSelection, scope, saveStoryItems]);

  const onDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragIndexRef.current = idx;
    try {
      e.dataTransfer.setData("text/plain", String(idx));
      e.dataTransfer.effectAllowed = "move";
    } catch (err) {
      /* ignore */
    }
  }, []);

  // set story's saved count to exact number
  const setStoryCount = useCallback(
    async (count: number) => {
      if (!id) return;
      try {
        const saved = (await get<any[]>("stories")) || [];
        const idx = saved.findIndex((s) => s.id === id);
        if (idx > -1) {
          saved[idx].count = count;
          await set("stories", saved);
          try {
            window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
          } catch {}
        }
      } catch (e) {
        /* ignore */
      }
    },
    [id],
  );

  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIndex(idx);
    try {
      e.dataTransfer.dropEffect = "move";
    } catch (err) {
      /* ignore */
    }

    // Only auto-scroll when a drag is active (dragIndexRef is set).
    if (dragIndexRef.current === null) return;

    // auto-scroll when pointer nears top/bottom of viewport
    const margin = 80; // px from edge to start scrolling
    const y = e.clientY;
    const vh = window.innerHeight;
    if (y < margin) {
      scrollDirectionRef.current = -1;
      startAutoScroll();
    } else if (y > vh - margin) {
      scrollDirectionRef.current = 1;
      startAutoScroll();
    } else {
      scrollDirectionRef.current = 0;
      stopAutoScroll();
    }
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      const fromStr = (() => {
        try {
          return e.dataTransfer.getData("text/plain");
        } catch (err) {
          return String(dragIndexRef.current ?? "");
        }
      })();
      const from = fromStr ? Number(fromStr) : null;
      const to = idx;
      setDragOverIndex(null);
      dragIndexRef.current = null;
      stopAutoScroll();
      if (from === null || Number.isNaN(from) || from === to) return;

      const next = [...moments];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      setMoments(next);
      try {
        // Persist while preserving local story metadata fields.
        await saveStoryItems(next);
        try {
          window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
        } catch (e) {
          /* ignore */
        }
      } catch (err) {
        logger.error("Failed to persist reordered story", err);
      }
    },
    [moments, id, saveStoryItems],
  );

  // allow dropping external images/URLs to append to story
  const handleExternalDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const addSrc = async (src: string, fingerprint?: string) => {
        setMoments((ms) => {
          // avoid duplicates by fingerprint (when available) or by src
          if (
            ms.some((m) =>
              fingerprint && m.fingerprint ? m.fingerprint === fingerprint : m.src === src,
            )
          ) {
            setStoryCount(ms.length).catch(() => {});
            return ms;
          }

          const newMoment: Moment = { id: crypto.randomUUID(), src, fingerprint };
          const updated = [...ms, newMoment];
          saveStoryItems(updated).catch(() => {});
          setStoryCount(updated.length).catch(() => {});
          return updated;
        });
      };

      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        for (const file of Array.from(e.dataTransfer.files)) {
          if (file.type.startsWith("image/")) {
            const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
            await addSrc(dataUrl, fingerprint);
          }
        }
        return;
      }
      const text = e.dataTransfer.getData("text/plain");
      if (text) {
        // normalize URL for dedupe by stripping query params
        const normalized = text.split("?")[0];
        await addSrc(text, normalized);
      }
    },
    [id, saveStoryItems],
  );

  function startAutoScroll() {
    if (scrollAnimRef.current) return;
    const step = () => {
      const dir = scrollDirectionRef.current;
      if (!dir) {
        scrollAnimRef.current = null;
        return;
      }
      try {
        window.scrollBy({ top: dir * 12 });
      } catch (e) {
        /* ignore */
      }
      scrollAnimRef.current = requestAnimationFrame(step);
    };
    scrollAnimRef.current = requestAnimationFrame(step);
  }

  function stopAutoScroll() {
    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  }

  useEffect(() => {
    const onDragEndWin = () => {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      stopAutoScroll();
    };
    window.addEventListener("dragend", onDragEndWin);
    return () => {
      window.removeEventListener("dragend", onDragEndWin);
      // clear any selections scoped to this story when leaving
      clearSelection(scope);
    };
  }, [clearSelection, scope]);

  useEffect(() => {
    const prev = document.title;
    if (!id)
      return () => {
        document.title = prev ?? "m4trix";
      };

    const base = "m4trix - story";
    document.title = title ? `${base} - ${title}` : base;
    return () => {
      document.title = prev ?? "m4trix";
    };
  }, [id, title]);

  const router = useRouter();
  const setSidebarOpen = useSidebar((s) => s.setIsOpen);

  const loadCharacters = useCallback(async () => {
    try {
      const saved = (await get<Character[]>("PLAYGROUND_AGENTS")) || [];
      setCharacters(Array.isArray(saved) ? saved : []);
    } catch (e) {
      setCharacters([]);
    }
  }, []);

  // load characters when story info drawer opens
  useEffect(() => {
    if (storyInfoOpen) {
      loadCharacters();
    }
  }, [storyInfoOpen, loadCharacters]);

  const createCharacter = useCallback(async () => {
    try {
      const saved = (await get<any[]>("PLAYGROUND_AGENTS")) || [];
      const newCharacter = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: "",
        description: "",
      };
      const next = [...saved, newCharacter];
      await set("PLAYGROUND_AGENTS", next);
      setCharacters(next);
      try {
        window.dispatchEvent(new Event("characters-updated"));
      } catch (e) {
        /* ignore */
      }
      if (id) {
        const storyList = (await get<any[]>("stories")) || [];
        const idx = storyList.findIndex((s: any) => s.id === id);
        if (idx > -1) {
          storyList[idx] = { ...storyList[idx], npcId: newCharacter.id };
          await set("stories", storyList);
          try {
            window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
          } catch (e) {
            /* ignore */
          }
        }
        setAssignedNpcId(newCharacter.id);
      }
      router.push(`/characters/${newCharacter.id}`);
    } catch (e) {
      logger.error("Failed to create character", e);
    }
  }, [router, id]);

  const assignNpcToStory = useCallback(
    async (characterId: string) => {
      if (!id) return;
      try {
        const saved = (await get<any[]>("stories")) || [];
        const idx = saved.findIndex((s: any) => s.id === id);
        if (idx > -1) {
          saved[idx] = { ...saved[idx], npcId: characterId };
          await set("stories", saved);
          try {
            window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
          } catch (e) {
            /* ignore */
          }
        }
        setAssignedNpcId(characterId);
        setAssignNpcOpen(false);
      } catch (e) {
        logger.error("Failed to assign NPC", e);
      }
    },
    [id],
  );

  const assignPlayerToStory = useCallback(
    async (characterId: string) => {
      if (!id) return;
      try {
        const saved = (await get<any[]>("stories")) || [];
        const idx = saved.findIndex((s: any) => s.id === id);
        if (idx > -1) {
          saved[idx] = { ...saved[idx], playerId: characterId };
          await set("stories", saved);
          try {
            window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
          } catch (e) {
            /* ignore */
          }
        }
        setAssignedPlayerId(characterId);
        setAssignPlayerOpen(false);
      } catch (e) {
        logger.error("Failed to assign player", e);
      }
    },
    [id],
  );

  const saveStoryMetadata = useCallback(async (patch: Record<string, unknown>) => {
    if (!id) return;
    try {
      const saved = (await get<any[]>("stories")) || [];
      const idx = saved.findIndex((s: any) => s.id === id);
      if (idx > -1) {
        saved[idx] = { ...saved[idx], ...patch };
        await set("stories", saved);
        try {
          window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
        } catch (e) {
          /* ignore */
        }
      }
    } catch (e) {
      logger.error("Failed to save story metadata", e);
    }
  }, [id]);

  const saveStoryArc = useCallback(
    async (rawText: string) => {
      if (!id) return;
      const trimmed = rawText.trim();
      if (!trimmed) {
        setStoryArcError(null);
        await saveStoryMetadata({ storyArc: null });
        const storyKey = `story:${id}`;
        const stored = (await get<any>(storyKey)) || [];
        if (!Array.isArray(stored) && stored && typeof stored === "object") {
          const next = { ...stored };
          delete next.storyArc;
          await set(storyKey, next);
        }
        return;
      }
      try {
        const parsed = parseStoryArcJson(trimmed);
        setStoryArcError(null);
        await saveStoryMetadata({ storyArc: parsed });
        const storyKey = `story:${id}`;
        const stored = (await get<any>(storyKey)) || [];
        if (Array.isArray(stored)) {
          await set(storyKey, { items: stored, storyArc: parsed });
        } else if (stored && typeof stored === "object") {
          await set(storyKey, { ...stored, storyArc: parsed });
        } else {
          await set(storyKey, { items: [], storyArc: parsed });
        }
      } catch (e) {
        setStoryArcError(
          e instanceof Error ? e.message : "Story arc must be valid StoryArc JSON.",
        );
      }
    },
    [id, saveStoryMetadata],
  );

  const saveStoryDescription = useCallback(async () => {
    await saveStoryMetadata({ description: storyDescription });
  }, [saveStoryMetadata, storyDescription]);

  const saveDirectorNotes = useCallback(async () => {
    await saveStoryMetadata({ directorNotes });
  }, [directorNotes, saveStoryMetadata]);

  const saveStoryArcCurrentStage = useCallback(
    async (stageNumber: number) => {
      setStoryArcCurrentStage(stageNumber);
      await saveStoryMetadata({ storyArcCurrentStage: stageNumber });
    },
    [saveStoryMetadata],
  );

  const parsedStoryArc = useMemo(() => {
    const trimmed = storyArcText.trim();
    if (!trimmed) return null;
    try {
      return parseStoryArcJson(trimmed);
    } catch {
      return null;
    }
  }, [storyArcText]);

  const storyArcStages = useMemo(
    () =>
      Array.isArray(parsedStoryArc?.stages)
        ? [...parsedStoryArc.stages].sort((a, b) => a.stageNumber - b.stageNumber)
        : [],
    [parsedStoryArc],
  );

  const stagePickerOptions = useMemo(() => {
    if (storyArcStages.length > 0) return storyArcStages;
    return [1, 2, 3, 4, 5].map((stageNumber) => ({
      stageNumber,
      stageName: "",
      shortDescription: "",
      emotionalState: [] as string[],
      keyTags: [] as string[],
      passTest: [] as string[],
      exampleDialogTone: "",
      powerDynamic: "",
      objectives: [] as CheckpointObjective[],
      sceneObjects: [] as SceneObject[],
    }));
  }, [storyArcStages]);

  useEffect(() => {
    if (!stageOpen || stageEditTarget == null) {
      setStageEditForm(createEmptyStageEditForm());
      return;
    }

    const stage = stagePickerOptions.find((item) => item.stageNumber === stageEditTarget);
    setStageEditForm({
      name: stage?.stageName ?? "",
      shortDesc: stage?.shortDescription ?? "",
      emotionalState: formatListField(stage?.emotionalState ?? []),
      powerDynamic: stage?.powerDynamic ?? "",
      keyTags: formatListField(stage?.keyTags ?? []),
      passTest: formatListField(stage?.passTest ?? []),
      exampleDialogTone: stage?.exampleDialogTone ?? "",
      objectives: stage?.objectives ?? [],
      sceneObjects: stage?.sceneObjects ?? [],
    });
  }, [stageEditTarget, stageOpen, stagePickerOptions]);

  const buildStoryArcForEditing = useCallback((): StoryArc => {
    if (parsedStoryArc) return parsedStoryArc;
    return {
      id: id ? `story-${id}-arc` : "story-arc",
      name: title.trim() || "Story Arc",
      stages: stagePickerOptions,
    };
  }, [id, parsedStoryArc, stagePickerOptions, title]);

  const saveStageEdit = useCallback(async () => {
    if (stageEditTarget == null) return;

    const arc = buildStoryArcForEditing();
    const nextStage: StoryArcStage = {
      stageNumber: stageEditTarget,
      stageName: stageEditForm.name.trim(),
      shortDescription: stageEditForm.shortDesc.trim(),
      emotionalState: parseListField(stageEditForm.emotionalState),
      powerDynamic: stageEditForm.powerDynamic.trim(),
      keyTags: parseListField(stageEditForm.keyTags),
      passTest: parseListField(stageEditForm.passTest),
      exampleDialogTone: stageEditForm.exampleDialogTone.trim(),
      objectives: stageEditForm.objectives,
      sceneObjects: stageEditForm.sceneObjects,
    };

    const stages = [...arc.stages];
    const existingIndex = stages.findIndex((stage) => stage.stageNumber === stageEditTarget);
    if (existingIndex >= 0) {
      stages[existingIndex] = nextStage;
    } else {
      stages.push(nextStage);
    }

    const nextArc: StoryArc = {
      ...arc,
      stages: stages.sort((a, b) => a.stageNumber - b.stageNumber),
    };
    const nextArcText = JSON.stringify(nextArc, null, 2);
    setStoryArcText(nextArcText);
    setStoryArcError(null);
    await saveStoryArc(nextArcText);
    await saveStoryArcCurrentStage(stageEditTarget);
    setStageOpen(false);
    setStageEditTarget(null);
  }, [
    buildStoryArcForEditing,
    saveStoryArc,
    saveStoryArcCurrentStage,
    stageEditForm,
    stageEditTarget,
  ]);

  const stagedMomentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const stageIds of Object.values(stagedMomentsByStage)) {
      for (const momentId of stageIds) ids.add(momentId);
    }
    return ids;
  }, [stagedMomentsByStage]);

  const unstagedMoments = useMemo(
    () => moments.filter((moment) => !stagedMomentIds.has(moment.id)),
    [moments, stagedMomentIds],
  );

  const populatedStageNumbers = useMemo(
    () =>
      Object.keys(stagedMomentsByStage)
        .map(Number)
        .filter((stageNumber) => (stagedMomentsByStage[stageNumber]?.length ?? 0) > 0)
        .sort((a, b) => a - b),
    [stagedMomentsByStage],
  );

  const saveStagedMoments = useCallback(
    async (next: StagedMomentsByStage) => {
      if (!id) return;
      const cleaned = normalizeStagedMomentsByStage(next);
      setStagedMomentsByStage(cleaned);
      try {
        await saveStoryMetadata({ stagedMomentsByStage: cleaned });
        const storyKey = `story:${id}`;
        const stored = (await get<any>(storyKey)) || [];
        if (Array.isArray(stored)) {
          await set(storyKey, { items: stored, stagedMomentsByStage: cleaned });
        } else if (stored && typeof stored === "object") {
          await set(storyKey, { ...stored, stagedMomentsByStage: cleaned });
        } else {
          await set(storyKey, { items: [], stagedMomentsByStage: cleaned });
        }
      } catch (e) {
        logger.error("Failed to save staged moments", e);
      }
    },
    [id, saveStoryMetadata],
  );

  const assignSelectedToStage = useCallback(
    async (stageNumber: number) => {
      const ids = Array.from(selectedIds || []);
      if (!ids.length) return;

      const next: StagedMomentsByStage = { ...stagedMomentsByStage };
      const existing = next[stageNumber] || [];
      next[stageNumber] = Array.from(new Set([...existing, ...ids]));

      for (const rawStageNumber of Object.keys(next)) {
        const currentStageNumber = Number(rawStageNumber);
        if (currentStageNumber === stageNumber) continue;
        const filtered = next[currentStageNumber].filter((momentId) => !ids.includes(momentId));
        if (filtered.length > 0) {
          next[currentStageNumber] = filtered;
        } else {
          delete next[currentStageNumber];
        }
      }

      await saveStagedMoments(next);
      await saveStoryArcCurrentStage(stageNumber);
      clearSelection(scope);
      setStageOpen(false);
    },
    [
      clearSelection,
      saveStagedMoments,
      saveStoryArcCurrentStage,
      selectedIds,
      stagedMomentsByStage,
    ],
  );

  const getStageMoments = useCallback(
    (stageNumber: number) => {
      const ids = stagedMomentsByStage[stageNumber] || [];
      const byId = new Map(moments.map((moment) => [moment.id, moment]));
      return ids.map((momentId) => byId.get(momentId)).filter(Boolean) as Moment[];
    },
    [moments, stagedMomentsByStage],
  );

  const saveNpcAppearance = useCallback(async () => {
    await saveStoryMetadata({ npcAppearance: assignedNpcAppearance });
  }, [assignedNpcAppearance, saveStoryMetadata]);

  const savePlayerAppearance = useCallback(async () => {
    await saveStoryMetadata({ playerAppearance: assignedPlayerAppearance });
  }, [assignedPlayerAppearance, saveStoryMetadata]);

  const saveStoryTitle = useCallback(async () => {
    if (!id) return;
    try {
      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || {};
      if (Array.isArray(stored)) {
        // keep array form
        await set(storyKey, stored);
      } else {
        stored.title = title;
        await set(storyKey, stored);
      }
      await saveStoryMetadata({ title });
    } catch (e) {
      logger.error("Failed to save story title", e);
    }
  }, [id, saveStoryMetadata, title]);

  async function handleDeleteStory() {
    if (!id) return;
    try {
      // confirm destructive action with user
      const ok =
        typeof window !== "undefined"
          ? window.confirm("Delete this story? This cannot be undone.")
          : true;
      if (!ok) return;

      const storyKey = `story:${id}`;
      // clear stored story items
      await set(storyKey, []);

      // remove from stories metadata
      try {
        const saved = (await get<any>("stories")) || [];
        const remaining = (Array.isArray(saved) ? saved : []).filter((s: any) => s.id !== id);
        await set("stories", remaining);
      } catch (e) {
        // ignore
      }

      try {
        window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
      } catch (e) {
        /* ignore */
      }
      try {
        clearSelection(scope);
      } catch (e) {
        /* ignore */
      }
      setMoments([]);
      // navigate back to stories list
      try {
        router.push("/stories");
      } catch (e) {
        /* ignore */
      }
    } catch (err) {
      logger.error("Failed to delete story", err);
    }
  }

  const moveToTrash = useCallback(async () => {
    try {
      const ids = selectedIds || [];
      if (!ids.length) return;
      const toMove = moments.filter((m) => ids.includes(m.id));
      const existingTrash =
        (await get<any[]>("trash-moments")) || (await get<any[]>("trash-gifs")) || [];
      const newTrash = [...existingTrash, ...toMove];
      await set("trash-moments", newTrash);

      // remove moved items from this story
      setMoments((prev) => prev.filter((m) => !ids.includes(m.id)));

      // update stored story list
      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || [];
      let remaining: any[] = [];
      if (Array.isArray(stored)) {
        remaining = stored.filter((s: any) => !ids.includes(s.id || s));
      } else if (stored && Array.isArray(stored.items)) {
        remaining = stored.items.filter((s: any) => !ids.includes(s.id || s));
      }
      await saveStoryItems(remaining);

      const prunedStaged: StagedMomentsByStage = {};
      for (const [rawStage, stageIds] of Object.entries(stagedMomentsByStage)) {
        const filtered = stageIds.filter((momentId) => !ids.includes(momentId));
        if (filtered.length > 0) prunedStaged[Number(rawStage)] = filtered;
      }
      await saveStagedMoments(prunedStaged);

      // keep story count in sync
      setStoryCount(remaining.length).catch(() => {});

      try {
        window.dispatchEvent(
          new CustomEvent("moments-updated", {
            detail: { count: newTrash.length, source: "story" },
          }),
        );
      } catch (e) {
        /* ignore */
      }
      clearSelection(scope);
    } catch (err) {
      logger.error("Failed to move selected to trash", err);
    }
  }, [clearSelection, id, moments, scope, saveStagedMoments, selectedIds, stagedMomentsByStage, saveStoryItems]);

  const moveToHeap = useCallback(async () => {
    try {
      const ids = selectedIds || [];
      if (!ids.length) return;
      const toMove = moments.filter((m) => ids.includes(m.id));
      const existingHeap =
        (await get<any[]>("heap-moments")) || (await get<any[]>("heap-gifs")) || [];
      const newHeap = [...existingHeap, ...toMove];
      await set("heap-moments", newHeap);

      // remove moved items from this story
      setMoments((prev) => prev.filter((m) => !ids.includes(m.id)));

      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || [];
      let remaining: any[] = [];
      if (Array.isArray(stored)) {
        remaining = stored.filter((s: any) => !ids.includes(s.id || s));
      } else if (stored && Array.isArray(stored.items)) {
        remaining = stored.items.filter((s: any) => !ids.includes(s.id || s));
      }
      await saveStoryItems(remaining);

      const prunedStaged: StagedMomentsByStage = {};
      for (const [rawStage, stageIds] of Object.entries(stagedMomentsByStage)) {
        const filtered = stageIds.filter((momentId) => !ids.includes(momentId));
        if (filtered.length > 0) prunedStaged[Number(rawStage)] = filtered;
      }
      await saveStagedMoments(prunedStaged);

      setStoryCount(remaining.length).catch(() => {});
      try {
        window.dispatchEvent(
          new CustomEvent("moments-updated", {
            detail: { count: newHeap.length, source: "heap" },
          }),
        );
      } catch (e) {
        /* ignore */
      }
      clearSelection(scope);
    } catch (err) {
      logger.error("Failed to move selected to heap", err);
    }
  }, [clearSelection, id, moments, scope, saveStagedMoments, selectedIds, stagedMomentsByStage, saveStoryItems]);

  return (
    <>
      <ContentLayout
        title={title || "Stories"}
        titleMarquee
        navLeft={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/stories")}
              className="m4-circle-ghost hover:bg-zinc-100 dark:hover:bg-zinc-700"
              aria-label="Back to stories"
              title="Back to stories"
            >
              <ChevronLeft size={16} />
            </button>
            <SelectionHeaderBar
              selectedIds={selectedIds || []}
              moments={moments}
              showSelectAll={(selectedIds || []).length > 0}
              onSelectAll={() => {
                if ((selectedIds || []).length !== moments.length) {
                  setSelectionStore(
                    scope,
                    moments.map((m) => m.id),
                  );
                } else {
                  clearSelection(scope);
                }
              }}
              onClearSelection={() => clearSelection(scope)}
            />
          </div>
        }
        navRight={
          <div className="flex items-center gap-2">
            {!(selectedIds || []).length ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="m4-circle-ghost bg-transparent text-foreground hover:bg-accent/10"
                      aria-label="Story info"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setStoryInfoOpen(true);
                      }}
                    >
                      <LuNotebookText size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Story info</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}

            {(selectedIds || []).length > 0 ? (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="m4-circle-ghost bg-transparent text-foreground hover:bg-accent/10"
                        aria-label="Stage"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setStageOpen(true);
                        }}
                      >
                        <SiLevelsdotfyi size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10}>
                      <p>Stage</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          moveToHeap();
                        }}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-transparent text-destructive hover:text-destructive/80 transition-colors"
                        aria-label="Remove from story"
                      >
                        <IoBanOutline size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10}>
                      <p>Remove from story</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          moveToTrash();
                        }}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        aria-label="Move selected to trash"
                      >
                        <Trash2 size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10}>
                      <p>Move to Trash</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            ) : null}
          </div>
        }
      >
        <ErrorBoundary>
          <div
            className="overflow-auto h-[calc(100vh_-_var(--app-header-height,56px))]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleExternalDrop}
          >
            <div className="py-4">
              <div className="mb-6">
                {editingTitle ? (
                    <input
                      autoFocus
                      aria-label="Edit story title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={async () => {
                      await saveStoryTitle();
                      setEditingTitle(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingTitle(false);
                      }
                    }}
                    className="w-full text-5xl font-light bg-transparent border-0 focus:ring-0 placeholder:text-muted-foreground"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="w-full text-left text-5xl font-light bg-transparent border-0 focus:outline-none"
                    aria-label="Edit story title"
                  >
                    <Marquee
                      className="text-5xl font-light"
                      duration="8s"
                      gap="13rem"
                      distance="200%"
                    >
                      {title.trim() ? title : "Add a title"}
                    </Marquee>
                  </button>
                )}
              </div>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loadingâ€¦</div>
              ) : moments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Upload size={16} />
                    <div className="font-medium">No story selected</div>
                  </div>
                  <div className="text-sm">
                    Create a new story from the heap to move moments here.
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleDeleteStory}
                      className="inline-flex items-center px-3 py-1.5 rounded border text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      Delete story
                    </button>
                  </div>
                </div>
              ) : (
                <MomentsProvider collection={moments}>
                  {moments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Upload size={16} />
                        <div className="font-medium">No story selected</div>
                      </div>
                      <div className="text-sm">
                        Create a new story from the heap to move moments here.
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={handleDeleteStory}
                          className="inline-flex items-center px-3 py-1.5 rounded border text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          Delete story
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {populatedStageNumbers.map((stageNumber) => {
                        const stageMoments = getStageMoments(stageNumber);
                        if (stageMoments.length === 0) return null;
                        const stageMeta = stagePickerOptions.find(
                          (stage) => stage.stageNumber === stageNumber,
                        );
                        const palette = getStagePalette(stageNumber - 1);
                        return (
                          <div key={`stage-${stageNumber}`} className="mb-8">
                            <div
                              className="mb-3 flex items-start justify-between gap-3 rounded border px-3 py-2"
                              style={{ backgroundColor: palette.bg, color: palette.fg }}
                            >
                              <div className="min-w-0 flex-1">
                                <h3 className="text-sm font-semibold">
                                  Stage {stageNumber}
                                  {stageMeta?.stageName ? `: ${stageMeta.stageName}` : ""}
                                </h3>
                                {stageMeta?.shortDescription ? (
                                  <p className="mt-1 text-xs opacity-80">{stageMeta.shortDescription}</p>
                                ) : null}
                              </div>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                                      aria-label={`Edit stage ${stageNumber}`}
                                      onClick={() => {
                                        setStageEditTarget(stageNumber);
                                        setStageOpen(true);
                                      }}
                                    >
                                      <SquarePen size={16} />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={10}>
                                    <p>Edit stage</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <MomentsGrid
                              moments={stageMoments}
                              selectedIds={selectedIds}
                              toggleSelect={(tid: string) => toggleSelect(scope, tid)}
                              onDragStart={onDragStart}
                              onDragEnd={(_idx: number) => {
                                dragIndexRef.current = null;
                                setDragOverIndex(null);
                                stopAutoScroll();
                              }}
                              onDragOver={onDragOver}
                              onDrop={onDrop}
                              dragOverIndex={dragOverIndex}
                            />
                          </div>
                        );
                      })}
                      <MomentsGrid
                        moments={unstagedMoments}
                        selectedIds={selectedIds}
                        toggleSelect={(tid: string) => toggleSelect(scope, tid)}
                        onDragStart={onDragStart}
                        onDragEnd={(_idx: number) => {
                          dragIndexRef.current = null;
                          setDragOverIndex(null);
                          stopAutoScroll();
                        }}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        dragOverIndex={dragOverIndex}
                      />
                    </>
                  )}
                  <CollectionOverlay />
                </MomentsProvider>
              )}
            </div>
          </div>
        </ErrorBoundary>
      </ContentLayout>{" "}
      <Dialog open={storyInfoOpen} onOpenChange={setStoryInfoOpen}>
        <DialogContent
          className="max-w-2xl p-0"
          aria-describedby="story-info-description"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Story info</DialogTitle>
            <DialogDescription id="story-info-description">
              View and edit story metadata, assignments, and description.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[85vh] min-h-[520px] flex-col p-4">
            <div className="mb-3 flex items-start justify-between gap-4">
              <h3 className="text-sm font-medium">Story info</h3>
              <div className="flex items-start gap-2">
                <div className="w-[240px] space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setAssignNpcOpen(true);
                            setStoryInfoOpen(false);
                          }}
                          className="flex items-center gap-2 w-full p-2 rounded border border-dashed text-sm text-muted-foreground hover:bg-accent/20"
                          aria-label="Assign NPC"
                        >
                          {assignedNpcId && characters.find((c) => c.id === assignedNpcId) ? (
                            <>
                              {characters.find((c) => c.id === assignedNpcId)?.avatarUrl ? (
                                <img
                                  src={characters.find((c) => c.id === assignedNpcId)?.avatarUrl}
                                  alt="Character"
                                  className="w-5 h-5 rounded-full object-cover"
                                />
                              ) : (
                                <GrUserFemale size={16} />
                              )}
                              <span>
                                {characters.find((c) => c.id === assignedNpcId)?.name || "Untitled"}
                              </span>
                            </>
                          ) : (
                            <>
                              <GrUserFemale size={16} />
                              <span>Assign character</span>
                            </>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={8}>
                        <p>{assignedNpcId ? "Reassign character" : "Assign character"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {assignedNpcId ? (
                    <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">
                      {(assignedNpcCharacter?.name || "NPC")} appearance
                    </div>
                      <textarea
                        value={assignedNpcAppearance}
                        onChange={(e) => setAssignedNpcAppearance(e.target.value)}
                        onBlur={() => {
                          void saveNpcAppearance();
                        }}
                        placeholder="Describe how this character looks"
                        className="min-h-[92px] w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="w-[240px] space-y-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setAssignPlayerOpen(true);
                            setStoryInfoOpen(false);
                          }}
                          className="flex items-center gap-2 w-full p-2 rounded border border-dashed text-sm text-muted-foreground hover:bg-accent/20"
                          aria-label="Assign player"
                        >
                          {assignedPlayerId && characters.find((c) => c.id === assignedPlayerId) ? (
                            <>
                              {characters.find((c) => c.id === assignedPlayerId)?.avatarUrl ? (
                                <img
                                  src={characters.find((c) => c.id === assignedPlayerId)?.avatarUrl}
                                  alt="Player"
                                  className="w-5 h-5 rounded-full object-cover"
                                />
                              ) : (
                                <GrUserFemale size={16} />
                              )}
                              <span>
                                {characters.find((c) => c.id === assignedPlayerId)?.name || "Untitled"}
                              </span>
                            </>
                          ) : (
                            <>
                              <GrUserFemale size={16} />
                              <span>Assign player</span>
                            </>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={8}>
                        <p>{assignedPlayerId ? "Reassign player" : "Assign player"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {assignedPlayerId ? (
                    <div className="space-y-1">
                      <div className="text-xs text-muted-foreground">
                        {(assignedPlayerCharacter?.name || "Player")} appearance
                      </div>
                      <textarea
                        value={assignedPlayerAppearance}
                        onChange={(e) => setAssignedPlayerAppearance(e.target.value)}
                        onBlur={() => {
                          void savePlayerAppearance();
                        }}
                        placeholder="Describe how this character looks"
                        className="min-h-[92px] w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                      />
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setStoryInfoOpen(false)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-accent/20 text-foreground"
                  aria-label="Close story info"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto space-y-4 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Title</div>
                <div className="font-medium break-words">
                  {title && title.trim().length > 0 ? title : "Untitled story"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground mb-0.5">Moments</div>
                  <div className="text-base font-semibold">{moments.length}</div>
                </div>
                {id ? (
                  <div>
                    <div className="text-muted-foreground mb-0.5">Story ID</div>
                    <div className="text-[11px] break-all text-foreground/80">{id}</div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">Description</div>
                <DescriptionEditor
                  className="character-description-editor"
                  value={storyDescription}
                  onChange={setStoryDescription}
                  onBlur={() => {
                    void saveStoryDescription();
                  }}
                  placeholder="No description"
                />
              </div>

              <div className="space-y-1">
                <div className="text-xs uppercase text-muted-foreground">Director&apos;s notes</div>
                <p className="text-[11px] text-muted-foreground">
                  Hidden setup for the NPC only — not shown in the game or read aloud. Use this for
                  location, mood, and facts the character would know about the scene.
                </p>
                <textarea
                  value={directorNotes}
                  onChange={(e) => setDirectorNotes(e.target.value)}
                  onBlur={() => {
                    void saveDirectorNotes();
                  }}
                  rows={5}
                  placeholder="e.g. Late evening in her apartment. Rain on the windows. She has never met the player before."
                  className="min-h-[120px] w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              <label className="flex items-start gap-3 rounded border border-border/60 px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={npcKnowsPlayer}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setNpcKnowsPlayer(next);
                    void saveStoryMetadata({ npcKnowsPlayer: next });
                  }}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">NPC knows player</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Leave unchecked for a first meeting. The NPC will not know the player&apos;s
                    name or history until it comes up in chat.
                  </span>
                </span>
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs uppercase text-muted-foreground">Story Arc (JSON)</div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={arcUploadInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async () => {
                          const raw = String(reader.result || "");
                          setStoryArcText(raw);
                          await saveStoryArc(raw);
                        };
                        reader.onerror = () => {
                          setStoryArcError("Failed to read uploaded JSON file.");
                        };
                        reader.readAsText(file);
                        e.currentTarget.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => arcUploadInputRef.current?.click()}
                      className="inline-flex items-center justify-center rounded border px-2 py-1 text-xs hover:bg-accent/30"
                    >
                      Upload JSON
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setStoryArcText("");
                        await saveStoryArc("");
                      }}
                      className="inline-flex items-center justify-center rounded border px-2 py-1 text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <textarea
                  value={storyArcText}
                  onChange={(e) => {
                    setStoryArcText(e.target.value);
                    if (storyArcError) setStoryArcError(null);
                  }}
                  onBlur={() => {
                    void saveStoryArc(storyArcText);
                  }}
                  placeholder='Paste story arc JSON (example: { "id": "corruption-arc-v1", ... })'
                  className="min-h-[180px] w-full rounded border border-border bg-background px-3 py-2 text-xs font-mono outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
                />
                {storyArcError ? (
                  <div className="text-xs text-destructive">{storyArcError}</div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">
                    Stored locally per story in IndexedDB as <code>storyArc</code>.
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-border/40 space-y-2">
                <div className="text-xs text-muted-foreground">
                  Story metadata is stored locally in your browser (IndexedDB). Deleting the story
                  will remove its moments from this view, but not from Heap or Trash.
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await handleDeleteStory();
                    setStoryInfoOpen(false);
                  }}
                  className="inline-flex items-center justify-center px-3 py-1.5 rounded border text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
                >
                  Delete story
                </button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={stageOpen}
        onOpenChange={(open) => {
          setStageOpen(open);
          if (!open) {
            setStageEditTarget(null);
            setStageEditForm(createEmptyStageEditForm());
          }
        }}
      >
        <DialogContent
          className={cn("p-0", stageEditTarget != null ? "max-w-xl" : "max-w-lg")}
          aria-describedby="story-stage-description"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{stageEditTarget != null ? "Edit stage" : "Stage"}</DialogTitle>
            <DialogDescription id="story-stage-description">
              {stageEditTarget != null
                ? "Edit story stage metadata."
                : "Assign selected moments to a story stage."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[75vh] flex-col p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">
                {stageEditTarget != null ? `Edit Stage ${stageEditTarget}` : "Stage"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setStageOpen(false);
                  setStageEditTarget(null);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-foreground hover:bg-accent/20"
                aria-label="Close stage dialog"
              >
                ×
              </button>
            </div>

            {stageEditTarget != null ? (
              <div className="space-y-4 overflow-auto">
                <div className="space-y-1">
                  <label htmlFor="stage-edit-name" className="text-xs uppercase text-muted-foreground">
                    name
                  </label>
                  <input
                    id="stage-edit-name"
                    value={stageEditForm.name}
                    onChange={(e) =>
                      setStageEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="stage-edit-short-desc"
                    className="text-xs uppercase text-muted-foreground"
                  >
                    shortDesc
                  </label>
                  <textarea
                    id="stage-edit-short-desc"
                    value={stageEditForm.shortDesc}
                    onChange={(e) =>
                      setStageEditForm((prev) => ({ ...prev, shortDesc: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="stage-edit-emotional-state"
                    className="text-xs uppercase text-muted-foreground"
                  >
                    emotionalState
                  </label>
                  <textarea
                    id="stage-edit-emotional-state"
                    value={stageEditForm.emotionalState}
                    onChange={(e) =>
                      setStageEditForm((prev) => ({ ...prev, emotionalState: e.target.value }))
                    }
                    rows={3}
                    placeholder="One item per line or comma-separated"
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="stage-edit-power-dynamic"
                    className="text-xs uppercase text-muted-foreground"
                  >
                    powerDynamic
                  </label>
                  <input
                    id="stage-edit-power-dynamic"
                    value={stageEditForm.powerDynamic}
                    onChange={(e) =>
                      setStageEditForm((prev) => ({ ...prev, powerDynamic: e.target.value }))
                    }
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="stage-edit-key-tags" className="text-xs uppercase text-muted-foreground">
                    keyTags
                  </label>
                  <textarea
                    id="stage-edit-key-tags"
                    value={stageEditForm.keyTags}
                    onChange={(e) =>
                      setStageEditForm((prev) => ({ ...prev, keyTags: e.target.value }))
                    }
                    rows={3}
                    placeholder="One item per line or comma-separated"
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label htmlFor="stage-edit-pass-test" className="text-xs uppercase text-muted-foreground">
                    passTest
                  </label>
                  <textarea
                    id="stage-edit-pass-test"
                    value={stageEditForm.passTest}
                    onChange={(e) =>
                      setStageEditForm((prev) => ({ ...prev, passTest: e.target.value }))
                    }
                    rows={3}
                    placeholder="One item per line or comma-separated"
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="stage-edit-example-dialog-tone"
                    className="text-xs uppercase text-muted-foreground"
                  >
                    exampleDialogTone
                  </label>
                  <textarea
                    id="stage-edit-example-dialog-tone"
                    value={stageEditForm.exampleDialogTone}
                    onChange={(e) =>
                      setStageEditForm((prev) => ({ ...prev, exampleDialogTone: e.target.value }))
                    }
                    rows={3}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase text-muted-foreground">
                      objectives ({stageEditForm.objectives.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newObj = createObjective({
                          type: 'collect-object',
                          description: 'New objective',
                        });
                        setStageEditForm((prev) => ({
                          ...prev,
                          objectives: [...prev.objectives, newObj],
                        }));
                      }}
                      className="inline-flex items-center justify-center rounded border px-2 py-0.5 text-xs hover:bg-accent/30"
                    >
                      + Add
                    </button>
                  </div>
                  {stageEditForm.objectives.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No objectives yet. Click &quot;+ Add&quot; to create one.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto rounded border border-border p-2">
                      {stageEditForm.objectives.map((obj, idx) => (
                        <div key={obj.id} className="flex items-start gap-2 rounded bg-accent/20 p-2">
                          <div className="flex-1 space-y-1">
                            <select
                              value={obj.type}
                              onChange={(e) => {
                                const updated = [...stageEditForm.objectives];
                                updated[idx] = { ...obj, type: e.target.value as ObjectiveType };
                                setStageEditForm((prev) => ({ ...prev, objectives: updated }));
                              }}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                            >
                              <option value="collect-object">Collect Object</option>
                              <option value="reach-location">Reach Location</option>
                              <option value="interact-npc">Interact NPC</option>
                              <option value="custom">Custom</option>
                            </select>
                            <input
                              value={obj.description}
                              placeholder="Description"
                              onChange={(e) => {
                                const updated = [...stageEditForm.objectives];
                                updated[idx] = { ...obj, description: e.target.value };
                                setStageEditForm((prev) => ({ ...prev, objectives: updated }));
                              }}
                              className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                            />
                            <div className="flex gap-1">
                              <input
                                value={obj.targetObjectId ?? ''}
                                placeholder="Target ID (optional)"
                                onChange={(e) => {
                                  const updated = [...stageEditForm.objectives];
                                  updated[idx] = { ...obj, targetObjectId: e.target.value };
                                  setStageEditForm((prev) => ({ ...prev, objectives: updated }));
                                }}
                                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                              />
                              <input
                                type="number"
                                min={1}
                                value={obj.requiredCount}
                                placeholder="Count"
                                onChange={(e) => {
                                  const updated = [...stageEditForm.objectives];
                                  updated[idx] = { ...obj, requiredCount: parseInt(e.target.value) || 1 };
                                  setStageEditForm((prev) => ({ ...prev, objectives: updated }));
                                }}
                                className="w-16 rounded border border-border bg-background px-2 py-1 text-xs"
                              />
                            </div>
                            <div className="flex gap-1">
                              <select
                                value={obj.interactionType ?? ''}
                                onChange={(e) => {
                                  const updated = [...stageEditForm.objectives];
                                  updated[idx] = {
                                    ...obj,
                                    interactionType: e.target.value as ObjectiveInteractionType || undefined,
                                  };
                                  setStageEditForm((prev) => ({ ...prev, objectives: updated }));
                                }}
                                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                              >
                                <option value="">Interaction (any)</option>
                                <option value="pickup">Pick Up</option>
                                <option value="reach">Reach/Enter</option>
                                <option value="interact">Interact</option>
                                <option value="use">Use Item On</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => {
                                  setStageEditForm((prev) => ({
                                    ...prev,
                                    objectives: prev.objectives.filter((_, i) => i !== idx),
                                  }));
                                }}
                                className="inline-flex items-center justify-center rounded bg-destructive/20 px-2 py-1 text-xs text-destructive hover:bg-destructive/30"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase text-muted-foreground">
                      scene objects ({stageEditForm.sceneObjects.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newObj = createSceneObject({ name: 'New Object' });
                        setStageEditForm((prev) => ({
                          ...prev,
                          sceneObjects: [...prev.sceneObjects, newObj],
                        }));
                      }}
                      className="inline-flex items-center justify-center rounded border px-2 py-0.5 text-xs hover:bg-accent/30"
                    >
                      + Add
                    </button>
                  </div>
                  {stageEditForm.sceneObjects.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      No scene objects. Click &quot;+ Add&quot; to place interactive objects.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-auto rounded border border-border p-2">
                      {stageEditForm.sceneObjects.map((obj, idx) => (
                        <div key={obj.id} className="flex items-start gap-2 rounded bg-accent/20 p-2">
                          <div className="flex-1 space-y-1">
                            <div className="flex gap-1">
                              <input
                                value={obj.name}
                                placeholder="Object name"
                                onChange={(e) => {
                                  const updated = [...stageEditForm.sceneObjects];
                                  updated[idx] = { ...obj, name: e.target.value };
                                  setStageEditForm((prev) => ({ ...prev, sceneObjects: updated }));
                                }}
                                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                              />
                              <select
                                value={obj.type}
                                onChange={(e) => {
                                  const updated = [...stageEditForm.sceneObjects];
                                  updated[idx] = {
                                    ...obj,
                                    type: e.target.value as SceneObject['type'],
                                  };
                                  setStageEditForm((prev) => ({ ...prev, sceneObjects: updated }));
                                }}
                                className="rounded border border-border bg-background px-2 py-1 text-xs"
                              >
                                <option value="collectible">Collectible</option>
                                <option value="door">Door</option>
                                <option value="npc">NPC</option>
                                <option value="prop">Prop</option>
                                <option value="vehicle">Vehicle</option>
                                <option value="key">Key</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div className="flex gap-1">
                              <input
                                value={obj.locationId ?? ''}
                                placeholder="Location ID (optional)"
                                onChange={(e) => {
                                  const updated = [...stageEditForm.sceneObjects];
                                  updated[idx] = { ...obj, locationId: e.target.value };
                                  setStageEditForm((prev) => ({ ...prev, sceneObjects: updated }));
                                }}
                                className="flex-1 rounded border border-border bg-background px-2 py-1 text-xs"
                              />
                              <label className="flex items-center gap-1 text-xs">
                                <input
                                  type="checkbox"
                                  checked={obj.isObjectiveTarget ?? false}
                                  onChange={(e) => {
                                    const updated = [...stageEditForm.sceneObjects];
                                    updated[idx] = { ...obj, isObjectiveTarget: e.target.checked };
                                    setStageEditForm((prev) => ({ ...prev, sceneObjects: updated }));
                                  }}
                                  className="rounded"
                                />
                                Target
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setStageEditForm((prev) => ({
                                    ...prev,
                                    sceneObjects: prev.sceneObjects.filter((_, i) => i !== idx),
                                  }));
                                }}
                                className="inline-flex items-center justify-center rounded bg-destructive/20 px-2 py-1 text-xs text-destructive hover:bg-destructive/30"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStageOpen(false);
                      setStageEditTarget(null);
                    }}
                    className="inline-flex items-center justify-center rounded border px-3 py-1.5 text-sm hover:bg-accent/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void saveStageEdit();
                    }}
                    className="inline-flex items-center justify-center rounded border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : stagePickerOptions.length === 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>No story arc stages found.</p>
                <p className="text-xs">
                  Add a story arc JSON in Story info to define stages.
                </p>
              </div>
            ) : (
              <div className="space-y-2 overflow-auto">
                {stagePickerOptions.map((stage: StoryArcStage, index: number) => {
                  const palette = getStagePalette(index);
                  const isActive =
                    stageEditTarget === stage.stageNumber ||
                    storyArcCurrentStage === stage.stageNumber;
                  const stagedCount = stagedMomentsByStage[stage.stageNumber]?.length ?? 0;
                  return (
                    <button
                      key={stage.stageNumber}
                      type="button"
                      onClick={() => {
                        void assignSelectedToStage(stage.stageNumber);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 rounded border p-3 text-left transition-colors hover:opacity-95",
                        isActive ? "border-primary ring-1 ring-primary/40" : "border-border",
                      )}
                      style={{ backgroundColor: palette.bg, color: palette.fg }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">
                          Stage {stage.stageNumber}
                          {stage.stageName ? `: ${stage.stageName}` : ""}
                        </div>
                        {stage.shortDescription ? (
                          <div className="mt-1 text-xs opacity-80">{stage.shortDescription}</div>
                        ) : null}
                      </div>
                      {stagedCount > 0 ? (
                        <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide opacity-80">
                          {stagedCount} staged
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Sheet open={assignNpcOpen} onOpenChange={setAssignNpcOpen}>
        <SheetContent side="center" onClick={(e) => e.stopPropagation()}>
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Assign NPC</SheetTitle>
              <SheetClose />
            </div>
            <SheetDescription className="text-sm">
              Create a new character or select one to assign to this story.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 overflow-y-auto max-h-[60vh]">
            <button
              type="button"
              onClick={createCharacter}
              className="flex items-center gap-3 w-full p-3 rounded border"
            >
              <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">
                +
              </div>
              <div className="text-sm">New character</div>
            </button>
            {characters.length === 0 ? (
              <div className="text-sm text-muted-foreground">No characters yet.</div>
            ) : (
              characters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => assignNpcToStory(character.id)}
                  className={`flex items-center justify-between gap-3 w-full p-3 rounded hover:bg-accent text-left ${
                    assignedNpcId === character.id ? "border border-primary/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex items-center justify-center">
                      {character.avatarUrl ? (
                        <img
                          src={character.avatarUrl}
                          alt={character.name || "Character"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <GrUserFemale size={16} />
                      )}
                    </div>
                    <div className="text-sm truncate">
                      {character.name && character.name.trim() ? character.name : "Untitled"}
                    </div>
                  </div>
                  {assignedNpcId === character.id ? (
                    <span className="text-xs text-primary">Assigned</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={assignPlayerOpen} onOpenChange={setAssignPlayerOpen}>
        <SheetContent side="center" onClick={(e) => e.stopPropagation()}>
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Assign Player</SheetTitle>
              <SheetClose />
            </div>
            <SheetDescription className="text-sm">
              Select a character to assign as the player for this story.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 overflow-y-auto max-h-[60vh]">
            <button
              type="button"
              onClick={createCharacter}
              className="flex items-center gap-3 w-full p-3 rounded border"
            >
              <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">
                +
              </div>
              <div className="text-sm">New character</div>
            </button>
            {characters.length === 0 ? (
              <div className="text-sm text-muted-foreground">No characters yet.</div>
            ) : (
              characters.map((character) => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => assignPlayerToStory(character.id)}
                  className={`flex items-center justify-between gap-3 w-full p-3 rounded hover:bg-accent text-left ${
                    assignedPlayerId === character.id ? "border border-primary/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-zinc-800 rounded overflow-hidden flex items-center justify-center">
                      {character.avatarUrl ? (
                        <img
                          src={character.avatarUrl}
                          alt={character.name || "Character"}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <GrUserFemale size={16} />
                      )}
                    </div>
                    <div className="text-sm truncate">
                      {character.name && character.name.trim() ? character.name : "Untitled"}
                    </div>
                  </div>
                  {assignedPlayerId === character.id ? (
                    <span className="text-xs text-primary">Assigned</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

