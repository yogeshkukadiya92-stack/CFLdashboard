"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function ConfirmDialog({
  cancelLabel = "Cancel",
  children,
  confirmLabel = "Confirm",
  description,
  onCancel,
  onConfirm,
  open,
  title
}: {
  cancelLabel?: string;
  children?: ReactNode;
  confirmLabel?: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: string;
}) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600">
              <AlertTriangle className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-black text-slate-950">{title}</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
            </div>
          </div>
          <button
            aria-label="Close dialog"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        {children ? <div className="border-b border-slate-100 px-5 py-4 text-sm font-semibold text-slate-600">{children}</div> : null}
        <div className="flex flex-col-reverse gap-2 p-5 sm:flex-row sm:justify-end">
          <button className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
