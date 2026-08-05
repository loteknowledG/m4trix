"use client";

import { get, set } from "idb-keyval";
import { HeaderBackButton } from "@/components/ui/header-back-button";
import { ChevronLeft, ChevronRight, Plus, SquarePen, Trash2, Upload, User } from "@/components/icons";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoPlaySharp, IoStopSharp } from "react-icons/io5";
import { IoMdChatbubbles } from "react-icons/io";
import { LuNotebookText } from "react-icons/lu";
import { SiLevelsdotfyi, SiThestorygraph } from "react-icons/si";
import { StoryArcEditor } from "@/components/story-arc-editor";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import CollectionOverlay from "@/components/collection-overlay";
import { DescriptionEditor } from "@/components/description-editor";
import { STORY_DESCRIPTION_MAX_CHARS } from "@/lib/game/dialogue-limits";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ErrorBoundary from "@/components/error-boundary";
import MomentsGrid from "@/components/moments-grid";
import { Marquee } from "@/components/ui/marquee";
import { SelectionHeaderBar } from "@/components/ui/selection-header-bar";
import type { StoryExperienceMode } from "@/components/story-experience-mode-toggle";
import { StoryMomentsViewer } from "@/components/story-moments-viewer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MomentsProvider } from "@/context/moments-collection";
import useSelection from "@/hooks/use-selection";
import { useSidebar } from "@/hooks/use-sidebar";
import {
  ensureNarratorCharacterRecord,
  NARRATOR_CHARACTER_ID,
} from "@/lib/game/narrator-agent";
import {
  createEmptyStoryArc,
  addStoryArcStage,
  type StoryArc,
  type StoryArcStage,
  type StoryArcTodoItem,
} from "@/lib/game/story-arc";
import { getStagePalette } from "@/lib/game/story-arc-palettes";
import {
  autoBackupStoryMomentsBeforeNormalization,
} from "@/lib/story-moment-backup";
import {
  dedupeStoryMomentsBySrc,
  filterStoryMomentItems,
  loadStoryMomentsFromStorage,
  mergeStoryMomentItemsForSave,
  momentSrcDedupeKey,
  normalizeStoryMomentList,
  readStoryMomentItems,
  reorderStoryMoments,
  storyMomentSrcExists,
  type StoryMomentRecord,
} from "@/lib/story-moments";
import { logger } from "@/lib/logger";
import { isMomentMediaFile, isEphemeralMomentSrc, materializeMomentSrc } from "@/lib/moments";
import { cn } from "@/lib/utils";
import { characterDetailHref } from "@/lib/character-routes";

const MOMENT_REORDER_MIME = "application/x-m4trix-moment-reorder";
const MOMENT_ID_MIME = "application/x-m4trix-moment-id";

type ExternalDropTarget = {
  stageNumber?: number;
  localInsertIdx?: number;
};

function reorderStageMomentIds(ids: string[], from: number, to: number): string[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= ids.length ||
    to >= ids.length
  ) {
    return [...ids];
  }
  const result = [...ids];
  const [moved] = result.splice(from, 1);
  const insertAt = from < to ? to - 1 : to;
  result.splice(insertAt, 0, moved);
  return result;
}

type StageEditForm = {
  name: string;
  characterIds: string[];
};

function createEmptyStageEditForm(): StageEditForm {
  return { name: "", characterIds: [] };
}

type Moment = StoryMomentRecord;
type StagedMomentsByStage = Record<number, string[]>;
type Character = { id: string; name?: string; avatarUrl?: string };
type StoryDialogLine = {
  id: string;
  speaker: string;
  text: string;
};
type StoryMeta = {
  id: string;
  title?: string;
  description?: string;
  count?: number;
  storyArc?: unknown;
  storyArcCurrentStage?: number;
  stagedMomentsByStage?: StagedMomentsByStage;
  narratorEnabled?: boolean;
  directorNotes?: string;
  dialogLines?: StoryDialogLine[];
};

function normalizeDialogLines(value: unknown): StoryDialogLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const raw = item as Record<string, unknown>;
      const text = typeof raw.text === "string" ? raw.text.trim() : "";
      if (!text) return null;
      return {
        id: typeof raw.id === "string" ? raw.id : `dialog-${index}`,
        speaker: typeof raw.speaker === "string" ? raw.speaker.trim() : "",
        text,
      };
    })
    .filter((line): line is StoryDialogLine => line !== null);
}

