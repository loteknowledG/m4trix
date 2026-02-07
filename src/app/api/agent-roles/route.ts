import fs from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const AGENT_MARKDOWN_DIR = path.join(process.cwd(), "agents")

export type AgentRole = {
  id: string
  label: string
  description: string
}

async function loadAgentRoles(): Promise<AgentRole[]> {
  try {
    const entries = await fs.readdir(AGENT_MARKDOWN_DIR, { withFileTypes: true })

    const mdFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))

    const roles: AgentRole[] = []

    for (const file of mdFiles) {
      const id = file.name.replace(/\.md$/, "")
      const fullPath = path.join(AGENT_MARKDOWN_DIR, file.name)
      const raw = await fs.readFile(fullPath, "utf8")
      const trimmed = raw.trim()

      const firstHeadingLine = trimmed
        .split(/\r?\n/)
        .find((line) => line.trim().startsWith("#"))

      const label = firstHeadingLine
        ? firstHeadingLine.replace(/^#+\s*/, "").trim() || id
        : id

      roles.push({ id, label, description: trimmed })
    }

    return roles
  } catch (error) {
    console.error("/api/agent-roles error loading roles", error)
    return []
  }
}

export async function GET() {
  const roles = await loadAgentRoles()

  return new Response(JSON.stringify(roles), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  })
}
