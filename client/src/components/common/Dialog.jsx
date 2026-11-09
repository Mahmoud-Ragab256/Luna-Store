import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
export default function Dialog({ open, onClose, title, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
