import { useEffect, useId, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/layout/AdminSidebar";
import { basePath } from "../../lib/basePath";
import AuthRecoveryNotice from "../../components/common/AuthRecoveryNotice";
import { useModalDialog } from "../../components/common/useModalDialog";
import { useLocale } from "../../hooks/useLocale";
import "../../styles/admin.css";

export default function AdminLayout() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const titleId = useId();
  useModalDialog(menuOpen, dialogRef, closeRef, triggerRef);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="admin-shell flex flex-col h-screen">
      <header className="admin-topbar px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <button ref={triggerRef} type="button" className="admin-toolbar-button md:hidden"
            aria-label={t.admin.openMenu} aria-expanded={menuOpen} aria-controls={menuId}
            onClick={() => setMenuOpen(true)}>
            <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-sm">{t.admin.shellTitle}</span>
        </div>
        <div className="flex items-center gap-1">
          <a href={basePath || "/"} target="_blank" rel="noopener noreferrer" className="admin-toolbar-button text-xs">{t.admin.visitSite}</a>
          <button type="button" onClick={() => navigate("/admin/login?logout=1", { replace: true })}
            className="admin-toolbar-button text-xs">{t.admin.logout}</button>
        </div>
      </header>
      <div className="flex flex-1 min-h-0 min-w-0">
        <AdminSidebar className="hidden md:flex w-56" />
        <main className="admin-main flex-1 min-w-0 overflow-y-auto p-3 sm:p-6">
          <AuthRecoveryNotice />
          <Outlet />
        </main>
      </div>
      <dialog id={menuId} ref={dialogRef} aria-labelledby={titleId}
        className="admin-navigation-dialog p-0"
        onCancel={event => { event.preventDefault(); setMenuOpen(false); }}>
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <h2 id={titleId} className="font-semibold text-sm">{t.admin.menu}</h2>
          <button ref={closeRef} type="button" className="admin-navigation-close px-3 py-2 rounded-lg text-sm"
            onClick={() => setMenuOpen(false)}>{t.admin.closeMenu}</button>
        </div>
        <AdminSidebar className="flex w-full" onNavigate={() => setMenuOpen(false)} />
      </dialog>
    </div>
  );
}
