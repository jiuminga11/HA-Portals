import { useEffect, useState } from "react";
import type { FileResponse } from "../../types";
import { getFiles, deleteFile, uploadFile } from "../../api/upload";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { resolveMediaUrl } from "../../lib/basePath";

type FileFilter = "all" | "image" | "video";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function FileManager() {
  const [files, setFiles] = useState<FileResponse[]>([]);
  const [filter, setFilter] = useState<FileFilter>("all");
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const load = async (f: FileFilter = filter) => {
    try {
      const data = await getFiles(f === "all" ? "all" : f);
      setFiles(data);
    } catch {
      setError("加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(filter);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async () => {
    if (deleteId === null) return;
    try {
      await deleteFile(deleteId);
      setFiles((prev) => prev.filter((f) => f.id !== deleteId));
      setDeleteId(null);
      setError(null);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number; data?: { detail?: string } } })?.response?.status;
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (status === 409) {
        setError("该文件正在被使用，无法删除。请先在内容编辑中移除引用后再删除。");
      } else {
        setError(msg || "删除失败");
      }
      setDeleteId(null);
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      await uploadFile(file, setUploadProgress);
      await load(filter);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "上传失败";
      setError(msg);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      e.target.value = "";
    }
  };

  const isImage = (mime: string) => mime.startsWith("image/");
  const isVideo = (mime: string) => mime.startsWith("video/");

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">文件管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">管理已上传的图片和视频文件</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm cursor-pointer">
            {uploading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                上传中 {uploadProgress}%
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                上传文件
              </>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-200">
          {error}
          <button className="ml-2 text-red-400 hover:text-red-300" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit border border-slate-200">
        {(["all", "image", "video"] as FileFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {f === "all" ? "全部" : f === "image" ? "图片" : "视频"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <p className="text-slate-600 font-medium mb-1">暂无文件</p>
          <p className="text-slate-500 text-sm">点击「上传文件」按鈕添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors"
            >
              {/* Preview */}
              <div className="aspect-square bg-slate-100 overflow-hidden relative">
                {isImage(file.mime_type) ? (
                  <img
                    src={resolveMediaUrl(file.file_url)}
                    alt={file.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : isVideo(file.mime_type) ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <svg className="w-10 h-10 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs">视频</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                )}

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => handleCopyUrl(file.file_url)}
                    title="复制 URL"
                    className="w-9 h-9 bg-white/90 rounded-lg flex items-center justify-center text-slate-700 hover:bg-white transition-colors"
                  >
                    {copiedUrl === file.file_url ? (
                      <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setDeleteId(file.id)}
                    title="删除文件"
                    className="w-9 h-9 bg-red-500 rounded-lg flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-2.5">
                <p className="text-xs font-medium text-slate-700 truncate" title={file.filename}>
                  {file.filename}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatBytes(file.file_size)} · {formatDate(file.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="删除文件"
        message={`确定删除「${files.find((f) => f.id === deleteId)?.filename}」？若文件正在被引用，删除将失败。`}
        confirmText="删除"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}
