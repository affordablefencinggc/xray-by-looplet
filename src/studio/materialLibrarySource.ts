import { THORNTON_LIBRARY } from "./construction/thorntonLibrary";
import { inspectPlanBytes } from "./documents";
import { useStudio } from "./store";

export async function openMaterialLibrarySource(item: (typeof THORNTON_LIBRARY)[number]) {
  const before = useStudio.getState();
  const existing = before.job.documents.find(
    (d) => d.sha256 === item.sha256 && d.source !== "sample",
  );
  if (existing) await before.selectDocument(existing.id);
  else {
    const response = await fetch(item.url);
    if (!response.ok) throw Error("Reference drawing could not be loaded.");
    const imported = await inspectPlanBytes({
      name: `${item.name}.pdf`,
      bytes: new Uint8Array(await response.arrayBuffer()),
      source: "web",
    });
    if (imported.binary.sha256 !== item.sha256 || imported.revision.pageCount !== item.pageCount)
      throw Error("Reference bytes or page count differ from the verified source.");
    const current = useStudio.getState();
    if (current.job.id !== before.job.id || current.activePlanBinary !== before.activePlanBinary)
      throw Error("Project or source changed while loading. Newer work preserved.");
    await current.importPlan(imported);
  }
  const current = useStudio.getState();
  if (current.job.id !== before.job.id || current.activePlanBinary?.sha256 !== item.sha256)
    throw Error("Source selection changed; registration cancelled.");
}
