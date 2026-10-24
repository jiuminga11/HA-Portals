import { useEffect, useRef, useState } from "react";
import { getSiteConfig, updateSiteConfig } from "../../api/siteConfig";
import type { SiteConfig } from "../../types";
import ImageUpload from "../../components/common/ImageUpload";
import { THEME_PRESETS } from "../../themes/presets";
import { useLocale } from "../../hooks/useLocale";
import { useUnsavedChanges } from "../../hooks/useUnsavedChanges";
import { conflictMessage, isRevisionConflict } from "../../lib/securityMessages";

type SettingsForm = Omit<SiteConfig, "updated_at" | "revision">;
function toForm(config: SiteConfig): SettingsForm {
  return {
    site_title: config.site_title, project_title: config.project_title, footer_text: config.footer_text,
    logo_url: config.logo_url, banner_url: config.banner_url,
    primary_color: config.primary_color, gradient_color: config.gradient_color, accent_color: config.accent_color,
    theme_preset: config.theme_preset, font_size: config.font_size,
    default_theme: config.default_theme, default_locale: config.default_locale,
    seo_default_title_zh: config.seo_default_title_zh, seo_default_title_en: config.seo_default_title_en,
    seo_default_description_zh: config.seo_default_description_zh, seo_default_description_en: config.seo_default_description_en,
    seo_og_image: config.seo_og_image,
  };
}

