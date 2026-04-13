import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Page } from "../../types";
import {
  getAdminPages,
  createPage,
  updatePage,
  deletePage,
  reorderPages,
} from "../../api/admin-pages";
import { getSections } from "../../api/sections";
import ConfirmDialog from "../../components/common/ConfirmDialog";

interface SectionCounts {
  [pageId: number]: number;
}

interface CreateForm {
  slug: string;
  title_zh: string;
  title_en: string;
}

interface EditForm {
  title_zh: string;
  title_en: string;
  meta_description_zh: string;
  meta_description_en: string;
}

export default function PageManager() {
  const [pages, setPages] = useState<Page[]>([]);
  const [sectionCounts, setSectionCounts] = useState<SectionCounts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({
    slug: "",
    title_zh: "",
    title_en: "",
  });
  const [editForm, setEditForm] = useState<EditForm>({
    title_zh: "",
    title_en: "",
    meta_description_zh: "",
    meta_description_en: "",
  });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const [pagesData, sectionsData] = await Promise.all([
        getAdminPages(),
        getSections(),
      ]);
      setPages(pagesData);
      const counts: SectionCounts = {};
      for (const s of sectionsData) {
        counts[s.page_id] = (counts[s.page_id] || 0) + 1;
      }
      setSectionCounts(counts);
    } catch {
      setError("加载失败，请刷新重试");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!createForm.slug.trim() || !createForm.title_zh.trim()) {
      setError("slug 和中文标题不能为空");
      return;
    }
    setSaving(true);
    try {
      const newPage = await createPage({
        slug: createForm.slug.trim().toLowerCase(),
        title_zh: createForm.title_zh.trim(),
        title_en: createForm.title_en.trim(),
      });
      setPages((prev) => [...prev, newPage]);
      setShowCreateModal(false);
      setCreateForm({ slug: "", title_zh: "", title_en: "" });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "创建失败";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (page: Page) => {
    setEditingPage(page);
    setEditForm({
      title_zh: page.title_zh,
      title_en: page.title_en,
      meta_description_zh: page.meta_description_zh,
      meta_description_en: page.meta_description_en,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPage || !editForm.title_zh.trim()) {
      setError("中文标题不能为空");
      return;
    }
    setSaving(true);
    try {
      const updated = await updatePage(editingPage.id, {
        title_zh: editForm.title_zh.trim(),
        title_en: editForm.title_en.trim(),
        meta_description_zh: editForm.meta_description_zh.trim(),
        meta_description_en: editForm.meta_description_en.trim(),
      });
      setPages((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
      setEditingPage(null);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "保存失败";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deletePage(deleteId);
      setPages((prev) => prev.filter((p) => p.id !== deleteId));
      setDeleteId(null);
    } catch {
      setError("删除失败");
    }
  };

  const handleToggleVisible = async (page: Page) => {
    try {
      const updated = await updatePage(page.id, { visible: !page.visible });
      setPages((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      );
    } catch {
      setError("更新失败");
    }
  };

  const handleMove = async (idx: number, dir: -1 | 1) => {
    const newPages = [...pages];
    const target = idx + dir;
    if (target < 0 || target >= newPages.length) return;
    [newPages[idx], newPages[target]] = [newPages[target], newPages[idx]];
    setPages(newPages);
    const orders = newPages.map((p, i) => ({ id: p.id, sort_order: i }));
    try {
      await reorderPages(orders);
    } catch {
      load();
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
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">页面管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            管理站点页面结构和导航
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          新建页面
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-600"
          >
            ✕
          </button>
        </div>
      )}

      {pages.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-slate-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-slate-600 font-medium mb-1">暂无页面</p>
          <p className="text-slate-500 text-sm">点击「新建页面」开始添加</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page, idx) => (
            <div
              key={page.id}
              className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 hover:border-slate-300 transition-colors"
            >
              {/* Order controls */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  onClick={() => handleMove(idx, -1)}
                  disabled={idx === 0}
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => handleMove(idx, 1)}
                  disabled={idx === pages.length - 1}
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-100 disabled:opacity-30 transition-colors"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => navigate(`/admin?page_id=${page.id}`)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 truncate">
                    {page.title_zh}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-mono">
                    /{page.slug}
                  </span>
                  {page.title_en && (
                    <span className="text-xs text-slate-400">
                      {page.title_en}
                    </span>
                  )}
                  {!page.visible && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                      已隐藏
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {sectionCounts[page.id] || 0} 个区块
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {/* Visibility toggle */}
                <button
                  onClick={() => handleToggleVisible(page)}
                  title={page.visible ? "点击隐藏" : "点击显示"}
                  className={`w-9 h-5 rounded-full transition-colors relative ${
                    page.visible ? "bg-primary" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                      page.visible ? "left-4" : "left-0.5"
                    }`}
                  />
                </button>

                {/* Edit */}
                <button
                  onClick={() => handleEdit(page)}
                  className="p-2 text-slate-500 hover:text-primary hover:bg-blue-500/10 rounded-lg transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>

                {/* Delete */}
                <button
                  onClick={() => setDeleteId(page.id)}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
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
        title="删除页面"
        message={`确定删除「${pages.find((p) => p.id === deleteId)?.title_zh}」页面？该页面下的所有区块也会被一起删除，此操作不可撤销。`}
        confirmText="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">
                新建页面
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                slug 创建后不可修改
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Slug（URL 路径）
                </label>
                <input
                  type="text"
                  value={createForm.slug}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, slug: e.target.value }))
                  }
                  placeholder="例如：about, research"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  中文标题
                </label>
                <input
                  type="text"
                  value={createForm.title_zh}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, title_zh: e.target.value }))
                  }
                  placeholder="例如：关于我"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  英文标题
                </label>
                <input
                  type="text"
                  value={createForm.title_en}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, title_en: e.target.value }))
                  }
                  placeholder="例如：About Me"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm({ slug: "", title_zh: "", title_en: "" });
                }}
                className="px-5 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-6 py-2.5 text-sm bg-primary text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {saving ? "创建中..." : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800">
                编辑页面
              </h3>
              <p className="text-sm text-slate-500 mt-1 font-mono">
                /{editingPage.slug}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  中文标题
                </label>
                <input
                  type="text"
                  value={editForm.title_zh}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title_zh: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  英文标题
                </label>
                <input
                  type="text"
                  value={editForm.title_en}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title_en: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  中文 Meta 描述
                </label>
                <textarea
                  value={editForm.meta_description_zh}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      meta_description_zh: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  英文 Meta 描述
                </label>
                <textarea
                  value={editForm.meta_description_en}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      meta_description_en: e.target.value,
                    }))
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
                />
              </div>
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingPage(null)}
                className="px-5 py-2.5 text-sm text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="px-6 py-2.5 text-sm bg-primary text-white rounded-xl font-semibold hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
