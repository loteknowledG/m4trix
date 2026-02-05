import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// Simple proxy to list models available to your Zen API key.
//
// It uses the following env vars:
// - ZEN_API_KEY      (required)
// - ZEN_API_URL      (used to infer the base URL if ZEN_MODELS_URL is not set)
// - ZEN_MODELS_URL   (optional explicit models endpoint, e.g. "https://opencode.ai/zen/v1/models")
//
// If ZEN_MODELS_URL is not set, we derive it from ZEN_API_URL by stripping the
// trailing path and appending "/models". You can override this by setting
// ZEN_MODELS_URL explicitly in .env.local if Zen uses a different endpoint.

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

export async function GET(_req: NextRequest) {
  const zenApiKey = process.env.ZEN_API_KEY
  const zenApiUrl = process.env.ZEN_API_URL
  const explicitModelsUrl = process.env.ZEN_MODELS_URL

  if (!zenApiKey) {
    return new Response("ZEN_API_KEY is not configured", { status: 400 })
  }

  const modelsUrl = explicitModelsUrl || deriveModelsUrlFromChatUrl(zenApiUrl)

  if (!modelsUrl) {
    return new Response(
      "No models URL configured. Set ZEN_MODELS_URL or a valid ZEN_API_URL.",
      { status: 400 },
    )
  }

  try {
    const response = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${zenApiKey}`,
      },
    })

    const text = await response.text()

    if (!response.ok) {
      return new Response(
        `Zen models endpoint error ${response.status}: ${text || response.statusText}`,
        { status: response.status },
      )
    }

    // Pass through JSON from Zen so you can see all details, including
    // any fields that indicate free / paid tiers.
    return new Response(text, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : typeof error === "string" ? error : "Internal error"

    return new Response(`Failed to fetch Zen models: ${message}`, {
      status: 500,
    })
  }
}
