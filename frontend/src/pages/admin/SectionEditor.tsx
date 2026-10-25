import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import type { SectionType, Page, RichTextContent, ImageGalleryContent, DataTableContent, ExternalLinksContent, VideoContent, MetricCardsContent, TimelineContent, ProfileHeroContent, CtaBandContent } from "../../types";
import { getSections, createSection, updateSection } from "../../api/sections";
import { getAdminPages } from "../../api/admin-pages";
import { useLocale } from "../../hooks/useLocale";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import RichTextEditor from "../../components/editor/RichTextEditor";
import ImageGalleryEditor from "../../components/editor/ImageGalleryEditor";
import DataTableEditor from "../../components/editor/DataTableEditor";
import ExternalLinksEditor from "../../components/editor/ExternalLinksEditor";
import VideoEditor from "../../components/editor/VideoEditor";
import MetricCardsEditor from "../../components/editor/MetricCardsEditor";
import TimelineEditor from "../../components/editor/TimelineEditor";
import ProfileHeroEditor from "../../components/editor/ProfileHeroEditor";
import CtaBandEditor from "../../components/editor/CtaBandEditor";
import { conflictMessage, isRevisionConflict } from "../../lib/securityMessages";

type ContentTypes = RichTextContent | ImageGalleryContent | DataTableContent | ExternalLinksContent | VideoContent | MetricCardsContent | TimelineContent | ProfileHeroContent | CtaBandContent;

const DEFAULT_CONTENT: Record<SectionType, ContentTypes> = {
  rich_text: { body: "" },
  image_gallery: { columns: 4, page_size: 8, items: [] },
  data_table: { columns: [{ key: "col1", title: "列1" }], rows: [] },
  external_links: { items: [] },
  video: { items: [] },
  metric_cards: { cards: [] },
  timeline: { items: [], layout: "vertical" },
  profile_hero: { avatar_url: "", name_zh: "", name_en: "", tagline_zh: "", tagline_en: "", mission_zh: "", mission_en: "", tags: [], social_links: [], cta_buttons: [] },
  cta_band: { description_zh: "", description_en: "", buttons: [] },
};

function parseSectionType(value: string | null): SectionType {
  return value && Object.prototype.hasOwnProperty.call(DEFAULT_CONTENT, value)
    ? value as SectionType : "rich_text";
}

