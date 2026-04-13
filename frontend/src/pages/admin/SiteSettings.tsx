import { useEffect, useState } from "react";
import { getSiteConfig, updateSiteConfig } from "../../api/siteConfig";
import ImageUpload from "../../components/common/ImageUpload";
import { THEME_PRESETS } from "../../themes/presets";

type SettingsForm = {
  site_title: string;
  project_title: string;
  footer_text: string;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string;
  gradient_color: string;
  accent_color: string;
  theme_preset: string;
  font_size: string;
};

export default function SiteSettings() {
  const [form, setForm] = useState<SettingsForm>({
    site_title: "",
    project_title: "",
    footer_text: "",
    logo_url: null,
    banner_url: null,
    primary_color: "#1E3A8A",
    gradient_color: "#3B82F6",
    accent_color: "#0284C7",
    theme_preset: "academic-slate-blue",
    font_size: "standard",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const config = await getSiteConfig();
        setForm({
          site_title: config.site_title,
          project_title: config.project_title,
          footer_text: config.footer_text,
          logo_url: config.logo_url,
          banner_url: config.banner_url,
          primary_color: config.primary_color,
          gradient_color: config.gradient_color,
          accent_color: config.accent_color,
          theme_preset: config.theme_preset || "academic-slate-blue",
          font_size: config.font_size || "standard",
        });
      } catch {
        showToast("error", "加载配置失败");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const applyPresetPreview = (presetId: string) => {
    const preset = THEME_PRESETS.find((t) => t.id === presetId) ?? THEME_PRESETS[0];
    const root = document.documentElement;
    Object.entries(preset.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
    root.setAttribute("data-theme", preset.mode);
  };

  const handleSave = async (overrides?: Partial<SettingsForm>) => {
    const data = overrides ? { ...form, ...overrides } : form;
    setSaving(true);
    try {
      const payload = {
        site_title: data.site_title,
        project_title: data.project_title,
        footer_text: data.footer_text,
        logo_url: data.logo_url as string | null,
        banner_url: data.banner_url as string | null,
        primary_color: data.primary_color,
        gradient_color: data.gradient_color,
        accent_color: data.accent_color,
        theme_preset: data.theme_preset,
        font_size: data.font_size,
      };
      await updateSiteConfig(payload);
      // Apply full theme preview
      applyPresetPreview(data.theme_preset);
      document.documentElement.style.setProperty("--color-primary", data.primary_color);
      document.documentElement.style.setProperty("--color-gradient", data.gradient_color);
      document.documentElement.style.setProperty("--color-accent", data.accent_color);
      // Apply font size
      const fontSizeMap: Record<string, string> = { standard: '16px', large: '18px', 'extra-large': '20px' };
      document.documentElement.style.fontSize = fontSizeMap[data.font_size] || '16px';
      showToast("success", "保存成功");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        "保存失败";
      showToast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const handlePresetSelect = async (presetId: string) => {
    const preset = THEME_PRESETS.find((t) => t.id === presetId) ?? THEME_PRESETS[0];
    const updated: Partial<SettingsForm> = {
      theme_preset: presetId,
      // Sync primary/gradient/accent from preset
      primary_color: preset.colors["--color-primary"],
      gradient_color: preset.colors["--color-gradient"],
      accent_color: preset.colors["--color-accent"],
    };
    setForm((prev) => ({ ...prev, ...updated }));
    // Immediately preview
    applyPresetPreview(presetId);
    // Auto-save
    await handleSave(updated);
  };

  const set = (key: keyof SettingsForm, value: string | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
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
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-800">站点设置</h1>
        <p className="text-sm text-slate-500 mt-0.5">配置网站基本信息和主题外观</p>
      </div>

      <div className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-600 pb-3 border-b border-slate-200">基本信息</h2>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">网站标题</label>
            <input
              type="text"
              value={form.site_title}
              onChange={(e) => set("site_title", e.target.value)}
              placeholder="教学成果展示（浏览器标签页显示）"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 ring-primary bg-white placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">项目名称 <span className="text-slate-400 font-normal">(回车换行)</span></label>
            <textarea
              rows={2}
              value={form.project_title}
              onChange={(e) => set("project_title", e.target.value)}
              placeholder="新医科背景下基于生成式人工智能的&#10;精神医学教学改革"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 ring-primary bg-white placeholder:text-slate-400 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1.5">底部版权文字</label>
            <input
              type="text"
              value={form.footer_text}
              onChange={(e) => set("footer_text", e.target.value)}
              placeholder="© 2024 河南医药大学精神医学系"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 ring-primary bg-white placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Images */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-600 pb-3 border-b border-slate-200">图片设置</h2>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">院徽 / 校徽</label>
            <ImageUpload
              value={form.logo_url}
              onChange={(url) => set("logo_url", url)}
              label="上传院徽"
              placeholder="支持 JPG/PNG/GIF/WebP 格式"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">横幅大图</label>
            <ImageUpload
              value={form.banner_url}
              onChange={(url) => set("banner_url", url)}
              label="上传横幅"
              placeholder="推荐尺寸 1920×480，支持 JPG/PNG/WebP"
            />
          </div>
        </div>

        {/* Theme preset selector */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-600 pb-3 border-b border-slate-200 mb-5">主题风格</h2>
          <p className="text-xs text-slate-400 mb-4">选择后立即生效，同时更新下方配色</p>
          <div className="grid grid-cols-3 gap-3">
            {THEME_PRESETS.map((preset) => {
              const isSelected = form.theme_preset === preset.id;
              const primary = preset.colors["--color-primary"];
              const gradient = preset.colors["--color-gradient"];
              const accent = preset.colors["--color-accent"];
              const bgBase = preset.colors["--bg-base"];
              const bgCard = preset.colors["--card-bg"];
              const textBase = preset.colors["--text-base"];
              return (
                <button
                  key={preset.id}
                  onClick={() => handlePresetSelect(preset.id)}
                  className="relative rounded-xl border-2 overflow-hidden transition-all duration-200 text-left"
                  style={{
                    borderColor: isSelected ? primary : '#E2E8F0',
                    boxShadow: isSelected
                      ? `0 0 0 3px ${primary}22`
                      : '0 1px 3px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* Color swatch area */}
                  <div
                    className="h-14 relative overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg, ${primary} 0%, ${gradient} 60%, ${accent} 100%)`,
                    }}
                  >
                    {/* Mini UI mockup */}
                    <div className="absolute inset-0 p-2 flex flex-col gap-1">
                      <div className="h-2 w-2/3 rounded-full opacity-50" style={{ background: bgCard }} />
                      <div className="h-1.5 w-1/2 rounded-full opacity-40" style={{ background: bgCard }} />
                      <div className="h-1.5 w-4/5 rounded-full opacity-30" style={{ background: bgCard }} />
                    </div>
                    {/* Mode badge */}
                    <div
                      className="absolute top-1.5 right-1.5 text-xs px-1.5 py-0.5 rounded-full font-medium leading-none"
                      style={{
                        background: 'rgba(0,0,0,0.35)',
                        color: '#FFFFFF',
                        fontSize: '9px',
                      }}
                    >
                      {preset.mode === 'dark' ? '暗色' : '亮色'}
                    </div>
                  </div>

                  {/* Card content area */}
                  <div
                    className="px-2.5 py-2"
                    style={{ background: bgBase === '#FFFFFF' ? '#F8FAFC' : bgBase }}
                  >
                    {/* Palette dots */}
                    <div className="flex items-center gap-1 mb-1.5">
                      <div className="w-3 h-3 rounded-full" style={{ background: primary }} />
                      <div className="w-3 h-3 rounded-full" style={{ background: gradient }} />
                      <div className="w-3 h-3 rounded-full" style={{ background: accent }} />
                    </div>
                    <div className="text-xs font-semibold truncate" style={{ color: textBase === '#F8FAFC' ? '#1E293B' : textBase }}>
                      {preset.name}
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>
                      {preset.description}
                    </div>
                  </div>

                  {/* Selected check */}
                  {isSelected && (
                    <div
                      className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: primary }}
                    >
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font size selector */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-600 pb-3 border-b border-slate-200">字体大小</h2>
          <div className="flex gap-3">
            {([
              { id: 'standard', label: '标准', desc: '16px，默认大小' },
              { id: 'large', label: '大号', desc: '18px，适合展示' },
              { id: 'extra-large', label: '特大', desc: '20px，更易阅读' },
            ] as const).map((size) => {
              const isSelected = form.font_size === size.id;
              return (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => { set('font_size', size.id); handleSave({ font_size: size.id }); }}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 text-center transition-all ${ isSelected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300' }`}
                >
                  <div className={`font-bold ${ isSelected ? 'text-blue-700' : 'text-slate-700' }`}>{size.label}</div>
                  <div className="text-xs text-slate-400 mt-1">{size.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme colors (fine-tuning) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-slate-600 pb-3 border-b border-slate-200">主题配色 <span className="font-normal text-slate-400">（微调）</span></h2>

          {[
            { key: "primary_color" as const, label: "主色", desc: "按钮、导航高亮等" },
            { key: "gradient_color" as const, label: "渐变色", desc: "页头渐变终止色" },
            { key: "accent_color" as const, label: "强调色", desc: "辅助高亮色" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-600 mb-0.5">{label}</label>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9a-fA-F]{0,6}$/.test(val)) set(key, val);
                  }}
                  maxLength={7}
                  className="w-24 text-sm border border-slate-300 rounded-lg px-2.5 py-2 font-mono uppercase focus:outline-none focus:ring-2 ring-primary bg-white text-slate-800"
                />
              </div>
            </div>
          ))}

          {/* Preview bar */}
          <div className="mt-2">
            <p className="text-xs text-slate-500 mb-2">渐变预览</p>
            <div
              className="h-8 rounded-lg shadow-inner"
              style={{
                background: `linear-gradient(135deg, ${form.primary_color}, ${form.gradient_color})`,
              }}
            />
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="px-8 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 transition-all flex items-center gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                保存中...
              </>
            ) : "保 存"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
