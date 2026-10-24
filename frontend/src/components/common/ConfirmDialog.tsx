import { useId, useRef } from "react";
import { useLocale } from "../../hooks/useLocale";
import { useModalDialog } from "./useModalDialog";
import zh from "../../locales/a11y.zh.json";
import en from "../../locales/a11y.en.json";

interface Props {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  busy?: boolean;
  disabled?: boolean;
}

export default function ConfirmDialog({ open, title, message, confirmText, cancelText, onConfirm, onCancel, danger = false, busy = false, disabled = false }: Props) {
  const { locale } = useLocale();
  const labels = locale === "en" ? en : zh;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();
  useModalDialog(open, dialogRef, cancelRef);
  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={messageId} aria-busy={busy}
      onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
      className="confirmation-dialog bg-white rounded-2xl shadow-2xl max-w-sm w-full p-0 border-0">
      <div className="p-6 [overflow-wrap:anywhere]">
        <h3 id={titleId} className="text-lg font-semibold text-slate-800 mb-2">{title ?? labels.confirmTitle}</h3>
        <p id={messageId} className="text-sm text-slate-600">{message}</p>
      </div>
      <div className="flex border-t border-slate-100">
        <button ref={cancelRef} type="button" aria-disabled={busy} onClick={() => { if (!busy) onCancel(); }} className="flex-1 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium">{cancelText ?? labels.cancel}</button>
        <div className="w-px bg-slate-100" />
        {/* Keep focus stable during pending requests; handlers enforce aria-disabled. */}
        <button type="button" aria-disabled={busy || disabled} onClick={() => { if (!busy && !disabled) onConfirm(); }} className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${danger ? "text-red-600 hover:bg-red-50" : "text-primary hover:bg-indigo-50"}`}>{confirmText ?? labels.confirm}</button>
      </div>
    </dialog>
  );
}
