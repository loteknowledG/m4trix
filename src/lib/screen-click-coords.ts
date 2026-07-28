function viewportPointToScreen(centerX: number, centerY: number): { x: number; y: number } {
  const viewport = window.visualViewport;
  const viewportOffsetX = viewport?.offsetLeft ?? 0;
  const viewportOffsetY = viewport?.offsetTop ?? 0;

  const cssX = window.screenX + viewportOffsetX + centerX;
  const cssY = window.screenY + viewportOffsetY + centerY;

  const scale = window.devicePixelRatio || 1;
  return {
    x: Math.round(cssX * scale),
    y: Math.round(cssY * scale),
  };
}

function embedTargetElement(element: HTMLElement): HTMLElement {
  const iframe = element.querySelector('iframe');
  return iframe instanceof HTMLElement ? iframe : element;
}

/** Center of the embed — any click on the player starts playback. */
export function elementToScreenClick(element: HTMLElement): { x: number; y: number } {
  const target = embedTargetElement(element);
  const rect = target.getBoundingClientRect();
  return viewportPointToScreen(
    rect.left + rect.width / 2,
    rect.top + rect.height / 2,
  );
}
