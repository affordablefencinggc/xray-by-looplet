import { z } from "zod";
import { sourceViewport } from "./documentViewport.ts";

export const sheetBookmarkSchema = z.object({
  id: z.string().uuid(), name: z.string().trim().min(1).max(120),
  createdAt: z.string().datetime({ offset: true }),
  zoom: z.number().finite().min(0.1).max(20),
  aspect: z.number().finite().positive().max(10000),
  center: z.object({ x: z.number().finite().min(-10000).max(10000), y: z.number().finite().min(-10000).max(10000) }).strict(),
}).strict();
export type SheetBookmark = z.infer<typeof sheetBookmarkSchema>;
export function captureSheetBookmark(name: string, zoom: number, pan: {x:number;y:number}, rendered: {width:number;height:number}): SheetBookmark {
  if (![rendered.width,rendered.height].every(v=>Number.isFinite(v)&&v>0)) throw Error("Wait for the original source page to finish rendering before saving its view.");
  return sheetBookmarkSchema.parse({id:crypto.randomUUID(),name,createdAt:new Date().toISOString(),zoom,aspect:rendered.width/rendered.height,
    center:{x:.5-pan.x/rendered.width,y:.5-pan.y/rendered.height}});
}
export function restoreSheetBookmark(bookmark: SheetBookmark, viewport: {width:number;height:number}) {
  const saved=sheetBookmarkSchema.parse(bookmark), frame=sourceViewport({x:0,y:0,width:saved.aspect,height:1},viewport.width,viewport.height,saved.zoom);
  if(!frame)throw Error("The drawing viewport is not ready. Open the saved view again after the page is visible.");
  return {zoom:saved.zoom,pan:{x:(.5-saved.center.x)*saved.aspect*frame.scale,y:(.5-saved.center.y)*frame.scale}};
}
