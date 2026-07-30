import type { CustomChatMessage } from "@/components/ai/custom-chat-window";
import { NARRATOR_CHARACTER_ID } from "@/lib/game/narrator-agent";
import type {
  DialogLinePosition,
  DialogSpeakerPosition,
  MomentDialogLine,
  MomentDialogScript,
} from "@/lib/moment-dialog";
import { resolveCharacterPosition, resolveMomentDialogSpeakerName } from "@/lib/moment-dialog";
import type { SceneCharacter } from "@/lib/scene-characters";
export type DialogSide = "left" | "right" | "center";
export type DialogPlacementZone = "top" | "bottom" | "left" | "right";

export type ObjectContainLayout = {
  renderedWidth: number;
  renderedHeight: number;
  offsetX: number;
  offsetY: number;
  sideBarWidth: number;
};

export const MIN_LETTERBOX_WIDTH_PX = 96;
export const MIN_WIDE_LAYOUT_WIDTH_PX = 640;

export function computeObjectContainLayout(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): ObjectContainLayout {
  if (!containerWidth || !containerHeight || !imageWidth || !imageHeight) {
    return {
      renderedWidth: 0,
      renderedHeight: 0,
      offsetX: 0,
      offsetY: 0,
      sideBarWidth: 0,
    };
  }

  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  const offsetX = (containerWidth - renderedWidth) / 2;
  const offsetY = (containerHeight - renderedHeight) / 2;

  return {
    renderedWidth,
    renderedHeight,
    offsetX,
    offsetY,
    sideBarWidth: offsetX,
  };
}

export function shouldUseWideSideDialogLayout(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number,
): boolean {
  if (containerWidth < MIN_WIDE_LAYOUT_WIDTH_PX) return false;
  const layout = computeObjectContainLayout(
    containerWidth,
    containerHeight,
    imageWidth,
    imageHeight,
  );
  return layout.sideBarWidth >= MIN_LETTERBOX_WIDTH_PX;
}

export function nonNarratorCharacterOrder(
  characterOrder: string[],
  sceneCharacters: SceneCharacter[],
): string[] {
  const roleById = new Map(sceneCharacters.map((character) => [character.id, character.role]));
  return characterOrder.filter((characterId) => roleById.get(characterId) !== "narrator");
}

export function characterDialogSide(
  characterId: string,
  characterOrder: string[],
  sceneCharacters: SceneCharacter[],
  characterPositions?: Record<string, DialogSpeakerPosition>,
): DialogSide {
  const character = sceneCharacters.find((entry) => entry.id === characterId);
  if (!character || character.role === "narrator" || characterId === NARRATOR_CHARACTER_ID) {
    return "center";
  }

  const position = resolveCharacterPosition(
    { characterOrder, lines: [], characterPositions },
    characterId,
    character.role,
  );
  if (position === "left" || position === "right") return position;

  const ordered = nonNarratorCharacterOrder(characterOrder, sceneCharacters);
  const index = ordered.indexOf(characterId);
  if (index === -1) return "center";
  if (index === 0) return "left";
  if (index === 1) return "right";
  return index % 2 === 0 ? "left" : "right";
}

export function characterPlacementZone(
  characterId: string,
  sceneCharacters: SceneCharacter[],
  characterPositions?: Record<string, DialogSpeakerPosition>,
): DialogPlacementZone {
  const character = sceneCharacters.find((entry) => entry.id === characterId);
  if (!character) return "bottom";

  const position = resolveCharacterPosition(
    { characterOrder: [], lines: [], characterPositions },
    characterId,
    character.role,
  );

  if (character.role === "narrator" || characterId === NARRATOR_CHARACTER_ID) {
    return position === "top" ? "top" : "bottom";
  }

  return position === "right" ? "right" : "left";
}

export function dialogLineToChatMessage(
  line: MomentDialogLine,
  sceneCharacters: SceneCharacter[],
): CustomChatMessage {
  const character = sceneCharacters.find((entry) => entry.id === line.characterId);
  const isNarrator =
    character?.role === "narrator" || line.characterId === NARRATOR_CHARACTER_ID;
  const isPlayer = character?.role === "player";

  return {
    id: line.id,
    from: isPlayer ? "user" : "agent",
    text: line.text,
    name: resolveMomentDialogSpeakerName(line, sceneCharacters),
    messageKind: isNarrator ? "narrator" : "npc",
  };
}

export function scriptToChatMessages(
  script: MomentDialogScript,
  sceneCharacters: SceneCharacter[],
): CustomChatMessage[] {
  const preview: MomentDialogLine[] = [];
  const seen = new Set<string>();

  for (const characterId of script.characterOrder) {
    for (const line of script.lines.filter((entry) => entry.characterId === characterId)) {
      preview.push(line);
      seen.add(line.id);
    }
  }

  for (const line of script.lines) {
    if (!seen.has(line.id)) preview.push(line);
  }

  return preview.map((line) => dialogLineToChatMessage(line, sceneCharacters));
}

export function groupLinesBySide(
  script: MomentDialogScript,
  sceneCharacters: SceneCharacter[],
): Record<DialogSide, CustomChatMessage[]> {
  const grouped: Record<DialogSide, CustomChatMessage[]> = {
    left: [],
    right: [],
    center: [],
  };

  for (const message of scriptToChatMessages(script, sceneCharacters)) {
    const line = script.lines.find((entry) => entry.id === message.id);
    const side = line
      ? characterDialogSide(
          line.characterId,
          script.characterOrder,
          sceneCharacters,
          script.characterPositions,
        )
      : "center";
    grouped[side].push(message);
  }

  return grouped;
}

export function groupLinesByPlacementZone(
  script: MomentDialogScript,
  sceneCharacters: SceneCharacter[],
): Record<DialogPlacementZone, CustomChatMessage[]> {
  const grouped: Record<DialogPlacementZone, CustomChatMessage[]> = {
    top: [],
    bottom: [],
    left: [],
    right: [],
  };

  for (const message of scriptToChatMessages(script, sceneCharacters)) {
    const line = script.lines.find((entry) => entry.id === message.id);
    const zone = line
      ? characterPlacementZone(line.characterId, sceneCharacters, script.characterPositions)
      : "bottom";
    grouped[zone].push(message);
  }

  return grouped;
}

export function defaultDialogLinePosition(
  index: number,
  total: number,
  side: DialogSide,
  placementZone?: DialogPlacementZone,
): DialogLinePosition {
  const zone =
    placementZone ??
    (side === "left" ? "left" : side === "right" ? "right" : "bottom");
  const stackStep = total > 1 ? Math.min(0.12, 0.55 / (total - 1)) : 0;

  if (zone === "left") {
    return { x: 0.12, y: Math.min(0.9, 0.35 + index * stackStep) };
  }
  if (zone === "right") {
    return { x: 0.88, y: Math.min(0.9, 0.35 + index * stackStep) };
  }
  if (zone === "top") {
    return { x: 0.5, y: Math.min(0.24, 0.1 + index * 0.05) };
  }
  return { x: 0.5, y: Math.min(0.92, 0.72 + index * 0.05) };
}
