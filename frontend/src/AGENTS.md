# FRONTEND SRC

React 19 + TypeScript + Vite + TailwindCSS. Dark sci-tech visual theme.

## STRUCTURE

```
src/
├── api/                 # Axios client + per-resource API functions
├── components/
│   ├── display/         # 5 public renderers + SectionRenderer dispatcher
│   ├── editor/          # 5 admin editors (one per content type)
│   ├── layout/          # Header, TopNav, Footer, AdminSidebar
│   └── common/          # FileUpload, ImageUpload, ConfirmDialog
├── hooks/               # useActiveSection (scroll), useAuth
├── pages/
│   ├── Home.tsx         # Public single-scroll display page
│   └── admin/           # Login, Layout, Dashboard, SectionEditor, SiteSettings, FileManager
├── styles/theme.css     # CSS variables + utility classes (THE theme source)
├── types/index.ts       # All TypeScript types (discriminated union for Section)
└── index.css            # Tailwind directives + global dark styles
```

## WHERE TO LOOK

| Task | File(s) | Notes |
|------|---------|-------|
| Add section renderer | `components/display/` + `SectionRenderer.tsx` | Add component + case in switch |
| Add section editor | `components/editor/` + `pages/admin/SectionEditor.tsx` | Add component + case in switch |
| Change theme colors | `styles/theme.css` | CSS vars; admin can override at runtime via API |
| Change scroll behavior | `hooks/useActiveSection.ts` | IntersectionObserver-based |
| Change API base URL | `api/client.ts` | Axios interceptors here too |
| Change routing | `App.tsx` | ProtectedRoute wraps admin routes |

## CONVENTIONS

- Theme colors via CSS variables (`--color-primary` etc.), NOT Tailwind color classes
- Utility classes in `theme.css`: `.bg-primary`, `.glass`, `.glow-primary`, `.reveal`
- Scroll-reveal: SectionRenderer adds `.reveal` class, IntersectionObserver toggles `.visible`
- System fonts only — never import Google Fonts or any external font
- CSS-only animations — no framer-motion, GSAP, etc.
- API types match backend Pydantic schemas — keep in sync manually
- Empty config fallback in `Home.tsx` via `getDisplayConfig()`

## ANTI-PATTERNS

- Never use `as any` or `@ts-ignore`
- Never hardcode text content (titles, footer) — all from SiteConfig API
- Never use Tailwind custom palette for theme colors — use CSS variables
- Never add external font CDN links (Google Fonts blocked in China)
