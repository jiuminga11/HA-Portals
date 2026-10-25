import { useEffect, useState, useCallback, useRef, useId } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import type { Section, SectionType, Page } from "../../types";
import { getSections, deleteSection, reorderSections, updateSection } from "../../api/sections";
import { getAdminPages } from "../../api/admin-pages";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { useLocale } from "../../hooks/useLocale";
import { useModalDialog } from "../../components/common/useModalDialog";
import { conflictMessage, isRevisionConflict } from "../../lib/securityMessages";
import zh from "../../locales/admin-content.zh.json";
import en from "../../locales/admin-content.en.json";

const TYPE_COLORS: Record<SectionType, string> = {
  rich_text: "bg-blue-50 text-blue-700 border border-blue-200",
  image_gallery: "bg-green-50 text-green-700 border border-green-200",
  data_table: "bg-orange-50 text-orange-700 border border-orange-200",
  external_links: "bg-purple-50 text-purple-700 border border-purple-200",
  video: "bg-red-50 text-red-700 border border-red-200",
  metric_cards: "bg-amber-50 text-amber-700 border border-amber-200",
  timeline: "bg-teal-50 text-teal-700 border border-teal-200",
  profile_hero: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  cta_band: "bg-rose-50 text-rose-700 border border-rose-200",
};

const SECTION_TYPES: SectionType[] = [
  "rich_text",
  "image_gallery",
  "data_table",
  "external_links",
  "video",
  "metric_cards",
  "timeline",
  "profile_hero",
  "cta_band",
];

