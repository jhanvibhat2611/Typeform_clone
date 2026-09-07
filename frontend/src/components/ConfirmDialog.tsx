"use client";

import { useEffect, useRef } from "react";

export function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="confirm-dialog" aria-labelledby="confirm-title" onCancel={onCancel}>
    <h2 id="confirm-title">Discard content?</h2>
    <p>{message}</p>
    <div className="confirm-actions">
      <button autoFocus className="secondary" onClick={onCancel}>Cancel</button>
      <button className="primary" onClick={onConfirm}>Discard and continue</button>
    </div>
  </dialog>;
}
