import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import PublicLayout from "./components/layout/PublicLayout";
import PublicPage from "./pages/public/PublicPage";
import Login from "./pages/admin/Login";
import AdminLayout from "./pages/admin/Layout";
import Dashboard from "./pages/admin/Dashboard";
import SectionEditor from "./pages/admin/SectionEditor";
import SiteSettings from "./pages/admin/SiteSettings";
import FileManager from "./pages/admin/FileManager";
import Guide from "./pages/admin/Guide";
import PageManager from "./pages/admin/PageManager";
import { LocaleProvider } from "./hooks/useLocale";
import { ThemeProvider } from "./hooks/useTheme";
import { basePath } from "./lib/basePath";

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
            <Route path="/admin/login" element={<Login />} />

            {/* Admin protected */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
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
