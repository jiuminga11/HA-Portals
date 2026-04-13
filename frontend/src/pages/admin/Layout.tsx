import { Outlet, useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/layout/AdminSidebar";
import { basePath } from "../../lib/basePath";

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/admin/login", { replace: true });
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Top bar */}
      <header
        className="px-6 py-3 flex items-center justify-between shrink-0"
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--card-border)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
              boxShadow: '0 0 10px rgba(59,130,246,0.4)',
            }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </div>
          <span className="font-semibold text-sm" style={{ color: '#1E293B' }}>HA-PORTALS 管理后台</span>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={basePath || "/"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{ color: '#64748B' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = '#1E3A8A';
              (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(30,58,138,0.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.color = '#64748B';
              (e.currentTarget as HTMLAnchorElement).style.background = '';
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            访问前台
          </a>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-200"
            style={{ color: '#64748B' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#FCA5A5';
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = '#64748B';
              (e.currentTarget as HTMLButtonElement).style.background = '';
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            退出登录
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        <AdminSidebar />
        <main
          className="flex-1 overflow-y-auto p-6"
          style={{ background: 'var(--bg-base)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
