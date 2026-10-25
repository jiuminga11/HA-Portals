import { useLocale } from "../../hooks/useLocale";
import adminZh from "../../locales/admin.zh.json";
import adminEn from "../../locales/admin.en.json";
import type { CtaBandContent, CTAButton } from "../../types";

interface Props {
  content: CtaBandContent;
  onChange: (content: CtaBandContent) => void;
}

function emptyButton(): CTAButton {
  return { label_zh: "", label_en: "", url: "" };
}

export default function CtaBandEditor({ content, onChange }: Props) {
  const { locale } = useLocale();
  const labels = locale === "en" ? adminEn : adminZh;
  const update = (patch: Partial<CtaBandContent>) => {
    onChange({ ...content, ...patch });
  };

  // --- Buttons ---
  const addButton = () => {
    update({ buttons: [...content.buttons, emptyButton()] });
  };

  const updateButton = (idx: number, patch: Partial<CTAButton>) => {
    const newButtons = [...content.buttons];
    newButtons[idx] = { ...newButtons[idx], ...patch };
    update({ buttons: newButtons });
  };

  const removeButton = (idx: number) => {
    update({ buttons: content.buttons.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700 mb-2">{labels.ctaBand.description}</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{labels.editor.descriptionZh}</label>
            <textarea
              value={content.description_zh}
              onChange={(e) => update({ description_zh: e.target.value })}
              placeholder={labels.ctaBand.descriptionZhPlaceholder}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">{labels.editor.descriptionEn}</label>
            <textarea
              value={content.description_en}
              onChange={(e) => update({ description_en: e.target.value })}
              placeholder={labels.ctaBand.descriptionEnPlaceholder}
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
            />
          </div>
        </div>
        <p className="text-xs text-slate-400">{labels.ctaBand.titleHint}</p>
      </fieldset>

      {/* Buttons */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700 mb-2">{labels.ctaBand.buttons}</legend>
        <button
          type="button"
          onClick={addButton}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {labels.editor.addButton}
        </button>

        {content.buttons.map((btn, idx) => (
          <div key={idx} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3">
            <div className="grid grid-cols-3 gap-2 flex-1">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{labels.editor.buttonLabelZh}</label>
                <input
                  type="text"
                  value={btn.label_zh}
                  onChange={(e) => updateButton(idx, { label_zh: e.target.value })}
                  placeholder={labels.ctaBand.buttonZhPlaceholder}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{labels.editor.buttonLabelEn}</label>
                <input
                  type="text"
                  value={btn.label_en}
                  onChange={(e) => updateButton(idx, { label_en: e.target.value })}
                  placeholder={labels.ctaBand.buttonEnPlaceholder}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">{labels.editor.linkUrl}</label>
                <input
                  type="text"
                  value={btn.url}
                  onChange={(e) => updateButton(idx, { url: e.target.value })}
                  placeholder={labels.ctaBand.urlPlaceholder}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
            </div>
            <button type="button" onClick={() => removeButton(idx)} className="mt-5 p-1 text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
