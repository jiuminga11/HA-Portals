import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import PublicLayout from "./components/layout/PublicLayout";
import PublicPage from "./pages/public/PublicPage";
import { LocaleProvider } from "./hooks/useLocale";
import { ThemeProvider } from "./hooks/useTheme";
import { basePath } from "./lib/basePath";

// Admin 路由延迟加载 — 避免 admin 代码进入公共 bundle。
const Login = lazy(() => import("./pages/admin/Login"));
const AdminLayout = lazy(() => import("./pages/admin/Layout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const SectionEditor = lazy(() => import("./pages/admin/SectionEditor"));
const SiteSettings = lazy(() => import("./pages/admin/SiteSettings"));
const FileManager = lazy(() => import("./pages/admin/FileManager"));
const Guide = lazy(() => import("./pages/admin/Guide"));
const PageManager = lazy(() => import("./pages/admin/PageManager"));

function AdminFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen text-sm" style={{ color: "var(--color-text-muted)" }}>
      加载中…
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }
  return <>{children}</>;
}

function DynamicPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/" replace />;
  return <PublicPage slug={slug} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <BrowserRouter basename={basePath}>
          <Routes>
            {/* Public pages */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<PublicPage slug="home" />} />
              <Route path="/:slug" element={<DynamicPage />} />
            </Route>

            {/* Admin auth */}
            {/* Admin auth */}
            <Route
              path="/admin/login"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <Login />
                </Suspense>
              }
            />

            {/* Admin protected */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Suspense fallback={<AdminFallback />}>
                    <AdminLayout />
                  </Suspense>
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="site-settings" element={<SiteSettings />} />
              <Route path="sections/new" element={<SectionEditor />} />
              <Route path="sections/:id" element={<SectionEditor />} />
              <Route path="files" element={<FileManager />} />
              <Route path="guide" element={<Guide />} />
              <Route path="pages" element={<PageManager />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </LocaleProvider>
    </ThemeProvider>
  );
}
