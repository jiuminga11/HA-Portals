import { useState, useEffect, useRef, useCallback } from "react";
import type { ImageGalleryContent } from "../../types";
import { resolveMediaUrl } from "../../lib/basePath";
import { useLocale } from "../../hooks/useLocale";

interface Props {
  content: ImageGalleryContent;
}

export default function ImageGallery({ content }: Props) {
  const { columns = 4, page_size = 8, items = [] } = content;
  const { t } = useLocale();
  const [currentPage, setCurrentPage] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const effectivePageSize = page_size === 0 ? items.length : page_size;
  const totalPages = effectivePageSize > 0 ? Math.ceil(items.length / effectivePageSize) : 1;
  const startIndex = currentPage * effectivePageSize;
  const pageItems = page_size === 0 ? items : items.slice(startIndex, startIndex + effectivePageSize);

  const openPreview = useCallback((index: number) => {
    setPreviewIndex(startIndex + index);
    dialogRef.current?.showModal();
  }, [startIndex]);

  const closePreview = useCallback(() => {
    setPreviewIndex(null);
    dialogRef.current?.close();
  }, []);

  const prevImage = useCallback(() => {
    setPreviewIndex((i) => (i !== null && i > 0 ? i - 1 : i));
  }, []);

  const nextImage = useCallback(() => {
    setPreviewIndex((i) => (i !== null && i < items.length - 1 ? i + 1 : i));
  }, [items.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (previewIndex === null) return;
      if (e.key === "Escape") closePreview();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [previewIndex, closePreview, prevImage, nextImage]);

  if (items.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p>{t.section.noImages}</p>
      </div>
    );
  }

  const colClass: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
    5: "grid-cols-2 sm:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  };
  const gridClass = colClass[Math.min(Math.max(columns, 2), 6)] || "grid-cols-2 sm:grid-cols-4";

  return (
    <div>
      <div className={`grid ${gridClass} gap-4`}>
        {pageItems.map((item, idx) => (
          <div
            key={idx}
            className="group relative overflow-hidden cursor-pointer glass-card rounded-xl"
            onClick={() => openPreview(idx)}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = 'var(--border-glow)';
              el.style.boxShadow = '0 4px 20px var(--glow-primary), 0 8px 30px rgba(0,0,0,0.12)';
              el.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.borderColor = '';
              el.style.boxShadow = '';
              el.style.transform = '';
            }}
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={resolveMediaUrl(item.url)}
                alt={item.caption || t.section.imageAlt}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            {item.caption && (
              <div
                className="absolute bottom-0 left-0 right-0 p-3"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
                }}
              >
                <p className="text-base truncate" style={{ color: 'var(--ink)' }}>{item.caption}</p>
              </div>
            )}
            {/* Hover overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: 'rgba(var(--color-primary-rgb), 0.08)' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(var(--color-primary-rgb), 0.18)',
                  border: '1px solid rgba(var(--color-primary-rgb), 0.35)',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <svg className="w-5 h-5" style={{ color: 'var(--color-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-30"
            style={{
              background: 'var(--badge-bg)',
              border: '1px solid var(--border-glow)',
              color: 'var(--color-primary)',
            }}
          >
            {t.pagination.prev}
          </button>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              className="w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: i === currentPage
                  ? 'linear-gradient(135deg, var(--color-primary), var(--color-gradient))'
                  : 'var(--bg-elevated)',
                border: i === currentPage
                  ? 'none'
                  : '1px solid var(--card-border)',
                color: i === currentPage ? 'var(--table-header-text)' : 'var(--text-muted)',
                boxShadow: i === currentPage ? '0 0 12px var(--glow-primary)' : undefined,
              }}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 disabled:opacity-30"
            style={{
              background: 'var(--badge-bg)',
              border: '1px solid var(--border-glow)',
              color: 'var(--color-primary)',
            }}
          >
            {t.pagination.next}
          </button>
        </div>
      )}

      {/* Fullscreen Preview Dialog */}
      <dialog
        ref={dialogRef}
        className="fixed inset-0 w-full h-full max-w-full max-h-full p-0 m-0"
        style={{
          border: "none",
          background: 'color-mix(in srgb, var(--color-bg) 96%, transparent)',
          backdropFilter: 'blur(20px)',
        }}
        onClick={(e) => {
          if (e.target === dialogRef.current) closePreview();
        }}
      >
        {previewIndex !== null && (
          <div className="flex items-center justify-center w-full h-full relative">
            <button
              onClick={closePreview}
              className="absolute top-4 right-4 z-10 rounded-full w-10 h-10 flex items-center justify-center transition-all duration-200"
              style={{
                background: 'rgba(var(--color-primary-rgb), 0.10)',
                border: '1px solid rgba(var(--color-primary-rgb), 0.20)',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(var(--color-primary-rgb), 0.22)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(var(--color-primary-rgb), 0.10)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {previewIndex > 0 && (
              <button
                onClick={prevImage}
                className="absolute left-4 z-10 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-200"
                style={{
                  background: 'rgba(var(--color-primary-rgb), 0.15)',
                  border: '1px solid rgba(var(--color-primary-rgb), 0.30)',
                  color: 'var(--color-primary)',
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {previewIndex < items.length - 1 && (
              <button
                onClick={nextImage}
                className="absolute right-4 z-10 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-200"
                style={{
                  background: 'rgba(var(--color-primary-rgb), 0.15)',
                  border: '1px solid rgba(var(--color-primary-rgb), 0.30)',
                  color: 'var(--color-primary)',
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}

            <img
              src={resolveMediaUrl(items[previewIndex].url)}
              alt={items[previewIndex].caption || t.section.imageAlt}
              className="max-w-[90vw] max-h-[85vh] object-contain"
              style={{
                borderRadius: '12px',
                boxShadow: '0 0 60px rgba(var(--color-primary-rgb), 0.15), 0 30px 60px rgba(0,0,0,0.5)',
              }}
            />

            {items[previewIndex].caption && (
              <div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full text-lg"
                style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-muted)',
                  backdropFilter: 'blur(12px)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                {items[previewIndex].caption}
              </div>
            )}

            <div
              className="absolute bottom-16 left-1/2 -translate-x-1/2 text-base"
              style={{ color: 'var(--text-faint)' }}
            >
              {previewIndex + 1} / {items.length}
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
