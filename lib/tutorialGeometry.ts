export type TutorialRect = { x: number; y: number; width: number; height: number };

export function tutorialHighlight(target: TutorialRect, origin: { x: number; y: number }, viewport: { width: number; height: number }): TutorialRect | null {
  const x = target.x - origin.x;
  const y = target.y - origin.y;
  if (![x, y, target.width, target.height].every(Number.isFinite) || target.width <= 0 || target.height <= 0) return null;
  // Do not point to an offscreen control or a detached screen.
  if (x < 0 || y < 0 || x + target.width > viewport.width + 1 || y + target.height > viewport.height + 1) return null;
  const left = Math.max(0, x - 4);
  const top = Math.max(0, y - 4);
  return { x: left, y: top, width: Math.min(viewport.width, x + target.width + 4) - left, height: Math.min(viewport.height, y + target.height + 4) - top };
}

export function tutorialCardPlacement(target: TutorialRect | null, viewport: { width: number; height: number }, safe: { top: number; bottom: number }) {
  const margin = 12;
  const topEdge = safe.top + margin;
  const bottomEdge = viewport.height - safe.bottom - margin;
  if (!target) return { top: topEdge, maxHeight: Math.max(0, bottomEdge - topEdge) };
  const above = Math.max(0, target.y - margin - topEdge);
  const belowStart = target.y + target.height + margin;
  const below = Math.max(0, bottomEdge - belowStart);
  return above >= below
    ? { top: topEdge, maxHeight: above }
    : { top: belowStart, maxHeight: below };
}
