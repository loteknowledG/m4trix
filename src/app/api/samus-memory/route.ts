import { NextResponse } from "next/server";
import fs from "fs/promises";

type MemoryRecord = {
  id?: number | string;
  type?: string;
  text?: string;
  created_at?: number;
};

const DEFAULT_MEMORY_PATH = "C:/dev/samus-manus/memory/memory_for_dexie.json";
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 40;
const EXCLUDED_TYPES = new Set(["action", "plan"]);

function getMemoryPath() {
  return (process.env.SAMUS_MEMORY_PATH || DEFAULT_MEMORY_PATH).trim();
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get("limit") || DEFAULT_LIMIT);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_LIMIT)
      : DEFAULT_LIMIT;

    const memoryPath = getMemoryPath();
    const raw = await fs.readFile(memoryPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "Memory file is not an array" }, { status: 500 });
    }

    const records = (parsed as MemoryRecord[])
      .filter((entry) => entry && typeof entry.text === "string" && entry.text.trim())
      .filter((entry) => !EXCLUDED_TYPES.has((entry.type || "").toLowerCase()))
      .sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0))
      .slice(0, limit)
      .map((entry) => ({
        id: entry.id ?? "",
        type: entry.type ?? "memory",
        text: cleanText(entry.text || ""),
      }));

    const summary = records.map((entry) => `- [${entry.type}] ${entry.text}`).join("\n");

    return NextResponse.json({
      ok: true,
      source: memoryPath,
      count: records.length,
      records,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to load memory" },
      { status: 500 }
    );
  }
}
