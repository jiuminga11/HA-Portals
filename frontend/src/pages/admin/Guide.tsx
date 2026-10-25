import { useLocale } from "../../hooks/useLocale";
import zh from "../../locales/admin.zh.json";
import en from "../../locales/admin.en.json";

export default function Guide() {
  const { locale } = useLocale();
  const guide = (locale === "en" ? en : zh).guide;
  const sections = guide.sections;

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-slate-800">{guide.title}</h1>
        <p className="text-slate-500 text-sm mt-1">{guide.intro}</p>
      </div>

      <div className="space-y-6">
        {sections.map((section, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
          >
            <div
              className="px-6 py-4 border-b border-slate-100"
              style={{ background: '#F8FAFC' }}
            >
              <h2 className="font-bold text-slate-700 flex items-center gap-2">
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-xs text-white font-bold"
                  style={{ background: 'linear-gradient(135deg, #1E3A8A, #3B82F6)' }}
                >
                  {idx + 1}
                </span>
                {section.title}
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {section.items.map((item, i) => (
                <div key={i} className="px-6 py-4 flex gap-4">
                  <div className="shrink-0 mt-0.5">
                    <span className="inline-block w-2 h-2 rounded-full mt-1.5" style={{ background: '#3B82F6' }} />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-800">{item.label}</span>
                    <span className="text-slate-500 ml-2">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
