import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Page } from "../../types";
import { getAdminPages, createPage, updatePage, deletePage, reorderPages } from "../../api/admin-pages";
import { getSections } from "../../api/sections";
import { useLocale } from "../../hooks/useLocale";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import AuthRecoveryNotice from "../../components/common/AuthRecoveryNotice";
import { conflictMessage, isRevisionConflict } from "../../lib/securityMessages";

type PageForm = Pick<Page, "title_zh" | "title_en" | "meta_description_zh" | "meta_description_en"> & { slug: string };
const EMPTY_FORM: PageForm = { slug: "", title_zh: "", title_en: "", meta_description_zh: "", meta_description_en: "" };
function toForm(page: Page): PageForm {
  return { slug: page.slug, title_zh: page.title_zh, title_en: page.title_en,
    meta_description_zh: page.meta_description_zh, meta_description_en: page.meta_description_en };
}

export default function PageManager() {
  const { t, localized, locale } = useLocale();
  const [revision, setRevision] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [pages, setPages] = useState<Page[]>([]);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<"loadError" | "saveError" | "deleteError" | "updateError" | "reorderError" | "required" | null>(null);
  const [modal, setModal] = useState<"new" | number | null>(null);
  const [form, setForm] = useState<PageForm>(EMPTY_FORM);
  const [snapshot, setSnapshot] = useState(JSON.stringify(EMPTY_FORM));
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const dirty = modal !== null && JSON.stringify(form) !== snapshot;
  useUnsavedChanges(dirty);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setLoaded(false); setError(null);
      try {
        const [pageData, sections] = await Promise.all([getAdminPages(), getSections()]);
        if (cancelled) return;
        setPages([...pageData].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id));
        const next: Record<number, number> = {};
        for (const section of sections) next[section.page_id] = (next[section.page_id] || 0) + 1;
        setCounts(next); setLoaded(true);
      } catch { if (!cancelled) setError("loadError"); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [attempt]);
  useEffect(() => {
    if (modal !== null) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);

  const begin = () => {
    if (lock.current || !loaded) return false;
    lock.current = true; setSaving(true); setError(null); setConflict(false); return true;
  };
  const end = () => { lock.current = false; setSaving(false); };
  const open = (page?: Page) => {
    const initial = page ? toForm(page) : EMPTY_FORM;
    setRevision(page?.revision); setConflict(false);
    setForm(initial); setSnapshot(JSON.stringify(initial)); setError(null);
    setModal(page?.id ?? "new");
  };
  const close = () => {
    if (lock.current || (dirty && !window.confirm(t.pages.discard))) return;
    setModal(null); setError(null);
  };
  const save = async () => {
    if (modal === null) return;
    if (!form.title_zh.trim() || (modal === "new" && !form.slug.trim())) { setError("required"); return; }
    if (!begin()) return;
    try {
      const { slug, ...fields } = form;
      const result = modal === "new"
        ? await createPage({ ...fields, slug: slug.trim().toLowerCase() })
        : await updatePage(modal, { ...fields, expected_revision: revision });
      setPages(previous => modal === "new" ? [...previous, result] : previous.map(page => page.id === result.id ? result : page));
      const saved = toForm(result); setForm(saved); setSnapshot(JSON.stringify(saved));
      setModal(null);
    } catch (error) { setConflict(isRevisionConflict(error)); setError("saveError"); }
    finally { end(); }
  };
  const remove = async (page: Page) => {
    if (page.slug === "home" || lock.current || !window.confirm(t.pages.confirmDelete.replace("{title}", localized(page.title_zh, page.title_en)))) return;
    if (!begin()) return;
    try {
      await deletePage(page.id);
      setPages(await getAdminPages());
    } catch { setError("deleteError"); }
    finally { end(); }
  };
  const toggle = async (page: Page) => {
    if (page.slug === "home" || !begin()) return;
    try {
      const result = await updatePage(page.id, { visible: !page.visible, expected_revision: page.revision });
      setPages(previous => previous.map(item => item.id === result.id ? result : item));
    } catch (error) { setConflict(isRevisionConflict(error)); setError("updateError"); }
    finally { end(); }
  };
  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pages.length || !begin()) return;
    const previous = pages;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    const normalized = next.map((page, sort_order) => ({ ...page, sort_order }));
    setPages(normalized);
    try { setPages(await reorderPages(normalized.map(({ id, sort_order }) => ({ id, sort_order })), previous.map(page => page.id))); }
    catch (error) {
      setPages(previous); setError("reorderError");
      if (isRevisionConflict(error)) {
        setConflict(true);
        try { setPages(await getAdminPages()); }
        catch { setLoaded(false); }
      }
    }
    finally { end(); }
  };

  if (loading) return <p role="status" className="py-16 text-center">{t.common.loading}</p>;
  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div><h1 className="text-xl font-bold text-slate-800">{t.pages.title}</h1><p className="text-sm text-slate-500 mt-2">{t.pages.intro}</p></div>
        <button className="rounded-xl bg-primary text-white px-4 py-3 font-semibold disabled:opacity-50" disabled={!loaded || saving} onClick={() => open()}>{t.pages.create}</button>
      </div>
      <p id="home-protection" className="admin-form-message mb-5">{t.pages.homeProtection}</p>
      {error && modal === null && <div role="alert" className="admin-form-message mb-5">{conflict ? conflictMessage(locale) : t.pages[error]}{!loaded && <button className="underline ml-3" onClick={() => setAttempt(value => value + 1)}>{t.publicPage.retry}</button>}</div>}
      {loaded && !pages.length && <p className="admin-settings-card">{t.pages.empty}</p>}
      <div className="space-y-3">
        {pages.map((page, index) => <article key={page.id} className="admin-settings-card flex flex-wrap gap-4 items-center">
          <div className="flex gap-1">
            <button className="admin-icon-button" aria-label={t.admin.moveUp} disabled={saving || index === 0} onClick={() => move(index, -1)}>↑</button>
            <button className="admin-icon-button" aria-label={t.admin.moveDown} disabled={saving || index === pages.length - 1} onClick={() => move(index, 1)}>↓</button>
          </div>
          <div className="flex-1 min-w-0 [overflow-wrap:anywhere]">
            <Link className="font-semibold underline underline-offset-4" to={`/admin?page_id=${page.id}`}>{localized(page.title_zh, page.title_en)}</Link>
            <p className="text-sm text-slate-500 mt-1">/{page.slug} · {counts[page.id] || 0} {t.pages.sections}</p>
            {!page.visible && <p className="text-sm text-slate-500">{t.pages.hidden}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="admin-icon-button" disabled={saving || page.slug === "home"} aria-describedby={page.slug === "home" ? "home-protection" : undefined} onClick={() => toggle(page)}>{page.visible ? t.pages.hide : t.pages.show}</button>
            <button className="admin-icon-button" disabled={saving} onClick={() => open(page)}>{t.admin.edit}</button>
            <button className="admin-icon-button" disabled={saving || page.slug === "home"} aria-describedby={page.slug === "home" ? "home-protection" : undefined} onClick={() => remove(page)}>{t.admin.delete}</button>
          </div>
        </article>)}
      </div>
      <dialog ref={dialog} className="admin-page-dialog rounded-2xl p-0 w-full max-w-lg" onCancel={event => { event.preventDefault(); close(); }} aria-labelledby="page-dialog-title">
        <form onSubmit={event => { event.preventDefault(); void save(); }}>
          <fieldset disabled={saving} className="p-6 min-w-0">
            <h2 id="page-dialog-title" className="text-lg font-semibold mb-2">{modal === "new" ? t.pages.create : t.pages.edit}</h2>
            <AuthRecoveryNotice />
            <p className="text-sm text-slate-500 mb-5">{modal === "new" ? t.pages.newHint : t.pages.slugHint}</p>
            {error && <p role="alert" className="admin-form-message mb-4">{conflict ? conflictMessage(locale) : t.pages[error]}</p>}
            <label className="block text-sm font-medium mb-4">{t.pages.slug}<input autoFocus className="admin-form-input" value={form.slug} disabled={modal !== "new"} onChange={event => setForm(previous => ({ ...previous, slug: event.target.value }))} required /></label>
            {(["title_zh", "title_en", "meta_description_zh", "meta_description_en"] as const).map(key => <label key={key} className="block text-sm font-medium mb-4">{t.pages.fields[key]}
              <textarea className="admin-form-input" rows={key.includes("description") ? 3 : 1} required={key === "title_zh"} value={form[key]} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} />
            </label>)}
            <div className="flex gap-3 justify-end mt-6">
              <button type="button" className="admin-icon-button" onClick={close}>{t.admin.cancel}</button>
              <button type="submit" disabled={!loaded || saving || !dirty} className="rounded-xl bg-primary text-white px-5 py-3 disabled:opacity-50">{saving ? t.admin.saving : t.admin.save}</button>
            </div>
          </fieldset>
        </form>
      </dialog>
    </div>
  );
}