function newDialogLineId() {
  return `${Date.now()}-${Math.random()}`;
}

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
  const id = routeId === "edit" ? searchParams?.get("story") || undefined : routeId;

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [storyInfoOpen, setStoryInfoOpen] = useState(false);
  const [storyArcOpen, setStoryArcOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLines, setDialogLines] = useState<StoryDialogLine[]>([]);
  const [dialogSpeakerInput, setDialogSpeakerInput] = useState("");
  const [dialogTextInput, setDialogTextInput] = useState("");
  const [stageOpen, setStageOpen] = useState(false);
  const [stageAssignSelection, setStageAssignSelection] = useState("__new__");
  const [stageEditTarget, setStageEditTarget] = useState<number | null>(null);
  const [stageEditForm, setStageEditForm] = useState<StageEditForm>(createEmptyStageEditForm);
  const [assignStageCharacterOpen, setAssignStageCharacterOpen] = useState(false);
  const [storyArcCurrentStage, setStoryArcCurrentStage] = useState<number | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [storyDescription, setStoryDescription] = useState("");
  const [storyArc, setStoryArc] = useState<StoryArc | null>(null);
  const [stagedMomentsByStage, setStagedMomentsByStage] = useState<StagedMomentsByStage>({});
  const [narratorEnabled, setNarratorEnabled] = useState(true);
  const [directorNotes, setDirectorNotes] = useState("");
  const [storyMode, setStoryMode] = useState<StoryExperienceMode>("edit");
  const [viewMomentIndex, setViewMomentIndex] = useState(0);
  const narratorCharacter = useMemo(
    () => characters.find((character) => character.id === NARRATOR_CHARACTER_ID) || null,
    [characters],
  );
  const assignableCharacters = useMemo(
    () => characters.filter((character) => character.id !== NARRATOR_CHARACTER_ID),
    [characters],
  );
  const stageEditCharacters = useMemo(() => {
    const byId = new Map(assignableCharacters.map((character) => [character.id, character]));
    return stageEditForm.characterIds
      .map((characterId) => byId.get(characterId))
      .filter(Boolean) as Character[];
  }, [assignableCharacters, stageEditForm.characterIds]);

  const selectedIds = useSelection((s) => s.selections["stories"] || []);
  const toggleSelect = useSelection((s) => s.toggle);
  const setSelectionStore = useSelection((s) => s.set);
  const clearSelection = useSelection((s) => s.clear);
  const scope = "stories";

  const dragIndexRef = useRef<number | null>(null);
  const reorderDropHandledRef = useRef(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const scrollDirectionRef = useRef<number | null>(null);
  const scrollAnimRef = useRef<number | null>(null);

  const saveStoryItems = useCallback(
    async (nextItems: Moment[]) => {
      if (!id) return;
      const dedupedItems = dedupeStoryMomentsBySrc(nextItems);
      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || [];
      const existingRawItems = readStoryMomentItems(stored);
      const mergedItems = mergeStoryMomentItemsForSave(dedupedItems, existingRawItems);
      if (Array.isArray(stored)) {
        await set(storyKey, mergedItems);
      } else if (stored && typeof stored === "object") {
        await set(storyKey, { ...stored, items: mergedItems });
      } else {
        await set(storyKey, mergedItems);
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

        const { moments: loadedMoments, rawItems, usedRecovery, needsAutoBackup } =
          loadStoryMomentsFromStorage(stored);
        setMoments(loadedMoments);

        if (needsAutoBackup) {
          await autoBackupStoryMomentsBeforeNormalization(
            id,
            stored,
            usedRecovery ? "recovery" : "normalization",
          );
        }

        const shouldPersistLoadedMoments =
          loadedMoments.length > 0 &&
          (usedRecovery || loadedMoments.length !== rawItems.length);

        if (shouldPersistLoadedMoments) {
          const storyKey = `story:${id}`;
          if (Array.isArray(stored)) {
            await set(storyKey, loadedMoments);
          } else if (stored && typeof stored === "object") {
            await set(storyKey, { ...stored, items: loadedMoments });
          } else {
            await set(storyKey, loadedMoments);
          }
          try {
            const saved = (await get<StoryMeta[]>("stories")) || [];
            const idx = saved.findIndex((entry) => entry.id === id);
            if (idx > -1) {
              saved[idx].count = loadedMoments.length;
              await set("stories", saved);
            }
          } catch (e) {
            /* ignore */
          }
        }

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
          setStoryDescription(normalizeDescription(meta?.description || ""));
          const arcValue = meta?.storyArc ?? storedArc ?? null;
          setStoryArc(
            arcValue && typeof arcValue === "object" ? (arcValue as StoryArc) : null,
          );
          setStoryArcCurrentStage(
            typeof meta?.storyArcCurrentStage === "number" ? meta.storyArcCurrentStage : null,
          );
          setStagedMomentsByStage(
            normalizeStagedMomentsByStage(meta?.stagedMomentsByStage ?? storedStaged),
          );
          setNarratorEnabled(meta?.narratorEnabled !== false);
          setDirectorNotes(typeof meta?.directorNotes === "string" ? meta.directorNotes : "");
          setDialogLines(normalizeDialogLines(meta?.dialogLines));
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

  // refresh story metadata when stories-updated event fires
  useEffect(() => {
    if (!id) return;
    const handler = async () => {
      try {
        const saved = (await get<StoryMeta[]>("stories")) || [];
        const meta = saved.find((m: any) => m.id === id);
        setStoryDescription(normalizeDescription(meta?.description || ""));
        setStoryArc(
          meta?.storyArc && typeof meta.storyArc === "object" ? (meta.storyArc as StoryArc) : null,
        );
        setStoryArcCurrentStage(
          typeof meta?.storyArcCurrentStage === "number" ? meta.storyArcCurrentStage : null,
        );
        setStagedMomentsByStage(normalizeStagedMomentsByStage(meta?.stagedMomentsByStage));
        setNarratorEnabled(meta?.narratorEnabled !== false);
        setDirectorNotes(typeof meta?.directorNotes === "string" ? meta.directorNotes : "");
        setDialogLines(normalizeDialogLines(meta?.dialogLines));
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
        if (action === "move-to-trash") {
          const trash =
            (await get<any[]>("trash-moments")) || (await get<any[]>("trash-gifs")) || [];
          const moving = moments.filter((g) => ids.includes(g.id));
          const newTrash = [...trash, ...moving];
          await set("trash-moments", newTrash);
          const storyKey = `story:${id}`;
          const stored = (await get<any>(storyKey)) || [];
          const rawItems = readStoryMomentItems(stored);
          const remainingRaw = filterStoryMomentItems(rawItems, ids);
          const remaining = normalizeStoryMomentList(remainingRaw);
          await saveStoryItems(remaining);
          setMoments((prev) => prev.filter((g) => !ids.includes(g.id)));
          try {
            const saved = (await get<any>("stories")) || [];
            const idx = saved.findIndex((s: any) => s.id === id);
            if (idx > -1) {
              saved[idx].count = remaining.length;
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

  const onMomentDragStart = useCallback((gridMoments: Moment[], e: React.DragEvent, localIdx: number) => {
    reorderDropHandledRef.current = false;
    dragIndexRef.current = localIdx;
    const moment = gridMoments[localIdx];
    try {
      e.dataTransfer.setData(MOMENT_REORDER_MIME, String(localIdx));
      if (moment?.id) {
        e.dataTransfer.setData(MOMENT_ID_MIME, moment.id);
        e.dataTransfer.setData("text/plain", moment.id);
      } else {
        e.dataTransfer.setData("text/plain", String(localIdx));
      }
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
      e.dataTransfer.dropEffect = e.dataTransfer.types.includes("Files") ? "copy" : "move";
    } catch (err) {
      /* ignore */
    }

    if (dragIndexRef.current === null) return;

    const margin = 80;
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
      reorderDropHandledRef.current = false;
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
      const { agents, changed } = ensureNarratorCharacterRecord(saved);
      if (changed) {
        await set("PLAYGROUND_AGENTS", agents);
        try {
          window.dispatchEvent(new Event("characters-updated"));
        } catch (e) {
          /* ignore */
        }
      }
      setCharacters(Array.isArray(agents) ? agents : []);
    } catch (e) {
      setCharacters([]);
    }
  }, []);

  useEffect(() => {
    void loadCharacters();
  }, [loadCharacters]);

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

  const saveStoryArcObject = useCallback(
    async (arc: StoryArc | null) => {
      if (!id) return;
      setStoryArc(arc);
      await saveStoryMetadata({ storyArc: arc });
      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || [];
      if (Array.isArray(stored)) {
        if (arc) {
          await set(storyKey, { items: stored, storyArc: arc });
        } else {
          await set(storyKey, { items: stored });
        }
      } else if (stored && typeof stored === "object") {
        if (arc) {
          await set(storyKey, { ...stored, storyArc: arc });
        } else {
          const next = { ...stored };
          delete next.storyArc;
          await set(storyKey, next);
        }
      } else {
        await set(storyKey, arc ? { items: [], storyArc: arc } : { items: [] });
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

  const saveDialogLines = useCallback(
    async (lines: StoryDialogLine[]) => {
      setDialogLines(lines);
      await saveStoryMetadata({ dialogLines: lines });
    },
    [saveStoryMetadata],
  );

  const saveStoryArcCurrentStage = useCallback(
    async (stageNumber: number) => {
      setStoryArcCurrentStage(stageNumber);
      await saveStoryMetadata({ storyArcCurrentStage: stageNumber });
    },
    [saveStoryMetadata],
  );

  const storyArcStages = useMemo(
    () =>
      Array.isArray(storyArc?.stages)
        ? [...storyArc.stages].sort((a, b) => a.stageNumber - b.stageNumber)
        : [],
    [storyArc],
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
      todos: [] as StoryArcTodoItem[],
      characterIds: [] as string[],
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
      characterIds: Array.isArray(stage?.characterIds) ? [...stage.characterIds] : [],
    });
  }, [stageEditTarget, stageOpen, stagePickerOptions]);

  const addCharacterToStageEdit = useCallback((characterId: string) => {
    setStageEditForm((prev) => {
      if (prev.characterIds.includes(characterId)) return prev;
      return { ...prev, characterIds: [...prev.characterIds, characterId] };
    });
    setAssignStageCharacterOpen(false);
  }, []);

  const removeCharacterFromStageEdit = useCallback((characterId: string) => {
    setStageEditForm((prev) => ({
      ...prev,
      characterIds: prev.characterIds.filter((id) => id !== characterId),
    }));
  }, []);

  useEffect(() => {
    if (stageOpen && stageEditTarget == null) {
      setStageAssignSelection("__new__");
    }
  }, [stageOpen, stageEditTarget]);

  const buildStoryArcForEditing = useCallback((): StoryArc => {
    if (storyArc) return storyArc;
    return createEmptyStoryArc(id ?? "", title);
  }, [id, storyArc, title]);

  const persistStageEdit = useCallback(
    async (form: StageEditForm, stageNumber: number, closeAfter = true) => {
      const arc = buildStoryArcForEditing();
      const existingStage = arc.stages.find((stage) => stage.stageNumber === stageNumber);
      const nextStage: StoryArcStage = {
        stageNumber,
        stageName: form.name.trim(),
        shortDescription: existingStage?.shortDescription ?? "",
        emotionalState: existingStage?.emotionalState ?? [],
        powerDynamic: existingStage?.powerDynamic ?? "",
        keyTags: existingStage?.keyTags ?? [],
        passTest: existingStage?.passTest ?? [],
        exampleDialogTone: existingStage?.exampleDialogTone ?? "",
        characterIds: form.characterIds,
        objectives: existingStage?.objectives,
        sceneObjects: existingStage?.sceneObjects,
        todos: existingStage?.todos ?? [],
      };

      const stages = [...arc.stages];
      const existingIndex = stages.findIndex((stage) => stage.stageNumber === stageNumber);
      if (existingIndex >= 0) {
        stages[existingIndex] = nextStage;
      } else {
        stages.push(nextStage);
      }

      const nextArc: StoryArc = {
        ...arc,
        stages: stages.sort((a, b) => a.stageNumber - b.stageNumber),
      };
      await saveStoryArcObject(nextArc);
      await saveStoryArcCurrentStage(stageNumber);
      if (closeAfter) {
        setStageOpen(false);
        setStageEditTarget(null);
        setStageEditForm(createEmptyStageEditForm());
      }
    },
    [buildStoryArcForEditing, saveStoryArcObject, saveStoryArcCurrentStage],
  );

  const saveStageEdit = useCallback(async () => {
    if (stageEditTarget == null) return;
    await persistStageEdit(stageEditForm, stageEditTarget);
  }, [persistStageEdit, stageEditForm, stageEditTarget]);

  const createCharacterForStage = useCallback(async () => {
    if (stageEditTarget == null) return;
    try {
      const saved = (await get<Character[]>("PLAYGROUND_AGENTS")) || [];
      const newCharacter: Character = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: "",
      };
      const next = [...saved, newCharacter];
      await set("PLAYGROUND_AGENTS", next);
      setCharacters(next);
      try {
        window.dispatchEvent(new Event("characters-updated"));
      } catch (e) {
        /* ignore */
      }
      const nextForm: StageEditForm = {
        ...stageEditForm,
        characterIds: [...stageEditForm.characterIds, newCharacter.id],
      };
      setStageEditForm(nextForm);
      await persistStageEdit(nextForm, stageEditTarget);
      setAssignStageCharacterOpen(false);
      router.push(characterDetailHref(newCharacter.id));
    } catch (e) {
      logger.error("Failed to create character", e);
    }
  }, [persistStageEdit, router, stageEditForm, stageEditTarget]);

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

  const stageAssignOptions = useMemo(() => {
    const byNumber = new Map(storyArcStages.map((stage) => [stage.stageNumber, stage]));
    for (const stageNumber of populatedStageNumbers) {
      if (!byNumber.has(stageNumber)) {
        byNumber.set(stageNumber, {
          stageNumber,
          stageName: "",
          shortDescription: "",
          emotionalState: [],
          keyTags: [],
          passTest: [],
          exampleDialogTone: "",
          powerDynamic: "",
          todos: [],
        });
      }
    }
    return [...byNumber.values()].sort((a, b) => a.stageNumber - b.stageNumber);
  }, [populatedStageNumbers, storyArcStages]);

  const saveStagedMoments = useCallback(
    async (next: StagedMomentsByStage) => {
      if (!id) return;
      const cleaned = normalizeStagedMomentsByStage(next);
      setStagedMomentsByStage(cleaned);
      try {
        await saveStoryMetadata({ stagedMomentsByStage: cleaned });
        const storyKey = `story:${id}`;
        const stored = await get<any>(storyKey);
        const existingItems = readStoryMomentItems(stored);
        if (stored && typeof stored === "object" && !Array.isArray(stored)) {
          await set(storyKey, { ...stored, items: existingItems, stagedMomentsByStage: cleaned });
        } else {
          await set(storyKey, { items: existingItems, stagedMomentsByStage: cleaned });
        }
      } catch (e) {
        logger.error("Failed to save staged moments", e);
      }
    },
    [id, saveStoryMetadata],
  );

  const insertMomentIntoStage = useCallback(
    async (momentId: string, stageNumber: number, localInsertIdx?: number) => {
      const next: StagedMomentsByStage = { ...stagedMomentsByStage };
      for (const rawKey of Object.keys(next)) {
        const key = Number(rawKey);
        const filtered = next[key].filter((id) => id !== momentId);
        if (filtered.length > 0) next[key] = filtered;
        else delete next[key];
      }
      const stageIds = [...(next[stageNumber] || [])];
      const insertAt =
        localInsertIdx == null
          ? stageIds.length
          : Math.max(0, Math.min(localInsertIdx, stageIds.length));
      stageIds.splice(insertAt, 0, momentId);
      next[stageNumber] = stageIds;
      await saveStagedMoments(next);
    },
    [saveStagedMoments, stagedMomentsByStage],
  );

  const removeMomentFromAllStages = useCallback(
    async (momentId: string) => {
      const next: StagedMomentsByStage = { ...stagedMomentsByStage };
      let changed = false;
      for (const rawKey of Object.keys(next)) {
        const key = Number(rawKey);
        const filtered = next[key].filter((id) => id !== momentId);
        if (filtered.length !== next[key].length) changed = true;
        if (filtered.length > 0) next[key] = filtered;
        else delete next[key];
      }
      if (changed) await saveStagedMoments(next);
    },
    [saveStagedMoments, stagedMomentsByStage],
  );

  const parseExternalDropTarget = (target?: number | ExternalDropTarget): ExternalDropTarget => {
    if (typeof target === "number") return { localInsertIdx: target };
    return target ?? {};
  };

  const handleExternalDrop = useCallback(
    async (e: React.DragEvent, target?: number | ExternalDropTarget) => {
      e.preventDefault();
      e.stopPropagation();

      const options = parseExternalDropTarget(target);
      const hasFiles = Boolean(e.dataTransfer.files?.length);

      if (!hasFiles) {
        const transferTypes = Array.from(e.dataTransfer.types);
        if (
          reorderDropHandledRef.current ||
          transferTypes.includes(MOMENT_REORDER_MIME) ||
          transferTypes.includes(MOMENT_ID_MIME)
        ) {
          return;
        }
      }

      const addMoment = async (src: string, fingerprint?: string): Promise<string | null> => {
        let addedId: string | null = null;
        setMoments((ms) => {
          if (storyMomentSrcExists(ms, src, fingerprint)) {
            const existing = ms.find(
              (moment) =>
                (fingerprint && moment.fingerprint === fingerprint) ||
                momentSrcDedupeKey(moment.src) === momentSrcDedupeKey(src),
            );
            addedId = existing?.id ?? null;
            setStoryCount(ms.length).catch(() => {});
            return ms;
          }

          const newMoment: Moment = { id: crypto.randomUUID(), src, fingerprint };
          addedId = newMoment.id;
          const updated = dedupeStoryMomentsBySrc([...ms, newMoment]);
          saveStoryItems(updated).catch(() => {});
          setStoryCount(updated.length).catch(() => {});
          return updated;
        });

        if (addedId && options.stageNumber != null) {
          await insertMomentIntoStage(addedId, options.stageNumber, options.localInsertIdx);
        }
        return addedId;
      };

      if (hasFiles) {
        reorderDropHandledRef.current = false;
        dragIndexRef.current = null;
        for (const file of Array.from(e.dataTransfer.files)) {
          if (!isMomentMediaFile(file)) continue;
          const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
          await addMoment(dataUrl, fingerprint);
        }
        setDragOverIndex(null);
        stopAutoScroll();
        return;
      }

      const text = e.dataTransfer.getData("text/plain");
      if (text && !/^\d+$/.test(text.trim())) {
        const durable = isEphemeralMomentSrc(text) ? await materializeMomentSrc(text) : text;
        const finalSrc = durable || text;
        const normalized = momentSrcDedupeKey(finalSrc);
        await addMoment(finalSrc, normalized || undefined);
      }
    },
    [insertMomentIntoStage, saveStoryItems],
  );

  const onStageDrop = useCallback(
    async (stageNumber: number, stageMoments: Moment[], e: React.DragEvent, localIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderDropHandledRef.current) return;

      if (e.dataTransfer.files?.length) {
        await handleExternalDrop(e, { stageNumber, localInsertIdx: localIdx });
        return;
      }

      let momentId = "";
      try {
        momentId =
          e.dataTransfer.getData(MOMENT_ID_MIME) || e.dataTransfer.getData("text/plain");
      } catch (err) {
        momentId = "";
      }

      if (momentId && !/^\d+$/.test(momentId.trim())) {
        reorderDropHandledRef.current = true;
        dragIndexRef.current = null;
        setDragOverIndex(null);
        stopAutoScroll();
        await insertMomentIntoStage(momentId, stageNumber, localIdx);
        return;
      }

      let fromStr = "";
      try {
        fromStr = e.dataTransfer.getData(MOMENT_REORDER_MIME);
      } catch (err) {
        fromStr = String(dragIndexRef.current ?? "");
      }
      const from = fromStr ? Number(fromStr) : null;
      setDragOverIndex(null);
      stopAutoScroll();
      if (from === null || Number.isNaN(from) || from === localIdx) {
        dragIndexRef.current = null;
        return;
      }

      reorderDropHandledRef.current = true;
      dragIndexRef.current = null;

      const ids = stagedMomentsByStage[stageNumber] || [];
      const reordered = reorderStageMomentIds(ids, from, localIdx);
      await saveStagedMoments({ ...stagedMomentsByStage, [stageNumber]: reordered });
    },
    [handleExternalDrop, insertMomentIntoStage, saveStagedMoments, stagedMomentsByStage],
  );

  const onUnstagedDrop = useCallback(
    async (unstaged: Moment[], e: React.DragEvent, localIdx: number) => {
      e.preventDefault();
      e.stopPropagation();
      if (reorderDropHandledRef.current) return;

      if (e.dataTransfer.files?.length) {
        await handleExternalDrop(e, { localInsertIdx: localIdx });
        return;
      }

      let momentId = "";
      try {
        momentId =
          e.dataTransfer.getData(MOMENT_ID_MIME) || e.dataTransfer.getData("text/plain");
      } catch (err) {
        momentId = "";
      }

      if (momentId && !/^\d+$/.test(momentId.trim())) {
        reorderDropHandledRef.current = true;
        dragIndexRef.current = null;
        setDragOverIndex(null);
        stopAutoScroll();
        await removeMomentFromAllStages(momentId);
        return;
      }

      let fromStr = "";
      try {
        fromStr = e.dataTransfer.getData(MOMENT_REORDER_MIME);
      } catch (err) {
        fromStr = String(dragIndexRef.current ?? "");
      }
      const from = fromStr ? Number(fromStr) : null;
      setDragOverIndex(null);
      stopAutoScroll();
      if (from === null || Number.isNaN(from) || from === localIdx) {
        dragIndexRef.current = null;
        return;
      }

      reorderDropHandledRef.current = true;
      dragIndexRef.current = null;

      const fromMoment = unstaged[from];
      const toMoment = unstaged[localIdx];
      if (!fromMoment) return;
      const globalFrom = moments.findIndex((moment) => moment.id === fromMoment.id);
      const globalTo = toMoment
        ? moments.findIndex((moment) => moment.id === toMoment.id)
        : moments.length - 1;
      if (globalFrom < 0 || globalTo < 0) return;

      let next: Moment[] = [];
      setMoments((prev) => {
        next = dedupeStoryMomentsBySrc(reorderStoryMoments(prev, globalFrom, globalTo));
        return next;
      });

      try {
        await saveStoryItems(next);
        try {
          window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
        } catch (err) {
          /* ignore */
        }
      } catch (err) {
        logger.error("Failed to persist reordered story", err);
      }
    },
    [handleExternalDrop, id, moments, removeMomentFromAllStages, saveStoryItems],
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

  const assignSelectedToNewStage = useCallback(async () => {
    const arc = buildStoryArcForEditing();
    const nextArc = addStoryArcStage(arc);
    await saveStoryArcObject(nextArc);
    const newStageNumber = nextArc.stages[nextArc.stages.length - 1]?.stageNumber;
    if (newStageNumber == null) return;
    await assignSelectedToStage(newStageNumber);
  }, [assignSelectedToStage, buildStoryArcForEditing, saveStoryArcObject]);

  const confirmStageAssignment = useCallback(async () => {
    if (stageAssignSelection === "__new__") {
      await assignSelectedToNewStage();
      return;
    }
    const stageNumber = Number(stageAssignSelection);
    if (!Number.isFinite(stageNumber)) return;
    await assignSelectedToStage(stageNumber);
  }, [assignSelectedToNewStage, assignSelectedToStage, stageAssignSelection]);

  const getStageMoments = useCallback(
    (stageNumber: number) => {
      const ids = stagedMomentsByStage[stageNumber] || [];
      const byId = new Map(moments.map((moment) => [moment.id, moment]));
      return ids.map((momentId) => byId.get(momentId)).filter(Boolean) as Moment[];
    },
    [moments, stagedMomentsByStage],
  );

  const viewMoments = useMemo(() => {
    const ordered: Moment[] = [];
    for (const stageNumber of populatedStageNumbers) {
      ordered.push(...getStageMoments(stageNumber));
    }
    ordered.push(...unstagedMoments);
    return ordered;
  }, [getStageMoments, populatedStageNumbers, unstagedMoments]);

  const isEditMode = storyMode === "edit";

  const enterViewMode = useCallback(() => {
    setStoryMode("view");
    clearSelection(scope);
    setViewMomentIndex(0);
  }, [clearSelection, scope]);

  const enterEditMode = useCallback(() => {
    setStoryMode("edit");
  }, []);

  const goViewPrevious = useCallback(() => {
    if (viewMoments.length === 0) return;
    setViewMomentIndex((prev) => (prev > 0 ? prev - 1 : viewMoments.length - 1));
  }, [viewMoments.length]);

  const goViewNext = useCallback(() => {
    if (viewMoments.length === 0) return;
    setViewMomentIndex((prev) => (prev < viewMoments.length - 1 ? prev + 1 : 0));
  }, [viewMoments.length]);

  useEffect(() => {
    if (viewMoments.length === 0) {
      setViewMomentIndex(0);
      return;
    }
    setViewMomentIndex((prev) => Math.min(prev, viewMoments.length - 1));
  }, [viewMoments.length]);

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

      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || [];
      const rawItems = readStoryMomentItems(stored);
      const remainingRaw = filterStoryMomentItems(rawItems, ids);
      const remaining = normalizeStoryMomentList(remainingRaw);
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
  }, [clearSelection, id, moments, scope, saveStagedMoments, selectedIds, stagedMomentsByStage, saveStoryItems, setStoryCount]);

  return (
    <>
      <ContentLayout
        title={title || "Stories"}
        titleMarquee={isEditMode}
        fullBleed={!isEditMode}
        navLeft={
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HeaderBackButton label="Back to stories" onClick={() => router.push("/stories")} />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Back to stories</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {isEditMode ? (
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
            ) : null}
          </div>
        }
        navRight={
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="m4-circle-ghost bg-transparent text-foreground hover:bg-accent/10 disabled:opacity-40"
                      aria-label="Play story"
                      disabled={viewMoments.length === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        enterViewMode();
                      }}
                    >
                      <IoPlaySharp size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Play story</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="m4-circle-ghost bg-transparent text-foreground hover:bg-accent/10 disabled:opacity-40"
                      aria-label="Previous moment"
                      disabled={viewMoments.length === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        goViewPrevious();
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Previous moment</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="m4-circle-ghost bg-transparent text-foreground hover:bg-accent/10 disabled:opacity-40"
                      aria-label="Next moment"
                      disabled={viewMoments.length === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        goViewNext();
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Next moment</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="m4-circle-ghost bg-transparent text-foreground hover:bg-accent/10"
                      aria-label="Stop and return to edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        enterEditMode();
                      }}
                    >
                      <IoStopSharp size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Stop</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isEditMode && !(selectedIds || []).length ? (
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="m4-circle-ghost bg-transparent text-foreground hover:bg-accent/10"
                      aria-label="Story arc"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setStoryArcOpen(true);
                      }}
                    >
                      <SiThestorygraph size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Story arc</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="m4-circle-ghost bg-transparent text-foreground hover:bg-accent/10"
                      aria-label="Dialog"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDialogOpen(true);
                      }}
                    >
                      <IoMdChatbubbles size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Dialog</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}

            {(selectedIds || []).length > 0 && isEditMode ? (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="m4-circle-ghost bg-transparent text-foreground hover:bg-accent/10"
                        aria-label="Add to stage"
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setStageEditTarget(null);
                          setStageOpen(true);
                        }}
                      >
                        <SiLevelsdotfyi size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10}>
                      <p>Add to stage</p>
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
            className={cn(
              "h-[calc(100vh_-_var(--app-header-height,56px))]",
              isEditMode ? "overflow-auto" : "overflow-hidden bg-black",
            )}
            onDragOver={isEditMode ? (e) => e.preventDefault() : undefined}
            onDrop={isEditMode ? handleExternalDrop : undefined}
          >
            {isEditMode ? (
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
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : moments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Upload size={16} />
                    <div className="font-medium">No moments yet</div>
                  </div>
                  <div className="text-sm">
                    Drag images and MP4 videos into this story to add moments.
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteStory}
                      className="inline-flex items-center px-3 py-1.5 rounded border text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      Delete story
                    </button>
                  </div>
                  </div>
                ) : (
                  <MomentsProvider collection={moments}>
                  <>
                      {populatedStageNumbers.map((stageNumber) => {
                        const stageMoments = getStageMoments(stageNumber);
                        if (stageMoments.length === 0) return null;
                        const stageMeta = stagePickerOptions.find(
                          (stage) => stage.stageNumber === stageNumber,
                        );
                        const palette = getStagePalette(stageNumber - 1);
                        return (
                          <div key={`stage-${stageNumber}`} className="mb-8 w-full min-w-0">
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
                                      aria-label={`Scene description for stage ${stageNumber}`}
                                      onClick={() => {
                                        setStageEditTarget(stageNumber);
                                        setStageOpen(true);
                                      }}
                                    >
                                      <SquarePen size={16} />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" sideOffset={10}>
                                    <p>Scene description</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <MomentsGrid
                              moments={stageMoments}
                              selectedIds={selectedIds}
                              toggleSelect={(tid: string) => toggleSelect(scope, tid)}
                              onDragStart={(e, idx) => onMomentDragStart(stageMoments, e, idx)}
                              onDragEnd={(_idx: number) => {
                                dragIndexRef.current = null;
                                reorderDropHandledRef.current = false;
                                setDragOverIndex(null);
                                stopAutoScroll();
                              }}
                              onDragOver={onDragOver}
                              onDrop={(e, idx) => {
                                void onStageDrop(stageNumber, stageMoments, e, idx);
                              }}
                              onExternalDrop={(e, idx) => {
                                void handleExternalDrop(e, { stageNumber, localInsertIdx: idx });
                              }}
                              dragOverIndex={dragOverIndex}
                            />
                          </div>
                        );
                      })}
                      <MomentsGrid
                        moments={unstagedMoments}
                        selectedIds={selectedIds}
                        toggleSelect={(tid: string) => toggleSelect(scope, tid)}
                        onDragStart={(e, idx) => onMomentDragStart(unstagedMoments, e, idx)}
                        onDragEnd={(_idx: number) => {
                          dragIndexRef.current = null;
                          reorderDropHandledRef.current = false;
                          setDragOverIndex(null);
                          stopAutoScroll();
                        }}
                        onDragOver={onDragOver}
                        onDrop={(e, idx) => {
                          void onUnstagedDrop(unstagedMoments, e, idx);
                        }}
                        onExternalDrop={(e, idx) => {
                          void handleExternalDrop(e, { localInsertIdx: idx });
                        }}
                        dragOverIndex={dragOverIndex}
                      />
                    </>
                  <CollectionOverlay />
                </MomentsProvider>
                )}
              </div>
            ) : loading ? (
              <div className="flex h-full items-center justify-center text-sm text-white/70">
                Loading…
              </div>
            ) : moments.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-white/70">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Upload size={16} />
                  <div className="font-medium">No moments yet</div>
                </div>
                <div className="text-sm">Add moments in edit mode, then press Play.</div>
              </div>
            ) : (
              <StoryMomentsViewer
                moments={viewMoments}
                currentIndex={viewMomentIndex}
                onIndexChange={setViewMomentIndex}
                storyId={id ?? null}
                showStageNavigation={false}
                className="h-full w-full"
              />
            )}
          </div>
        </ErrorBoundary>
      </ContentLayout>{" "}
      <Dialog open={storyInfoOpen} onOpenChange={setStoryInfoOpen}>
        <DialogContent
          className="max-w-3xl overflow-hidden p-0"
          aria-describedby="story-info-description"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Story info</DialogTitle>
            <DialogDescription id="story-info-description">
              View and edit story metadata, assignments, and description.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[85vh] min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-medium">Story info</h3>
              <button
                type="button"
                onClick={() => setStoryInfoOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-foreground hover:bg-accent/20"
                aria-label="Close story info"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4 text-sm">
              <div className="min-w-0 space-y-2">
                <div
                  className="flex w-full min-w-0 items-center gap-2 rounded border border-amber-500/30 bg-amber-500/5 p-2 text-sm"
                  aria-label="Narrator"
                >
                  {narratorCharacter?.avatarUrl ? (
                    <img
                      src={narratorCharacter.avatarUrl}
                      alt="Narrator"
                      className="h-5 w-5 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <LuNotebookText size={16} className="shrink-0 text-amber-600" />
                  )}
                  <span className="font-medium">Narrator</span>
                </div>
                <label className="flex min-w-0 items-start gap-2 rounded border border-border/60 px-2 py-2 text-xs">
                  <input
                    type="checkbox"
                    checked={narratorEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setNarratorEnabled(next);
                      void saveStoryMetadata({ narratorEnabled: next });
                    }}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="min-w-0 break-words text-muted-foreground">
                    After each player/NPC exchange, recount what happened. When story arc stages
                    have todo goals, the narrator tracks completion during play.
                  </span>
                </label>
              </div>

              <div className="space-y-4 border-t border-border/40 pt-4">
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
                  maxPlainTextLength={STORY_DESCRIPTION_MAX_CHARS}
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

              <div className="pt-2 border-t border-border/40 space-y-2">
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
            setAssignStageCharacterOpen(false);
          }
        }}
      >
        <DialogContent
          className={cn("p-0", stageEditTarget != null ? "max-w-xl" : "max-w-lg")}
          aria-describedby="story-stage-description"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{stageEditTarget != null ? "Scene description" : "Add to stage"}</DialogTitle>
            <DialogDescription id="story-stage-description">
              {stageEditTarget != null
                ? "Name this stage and assign characters."
                : "Choose a stage for the selected moments."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[75vh] flex-col p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium">
                {stageEditTarget != null ? `Scene description — Stage ${stageEditTarget}` : "Add to stage"}
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
                    Name
                  </label>
                  <input
                    id="stage-edit-name"
                    value={stageEditForm.name}
                    onChange={(e) =>
                      setStageEditForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder={`Stage ${stageEditTarget}`}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <div className="text-xs uppercase text-muted-foreground">Characters</div>
                  {stageEditCharacters.length > 0 ? (
                    <ul className="space-y-2">
                      {stageEditCharacters.map((character) => (
                        <li
                          key={character.id}
                          className="flex items-center justify-between gap-2 rounded border border-border/60 px-2 py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            {character.avatarUrl ? (
                              <img
                                src={character.avatarUrl}
                                alt=""
                                className="h-8 w-8 shrink-0 rounded-full object-cover"
                              />
                            ) : (
                              <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                <User size={14} className="text-muted-foreground" />
                              </div>
                            )}
                            <span className="truncate text-sm">
                              {character.name?.trim() || "Untitled character"}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCharacterFromStageEdit(character.id)}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove ${character.name?.trim() || "character"} from stage`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No characters assigned yet.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setAssignStageCharacterOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent/20"
                  >
                    <Plus size={16} />
                    Add character
                  </button>
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
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  {(selectedIds || []).length} moment
                  {(selectedIds || []).length === 1 ? "" : "s"} selected
                </p>
                <select
                  size={Math.min(10, Math.max(4, stageAssignOptions.length + 1))}
                  value={stageAssignSelection}
                  onChange={(e) => setStageAssignSelection(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void confirmStageAssignment();
                    }
                  }}
                  aria-label="Choose a stage"
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                >
                  <option value="__new__">Add to new stage</option>
                  {stageAssignOptions.map((stage) => {
                    const stagedCount = stagedMomentsByStage[stage.stageNumber]?.length ?? 0;
                    const label = [
                      `Stage ${stage.stageNumber}`,
                      stage.stageName ? `: ${stage.stageName}` : "",
                      stagedCount > 0 ? ` (${stagedCount} moment${stagedCount === 1 ? "" : "s"})` : "",
                    ].join("");
                    return (
                      <option key={stage.stageNumber} value={String(stage.stageNumber)}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <div className="flex items-center justify-end gap-2 pt-1">
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
                      void confirmStageAssignment();
                    }}
                    className="inline-flex items-center justify-center rounded border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={assignStageCharacterOpen} onOpenChange={setAssignStageCharacterOpen}>
        <SheetContent side="center" onClick={(e) => e.stopPropagation()}>
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Add character</SheetTitle>
              <SheetClose />
            </div>
            <SheetDescription className="text-sm">
              Create a new character or select one for this stage.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                void createCharacterForStage();
              }}
              className="flex w-full items-center gap-3 rounded border p-3 hover:bg-accent/20"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800">
                <Plus size={18} />
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">Create new character</div>
                <div className="text-xs text-muted-foreground">Opens the character editor</div>
              </div>
            </button>
            {assignableCharacters.length === 0 ? (
              <p className="text-sm text-muted-foreground">No saved characters yet.</p>
            ) : (
              assignableCharacters.map((character) => {
                const isAssigned = stageEditForm.characterIds.includes(character.id);
                return (
                  <button
                    key={character.id}
                    type="button"
                    disabled={isAssigned}
                    onClick={() => addCharacterToStageEdit(character.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded p-3 text-left hover:bg-accent/20",
                      isAssigned ? "cursor-not-allowed opacity-50" : "",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {character.avatarUrl ? (
                        <img
                          src={character.avatarUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                          <User size={16} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {character.name?.trim() || "Untitled character"}
                        </div>
                        {isAssigned ? (
                          <div className="text-xs text-muted-foreground">Already on this stage</div>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-w-2xl overflow-hidden p-0"
          aria-describedby="story-dialog-description"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Dialog</DialogTitle>
            <DialogDescription id="story-dialog-description">
              Write and preview dialog lines for this story.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[85vh] min-h-0 flex-col">
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-4 py-3">
              <h3 className="text-sm font-medium">Dialog</h3>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-transparent text-foreground hover:bg-accent/20"
                aria-label="Close dialog editor"
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <div className="grid gap-2 sm:grid-cols-[minmax(0,140px)_1fr_auto]">
                <input
                  value={dialogSpeakerInput}
                  onChange={(e) => setDialogSpeakerInput(e.target.value)}
                  className="rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="Speaker"
                />
                <input
                  value={dialogTextInput}
                  onChange={(e) => setDialogTextInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const text = dialogTextInput.trim();
                    if (!text) return;
                    const nextLine: StoryDialogLine = {
                      id: newDialogLineId(),
                      speaker: dialogSpeakerInput.trim(),
                      text,
                    };
                    void saveDialogLines([...dialogLines, nextLine]);
                    setDialogSpeakerInput("");
                    setDialogTextInput("");
                  }}
                  className="rounded border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="Dialog line"
                />
                <button
                  type="button"
                  onClick={() => {
                    const text = dialogTextInput.trim();
                    if (!text) return;
                    const nextLine: StoryDialogLine = {
                      id: newDialogLineId(),
                      speaker: dialogSpeakerInput.trim(),
                      text,
                    };
                    void saveDialogLines([...dialogLines, nextLine]);
                    setDialogSpeakerInput("");
                    setDialogTextInput("");
                  }}
                  className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  disabled={!dialogTextInput.trim()}
                >
                  Add
                </button>
              </div>

              <div className="space-y-2">
                {dialogLines.length ? (
                  dialogLines.map((line, index) => {
                    const palette = getStagePalette(index);
                    return (
                      <div
                        key={line.id}
                        className="relative rounded border px-3 py-2 pr-10 text-sm"
                        style={{ backgroundColor: palette.bg, color: palette.fg }}
                      >
                        {line.speaker ? (
                          <div className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-80">
                            {line.speaker}
                          </div>
                        ) : null}
                        <div className="whitespace-pre-wrap">{line.text}</div>
                        <button
                          type="button"
                          onClick={() => {
                            void saveDialogLines(dialogLines.filter((item) => item.id !== line.id));
                          }}
                          className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
                          aria-label="Remove dialog line"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                    No dialog lines yet. Add a speaker and line above.
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <StoryArcEditor
        open={storyArcOpen}
        onOpenChange={setStoryArcOpen}
        storyId={id ?? ""}
        storyTitle={title}
        storyArc={storyArc}
        onSave={saveStoryArcObject}
      />
    </>
  );
}

