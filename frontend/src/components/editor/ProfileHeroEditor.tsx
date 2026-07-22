import { useState } from "react";
import type { ProfileHeroContent, SocialLink } from "../../types";
import ImageUpload from "../common/ImageUpload";
import AvatarCropEditor from "../common/AvatarCropEditor";

interface Props {
  content: ProfileHeroContent;
  onChange: (content: ProfileHeroContent) => void;
}

const PLATFORM_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "github", label: "GitHub" },
  { value: "google_scholar", label: "Google Scholar" },
  { value: "orcid", label: "ORCID" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "researchgate", label: "ResearchGate" },
];

function emptySocialLink(): SocialLink {
  return { platform: "email", url: "", label: "" };
}

function emptyCTA(): { label_zh: string; label_en: string; url: string } {
  return { label_zh: "", label_en: "", url: "" };
}

export default function ProfileHeroEditor({ content, onChange }: Props) {
  const [tagInput, setTagInput] = useState("");

  const update = (patch: Partial<ProfileHeroContent>) => {
    onChange({ ...content, ...patch });
  };

  // --- Tags ---
  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || content.tags.includes(trimmed)) return;
    update({ tags: [...content.tags, trimmed] });
    setTagInput("");
  };

  const removeTag = (idx: number) => {
    update({ tags: content.tags.filter((_, i) => i !== idx) });
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    }
  };

  // --- Social Links ---
  const addSocialLink = () => {
    update({ social_links: [...content.social_links, emptySocialLink()] });
  };

  const updateSocialLink = (idx: number, patch: Partial<SocialLink>) => {
    const newLinks = [...content.social_links];
    newLinks[idx] = { ...newLinks[idx], ...patch };
    update({ social_links: newLinks });
  };

  const removeSocialLink = (idx: number) => {
    update({ social_links: content.social_links.filter((_, i) => i !== idx) });
  };

  // --- CTA Buttons ---
  const addCTA = () => {
    update({ cta_buttons: [...content.cta_buttons, emptyCTA()] });
  };

  const updateCTA = (idx: number, patch: Partial<{ label_zh: string; label_en: string; url: string }>) => {
    const newButtons = [...content.cta_buttons];
    newButtons[idx] = { ...newButtons[idx], ...patch };
    update({ cta_buttons: newButtons });
  };

  const removeCTA = (idx: number) => {
    update({ cta_buttons: content.cta_buttons.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      {/* Basic fields */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700 mb-2">基本信息</legend>

<div>
<label className="text-xs text-slate-500 mb-1 block">头像</label>
<ImageUpload
value={content.avatar_url || null}
onChange={(url) => update({ avatar_url: url ?? "" })}
label="上传头像"
placeholder="支持 JPG/PNG/GIF/WebP，上传后自动填充路径"
            circular
            hidePreview
/>
          {content.avatar_url && (
            <div className="mt-3">
              <AvatarCropEditor
                src={content.avatar_url}
                position={content.avatar_position ?? "50% 50%"}
                onChange={(pos) => update({ avatar_position: pos })}
              />
            </div>
          )}
<input
type="text"
value={content.avatar_url}
onChange={(e) => update({ avatar_url: e.target.value })}
placeholder="或粘贴外部图片 URL（https://...）"
className="mt-2 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
/>
</div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">姓名（中文）*</label>
            <input
              type="text"
              value={content.name_zh}
              onChange={(e) => update({ name_zh: e.target.value })}
              placeholder="请输入姓名"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">姓名（英文）</label>
            <input
              type="text"
              value={content.name_en}
              onChange={(e) => update({ name_en: e.target.value })}
              placeholder="Your Name"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">标语（中文）</label>
            <input
              type="text"
              value={content.tagline_zh}
              onChange={(e) => update({ tagline_zh: e.target.value })}
              placeholder="连接AI、心理学与精神医学教育"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">标语（英文）</label>
            <input
              type="text"
              value={content.tagline_en}
              onChange={(e) => update({ tagline_en: e.target.value })}
              placeholder="Bridging AI, Psychology & Psychiatry Education"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">使命宣言（中文）</label>
            <textarea
              value={content.mission_zh}
              onChange={(e) => update({ mission_zh: e.target.value })}
              placeholder="核心理念"
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">使命宣言（英文）</label>
            <textarea
              value={content.mission_en}
              onChange={(e) => update({ mission_en: e.target.value })}
              placeholder="Mission statement"
              rows={3}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary resize-none"
            />
          </div>
        </div>
      </fieldset>

      {/* Tags */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700 mb-2">标签</legend>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="输入标签后按回车添加"
            className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-3 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            添加
          </button>
        </div>
        {content.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {content.tags.map((tag, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(idx)}
                  className="text-slate-400 hover:text-red-500"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </fieldset>

      {/* Social Links */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700 mb-2">社交链接</legend>
        <button
          type="button"
          onClick={addSocialLink}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加社交链接
        </button>

        {content.social_links.map((link, idx) => (
          <div key={idx} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3">
            <div className="grid grid-cols-3 gap-2 flex-1">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">平台</label>
                <select
                  value={link.platform}
                  onChange={(e) => updateSocialLink(idx, { platform: e.target.value })}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                >
                  {PLATFORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">URL *</label>
                <input
                  type="text"
                  value={link.url}
                  onChange={(e) => updateSocialLink(idx, { url: e.target.value })}
                  placeholder="https://..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">标签</label>
                <input
                  type="text"
                  value={link.label}
                  onChange={(e) => updateSocialLink(idx, { label: e.target.value })}
                  placeholder="显示名称"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
            </div>
            <button type="button" onClick={() => removeSocialLink(idx)} className="mt-5 p-1 text-red-400 hover:text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </fieldset>

      {/* CTA Buttons */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-700 mb-2">CTA 按钮</legend>
        <button
          type="button"
          onClick={addCTA}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          添加按钮
        </button>

        {content.cta_buttons.map((btn, idx) => (
          <div key={idx} className="flex items-start gap-3 bg-white border border-slate-200 rounded-xl p-3">
            <div className="grid grid-cols-3 gap-2 flex-1">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">按钮文字（中文）*</label>
                <input
                  type="text"
                  value={btn.label_zh}
                  onChange={(e) => updateCTA(idx, { label_zh: e.target.value })}
                  placeholder="查看研究"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">按钮文字（英文）</label>
                <input
                  type="text"
                  value={btn.label_en}
                  onChange={(e) => updateCTA(idx, { label_en: e.target.value })}
                  placeholder="View Research"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">链接 URL *</label>
                <input
                  type="text"
                  value={btn.url}
                  onChange={(e) => updateCTA(idx, { url: e.target.value })}
                  placeholder="/research 或 https://..."
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 ring-primary"
                />
              </div>
            </div>
            <button type="button" onClick={() => removeCTA(idx)} className="mt-5 p-1 text-red-400 hover:text-red-600">
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
