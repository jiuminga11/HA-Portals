// ===== Page =====
export interface Page {
  id: number;
  slug: string;
  title_zh: string;
  title_en: string;
  meta_description_zh: string;
  meta_description_en: string;
  sort_order: number;
  visible: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// ===== Section types =====
export type SectionType =
  | "rich_text" | "image_gallery" | "data_table" | "external_links" | "video"
  | "metric_cards" | "timeline" | "profile_hero";

// ===== Content 类型 =====
export interface RichTextContent {
  body: string;
}

export interface ImageGalleryItem {
  url: string;
  caption?: string;
}
export interface ImageGalleryContent {
  columns: number;
  page_size: number;
  items: ImageGalleryItem[];
}

export interface DataTableColumn {
  key: string;
  title: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}
export interface DataTableContent {
  columns: DataTableColumn[];
  rows: Record<string, string>[];
}

export interface ExternalLinkItem {
  title: string;
  url: string;
  date?: string;
  source?: string;
}
export interface ExternalLinksContent {
  items: ExternalLinkItem[];
}

export interface VideoItem {
  title: string;
  url: string;
  poster?: string;
}
export interface VideoContent {
  items: VideoItem[];
}

// ===== New content types =====
export interface MetricCardItem {
  label_zh: string;
  label_en: string;
  value: string;
  detail_zh: string;
  detail_en: string;
}
export interface MetricCardsContent {
  cards: MetricCardItem[];
}

export interface TimelineItem {
  date_start: string;
  date_end?: string;
  title_zh: string;
  title_en: string;
  subtitle_zh: string;
  subtitle_en: string;
  description_zh: string;
  description_en: string;
  category: string;
  icon?: string;
}
export interface TimelineContent {
  items: TimelineItem[];
  layout: "vertical" | "horizontal";
}

export interface SocialLink {
  platform: string;
  url: string;
  label: string;
}
export interface ProfileHeroContent {
  avatar_url: string;
  name_zh: string;
  name_en: string;
  tagline_zh: string;
  tagline_en: string;
  mission_zh: string;
  mission_en: string;
  tags: string[];
  social_links: SocialLink[];
  cta_buttons: { label_zh: string; label_en: string; url: string }[];
}

// ===== Discriminated union (8 types) =====
export type Section =
  | { id: number; page_id: number; title_zh: string; title_en: string; type: "rich_text";       sort_order: number; visible: boolean; content: RichTextContent;       created_at: string | null; updated_at: string | null; }
  | { id: number; page_id: number; title_zh: string; title_en: string; type: "image_gallery";   sort_order: number; visible: boolean; content: ImageGalleryContent;   created_at: string | null; updated_at: string | null; }
  | { id: number; page_id: number; title_zh: string; title_en: string; type: "data_table";      sort_order: number; visible: boolean; content: DataTableContent;      created_at: string | null; updated_at: string | null; }
  | { id: number; page_id: number; title_zh: string; title_en: string; type: "external_links";  sort_order: number; visible: boolean; content: ExternalLinksContent;  created_at: string | null; updated_at: string | null; }
  | { id: number; page_id: number; title_zh: string; title_en: string; type: "video";           sort_order: number; visible: boolean; content: VideoContent;          created_at: string | null; updated_at: string | null; }
  | { id: number; page_id: number; title_zh: string; title_en: string; type: "metric_cards";    sort_order: number; visible: boolean; content: MetricCardsContent;    created_at: string | null; updated_at: string | null; }
  | { id: number; page_id: number; title_zh: string; title_en: string; type: "timeline";        sort_order: number; visible: boolean; content: TimelineContent;       created_at: string | null; updated_at: string | null; }
  | { id: number; page_id: number; title_zh: string; title_en: string; type: "profile_hero";    sort_order: number; visible: boolean; content: ProfileHeroContent;    created_at: string | null; updated_at: string | null; };

// ===== SiteConfig =====
export interface SiteConfig {
  site_title: string;
  project_title: string;
  logo_url: string | null;
  banner_url: string | null;
  footer_text: string;
  primary_color: string;
  gradient_color: string;
  accent_color: string;
  theme_preset: string;
  font_size: string;
  default_theme: string;
  default_locale: string;
  seo_default_title_zh: string;
  seo_default_title_en: string;
  seo_default_description_zh: string;
  seo_default_description_en: string;
  seo_og_image: string | null;
  updated_at: string | null;
}

// ===== File =====
export interface FileResponse {
  id: number;
  filename: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface UploadResponse {
  id: number;
  file_url: string;
  filename: string;
}

// ===== Auth =====
export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}
