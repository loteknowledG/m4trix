/** Extract assistant text from /api/agents JSON, LM Studio payloads, or plain text. */
export function extractAgentResponseText(raw: string): string {
  const text = (raw || "").trim();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as {
      text?: string;
      messages?: Array<{ text?: string }>;
      response?: { text?: string };
      error?: string;
      choices?: Array<{ message?: { content?: string | Array<{ text?: string } | string> } }>;
    };

    if (typeof parsed?.error === "string" && parsed.error.trim()) {
      return "";
    }
    if (typeof parsed?.text === "string" && parsed.text.trim()) {
      return parsed.text.trim();
    }
    if (Array.isArray(parsed?.messages) && typeof parsed.messages[0]?.text === "string") {
      return parsed.messages[0].text.trim();
    }
    if (typeof parsed?.response?.text === "string" && parsed.response.text.trim()) {
      return parsed.response.text.trim();
    }

    const choiceContent = parsed?.choices?.[0]?.message?.content;
    if (typeof choiceContent === "string" && choiceContent.trim()) {
      return choiceContent.trim();
    }
    if (Array.isArray(choiceContent)) {
      const joined = choiceContent
        .map((part) => {
          if (!part) return "";
          if (typeof part === "string") return part;
          if (typeof part === "object" && part && "text" in part) {
            const maybeText = (part as { text?: unknown }).text;
            return typeof maybeText === "string" ? maybeText : "";
          }
          return "";
        })
        .filter(Boolean)
        .join(" ")
        .trim();
      if (joined) return joined;
    }

    return text;
  } catch {
    return text;
  }
}
