import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Hardcoded OpenCode endpoints.
const ZEN_CHAT_URL = "https://opencode.ai/zen/v1/chat/completions"
const ZEN_MODELS_URL = "https://opencode.ai/zen/v1/models"

// Google Gemini OpenAI-compatible endpoints
const GOOGLE_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/openai/v1/models"

// Simple proxy to list models available to your Zen/OpenCode API key.
//
// Uses the hardcoded OpenCode models endpoint above. You can still
// override this by changing ZEN_MODELS_URL here if needed.

function deriveModelsUrlFromChatUrl(chatUrl: string | undefined): string | null {
  if (!chatUrl) return null

  try {
    const url = new URL(chatUrl)
    // keep origin + first path segment ("/zen/v1") and then add "/models"
    const segments = url.pathname.split("/").filter(Boolean)
    if (segments.length >= 2) {
      const basePath = `/${segments[0]}/${segments[1]}`
      return `${url.origin}${basePath}/models`
    }
    // Fallback: just use origin + "/models"
    return `${url.origin}/models`
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const overrideKey = req.headers.get("x-zen-api-key")?.trim() || null
  const googleOverrideKey = req.headers.get("x-google-api-key")?.trim() || null
  
  const zenApiKey = overrideKey || process.env.ZEN_API_KEY
  const googleApiKey = googleOverrideKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!zenApiKey && !googleApiKey) {
    return new Response(
      "Neither ZEN_API_KEY nor GOOGLE_GENERATIVE_AI_API_KEY are configured, and no per-request key was provided",
      { status: 400 },
    )
  }

  // If a google key is provided (or specifically requested via header), prefer it or use it.
  // In the playground, the client sends exactly one key header usually.
  const isGoogle = Boolean(googleOverrideKey || (googleApiKey && !zenApiKey && !overrideKey))
  
  const modelsUrl = isGoogle 
    ? GOOGLE_MODELS_URL 
    : (ZEN_MODELS_URL || deriveModelsUrlFromChatUrl(ZEN_CHAT_URL))
    
  const apiKeyToUse = isGoogle ? googleApiKey : zenApiKey

  try {
    const response = await fetch(modelsUrl!, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKeyToUse}`,
      },
    })

    const text = await response.text()

    if (!response.ok) {
      const provider = isGoogle ? "Google Gemini" : "Zen"
      return new Response(
        `${provider} models endpoint error ${response.status}: ${text || response.statusText}`,
        { status: response.status },
      )
    }

    // Pass through JSON from provider so you can see all details.
    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error: unknown) {
    const provider = isGoogle ? "Google Gemini" : "Zen"
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Internal error"

    return new Response(`Failed to fetch ${provider} models: ${message}`, {
      status: 500,
    })
  }
}
