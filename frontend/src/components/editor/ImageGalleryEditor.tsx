import { useRef } from "react";
import type { ImageGalleryContent, ImageGalleryItem } from "../../types";
import { uploadFile } from "../../api/upload";
import { resolveMediaUrl } from "../../lib/basePath";

interface Props {
  content: ImageGalleryContent;
  onChange: (content: ImageGalleryContent) => void;
}

export default function ImageGalleryEditor({ content, onChange }: Props) {
  const { columns = 4, page_size = 8, items = [] } = content;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceIndexRef = useRef<number>(-1);

  const update = (patch: Partial<ImageGalleryContent>) => {
    onChange({ ...content, ...patch });
  };

  const updateItem = (index: number, patch: Partial<ImageGalleryItem>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...patch };
    update({ items: newItems });
  };

  const removeItem = (index: number) => {
    update({ items: items.filter((_, i) => i !== index) });
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    const newItems = [...items];
    const target = index + dir;
    if (target < 0 || target >= newItems.length) return;
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    update({ items: newItems });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const newItems: ImageGalleryItem[] = [];
    for (const file of files) {
      try {
        const res = await uploadFile(file);
        newItems.push({ url: res.file_url, caption: "" });
      } catch {
        // skip failed
      }
    }
    update({ items: [...items, ...newItems] });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReplace = (index: number) => {
    replaceIndexRef.current = index;
    if (replaceInputRef.current) {
      replaceInputRef.current.value = "";
      replaceInputRef.current.click();
    }
  };

  const handleReplaceChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const idx = replaceIndexRef.current;
    if (!file || idx < 0) return;
    try {
      const res = await uploadFile(file);
      updateItem(idx, { url: res.file_url });
    } catch {
      // skip failed
    }
    replaceIndexRef.current = -1;
    if (replaceInputRef.current) replaceInputRef.current.value = "";
  };

  return (
    <div className="space-y-5">
      {/* Config row */}
      <div className="flex flex-wrap gap-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">每行列数</label>
          <select
            value={columns}
            onChange={(e) => update({ columns: Number(e.target.value) })}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 ring-primary"
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n} 列</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">每页数量</label>
          <select
            value={page_size}
            onChange={(e) => update({ page_size: Number(e.target.value) })}
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 ring-primary"
          >
            <option value={0}>不分页</option>
            {[4, 8, 12, 16, 20].map((n) => (
              <option key={n} value={n}>{n} 张/页</option>
            ))}
          </select>
        </div>
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item, idx) => (
          <div key={idx} className="group relative bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
            <div className="aspect-square overflow-hidden bg-slate-100">
              <img
                src={resolveMediaUrl(item.url)}
                alt={item.caption || "图片"}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-2">
              <input
                type="text"
                value={item.caption || ""}
                onChange={(e) => updateItem(idx, { caption: e.target.value })}
                placeholder="图片标题（可选）"
                className="w-full text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 ring-primary"
              />
            </div>
            {/* Controls */}
            <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleReplace(idx)}
                title="替换图片"
                className="w-7 h-7 bg-black/50 text-white rounded-md flex items-center justify-center hover:bg-black/70"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => moveItem(idx, -1)}
                disabled={idx === 0}
                className="w-7 h-7 bg-black/50 text-white rounded-md flex items-center justify-center text-xs disabled:opacity-30 hover:bg-black/70"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => moveItem(idx, 1)}
                disabled={idx === items.length - 1}
                className="w-7 h-7 bg-black/50 text-white rounded-md flex items-center justify-center text-xs disabled:opacity-30 hover:bg-black/70"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="w-7 h-7 bg-red-500/80 text-white rounded-md flex items-center justify-center hover:bg-red-600"
              >
                ×
              </button>
            </div>
          </div>
        ))}

        {/* Upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-primary hover:bg-indigo-50 transition-all text-slate-400 hover:text-primary"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-xs">上传图片</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/*"
        onChange={handleReplaceChange}
        className="hidden"
      />
    </div>
  );
}
