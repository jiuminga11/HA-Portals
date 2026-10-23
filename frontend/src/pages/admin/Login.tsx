import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { login } from "../../api/auth";
import { getSiteConfig } from "../../api/siteConfig";
import { useLocale } from "../../hooks/useLocale";
import { expireAuthSession, isTokenValid, safeReturnTo, setAuthToken } from "../../lib/authSession";
import zh from "../../locales/auth.zh.json";
import en from "../../locales/auth.en.json";
export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [siteTitle, setSiteTitle] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reauth = searchParams.get("reauth") === "1";
  const logout = searchParams.get("logout") === "1";
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const { locale } = useLocale();
  const text = locale === "en" ? en : zh;
  const [success, setSuccess] = useState(() => !logout && reauth && isTokenValid(localStorage.getItem("token")));
  const attempt = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPendingLogin = useCallback(() => {
    attempt.current++;
    controller.current?.abort();
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (logout) {
      expireAuthSession(localStorage.getItem("token"));
      // Consume the command so refresh cannot log out a later successful login.
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("logout");
      const query = nextParams.toString();
      navigate(`/admin/login${query ? `?${query}` : ""}`, { replace: true });
      return;
    }
    if (!reauth && isTokenValid(localStorage.getItem("token"))) {
      navigate(returnTo, { replace: true });
    }
    let mounted = true;
    getSiteConfig().then((c) => { if (mounted) setSiteTitle(c.site_title || ""); }).catch((err) => console.warn("[HA-PORTALS] Failed to load site config:", err.message));
    return () => {
      mounted = false;
      cancelPendingLogin();
    };
  }, [navigate, reauth, logout, returnTo, searchParams, cancelPendingLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    controller.current?.abort();
    if (timer.current !== null) clearTimeout(timer.current);
    const attemptId = ++attempt.current;
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError(null);
    setSuccess(false);

    // 10 秒超时保护，避免用户无限等待
    timer.current = setTimeout(() => {
      if (attempt.current !== attemptId) return;
      attempt.current++;
      request.abort();
      setLoading(false);
      setError(text.timeout);
    }, 10000);

    try {
      const res = await login(username.trim(), password, request.signal);
      if (attempt.current !== attemptId || request.signal.aborted) return;
      setAuthToken(res.access_token);
      setPassword("");
      if (reauth) setSuccess(true);
      else navigate(returnTo, { replace: true });
    } catch (err: unknown) {
      if (attempt.current !== attemptId || request.signal.aborted) return;
      setError(axios.isAxiosError(err)
        ? err.response?.status === 401 ? text.invalidCredentials
          : err.code === "ECONNABORTED" ? text.timeout
          : err.code === "ERR_NETWORK" ? text.network : text.failed
        : text.failed);
    } finally {
      if (attempt.current === attemptId) {
        if (timer.current !== null) clearTimeout(timer.current);
        controller.current = null;
        setLoading(false);
      }
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden"
      style={{ background: '#0A1628' }}
    >
      {/* Background orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
          top: '-150px',
          right: '-100px',
          borderRadius: '50%',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          width: '400px',
          height: '400px',
          background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
          bottom: '-120px',
          left: '-100px',
          borderRadius: '50%',
          filter: 'blur(40px)',
        }}
      />

      {/* Tech grid */}
      <div
        className="absolute inset-0 tech-grid pointer-events-none"
        style={{ opacity: 0.4 }}
      />

      {/* Login card */}
      <div
        className="relative w-full max-w-md overflow-hidden"
        style={{
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(59,130,246,0.18)',
          boxShadow: '0 0 60px rgba(59,130,246,0.12), 0 30px 60px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Card header */}
        <div
          className="px-8 py-8 text-center relative"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(6,182,212,0.1) 100%)',
            borderBottom: '1px solid rgba(59,130,246,0.15)',
          }}
        >
          {/* Icon */}
          <div
            className="w-14 h-14 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(6,182,212,0.25))',
              border: '1px solid rgba(59,130,246,0.3)',
              boxShadow: '0 0 20px rgba(59,130,246,0.25)',
            }}
          >
            <svg className="w-7 h-7" fill="none" stroke="#60A5FA" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>{text.title}</h1>
          {siteTitle && <p className="text-sm mt-1" style={{ color: '#64748B' }}>{siteTitle}</p>}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
          <div>
            <label htmlFor="login-username" className="block text-sm font-medium mb-1.5" style={{ color: '#94A3B8' }}>
              {text.username}
            </label>
            <input
              type="text"
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={text.usernamePlaceholder}
              autoComplete="username"
              required
              className="w-full px-4 py-3 text-sm focus:outline-none transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#E2E8F0',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(59,130,246,0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.boxShadow = '';
              }}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium mb-1.5" style={{ color: '#94A3B8' }}>
              {text.password}
            </label>
            <input
              type="password"
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={text.passwordPlaceholder}
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 text-sm focus:outline-none transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                color: '#E2E8F0',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(59,130,246,0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.boxShadow = '';
              }}
            />
          </div>

          {(error || success) && (
            <div
              role={error ? "alert" : "status"}
              className="text-sm px-4 py-3"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: '10px',
                color: '#FCA5A5',
              }}
            >
              {error || text.restored}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 50%, #06B6D4 100%)',
              backgroundSize: '200% auto',
              borderRadius: '10px',
              color: 'white',
              boxShadow: '0 4px 15px rgba(59,130,246,0.35)',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 25px rgba(59,130,246,0.5)';
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 15px rgba(59,130,246,0.35)';
              (e.currentTarget as HTMLButtonElement).style.transform = '';
            }}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {text.submitting}
              </>
            ) : (
              text.submit
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
