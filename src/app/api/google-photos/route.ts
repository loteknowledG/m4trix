import { NextResponse } from "next/server";
import { createRequire } from "module";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

// Ensure this route runs on Node.js (not Edge) and is always dynamic
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const albumUrl = body?.albumUrl;
    if (!albumUrl) return NextResponse.json({ error: "albumUrl required" }, { status: 400 });

    // Robust resolver: ESM import -> CJS require -> require.resolve -> scan pnpm store
    const pickFn = (mod: any) => {
      const candidates: any[] = [];
      const pushFnsFrom = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        // Prefer well-known names
        const named = [
          obj.fetchAlbum,
          obj.fetchAlbumImageUrls,
          obj.getAlbumImageUrls,
          obj.getImageUrls,
          obj.getUrls,
          obj.fetchImageUrls,
        ].filter((f) => typeof f === "function");
        candidates.push(...named);
        // Fallback: first function value in the object
        const anyFn = Object.values(obj).find((v: any) => typeof v === "function");
        if (anyFn) candidates.push(anyFn);
      };

      if (typeof mod === "function") return mod;
      if (mod && typeof mod === "object") {
        // If default is a function use it; if it's an object, search inside it
        if (typeof mod.default === "function") return mod.default;
        pushFnsFrom(mod.default);
        pushFnsFrom(mod);
      }
      return candidates[0] ?? null;
    };
    let fn: any = null;
    const errs: string[] = [];
    // 1) Try standard ESM import
    try {
      const esm = await import("google-photos-album-image-url-fetch");
      fn = pickFn(esm);
    } catch (e: any) {
      errs.push(`esm:${String(e?.message || e)}`);
    }
    // 2) Try CJS via createRequire
    if (!fn) {
      try {
        const require = createRequire(import.meta.url);
        const cjs = require("google-photos-album-image-url-fetch");
        fn = pickFn(cjs);
      } catch (e: any) {
        errs.push(`cjs:${String(e?.message || e)}`);
      }
    }
    // 3) Try require.resolve then import by path
    if (!fn) {
      try {
        const require = createRequire(import.meta.url);
        const resolved = require.resolve("google-photos-album-image-url-fetch");
        const url = pathToFileURL(resolved).href;
        const byPath = await import(url);
        fn = pickFn(byPath);
      } catch (e: any) {
        errs.push(`resolve:${String(e?.message || e)}`);
      }
    }
    // 4) Scan pnpm virtual store for the package entry
    if (!fn) {
      try {
        const nm = path.join(process.cwd(), "node_modules", ".pnpm");
        if (fs.existsSync(nm)) {
          const entries = fs.readdirSync(nm);
          for (const ent of entries) {
            if (ent.includes("google-photos-album-image-url-fetch")) {
              const pkgDir = path.join(nm, ent, "node_modules", "google-photos-album-image-url-fetch");
              const entryCandidates = [
                path.join(pkgDir, "dist", "index.js"),
                path.join(pkgDir, "index.js"),
                path.join(pkgDir, "main.js"),
              ];
              for (const cand of entryCandidates) {
                if (fs.existsSync(cand)) {
                  const mod = await import(pathToFileURL(cand).href);
                  fn = pickFn(mod);
                  if (fn) break;
                }
              }
              if (fn) break;
            }
          }
        }
      } catch (e: any) {
        errs.push(`pnpm:${String(e?.message || e)}`);
      }
    }
    if (!fn || typeof fn !== "function") {
      return NextResponse.json({ error: "Unable to load google-photos-album-image-url-fetch", detail: errs.join("; ") }, { status: 500 });
    }

    const urls = await fn(albumUrl);

    // Do not coerce items to strings; callers (like the heap demo)
    // can normalize objects or strings into URLs as needed.
    const out = Array.isArray(urls) ? urls : [];
    return NextResponse.json({ urls: out });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
