"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { HiMiniChatBubbleLeftRight } from "react-icons/hi2";
import { ArrowLeft } from "@/components/icons";
import MomentCard from "@/components/moment-card";
import { MomentDialogModal } from "@/components/moment-dialog-modal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { logger } from "@/lib/logger";
import { get } from "idb-keyval";

type MomentRecord = {
  id: string;
  src: string;
  name?: string;
  dialogLines?: unknown;
};

export default function MomentPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params as { id?: string })?.id;

  const [item, setItem] = useState<MomentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        let found: MomentRecord | null = null;

        const storiesMeta = (await get<Array<{ id: string }>>("stories")) || [];
        for (const meta of storiesMeta) {
          const storyKey = `story:${meta.id}`;
          const stored = await get<unknown>(storyKey);
          const items: unknown[] = Array.isArray(stored)
            ? stored
            : stored &&
                typeof stored === "object" &&
                Array.isArray((stored as { items?: unknown[] }).items)
              ? ((stored as { items: unknown[] }).items ?? [])
              : [];
          const match = items.find(
            (entry) => (typeof entry === "string" ? entry : (entry as { id?: string })?.id) === id,
          );
          if (match) {
            found =
              typeof match === "string"
                ? { id: match, src: match }
                : {
                    id: (match as MomentRecord).id || id,
                    src: (match as MomentRecord).src || id,
                    name: (match as MomentRecord).name,
                    dialogLines: (match as MomentRecord).dialogLines,
                  };
            break;
          }
        }

        if (mounted) setItem(found);
      } catch (error) {
        logger.error("Failed to load moment", error);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95">
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !item ? (
        <div className="text-center text-muted-foreground">Moment not found.</div>
      ) : (
        <>
          <button
            onClick={() => router.back()}
            className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-white hover:bg-white/5"
            aria-label="Close"
          >
            <ArrowLeft size={18} />
          </button>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-transparent text-white hover:bg-white/10"
                  aria-label="Dialog"
                  onClick={() => setDialogOpen(true)}
                >
                  <HiMiniChatBubbleLeftRight size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={14}>
                <p>Dialog</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="flex h-full w-full max-w-6xl items-center justify-center">
            <MomentCard item={item} anySelected={false} toggleSelect={() => {}} fullHeight />
          </div>

          <MomentDialogModal
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            momentId={item.id}
          />
        </>
      )}
    </div>
  );
}