export default function SiteSettings() {
  const { t, locale } = useLocale();
  const [revision, setRevision] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState<"loadedError" | "saveError" | "saved" | null>(null);
  const saveLock = useRef(false);
  const mounted = useRef(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const dirty = form !== null && JSON.stringify(form) !== snapshot;
  useUnsavedChanges(dirty);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getSiteConfig().then(config => {
      if (cancelled) return;
      const loaded = toForm(config);
      setRevision(config.revision);
      setForm(loaded);
      setSnapshot(JSON.stringify(loaded));
    }).catch(() => { if (!cancelled) setMessage("loadedError"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  // All preview variables belong to this card, never documentElement.
  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || !form) return;
    preview.style.cssText = "";
    preview.style.setProperty("--color-primary", form.primary_color);
    preview.style.setProperty("--color-gradient", form.gradient_color);
    preview.style.setProperty("--color-accent", form.accent_color);
    preview.style.fontSize = ({ standard: "16px", large: "18px", "extra-large": "20px" }[form.font_size] || "16px");
  }, [form, loading]);

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    if (!mounted.current) return;
    setMessage(null);
    setForm(previous => previous ? { ...previous, [key]: value } : previous);
  };
  const selectPreset = (id: string) => {
    const preset = THEME_PRESETS.find(item => item.id === id);
    if (!preset) return;
    setMessage(null);
    setForm(previous => previous ? { ...previous, theme_preset: id,
      primary_color: preset.colors["--color-primary"], gradient_color: preset.colors["--color-gradient"], accent_color: preset.colors["--color-accent"],
    } : previous);
  };
  const save = async () => {
    if (!mounted.current || !form || loading || saveLock.current) return;
    const submittedSnapshot = JSON.stringify(form);
    saveLock.current = true; setSaving(true); setMessage(null); setConflict(false);
    try {
      const response = await updateSiteConfig({ ...form, expected_revision: revision });
      const saved = toForm(response);
      if (!mounted.current) return;
      setRevision(response.revision);
      // An already-running upload can finish while the fieldset is disabled.
      // Preserve that newer input; only the submitted form may be normalized.
      setForm(current => JSON.stringify(current) === submittedSnapshot ? saved : current);
      setSnapshot(JSON.stringify(saved));
      setMessage("saved");
    } catch (error) { if (mounted.current) { setConflict(isRevisionConflict(error)); setMessage("saveError"); } }
    finally { saveLock.current = false; if (mounted.current) setSaving(false); }
  };

  if (loading) return <p role="status" className="py-16 text-center">{t.common.loading}</p>;
  if (!form) return <div role="alert" className="admin-form-message"><p>{t.settings.loadedError}</p><button className="underline mt-3" onClick={() => { setLoading(true); setMessage(null); setAttempt(value => value + 1); }}>{t.publicPage.retry}</button></div>;
  return (
    <div className="max-w-5xl">
      <h1 className="text-xl font-bold text-slate-800">{t.settings.title}</h1>
      <p className="text-sm text-slate-500 mt-2 mb-6">{t.settings.intro}</p>
      {message && <p role={message === "saved" ? "status" : "alert"} className="admin-form-message mb-5">{conflict ? conflictMessage(locale) : t.settings[message]}</p>}
      <fieldset disabled={saving} className="space-y-6 min-w-0">
        <section className="admin-settings-card">
          <h2 className="font-semibold mb-5">{t.settings.identity}</h2>
          {(["site_title", "project_title", "footer_text"] as const).map(key => <label key={key} className="block mb-5 text-sm font-medium">
            {t.settings.labels[key]}
            <textarea rows={key === "site_title" ? 1 : 2} value={form[key]} onChange={event => set(key, event.target.value)} className="admin-form-input" />
            <span className="block mt-2 text-sm text-slate-500 font-normal">{t.settings.hints[key]}</span>
          </label>)}
          {(["logo_url", "banner_url"] as const).map(key => <div key={key} className="mb-5">
            <h3 className="text-sm font-medium mb-2">{t.settings.labels[key]}</h3>
            <ImageUpload value={form[key]} onChange={url => set(key, url)} label={t.settings.labels[key]} placeholder={t.settings.imageHint} />
            <p className="mt-2 text-sm text-slate-500">{t.settings.hints[key]}</p>
          </div>)}
        </section>
        <section className="admin-settings-card">
          <h2 className="font-semibold mb-2">{t.settings.appearance}</h2>
          <p className="text-sm text-slate-500 mb-5">{t.settings.previewHint}</p>
          <label className="block text-sm font-medium mb-4">{t.settings.preset}
            <select className="admin-form-input" value={form.theme_preset} onChange={event => selectPreset(event.target.value)}>
              {THEME_PRESETS.map(preset => <option key={preset.id} value={preset.id}>{t.settings.presetNames[preset.id as keyof typeof t.settings.presetNames] || preset.id}</option>)}
            </select>
          </label>
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            {(["primary_color", "gradient_color", "accent_color"] as const).map(key => <label key={key} className="block text-sm font-medium">{t.settings.labels[key]}
              <input className="admin-form-input font-mono" value={form[key]} onChange={event => set(key, event.target.value)} placeholder={t.settings.colorHint} />
            </label>)}
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <label className="text-sm font-medium">{t.settings.fontSize}<select className="admin-form-input" value={form.font_size} onChange={event => set("font_size", event.target.value)}>
              <option value="standard">{t.settings.standard}</option><option value="large">{t.settings.large}</option><option value="extra-large">{t.settings.extraLarge}</option>
            </select></label>
            <label className="text-sm font-medium">{t.settings.defaultTheme}<select className="admin-form-input" value={form.default_theme} onChange={event => set("default_theme", event.target.value)}>
              <option value="light">{t.settings.light}</option><option value="dark">{t.settings.dark}</option><option value="system">{t.settings.system}</option>
            </select></label>
          </div>
          <p className="text-sm text-slate-500 mb-4">{t.settings.defaultThemeHint}</p>
          <div ref={previewRef} data-theme={THEME_PRESETS.some(preset => preset.id === form.theme_preset) ? form.theme_preset : "teal-amber"}
            className={`settings-preview rounded-xl p-5${form.default_theme === "dark" || (form.default_theme === "system" && systemDark) ? " dark" : ""}`}>
            <p className="font-semibold mb-3">{t.settings.preview}</p>
            <p>{form.site_title || t.settings.previewText}</p>
            <div className="settings-preview-swatch mt-4 h-4 rounded-full" />
          </div>
          <p className="text-sm text-slate-500 mt-5">{t.settings.localeHint} <code>{form.default_locale}</code></p>
        </section>
        <section className="admin-settings-card">
          <h2 className="font-semibold mb-2">{t.settings.seo}</h2>
          <p className="text-sm text-slate-500 mb-5">{t.settings.seoHint}</p>
          {(["seo_default_title_zh", "seo_default_title_en", "seo_default_description_zh", "seo_default_description_en"] as const).map(key => <label className="block mb-4 text-sm font-medium" key={key}>{t.settings.labels[key]}
            <textarea className="admin-form-input" rows={key.includes("description") ? 3 : 1} value={form[key]} onChange={event => set(key, event.target.value)} />
          </label>)}
          <ImageUpload value={form.seo_og_image} onChange={url => set("seo_og_image", url)} label={t.settings.labels.seo_og_image} placeholder={t.settings.imageHint} />
        </section>
        <div className="flex items-center justify-end gap-4">
          {dirty && <p className="text-sm text-slate-500">{t.settings.unsaved}</p>}
          <button className="px-6 py-3 rounded-xl bg-primary text-white font-semibold disabled:opacity-50" disabled={saving || !dirty} onClick={save}>{saving ? t.admin.saving : t.admin.save}</button>
        </div>
      </fieldset>
    </div>
  );
}
