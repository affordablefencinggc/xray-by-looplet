export type AssistantRect = { x: number; y: number; width: number; height: number };
export type AssistantViewport = { width: number; height: number };
const MARGIN = 12,
  LAUNCHER = 52;
export function fitAssistantRect(rect: AssistantRect, viewport: AssistantViewport): AssistantRect {
  const width = Math.max(
    Math.min(300, viewport.width - MARGIN * 2),
    Math.min(rect.width, viewport.width - MARGIN * 2),
  );
  const height = Math.max(
    Math.min(300, viewport.height - MARGIN * 2 - LAUNCHER),
    Math.min(rect.height, viewport.height - MARGIN * 2 - LAUNCHER),
  );
  return {
    width,
    height,
    x: Math.max(MARGIN, Math.min(rect.x, viewport.width - width - MARGIN)),
    y: Math.max(MARGIN, Math.min(rect.y, viewport.height - height - LAUNCHER - MARGIN)),
  };
}
export function defaultAssistantRect(viewport: AssistantViewport): AssistantRect {
  return fitAssistantRect({ x: viewport.width - 376, y: viewport.height - 468, width: 360, height: 400 }, viewport);
}
export function changeAssistantRect(
  rect: AssistantRect,
  dx: number,
  dy: number,
  mode: "move" | "resize",
  viewport: AssistantViewport,
) {
  if (mode === "move")
    return fitAssistantRect({ ...rect, x: rect.x + dx, y: rect.y + dy }, viewport);
  const height = Math.max(300, Math.min(rect.height - dy, rect.y + rect.height - MARGIN));
  return fitAssistantRect(
    { ...rect, width: rect.width + dx, height, y: rect.y + rect.height - height },
    viewport,
  );
}
export function readAssistantRect(text: string | null, viewport: AssistantViewport) {
  try {
    const value = JSON.parse(text ?? "null");
    if (
      !value ||
      !["x", "y", "width", "height"].every(
        (k) => typeof value[k] === "number" && Number.isFinite(value[k]),
      )
    )
      return defaultAssistantRect(viewport);
    return fitAssistantRect(value, viewport);
  } catch {
    return defaultAssistantRect(viewport);
  }
}
