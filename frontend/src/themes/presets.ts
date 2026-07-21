// ===== Theme Preset Definitions =====
// Each preset defines CSS variables for the admin preview.
// Public pages use CSS-based theming via data-theme attribute (see themes.css).

export interface ThemePreset {
  id: string;
  name: string;        // Chinese display name
  description: string; // One-line description
  mode: 'light' | 'dark';
  colors: Record<string, string>; // CSS variable name → value (light mode values for preview)
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'teal-amber',
    name: '青蓝琥珀',
    description: '心理学 × 医学，沉稳温暖',
    mode: 'light',
    colors: {
      // Primary palette
      '--color-primary':   '#0D9488',
      '--color-gradient':  '#D97706',
      '--color-accent':    '#D97706',

      // Background layers
      '--bg-base':         '#FAFAF9',
      '--bg-surface':      '#FFFFFF',
      '--bg-elevated':     '#F5F5F4',
      '--bg-card':         '#FFFFFF',

      // Hero gradient
      '--bg-hero-start':   '#0D9488',
      '--bg-hero-end':     '#D97706',

      // Glow
      '--glow-primary':    'rgba(13, 148, 136, 0.25)',
      '--glow-cyan':       'rgba(217, 119, 6, 0.2)',
      '--glow-purple':     'rgba(5, 150, 105, 0.2)',

      // Borders
      '--border-glass':    '#E2E8F0',
      '--border-glow':     'rgba(13, 148, 136, 0.25)',

      // Text
      '--text-base':       '#1E293B',
      '--text-muted':      '#64748B',
      '--text-faint':      '#94A3B8',

      // Component tokens
      '--card-bg':         '#FFFFFF',
      '--card-border':     '#E2E8F0',
      '--card-shadow':     '0 1px 3px rgba(0,0,0,0.08)',
      '--input-bg':        '#FFFFFF',
      '--input-border':    '#E2E8F0',
      '--nav-bg':          'rgba(255,255,255,0.92)',
      '--nav-border':      '#E2E8F0',
      '--footer-bg':       '#0F172A',
      '--footer-text':     '#94A3B8',
      '--table-header-text': '#FFFFFF',
      '--table-row-alt':   '#FAFAF9',
      '--badge-bg':        'rgba(13,148,136,0.08)',
      '--hover-bg':        'rgba(13,148,136,0.05)',
    },
  },

  {
    id: 'deep-indigo',
    name: '靛蓝鼠尾',
    description: '认知科学，深邃典雅',
    mode: 'light',
    colors: {
      '--color-primary':   '#312E81',
      '--color-gradient':  '#059669',
      '--color-accent':    '#059669',

      '--bg-base':         '#F5F5F4',
      '--bg-surface':      '#FFFFFF',
      '--bg-elevated':     '#FAFAF9',
      '--bg-card':         '#FFFFFF',

      '--bg-hero-start':   '#312E81',
      '--bg-hero-end':     '#059669',

      '--glow-primary':    'rgba(49, 46, 129, 0.25)',
      '--glow-cyan':       'rgba(5, 150, 105, 0.2)',
      '--glow-purple':     'rgba(225, 29, 72, 0.2)',

      '--border-glass':    '#D6D3D1',
      '--border-glow':     'rgba(49, 46, 129, 0.25)',

      '--text-base':       '#1C1917',
      '--text-muted':      '#57534E',
      '--text-faint':      '#A8A29E',

      '--card-bg':         '#FFFFFF',
      '--card-border':     '#D6D3D1',
      '--card-shadow':     '0 1px 3px rgba(0,0,0,0.08)',
      '--input-bg':        '#FFFFFF',
      '--input-border':    '#D6D3D1',
      '--nav-bg':          'rgba(255,255,255,0.92)',
      '--nav-border':      '#D6D3D1',
      '--footer-bg':       '#0F172A',
      '--footer-text':     '#94A3B8',
      '--table-header-text': '#FFFFFF',
      '--table-row-alt':   '#F5F5F4',
      '--badge-bg':        'rgba(49,46,129,0.08)',
      '--hover-bg':        'rgba(49,46,129,0.05)',
    },
  },

  {
    id: 'forest-terracotta',
    name: '森绿赤陶',
    description: '跨界创新，自然温暖',
    mode: 'light',
    colors: {
      '--color-primary':   '#065F46',
      '--color-gradient':  '#C2410C',
      '--color-accent':    '#C2410C',

      '--bg-base':         '#FFFBEB',
      '--bg-surface':      '#FFFFFF',
      '--bg-elevated':     '#FEF3C7',
      '--bg-card':         '#FFFFFF',

      '--bg-hero-start':   '#065F46',
      '--bg-hero-end':     '#C2410C',

      '--glow-primary':    'rgba(6, 95, 70, 0.25)',
      '--glow-cyan':       'rgba(194, 65, 12, 0.2)',
      '--glow-purple':     'rgba(37, 99, 235, 0.2)',

      '--border-glass':    '#D6D3D1',
      '--border-glow':     'rgba(6, 95, 70, 0.25)',

      '--text-base':       '#1C1917',
      '--text-muted':      '#57534E',
      '--text-faint':      '#A8A29E',

      '--card-bg':         '#FFFFFF',
      '--card-border':     '#D6D3D1',
      '--card-shadow':     '0 1px 3px rgba(0,0,0,0.08)',
      '--input-bg':        '#FFFFFF',
      '--input-border':    '#D6D3D1',
      '--nav-bg':          'rgba(255,251,235,0.92)',
      '--nav-border':      '#D6D3D1',
      '--footer-bg':       '#0F172A',
      '--footer-text':     '#94A3B8',
      '--table-header-text': '#FFFFFF',
      '--table-row-alt':   '#FFFBEB',
      '--badge-bg':        'rgba(6,95,70,0.08)',
      '--hover-bg':        'rgba(6,95,70,0.05)',
    },
  },
  {
    id: 'cyber-purple',
    name: '赛博紫',
    description: '赛博朋克，紫青霓虹',
    mode: 'light',
    colors: {
      // Primary palette
      '--color-primary':   '#8B5CF6',
      '--color-gradient':  '#06B6D4',
      '--color-accent':    '#06B6D4',

      // Background layers
      '--bg-base':         '#FAFAFF',
      '--bg-surface':      '#FFFFFF',
      '--bg-elevated':     '#F5F3FF',
      '--bg-card':         '#FFFFFF',

      // Hero gradient
      '--bg-hero-start':   '#8B5CF6',
      '--bg-hero-end':     '#06B6D4',

      // Glow
      '--glow-primary':    'rgba(139, 92, 246, 0.25)',
      '--glow-cyan':       'rgba(6, 182, 212, 0.2)',
      '--glow-purple':     'rgba(219, 39, 119, 0.2)',

      // Borders
      '--border-glass':    '#DDD6FE',
      '--border-glow':     'rgba(139, 92, 246, 0.25)',

      // Text
      '--text-base':       '#1E1B2E',
      '--text-muted':      '#4C4763',
      '--text-faint':      '#6E6890',

      // Component tokens
      '--card-bg':         '#FFFFFF',
      '--card-border':     '#DDD6FE',
      '--card-shadow':     '0 1px 3px rgba(0,0,0,0.08)',
      '--input-bg':        '#FFFFFF',
      '--input-border':    '#DDD6FE',
      '--nav-bg':          'rgba(250,250,255,0.9)',
      '--nav-border':      '#DDD6FE',
      '--footer-bg':       '#0F172A',
      '--footer-text':     '#94A3B8',
      '--table-header-text': '#FFFFFF',
      '--table-row-alt':   '#F5F3FF',
      '--badge-bg':        'rgba(139,92,246,0.08)',
      '--hover-bg':        'rgba(139,92,246,0.06)',
    },
  },

  {
    id: 'ink-blue-gold',
    name: '墨蓝金',
    description: '学术正式，藏青配金',
    mode: 'light',
    colors: {
      // Primary palette
      '--color-primary':   '#2F5FBF',
      '--color-gradient':  '#D97706',
      '--color-accent':    '#D97706',

      // Background layers
      '--bg-base':         '#F8F7F4',
      '--bg-surface':      '#FFFFFF',
      '--bg-elevated':     '#F5F5F4',
      '--bg-card':         '#FFFFFF',

      // Hero gradient
      '--bg-hero-start':   '#2F5FBF',
      '--bg-hero-end':     '#D97706',

      // Glow
      '--glow-primary':    'rgba(47, 95, 191, 0.25)',
      '--glow-cyan':       'rgba(217, 119, 6, 0.2)',
      '--glow-purple':     'rgba(159, 18, 57, 0.2)',

      // Borders
      '--border-glass':    '#E7E5E4',
      '--border-glow':     'rgba(47, 95, 191, 0.25)',

      // Text
      '--text-base':       '#1C1917',
      '--text-muted':      '#44403C',
      '--text-faint':      '#78716C',

      // Component tokens
      '--card-bg':         '#FFFFFF',
      '--card-border':     '#E7E5E4',
      '--card-shadow':     '0 1px 3px rgba(0,0,0,0.08)',
      '--input-bg':        '#FFFFFF',
      '--input-border':    '#E7E5E4',
      '--nav-bg':          'rgba(248,247,244,0.92)',
      '--nav-border':      '#E7E5E4',
      '--footer-bg':       '#0F172A',
      '--footer-text':     '#94A3B8',
      '--table-header-text': '#FFFFFF',
      '--table-row-alt':   '#F5F5F4',
      '--badge-bg':        'rgba(47,95,191,0.08)',
      '--hover-bg':        'rgba(47,95,191,0.05)',
    },
  },
];
