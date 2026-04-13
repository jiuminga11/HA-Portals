import { useRef } from "react";
import type { VideoContent, VideoItem } from "../../types";
import { uploadFile } from "../../api/upload";
import { resolveMediaUrl } from "../../lib/basePath";

interface Props {
  content: VideoContent;
  onChange: (content: VideoContent) => void;
}

function emptyItem(): VideoItem {
  return { title: "", url: "", poster: "" };
}

export default function VideoEditor({ content, onChange }: Props) {
  const { items = [] } = content;
  const videoInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const posterInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const update = (newItems: VideoItem[]) => onChange({ items: newItems });
  const addItem = () => update([...items, emptyItem()]);
  const removeItem = (idx: number) => update(items.filter((_, i) => i !== idx));

  const updateItem = (idx: number, patch: Partial<VideoItem>) => {
    const newItems = [...items];
    newItems[idx] = { ...newItems[idx], ...patch };
    update(newItems);
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newItems = [...items];
    const target = idx + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[idx], newItems[target]] = [newItems[target], newItems[idx]];
    update(newItems);
  };

  const handleVideoUpload = async (idx: number, file: File) => {
    try {
      const res = await uploadFile(file);
      updateItem(idx, { url: res.file_url });
    } catch {
      alert("视频上传失败，请重试");
    }
  };

  const handlePosterUpload = async (idx: number, file: File) => {
    try {
      const res = await uploadFile(file);
      updateItem(idx, { poster: res.file_url });
    } catch {
      alert("封面图上传失败，请重试");
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={addItem}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        添加视频
      </button>

      {items.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6 bg-slate-50 rounded-lg border border-slate-200">
          暂无视频，点击上方按钮添加
        </p>
      )}

      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                视频 {idx + 1}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => moveItem(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">↑</button>
                <button type="button" onClick={() => moveItem(idx, 1)} disabled={idx === items.length - 1} className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => removeItem(idx)} className="p-1 text-red-400 hover:text-red-600 ml-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">视频标题 *</label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => updateItem(idx, { title: e.target.value })}
                placeholder="教学视频标题"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ring-primary"
              />
            </div>

            {/* Video source */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">视频来源 *</label>
              <div className="flex flex-wrap gap-3 items-start">
                <div className="flex-1 min-w-0">
                  <input
                    type="url"
                    value={item.url}
                    onChange={(e) => updateItem(idx, { url: e.target.value })}
                    placeholder="外部视频直链 URL (*.mp4 / *.webm)"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 ring-primary"
                  />
                </div>
                <div className="shrink-0 text-xs text-slate-400 py-2">或</div>
                <div>
                  <input
                    ref={(el) => { videoInputRefs.current[idx] = el; }}
                    type="file"
                    accept="video/mp4,video/webm"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(idx, file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => videoInputRefs.current[idx]?.click()}
                    className="text-sm px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                  >
                    上传视频文件
                  </button>
                </div>
              </div>
              {item.url && (
                <p className="text-xs text-slate-400 mt-1 truncate">当前：{item.url}</p>
              )}
            </div>

            {/* Poster */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">封面图（可选）</label>
              <div className="flex items-center gap-3 flex-wrap">
                <input
                  ref={(el) => { posterInputRefs.current[idx] = el; }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePosterUpload(idx, file);
                  }}
                />
                <button
                  type="button"
                  onClick={() => posterInputRefs.current[idx]?.click()}
                  className="text-sm px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  选择封面图
                </button>
                {item.poster && (
                  <>
                    <img
                      src={resolveMediaUrl(item.poster)}
                      alt="封面预览"
                      className="h-14 w-auto object-contain rounded border border-slate-200"
                    />
                    <button
                      type="button"
                      onClick={() => updateItem(idx, { poster: "" })}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      移除封面
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