export default function Dashboard() {
  const { t, locale } = useLocale();
  const messages = locale === "en" ? en : zh;
  const mutationLock = useRef(false);
  const [mutating, setMutating] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const newDialogRef = useRef<HTMLDialogElement>(null);
  const firstTypeRef = useRef<HTMLButtonElement>(null);
  const newTriggerRef = useRef<HTMLButtonElement>(null);
  const newTitleId = useId();
  const newDescriptionId = useId();
  useModalDialog(showNewModal, newDialogRef, firstTypeRef, newTriggerRef);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedPageId = searchParams.get("page_id")
    ? Number(searchParams.get("page_id"))
    : null;

  const pageMap = new Map(pages.map((p) => [p.id, p]));

  const load = useCallback(async () => {
    try {
      const [pagesData, sectionsData] = await Promise.all([
        getAdminPages(),
        getSections(),
      ]);
      setPages(pagesData);
      setSections(sectionsData);
    } catch {
      setError(messages.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [messages.loadFailed]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredSections = (selectedPageId
    ? sections.filter((s) => s.page_id === selectedPageId)
    : [...sections]).sort((a, b) => a.page_id - b.page_id || a.sort_order - b.sort_order || a.id - b.id);

  const beginMutation = () => {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    setMutating(true);
    setError(null);
    return true;
  };
  const endMutation = () => {
    mutationLock.current = false;
    setMutating(false);
  };

  const handlePageFilter = (pageId: string) => {
    if (pageId === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ page_id: pageId });
    }
  };

  const handleDelete = async () => {
    const deleted = sections.find((s) => s.id === deleteId);
    if (!deleted || !beginMutation()) return;
    try {
      await deleteSection(deleted.id);
      // Deletion normalizes remaining ranks and changes their revisions.
      setSections(await getSections());
      setDeleteId(null);
    } catch {
      setDeleteId(null);
      setError(t.admin.deleteFailed);
    } finally {
      endMutation();
    }
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    if (!selectedPageId || !pageMap.has(selectedPageId)) return;
    const newSections = [...filteredSections];
    const target = idx + dir;
    if (target < 0 || target >= newSections.length) return;
    if (!beginMutation()) return;
    [newSections[idx], newSections[target]] = [newSections[target], newSections[idx]];

    const previousSections = sections;
    const expectedPreviousOrder = filteredSections.map(section => section.id);
    const reordered = newSections.map((s, sort_order) => ({ ...s, sort_order }));
    let pageIndex = 0;
    setSections(sections.map((s) => s.page_id === selectedPageId ? reordered[pageIndex++] : s));

    const orders = newSections.map((s, i) => ({ id: s.id, sort_order: i }));
    try {
      setSections(await reorderSections(orders, expectedPreviousOrder));
    } catch (error) {
      setSections(previousSections);
      if (isRevisionConflict(error)) {
        setError(conflictMessage(locale));
        try { setSections(await getSections()); }
        catch { setError(`${conflictMessage(locale)} ${messages.loadFailed}`); }
      } else {
        setError(t.admin.reorderFailed);
      }
    } finally {
      endMutation();
    }
  };

  const handleToggleVisible = async (section: Section) => {
    if (!beginMutation()) return;
    try {
      const updated = await updateSection(section.id, { visible: !section.visible, expected_revision: section.revision ?? "" });
      setSections((prev) => prev.map((s) => (s.id === section.id ? updated : s)));
    } catch (error) {
      setError(isRevisionConflict(error) ? conflictMessage(locale) : t.admin.updateFailed);
    } finally {
      endMutation();
    }
  };

  const handleCreateSection = (type: SectionType) => {
    setShowNewModal(false);
    const params = new URLSearchParams({ type });
    if (selectedPageId) {
      params.set("page_id", String(selectedPageId));
    }
    navigate(`/admin/sections/new?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{messages.title}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{messages.intro}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/pages"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {messages.managePages}
          </Link>
          <button
            ref={newTriggerRef}
            onClick={() => setShowNewModal(true)}
            disabled={mutating}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.admin.newSection}
          </button>
        </div>
      </div>

      {/* Page filter */}
      {pages.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-500">{messages.pageFilter}</label>
          <select
            disabled={mutating}
            value={selectedPageId ? String(selectedPageId) : "all"}
            onChange={(e) => handlePageFilter(e.target.value)}
            className="max-w-full min-w-0 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
          >
            <option value="all">{messages.allPages}</option>
            {pages.map((page) => (
              <option key={page.id} value={String(page.id)}>
                {page.title_zh} (/{page.slug})
              </option>
            ))}
          </select>
          {selectedPageId ? (
            <span className="text-xs text-slate-400">
              {messages.sectionCount.replace("{count}", String(filteredSections.length))}
            </span>
          ) : (
            <span className="text-xs text-amber-500">
              {messages.choosePageToSort}
            </span>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
          {error}
        </div>
      )}

      {mutating && <p role="status" className="mb-4 text-sm text-slate-500">{t.admin.updating}</p>}

      {filteredSections.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <p className="text-slate-600 font-medium mb-1">{messages.empty}</p>
          <p className="text-slate-500 text-sm">{messages.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSections.map((section, idx) => (
            <div
              key={section.id}
              className="bg-white rounded-xl border border-slate-200 p-3 sm:p-4 flex flex-wrap sm:flex-nowrap items-center gap-3 hover:border-slate-300 transition-colors"
            >
              {/* Order controls */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => handleMove(idx, -1)}
                  aria-label={t.admin.moveUp}
                  disabled={mutating || !selectedPageId || !pageMap.has(selectedPageId) || idx === 0}
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => handleMove(idx, 1)}
                  aria-label={t.admin.moveDown}
                  disabled={mutating || !selectedPageId || !pageMap.has(selectedPageId) || idx === filteredSections.length - 1}
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 truncate">{section.title_zh}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[section.type]}`}>
                    {t.admin.types[section.type]}
                  </span>
                  {!selectedPageId && pageMap.get(section.page_id) && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100">
                      {pageMap.get(section.page_id)?.title_zh}
                    </span>
                  )}
                  {!section.visible && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      {messages.hidden}
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Visibility toggle */}
                <button
                  onClick={() => handleToggleVisible(section)}
                  disabled={mutating}
                  title={section.visible ? messages.clickHide : messages.clickShow}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    section.visible ? "bg-primary" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      section.visible ? "left-4" : "left-0.5"
                    }`}
                  />
                </button>

                {/* Edit */}
                <button
                  onClick={() => navigate(`/admin/sections/${section.id}${selectedPageId ? `?page_id=${selectedPageId}` : ""}`)}
                  disabled={mutating}
                  aria-label={t.admin.edit}
                  className="p-2 text-slate-500 hover:text-primary hover:bg-blue-500/10 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Delete */}
                <button
                  onClick={() => setDeleteId(section.id)}
                  disabled={mutating}
                  aria-label={t.admin.delete}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        title={messages.deleteTitle}
        message={messages.deleteMessage.replace("{title}", sections.find((s) => s.id === deleteId)?.title_zh ?? "")}
        confirmText={mutating ? t.admin.updating : t.admin.delete}
        busy={mutating}
        danger
        onConfirm={handleDelete}
        onCancel={() => { if (!mutationLock.current) setDeleteId(null); }}
      />

      {/* New section modal */}
      <dialog ref={newDialogRef} aria-labelledby={newTitleId} aria-describedby={newDescriptionId}
        onCancel={event => { event.preventDefault(); setShowNewModal(false); }}
        className="admin-page-dialog admin-section-dialog rounded-2xl shadow-2xl p-0">
            <div className="px-6 py-5 border-b border-slate-200">
              <h3 id={newTitleId} className="text-lg font-semibold text-slate-800">{t.admin.chooseSectionType}</h3>
              <p id={newDescriptionId} className="text-sm text-slate-500 mt-1">{t.admin.sectionTypeHint}</p>
            </div>
            <div className="p-4 grid grid-cols-1 gap-2">
              {SECTION_TYPES.map((type) => (
                <button
                  key={type}
                  ref={type === SECTION_TYPES[0] ? firstTypeRef : undefined}
                  onClick={() => handleCreateSection(type)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_COLORS[type]}`}>
                    {t.admin.types[type]}
                  </span>
                  <span className="text-sm text-slate-600">
                    {messages.typeHints[type]}
                  </span>
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <button
                onClick={() => setShowNewModal(false)}
                className="w-full py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                {t.admin.cancel}
              </button>
            </div>
      </dialog>
    </div>
  );
}