export default function SectionEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const { t, localized, locale } = useLocale();
  const [revision, setRevision] = useState<string>();
  const pageIdParam = searchParams.get("page_id");
  const typeParam = searchParams.get("type");
  const [pageId, setPageId] = useState<number | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [titleZh, setTitleZh] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [sectionType, setSectionType] = useState<SectionType>(
    parseSectionType(typeParam)
  );
  const [content, setContent] = useState<ContentTypes>(DEFAULT_CONTENT[sectionType]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"loadFailed" | "sectionMissing" | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [baseline, setBaseline] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const savingRef = useRef(false);
  const routeKey = `${id ?? "new"}:${pageIdParam ?? ""}:${typeParam ?? ""}`;
  const page = pages.find((p) => p.id === pageId);
  const pageName = page ? localized(page.title_zh, page.title_en) : "";
  const returnUrl = pageIdParam ? `/admin?page_id=${encodeURIComponent(pageIdParam)}` : "/admin";
  const canSave = !loading && !loadError && loadedKey === routeKey && !!page;
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const snapshot = JSON.stringify({ pageId, titleZh, titleEn, sectionType, content });
  const latest = useRef({ snapshot, routeKey });
  useLayoutEffect(() => { latest.current = { snapshot, routeKey }; }, [snapshot, routeKey]);
  const { allowNextNavigation } = useUnsavedChanges(baseline !== null && snapshot !== baseline);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadPage = async () => {
      setLoading(true);
      setLoadError(null);
      setBaseline(null);
      setCreatedId(null);
      setRevision(undefined);
      try {
        const pages: Page[] = await getAdminPages();
        if (cancelled) return;
        setPages(pages);
        if (!isNew && id) {
          const sections = await getSections();
          if (cancelled) return;
          const section = sections.find((s) => s.id === Number(id));
          if (section) {
            setRevision(section.revision);
            setTitleZh(section.title_zh);
            setTitleEn(section.title_en);
            setSectionType(section.type);
            setContent(section.content as ContentTypes);
            setPageId(section.page_id);
            setBaseline(JSON.stringify({ pageId: section.page_id, titleZh: section.title_zh, titleEn: section.title_en, sectionType: section.type, content: section.content }));
          } else {
            setLoadError("sectionMissing");
          }
        } else {
          setPageId(pageIdParam ? Number(pageIdParam) : null);
          setTitleZh("");
          setTitleEn("");
          const initialType = parseSectionType(typeParam);
          setSectionType(initialType);
          setContent(DEFAULT_CONTENT[initialType]);
          setBaseline(JSON.stringify({ pageId: pageIdParam ? Number(pageIdParam) : null, titleZh: "", titleEn: "", sectionType: initialType, content: DEFAULT_CONTENT[initialType] }));
        }
        setLoadedKey(routeKey);
      } catch {
        if (!cancelled) setLoadError("loadFailed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPage();
    return () => { cancelled = true; };
  }, [id, isNew, pageIdParam, typeParam, routeKey]);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (savingRef.current || !canSave || pageId === null) return;
    if (!titleZh.trim()) {
      showToast("error", t.admin.titleRequired);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const submittedSnapshot = snapshot;
    const submittedRoute = routeKey;
    // Detach the submitted content from editor objects that may still mutate in flight.
    const submittedContent: Record<string, unknown> = JSON.parse(JSON.stringify(content));
    try {
      if (isNew && createdId === null) {
        const created = await createSection({
          page_id: pageId,
          title_zh: titleZh,
          title_en: titleEn,
          type: sectionType,
          content: submittedContent,
        });
        if (!mounted.current || latest.current.routeKey !== submittedRoute) return;
        setCreatedId(created.id);
        setRevision(created.revision);
        setBaseline(JSON.stringify({ pageId: created.page_id, titleZh: created.title_zh, titleEn: created.title_en, sectionType: created.type, content: created.content }));
        if (latest.current.snapshot === submittedSnapshot) {
          allowNextNavigation();
          navigate(returnUrl);
        } else {
          showToast("success", t.admin.saved);
        }
      } else {
        const saved = await updateSection(createdId ?? Number(id), {
          expected_revision: revision ?? "",
          title_zh: titleZh,
          title_en: titleEn,
          content: submittedContent,
        });
        if (!mounted.current || latest.current.routeKey !== submittedRoute) return;
        setRevision(saved.revision);
        setBaseline(JSON.stringify({ pageId: saved.page_id, titleZh: saved.title_zh, titleEn: saved.title_en, sectionType: saved.type, content: saved.content }));
        if (latest.current.snapshot === submittedSnapshot) {
          setTitleZh(saved.title_zh);
          setTitleEn(saved.title_en);
          setContent(saved.content);
        }
        showToast("success", t.admin.saved);
      }
    } catch (err: unknown) {
      if (!mounted.current || latest.current.routeKey !== submittedRoute) return;
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      const msg = isRevisionConflict(err) ? conflictMessage(locale) : typeof detail === "string" ? detail : t.admin.saveFailed;
      showToast("error", msg);
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const renderEditor = () => {
    switch (sectionType) {
      case "rich_text":
        return (
          <RichTextEditor
            content={content as RichTextContent}
            onChange={(c) => setContent(c)}
          />
        );
      case "image_gallery":
        return (
          <ImageGalleryEditor
            content={content as ImageGalleryContent}
            onChange={(c) => setContent(c)}
          />
        );
      case "data_table":
        return (
          <DataTableEditor
            content={content as DataTableContent}
            onChange={(c) => setContent(c)}
          />
        );
      case "external_links":
        return (
          <ExternalLinksEditor
            content={content as ExternalLinksContent}
            onChange={(c) => setContent(c)}
          />
        );
      case "video":
        return (
          <VideoEditor
            content={content as VideoContent}
            onChange={(c) => setContent(c)}
          />
        );
      case "metric_cards":
        return (
          <MetricCardsEditor
            content={content as MetricCardsContent}
            onChange={(c) => setContent(c)}
          />
        );
      case "timeline":
        return (
          <TimelineEditor
            content={content as TimelineContent}
            onChange={(c) => setContent(c)}
          />
        );
      case "profile_hero":
        return (
          <ProfileHeroEditor
            content={content as ProfileHeroContent}
            onChange={(c) => setContent(c)}
          />
        );
      case "cta_band":
        return (
          <CtaBandEditor
            content={content as CtaBandContent}
            onChange={(c) => setContent(c)}
          />
        );
    }
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
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500 mb-6">
        <button onClick={() => navigate(returnUrl)} className="hover:text-primary transition-colors">
          {t.admin.contentManagement}
        </button>
        {pageName && (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-slate-500">{pageName}</span>
          </>
        )}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-slate-800 font-medium">
          {isNew ? t.admin.newSection : t.admin.editSection}
        </span>
      </div>

      {loadError && <p role="alert" className="mb-4 text-red-600">{t.admin[loadError]}</p>}
      {!loadError && !page && <p role="alert" className="mb-4 text-red-600">{pageId === null ? t.admin.choosePage : t.admin.pageUnavailable}</p>}
      {/* Form card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200">
          <label className="block text-sm font-medium text-slate-600 mb-4">
            {t.admin.page}
            <select value={page ? String(page.id) : ""} onChange={(e) => setPageId(e.target.value ? Number(e.target.value) : null)} disabled={!isNew || createdId !== null || saving || !!loadError} className="mt-2 w-full border border-slate-200 rounded-lg p-3 bg-white disabled:opacity-60">
              <option value="">{t.admin.choosePage}</option>
              {pages.map((p) => <option key={p.id} value={p.id}>{localized(p.title_zh, p.title_en)} (/{p.slug})</option>)}
            </select>
          </label>
          <fieldset disabled={saving || !!loadError} className="grid gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-medium text-slate-600">
              {t.admin.titleZh}
              <input
                type="text"
                value={titleZh}
                onChange={(e) => setTitleZh(e.target.value)}
                required
                className="mt-2 w-full text-lg border border-slate-200 rounded-lg p-3 text-slate-800"
              />
            </label>
            <label className="min-w-0 text-sm font-medium text-slate-600">
              {t.admin.titleEn}
              <input type="text" value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="mt-2 w-full text-lg border border-slate-200 rounded-lg p-3 text-slate-800" />
            </label>
          </fieldset>
          <div className="mt-4">
              <span className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {t.admin.types[sectionType]}
              </span>
          </div>
        </div>

        <fieldset disabled={saving || !!loadError} className="p-6 min-w-0">
          {renderEditor()}
        </fieldset>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={() => navigate(returnUrl)}
            className="px-5 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            {t.admin.cancel}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave || !titleZh.trim()}
            className="px-6 py-2.5 text-sm bg-primary text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                 {t.admin.saving}
              </>
            ) : t.admin.save}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          role={toast.type === "error" ? "alert" : "status"}
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
