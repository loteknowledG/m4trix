"use client";
import { SelectionHeaderBar } from "@/components/ui/selection-header-bar";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import ErrorBoundary from "@/components/error-boundary";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { useCallback, useEffect, useRef, useState } from "react";
import useSelection from "@/hooks/use-selection";
import { usePathname, useRouter } from "next/navigation";
import { get, set } from "idb-keyval";
import { logger } from "@/lib/logger";
import { MomentsProvider } from "@/context/moments-collection";
import CollectionOverlay from "@/components/collection-overlay";
import MomentsGrid from "@/components/moments-grid";
import { Trash2, SquarePen, Upload } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ToastProvider, useToast } from "@/components/ui/toast";

type Moment = {
  id: string;
  src: string;
  name?: string;
  selected?: boolean;
};

function HeapInner() {
  const toast = useToast();
  const [storySheetOpen, setStorySheetOpen] = useState(false);
  const router = useRouter();
  const isImageLikeUrl = useCallback((u: string) => {
    if (!u) return false;
    const clean = u.trim();
    const base = clean.split("?")[0];
    const hasExt = [".gif", ".jpg", ".jpeg", ".png", ".webp"].some(ext => base.toLowerCase().endsWith(ext));
    const isGoogleContent = /googleusercontent\.com/.test(clean);
    return hasExt || isGoogleContent;
  }, []);
  const fixGoogleUrl = useCallback((u: string) => {
    try {
      const s = String(u || "");
      if (!s) return s;
      if (/googleusercontent\.com\//.test(s)) {
        if (!/[?&]w=\d+/.test(s) && !/=[ws]\d+/.test(s)) {
          return s + "=s0";
        }
      }
      return s;
    } catch {
      return u;
    }
  }, []);
  const proxifyUrl = useCallback((u: string) => {
    try {
      const s = String(u || "");
      if (/googleusercontent\.com\//.test(s)) {
        const esc = encodeURIComponent(s);
        return `/api/img?u=${esc}`;
      }
      return s;
    } catch {
      return u;
    }
  }, []);
  const normalizeUrls = useCallback((items: any): string[] => {
    if (!items) return [];
    const arr = Array.isArray(items) ? items : (items?.items && Array.isArray(items.items) ? items.items : (items?.urls && Array.isArray(items.urls) ? items.urls : []));
    const out: string[] = [];
    for (const it of arr) {
      if (!it) continue;
      if (typeof it === 'string') { out.push(it); continue; }
      if (typeof it === 'object') {
        const downloadUrl = typeof (it as any).downloadUrl === 'string' ? (it as any).downloadUrl : undefined;
        const baseUrl = typeof (it as any).baseUrl === 'string' ? (it as any).baseUrl : undefined;
        const urlArray = Array.isArray((it as any).url) ? (it as any).url : undefined;
        if (downloadUrl && /^https?:\/\//.test(downloadUrl)) { out.push(downloadUrl); continue; }
        if (baseUrl && /^https?:\/\//.test(baseUrl)) { out.push(baseUrl); continue; }
        if (urlArray && urlArray.length) {
          const first = urlArray.find((u: any) => typeof u === 'string' && /^https?:\/\//.test(u)) || urlArray[0];
          if (typeof first === 'string') { out.push(first); continue; }
        }
        const candidates = [
          (it as any).src, (it as any).imageUrl, (it as any).href, (it as any).link,
          (it as any).photo?.url, (it as any).media?.url, (it as any).image?.url,
        ];
        const found = candidates.find((u) => typeof u === 'string' && /^https?:\/\//.test(u));
        if (found) { out.push(found); continue; }
        for (const k of Object.keys(it)) {
          const v: any = (it as any)[k];
          if (typeof v === 'string' && /^https?:\/\//.test(v)) { out.push(v); break; }
          if (v && typeof v === 'object' && typeof v.url === 'string' && /^https?:\/\//.test(v.url)) { out.push(v.url); break; }
        }
      }
    }
    return out;
  }, []);
  // rest of file copied (unchanged)
}

export default function HeapPage() {
  return (
    <ContentLayout title="Heap">
      <ErrorBoundary>
        <ToastProvider>
          <div className="w-full h-full">
            <HeapInner />
          </div>
        </ToastProvider>
      </ErrorBoundary>
    </ContentLayout>
  );
}
