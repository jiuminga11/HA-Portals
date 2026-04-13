import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import type { SectionType, Page, RichTextContent, ImageGalleryContent, DataTableContent, ExternalLinksContent, VideoContent, MetricCardsContent, TimelineContent, ProfileHeroContent } from "../../types";
import { getSections, createSection, updateSection } from "../../api/sections";
import { getAdminPages } from "../../api/admin-pages";
import RichTextEditor from "../../components/editor/RichTextEditor";
import ImageGalleryEditor from "../../components/editor/ImageGalleryEditor";
import DataTableEditor from "../../components/editor/DataTableEditor";
import ExternalLinksEditor from "../../components/editor/ExternalLinksEditor";
import VideoEditor from "../../components/editor/VideoEditor";
import MetricCardsEditor from "../../components/editor/MetricCardsEditor";
import TimelineEditor from "../../components/editor/TimelineEditor";
import ProfileHeroEditor from "../../components/editor/ProfileHeroEditor";

type ContentTypes = RichTextContent | ImageGalleryContent | DataTableContent | ExternalLinksContent | VideoContent | MetricCardsContent | TimelineContent | ProfileHeroContent;

const DEFAULT_CONTENT: Record<SectionType, ContentTypes> = {
  rich_text: { body: "" },
  image_gallery: { columns: 4, page_size: 8, items: [] },
  data_table: { columns: [{ key: "col1", title: "列1" }], rows: [] },
  external_links: { items: [] },
  video: { items: [] },
  metric_cards: { cards: [] },
  timeline: { items: [], layout: "vertical" },
  profile_hero: { avatar_url: "", name_zh: "", name_en: "", tagline_zh: "", tagline_en: "", mission_zh: "", mission_en: "", tags: [], social_links: [], cta_buttons: [] },
};

const TYPE_LABELS: Record<SectionType, string> = {
  rich_text: "富文本",
  image_gallery: "图片展示",
  data_table: "数据表格",
  external_links: "外链",
  video: "视频",
  metric_cards: "指标卡片",
  timeline: "时间线",
  profile_hero: "个人头图",
};

export default function SectionEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id || id === "new";

  const pageIdParam = searchParams.get("page_id");
  const [pageId, setPageId] = useState<number>(pageIdParam ? Number(pageIdParam) : 1);
  const [pageName, setPageName] = useState<string>("");
  const [title, setTitle] = useState("");
  const [sectionType, setSectionType] = useState<SectionType>(
    (searchParams.get("type") as SectionType) || "rich_text"
  );
  const [content, setContent] = useState<ContentTypes>(DEFAULT_CONTENT[sectionType]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    const loadPage = async () => {
      try {
        const pages: Page[] = await getAdminPages();
        if (!isNew && id) {
          const sections = await getSections();
          const section = sections.find((s) => s.id === Number(id));
          if (section) {
            setTitle(section.title_zh);
            setSectionType(section.type);
            setContent(section.content as ContentTypes);
            setPageId(section.page_id);
            const p = pages.find((pg) => pg.id === section.page_id);
            if (p) setPageName(p.title_zh);
          }
        } else {
          const p = pages.find((pg) => pg.id === pageId);
          if (p) setPageName(p.title_zh);
        }
      } catch {
        setToast({ type: "error", msg: "加载失败" });
      } finally {
        setLoading(false);
      }
    };
    loadPage();
  }, [id, isNew, pageId]);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showToast("error", "区块标题不能为空");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createSection({
          page_id: pageId,
          title_zh: title.trim(),
          title_en: title.trim(),
          type: sectionType,
          content: content as unknown as Record<string, unknown>,
        });
        showToast("success", "创建成功");
        setTimeout(() => navigate("/admin"), 1000);
      } else {
        await updateSection(Number(id), {
          title_zh: title.trim(),
          title_en: title.trim(),
          content: content as unknown as Record<string, unknown>,
        });
        showToast("success", "保存成功");
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "保存失败，请检查内容";
      showToast("error", msg);
    } finally {
      setSaving(false);
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
        <button onClick={() => navigate("/admin")} className="hover:text-primary transition-colors">
          内容管理
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
          {isNew ? "新建区块" : "编辑区块"}
        </span>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="区块标题（必填）"
              className="w-full text-lg font-semibold border-0 outline-none text-slate-800 placeholder:text-slate-400 bg-transparent"
              />
            </div>
            <div className="shrink-0">
              <span className="text-xs px-3 py-1.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                {TYPE_LABELS[sectionType]}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {renderEditor()}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            onClick={() => navigate("/admin")}
            className="px-5 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 text-sm bg-primary text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 transition-all flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                保存中...
              </>
            ) : "保存"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
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
