import { NextResponse } from "next/server";
import fs from "fs/promises";

type MemoryRecord = {
  id?: number | string;
  type?: string;
  text?: string;
  created_at?: number;
  tags?: unknown[];
  metadata?: unknown;
};

const DEFAULT_MEMORY_PATH = "C:/dev/samus-manus/memory/memory_for_dexie.json";
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 40;
const MAX_SCAN_RECORDS = 5000;
const MAX_FIELD_CHARS = 1200;
const EXCLUDED_TYPES = new Set(["action", "plan"]);

function getMemoryPath() {
  return (process.env.SAMUS_MEMORY_PATH || DEFAULT_MEMORY_PATH).trim();
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function toLower(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function tokenize(value: string | null | undefined) {
  const normalized = toLower(value);
  if (!normalized) return [] as string[];
  return normalized
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function safeString(value: unknown) {
  if (typeof value === "string") return value.slice(0, MAX_FIELD_CHARS);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value).slice(0, MAX_FIELD_CHARS);
  } catch {
    return "";
  }
}

function scoreRecord(
  entry: MemoryRecord,
  context: {
    storyId: string;
    storyTitleTokens: string[];
    npcId: string;
    npcNameTokens: string[];
    playerId: string;
    playerNameTokens: string[];
  }
) {
  const haystack = [
    safeString(entry.text),
    safeString(entry.metadata),
    Array.isArray(entry.tags) ? entry.tags.map((tag) => safeString(tag)).join(" ") : "",
    String(entry.id ?? ""),
    String(entry.type ?? ""),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  if (context.storyId && haystack.includes(context.storyId)) score += 12;
  if (context.npcId && haystack.includes(context.npcId)) score += 10;
  if (context.playerId && haystack.includes(context.playerId)) score += 10;

  for (const token of context.storyTitleTokens) {
    if (haystack.includes(token)) score += 3;
  }
  for (const token of context.npcNameTokens) {
    if (haystack.includes(token)) score += 4;
  }
  for (const token of context.playerNameTokens) {
    if (haystack.includes(token)) score += 4;
  }

  return score;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get("limit") || DEFAULT_LIMIT);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(Math.trunc(limitRaw), 1), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const storyId = toLower(searchParams.get("storyId"));
    const storyTitleTokens = tokenize(searchParams.get("storyTitle"));
    const npcId = toLower(searchParams.get("npcId"));
    const npcNameTokens = tokenize(searchParams.get("npcName"));
    const playerId = toLower(searchParams.get("playerId"));
    const playerNameTokens = tokenize(searchParams.get("playerName"));

    const memoryPath = getMemoryPath();
    const raw = await fs.readFile(memoryPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ ok: false, error: "Memory file is not an array" }, { status: 500 });
    }

    const entries = (parsed as MemoryRecord[])
      .filter((entry) => entry && typeof entry.text === "string" && entry.text.trim())
      .filter((entry) => !EXCLUDED_TYPES.has(toLower(entry.type)));

    // Guardrail for very large memory stores: keep most recent records for ranking.
    const scanPool = entries
      .sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0))
      .slice(0, MAX_SCAN_RECORDS);

    const contextAware = !!(
      storyId ||
      storyTitleTokens.length ||
      npcId ||
      npcNameTokens.length ||
      playerId ||
      playerNameTokens.length
    );

    const ranked = scanPool
      .map((entry) => ({
        entry,
        createdAt: Number(entry.created_at) || 0,
        relevance: scoreRecord(entry, {
          storyId,
          storyTitleTokens,
          npcId,
          npcNameTokens,
          playerId,
          playerNameTokens,
        }),
      }))
      .sort((a, b) => {
        if (contextAware && b.relevance !== a.relevance) return b.relevance - a.relevance;
        return b.createdAt - a.createdAt;
      });

    const records = ranked
      .slice(0, limit)
      .map((entry) => ({
        id: entry.entry.id ?? "",
        type: entry.entry.type ?? "memory",
        text: cleanText(entry.entry.text || ""),
      }));

    const summary = records.map((entry) => `- [${entry.type}] ${entry.text}`).join("\n");

    return NextResponse.json({
      ok: true,
      source: memoryPath,
      count: records.length,
      contextAware,
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
