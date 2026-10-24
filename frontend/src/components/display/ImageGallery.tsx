import { useId, useRef, useState } from "react";
import type { ImageGalleryContent } from "../../types";
import { resolveMediaUrl } from "../../lib/basePath";
import { useLocale } from "../../hooks/useLocale";
import { contentLang } from "../../lib/displayContent";
import { safeContentUrl } from "../../lib/safeUrl";
import { useModalDialog } from "../common/useModalDialog";
import zh from "../../locales/a11y.zh.json";
import en from "../../locales/a11y.en.json";

interface Props { content: ImageGalleryContent }

function mediaSource(value: string): string {
  const safe = safeContentUrl(value, true);
  return safe ? resolveMediaUrl(safe) : "";
}

function ThumbnailImage({ src, alt, labels }: { src: string; alt: string; labels: typeof zh }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="flex h-full items-center p-3 text-sm reading-muted [overflow-wrap:anywhere]">{src ? labels.thumbnailFailed : labels.invalidImage}</span>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)}
    className="w-full h-full object-cover transition-transform duration-500 motion-reduce:transition-none motion-safe:group-hover:scale-105" />;
}

function PreviewImage({ src, alt, labels }: { src: string; alt: string; labels: typeof zh }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(src ? "loading" : "error");
  const [attempt, setAttempt] = useState(0);
  return <div className="gallery-media min-w-0 flex-1 flex flex-col items-center justify-center gap-3">
    {status === "loading" && <p role="status" className="text-sm">{labels.loadingImage}</p>}
    {status === "error" && <p role="alert" className="text-center [overflow-wrap:anywhere]">{src ? labels.imageFailed : labels.invalidImage}</p>}
    {src && <img key={attempt} src={src} alt={alt} decoding="async" hidden={status === "error"}
      className="gallery-preview-image object-contain rounded-xl" onLoad={() => setStatus("ready")} onError={() => setStatus("error")} />}
    <div className="flex flex-wrap justify-center gap-4 text-sm">
      <button type="button" aria-disabled={!src || status === "loading"} className="underline underline-offset-4 aria-disabled:opacity-50"
        onClick={() => { if (src && status !== "loading") { setStatus("loading"); setAttempt(value => value + 1); } }}>{labels.retryImage}</button>
      {src && <a href={src} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{labels.openOriginal}</a>}
    </div>
  </div>;
}

export default function ImageGallery({ content }: Props) {
  const { columns = 4, page_size = 8, items = [] } = content;
  const { t, locale } = useLocale();
  const labels = locale === "en" ? en : zh;
  const [currentPage, setCurrentPage] = useState(0);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const captionId = useId();
  const effectivePageSize = page_size === 0 ? items.length : page_size;
  const totalPages = effectivePageSize > 0 ? Math.ceil(items.length / effectivePageSize) : 1;
  const pageIndex = Math.min(currentPage, Math.max(0, totalPages - 1));
  const startIndex = pageIndex * effectivePageSize;
  const pageItems = page_size === 0 ? items : items.slice(startIndex, startIndex + effectivePageSize);
  const previewItem = previewIndex === null ? undefined : items[previewIndex];
  useModalDialog(Boolean(previewItem), dialogRef, closeRef, triggerRef);
  const close = () => setPreviewIndex(null);
  const move = (direction: -1 | 1) => setPreviewIndex(index => index === null ? null : Math.max(0, Math.min(items.length - 1, index + direction)));
  const colClass: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4", 5: "grid-cols-2 sm:grid-cols-5", 6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" };
  const gridClass = colClass[Math.min(Math.max(columns, 2), 6)] || "grid-cols-2 sm:grid-cols-4";
  if (!items.length) return <p className="reading-muted text-center py-8">{t.section.noImages}</p>;

  return <div>
    <div className={`grid ${gridClass} gap-4`}>
      {pageItems.map((item, index) => {
        const src = mediaSource(item.url);
        return <button type="button" key={startIndex + index}
        className="gallery-thumbnail group relative min-w-0 overflow-hidden glass-card rounded-xl text-left"
        aria-label={`${labels.openImage}: ${item.caption || t.section.imageAlt}`}
        onClick={event => { triggerRef.current = event.currentTarget; setPreviewIndex(startIndex + index); }}>
        <div className="aspect-square overflow-hidden">
          <ThumbnailImage key={src} src={src} alt={item.caption || t.section.imageAlt} labels={labels} />
        </div>
        {item.caption && <p lang={contentLang(item.caption)} className="p-3 text-base [overflow-wrap:anywhere]">{item.caption}</p>}
      </button>;
      })}
    </div>
    {totalPages > 1 && <nav aria-label={labels.gallery} className="flex flex-wrap justify-center items-center gap-2 mt-8">
      <button type="button" className="gallery-page-button" onClick={() => setCurrentPage(Math.max(0, pageIndex - 1))} disabled={pageIndex === 0}>{t.pagination.prev}</button>
      {Array.from({ length: totalPages }, (_, index) => <button type="button" key={index} aria-label={labels.page.replace("{page}", String(index + 1))} aria-current={pageIndex === index ? "page" : undefined}
        className="gallery-page-button" onClick={() => setCurrentPage(index)}>{index + 1}</button>)}
      <button type="button" className="gallery-page-button" onClick={() => setCurrentPage(Math.min(totalPages - 1, pageIndex + 1))} disabled={pageIndex === totalPages - 1}>{t.pagination.next}</button>
    </nav>}
    <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={previewItem?.caption ? captionId : undefined}
      className="gallery-dialog p-0 border-0 rounded-2xl"
      onCancel={event => { event.preventDefault(); close(); }}
      onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) close();
      }}
      onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }}>
      <div className="gallery-dialog-content flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold">{labels.gallery}</h2>
          <button ref={closeRef} type="button" className="gallery-control shrink-0" aria-label={labels.closeImage} onClick={close}>×</button>
        </div>
        {previewItem && previewIndex !== null && <>
          <p role="status" className="text-sm reading-muted">{labels.position.replace("{current}", String(previewIndex + 1)).replace("{total}", String(items.length))}</p>
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button type="button" className="gallery-control shrink-0" aria-label={labels.previousImage} aria-disabled={previewIndex === 0} onClick={() => { if (previewIndex > 0) move(-1); }}>‹</button>
            <PreviewImage key={`${previewIndex}:${previewItem.url}`} src={mediaSource(previewItem.url)} alt={previewItem.caption || t.section.imageAlt} labels={labels} />
            <button type="button" className="gallery-control shrink-0" aria-label={labels.nextImage} aria-disabled={previewIndex === items.length - 1} onClick={() => { if (previewIndex < items.length - 1) move(1); }}>›</button>
          </div>
          {previewItem.caption && <>
            <p id={`${captionId}-hint`} className="text-xs reading-muted">{labels.captionScrollHint}</p>
            <div id={captionId} lang={contentLang(previewItem.caption)} role="region" aria-label={labels.caption} aria-describedby={`${captionId}-hint`} tabIndex={0}
              className="gallery-caption rounded-lg p-3 text-base [overflow-wrap:anywhere] whitespace-pre-wrap">{previewItem.caption}</div>
          </>}
        </>}
      </div>
    </dialog>
  </div>;
}
