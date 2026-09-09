# Gemini capability discussion — 2026-09-10 Brisbane

Real Live assistant conversation, read-only mode, isolated project. No implementation or geometry edits. Full text: [transcript](transcript.txt). Raw work packets and audit events: [conversation evidence](conversation-evidence.json).

Gemini read project context and the workbench reference. Its initial answer claimed a 25-operation cap and overstated X-Ray's engineering/export guarantees. Challenged against source, it withdrew those claims. The stale 25-operation text is in `src/studio/assistant/workbenchStructure.ts:27`; actual draw/edit schemas permit 200. This inconsistency is identified, not fixed in this discussion.

Our earlier diagnosis also understated existing bulk storey extrusion, stable-ID edits, undo and screenshot feedback. Missing general arrays, grouped regeneration, spatial queries and smooth surface authoring are distinct gaps. AB-01's restrictive brief is not evidence of an expressive ceiling.

Gemini proposed an articulated pavilion, but incorrectly specified a hole in a simple slab polygon and inconsistent level/operation counts. After further challenges it corrected the tiled slab construction, counted 95 operations when reusing the base level and creating three more levels, and explicitly labelled all fit/host placement untested. This planning weakness is observed; claims that token limits are the dominant bottleneck are not yet measured.

After receiving Daniel's procedural-workspace proposal, Gemini agreed with a bounded generator that emits validated native operations into isolated preview and commits atomically with undo. It highlighted retaining the generator recipe, parameters, dependency relationships and stable object IDs; otherwise regenerated assemblies become disconnected primitives. Current primitives still only approximate smooth/twisted surfaces, so richer geometry representations remain separate work.

Generating existing operations does not by itself implement sandboxing, deterministic IDs, parametric regeneration, transaction rollback or correct IFC exports. Those are requirements to implement and verify, not established benefits of the proposal. A retry was needed after a server 'turn already running' rejection; both attempts are preserved. No provider response was fabricated.

Task-owned browser closed; user development server preserved. Screenshot records the interface, while the transcript and event journal contain the actual discussion.
