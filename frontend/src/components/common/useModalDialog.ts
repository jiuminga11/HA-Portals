import { useEffect, useRef, type RefObject } from "react";

/** The caller owns `open`; cancel/confirm callbacks never close a pending dialog. */
export function useModalDialog(
  open: boolean,
  dialogRef: RefObject<HTMLDialogElement | null>,
  initialFocusRef: RefObject<HTMLButtonElement | null>,
  triggerRef?: RefObject<HTMLElement | null>,
) {
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    returnFocus.current = triggerRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!dialog.open) dialog.showModal();
    initialFocusRef.current?.focus({ preventScroll: true });
    const containTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const stops = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
        .filter(node => node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden" && !node.closest('[hidden], [inert]'));
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (!first || !last) { event.preventDefault(); return; }
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    dialog.addEventListener("keydown", containTab);
    return () => {
      dialog.removeEventListener("keydown", containTab);
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      if (returnFocus.current?.isConnected) returnFocus.current.focus({ preventScroll: true });
    };
  }, [open, dialogRef, initialFocusRef, triggerRef]);
}
