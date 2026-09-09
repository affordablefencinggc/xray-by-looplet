import type { ChatImage } from "./conversation";
export const REFERENCE_KINDS = [
  "Reference",
  "Building style",
  "Inspiration",
  "Material",
  "Plan detail",
] as const;
export type ReferenceKind = (typeof REFERENCE_KINDS)[number];
export type ReferenceImage = ChatImage & { id: string; name: string; kind: ReferenceKind };
export const BUILDING_STYLES = [
  {
    name: "Modern",
    brief:
      "Explore a modern building with clean volumes, restrained materials, generous glazing and a clear structural rhythm.",
  },
  {
    name: "Mid-century",
    brief:
      "Explore a mid-century design with warm timber, expressive roof lines, natural stone and strong indoor-outdoor connections.",
  },
  {
    name: "Brutalist",
    brief:
      "Explore a brutalist design with expressed concrete structure, deep reveals, sculptural massing and carefully controlled daylight.",
  },
  {
    name: "Art Deco",
    brief:
      "Explore an Art Deco design with stepped forms, vertical emphasis, geometric detailing and a disciplined material palette.",
  },
  {
    name: "Industrial",
    brief:
      "Explore an industrial design with exposed structure, brick, steel, honest service detailing and adaptable open spaces.",
  },
  {
    name: "Coastal",
    brief:
      "Explore a coastal design with shaded outdoor spaces, light finishes, natural textures and climate-responsive openings.",
  },
] as const;
export function referenceMessage(text: string, images: ReferenceImage[]) {
  return [
    text.trim() || "Please inspect the attached images.",
    ...images.map(
      (im, i) =>
        `Image ${i + 1}: ${im.kind} — ${im.name}. This is a resized preview; retrieve its stored original with read_assistant_file when needed. Treat this image as reference evidence; do not infer verified dimensions from it.`,
    ),
  ].join("\n");
}
export function validateReferenceFile(file: { type: string; size: number }) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 500 * 1024 * 1024 ||
    file.size === 0
  )
    throw Error("Choose PNG, JPEG or WebP images up to 500 MB each.");
}
