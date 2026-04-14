const normalizeMomentText = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
};

export const storyTextForPrompt = (value: string) => {
  const raw = typeof value === "string" ? value : "";
  if (!raw.trim()) return "";
  if (typeof document === "undefined") {
    return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const container = document.createElement("div");
  container.innerHTML = raw;
  return (container.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const getMomentSearchText = (moment: any) => {
  const pieces = [
    moment?.name,
    moment?.title,
    moment?.description,
    moment?.text,
    moment?.caption,
    Array.isArray(moment?.tags) ? moment.tags.join(" ") : "",
  ];
  return normalizeMomentText(pieces.filter(Boolean).join(" "));
};

export const scoreMomentForStory = (
  moment: any,
  contextText: string,
  titleMomentId?: string | null,
) => {
  const normalizedContext = normalizeMomentText(contextText);
  if (!normalizedContext) return 0;

  let score = 0;
  const tags = Array.isArray(moment?.tags) ? moment.tags : [];

  for (const rawTag of tags) {
    const tag = normalizeMomentText(rawTag);
    if (!tag) continue;
    if (normalizedContext.includes(tag)) {
      score += 6;
      continue;
    }

    const tagWords = tag.split(/\s+/).filter(Boolean);
    if (tagWords.length && tagWords.every((word) => normalizedContext.includes(word))) {
      score += 3;
      continue;
    }

    if (tagWords.some((word) => normalizedContext.includes(word))) {
      score += 1;
    }
  }

  const searchText = getMomentSearchText(moment);
  if (searchText && normalizedContext.includes(searchText)) {
    score += 2;
  }

  if (titleMomentId && moment?.id === titleMomentId) {
    score += 2;
  }

  return score;
};

export const pickBestMomentIndex = (
  moments: any[],
  contextText: string,
  titleMomentId?: string | null,
) => {
  if (!moments.length) return 0;

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  moments.forEach((moment, index) => {
    const score = scoreMomentForStory(moment, contextText, titleMomentId);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
};
