import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, FileImage, ImagePlus, Trash2 } from "lucide-react";
import type { GateRecord, PhotoEvidence } from "./domain";
import type { EditableFenceRun } from "./tracing";
import { EvidenceGallery } from "./EvidenceGallery";
import { WorkspaceDialog } from "./WorkspaceDialog";

type EvidenceLink = Pick<EditableFenceRun | GateRecord, "id" | "label">;
type PhotoPatch = Partial<Pick<PhotoEvidence, "caption" | "runIds" | "gateIds">>;

export type PhotoEvidencePanelProps = {
  photos: readonly PhotoEvidence[];
  photoPreviewUrls: Readonly<Record<string, string>>;
  runs: readonly EvidenceLink[];
  gates: readonly EvidenceLink[];
  error: string | null;
  onAddPhotos: (files: File[]) => Promise<void>;
  onUpdatePhoto: (photoId: string, expectedRevision: number, patch: PhotoPatch) => void;
  onReorderPhoto: (photoId: string, toIndex: number, expectedRevision: number) => void;
  onRemovePhoto: (photoId: string, expectedRevision: number) => Promise<void>;
  disabled?: boolean;
};

export function PhotoEvidencePanel({
  photos,
  photoPreviewUrls,
  runs,
  gates,
  error,
  onAddPhotos,
  onUpdatePhoto,
  onReorderPhoto,
  onRemovePhoto,
  disabled = false,
}: PhotoEvidencePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const ordered = [...photos].sort(
    (left, right) => left.order - right.order || left.id.localeCompare(right.id),
  );
  const activePhoto = ordered.find((photo) => photo.id === selectedPhoto);

  async function selectFiles(files: FileList | null) {
    if (!files?.length) return;
    setPending(true);
    try {
      await onAddPhotos(Array.from(files));
    } catch {
      // The store supplies the visible, actionable error through the error prop.
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section
      className="photo-evidence-panel"
      aria-labelledby="photo-evidence-heading"
      aria-busy={pending || undefined}
    >
      <header className="photo-evidence-heading-row">
        <div>
          <span className="eyebrow">Site evidence</span>
          <h2 id="photo-evidence-heading">Inspection photos</h2>
        </div>
        <span className="muted-count">{ordered.length}</span>
      </header>
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled || pending}
        aria-label="Choose site evidence photos"
        onChange={(event) => void selectFiles(event.currentTarget.files)}
      />
      {error ? (
        <div className="photo-evidence-error" role="alert">
          <strong>Photo evidence needs attention</strong>
          <span>{error}</span>
        </div>
      ) : null}

      {ordered.length === 0 ? (
        <button
          className="photo-evidence-drop"
          type="button"
          disabled={disabled || pending}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus className="size-6" aria-hidden="true" />
          <strong>{pending ? "Adding photos" : "Add site photos"}</strong>
          <span>JPEG, PNG or WebP evidence of ground, access, corners and existing conditions</span>
        </button>
      ) : (
        <>
          <div className="photo-card-list">
            {ordered.map((photo, index) => (
              <article className="photo-evidence-card" key={photo.id}>
                <button
                  type="button"
                  className="photo-thumbnail"
                  aria-label={`View photo ${photo.name}`}
                  onClick={() => setSelectedPhoto(photo.id)}
                >
                  {photoPreviewUrls[photo.id] ? (
                    <img src={photoPreviewUrls[photo.id]} alt={photo.caption || photo.name} />
                  ) : (
                    <span role="status">
                      <FileImage className="size-5" aria-hidden="true" />
                      Original unavailable
                    </span>
                  )}
                </button>
                <div className="photo-card-body">
                  <div className="photo-card-title">
                    <strong>{photo.name}</strong>
                    <span>Rev {photo.revision}</span>
                  </div>
                  <span className="photo-card-meta">
                    {formatFileSize(photo.sizeBytes)} · {photo.source} ·{" "}
                    {photo.sha256 ? `SHA ${photo.sha256.slice(0, 10)}…` : "Hash pending"}
                  </span>
                  {photo.sha256 ? (
                    <code className="photo-card-hash" title={photo.sha256}>
                      SHA-256 {photo.sha256}
                    </code>
                  ) : (
                    <span className="photo-card-integrity" role="status">
                      Integrity hash unavailable
                    </span>
                  )}
                  {!photoPreviewUrls[photo.id] ? (
                    <span className="photo-card-integrity" role="alert">
                      The original image bytes could not be retrieved. Re-import the photo before
                      relying on this evidence.
                    </span>
                  ) : null}
                  <label className="field">
                    <span>Caption</span>
                    <textarea
                      rows={2}
                      disabled={disabled}
                      value={photo.caption}
                      onChange={(event) =>
                        onUpdatePhoto(photo.id, photo.revision, {
                          caption: event.currentTarget.value,
                        })
                      }
                      placeholder="What does this photo prove?"
                    />
                  </label>
                  <EvidenceLinks
                    label="Link to runs"
                    items={runs}
                    selectedIds={photo.runIds}
                    disabled={disabled}
                    onChange={(runIds) => onUpdatePhoto(photo.id, photo.revision, { runIds })}
                  />
                  <EvidenceLinks
                    label="Link to gates"
                    items={gates}
                    selectedIds={photo.gateIds}
                    disabled={disabled}
                    onChange={(gateIds) => onUpdatePhoto(photo.id, photo.revision, { gateIds })}
                  />
                  <div className="photo-card-actions">
                    <button
                      type="button"
                      aria-label={`Move ${photo.name} earlier`}
                      disabled={disabled || index === 0}
                      onClick={() => onReorderPhoto(photo.id, index - 1, photo.revision)}
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                      Earlier
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${photo.name} later`}
                      disabled={disabled || index === ordered.length - 1}
                      onClick={() => onReorderPhoto(photo.id, index + 1, photo.revision)}
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                      Later
                    </button>
                    <button
                      type="button"
                      className="remove"
                      aria-label={`Remove ${photo.name}`}
                      disabled={disabled}
                      onClick={() => void onRemovePhoto(photo.id, photo.revision)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <button
            className="photo-add-more"
            type="button"
            disabled={disabled || pending}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden="true" />{" "}
            {pending ? "Adding photos" : "Add photos"}
          </button>
        </>
      )}
      {activePhoto && (
        <WorkspaceDialog title="Inspection photo viewer" onClose={() => setSelectedPhoto(null)}>
          <EvidenceGallery
            activeId={activePhoto.id}
            onSelect={setSelectedPhoto}
            items={ordered.map((photo) => ({
              id: photo.id,
              title: photo.caption || photo.name,
              preview: photoPreviewUrls[photo.id] ? (
                <img src={photoPreviewUrls[photo.id]} alt={photo.caption || photo.name} />
              ) : (
                <span>Original unavailable</span>
              ),
            }))}
            tools={
              <div className="photo-viewer-tools">
                <h3>Photo tools</h3>
                <a
                  className="pill"
                  href={photoPreviewUrls[activePhoto.id]}
                  download={activePhoto.name}
                  aria-disabled={!photoPreviewUrls[activePhoto.id]}
                >
                  Download original
                </a>
                <button
                  className="pill"
                  disabled={disabled || pending}
                  onClick={() => inputRef.current?.click()}
                >
                  Add photos
                </button>
                <label>
                  Caption
                  <textarea
                    aria-label="Photo caption"
                    rows={3}
                    disabled={disabled}
                    value={activePhoto.caption}
                    onChange={(e) =>
                      onUpdatePhoto(activePhoto.id, activePhoto.revision, {
                        caption: e.target.value,
                      })
                    }
                  />
                </label>
                <EvidenceLinks
                  label="Link to runs"
                  items={runs}
                  selectedIds={activePhoto.runIds}
                  disabled={disabled}
                  onChange={(runIds) =>
                    onUpdatePhoto(activePhoto.id, activePhoto.revision, { runIds })
                  }
                />
                <EvidenceLinks
                  label="Link to gates"
                  items={gates}
                  selectedIds={activePhoto.gateIds}
                  disabled={disabled}
                  onChange={(gateIds) =>
                    onUpdatePhoto(activePhoto.id, activePhoto.revision, { gateIds })
                  }
                />
                <details>
                  <summary>More actions</summary>
                  <div className="settings-actions">
                    <button
                      className="pill"
                      disabled={disabled || ordered[0].id === activePhoto.id}
                      onClick={() =>
                        onReorderPhoto(
                          activePhoto.id,
                          ordered.findIndex((p) => p.id === activePhoto.id) - 1,
                          activePhoto.revision,
                        )
                      }
                    >
                      Move earlier
                    </button>
                    <button
                      className="pill"
                      disabled={disabled || ordered.at(-1)?.id === activePhoto.id}
                      onClick={() =>
                        onReorderPhoto(
                          activePhoto.id,
                          ordered.findIndex((p) => p.id === activePhoto.id) + 1,
                          activePhoto.revision,
                        )
                      }
                    >
                      Move later
                    </button>
                    <button
                      className="pill"
                      disabled={disabled}
                      onClick={() => void onRemovePhoto(activePhoto.id, activePhoto.revision)}
                    >
                      Remove photo
                    </button>
                  </div>
                </details>
                <div className="gallery-image-details">
                  <h3>Image details</h3>
                  <strong>{activePhoto.name}</strong>
                  <p>
                    {formatFileSize(activePhoto.sizeBytes)} · Revision {activePhoto.revision}
                  </p>
                  <p>{activePhoto.source}</p>
                  <code>SHA-256 {activePhoto.sha256 ?? "Unavailable"}</code>
                </div>
              </div>
            }
          >
            {photoPreviewUrls[activePhoto.id] ? (
              <img
                className="gallery-original-photo"
                src={photoPreviewUrls[activePhoto.id]}
                alt={activePhoto.caption || activePhoto.name}
              />
            ) : (
              <p>The original image could not be retrieved. Re-import it to restore the preview.</p>
            )}
          </EvidenceGallery>
        </WorkspaceDialog>
      )}
    </section>
  );
}

function EvidenceLinks({
  label,
  items,
  selectedIds,
  disabled,
  onChange,
}: {
  label: string;
  items: readonly EvidenceLink[];
  selectedIds: readonly string[];
  disabled: boolean;
  onChange: (ids: string[]) => void;
}) {
  return (
    <fieldset className="photo-evidence-links">
      <legend>{label}</legend>
      {items.length ? (
        <div>
          {items.map((item) => {
            const checked = selectedIds.includes(item.id);
            return (
              <label key={item.id}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() =>
                    onChange(
                      checked
                        ? selectedIds.filter((id) => id !== item.id)
                        : [...selectedIds, item.id],
                    )
                  }
                />
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      ) : (
        <span>No {label.endsWith("runs") ? "runs" : "gates"} available yet.</span>
      )}
    </fieldset>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
