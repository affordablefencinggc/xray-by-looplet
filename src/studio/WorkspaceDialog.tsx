import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function WorkspaceDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      old?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="workspace-dialog"
      aria-label={title}
      onCancel={onClose}
      onKeyDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <header className="workspace-dialog-heading">
        <div>
          <span className="kicker">X-Ray workspace</span>
          <h2>{title}</h2>
        </div>
        <button className="pill" aria-label={`Close ${title}`} onClick={onClose}>
          <X size={18} /> Close
        </button>
      </header>
      {children}
    </dialog>
  );
}
