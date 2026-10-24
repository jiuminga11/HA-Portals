import { useId, useState } from "react";
import type { VideoContent } from "../../types";
import { resolveMediaUrl } from "../../lib/basePath";
import { useLocale } from "../../hooks/useLocale";
import { contentLang } from "../../lib/displayContent";
import { safeContentUrl } from "../../lib/safeUrl";
import zh from "../../locales/a11y.zh.json";
import en from "../../locales/a11y.en.json";

function VideoItem({ item }: { item: VideoContent["items"][number] }) {
  const { t, locale } = useLocale();
  const labels = locale === "en" ? en : zh;
  const titleId = useId();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const source = safeContentUrl(item.url, true);
  const poster = safeContentUrl(item.poster || "", true);
  return <div className="overflow-hidden glass-card rounded-2xl">
    <div className="relative aspect-video" style={{ background: "var(--color-bg)" }}>
      <video key={attempt} src={source ? resolveMediaUrl(source) : undefined} aria-labelledby={titleId}
        className="block w-full h-full object-contain" controls preload="metadata"
        poster={poster ? resolveMediaUrl(poster) : undefined} onError={() => setFailed(true)}>
        {t.section.videoNotSupported}
      </video>
    </div>
    <div className="px-4 py-3" style={{ borderTop: "1px solid var(--card-border)" }}>
      <h3 id={titleId} lang={contentLang(item.title)} className="text-base font-medium [overflow-wrap:anywhere]">{item.title}</h3>
      {(failed || !source) && <div className="mt-3 text-sm">
        <p role="alert">{labels.videoFailed}</p>
        <div className="flex flex-wrap gap-4 mt-3">
          <button type="button" className="underline underline-offset-4 disabled:opacity-50" disabled={!source}
            onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>{labels.retryVideo}</button>
          {source && <a className="underline underline-offset-4" href={resolveMediaUrl(source)} target="_blank" rel="noopener noreferrer">{labels.openVideo}</a>}
        </div>
      </div>}
    </div>
  </div>;
}

export default function VideoPlayer({ content }: { content: VideoContent }) {
  const { t } = useLocale();
  const items = content.items ?? [];
  if (!items.length) return <p className="reading-muted text-center py-8">{t.section.noVideos}</p>;
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {items.map((item, index) => <VideoItem key={`${index}:${item.url}`} item={item} />)}
  </div>;
}
