import { Link } from "react-router-dom";

interface Props {
  text?: string | null;
}

export default function Footer({ text }: Props) {
  return (
    <footer
      className="relative overflow-hidden text-center py-10 px-4 mt-auto"
      style={{ background: 'linear-gradient(135deg, #0F1D3D 0%, #1E3A8A 100%)', borderTop: '1px solid rgba(59,130,246,0.2)' }}
    >
      {/* Subtle gradient top glow */}
      <div
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, #3B82F6 30%, #93C5FD 70%, transparent 100%)',
          opacity: 0.5,
        }}
      />

      {/* Background orbs */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: '300px',
          height: '200px',
          background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)',
          bottom: '-60px',
          left: '50%',
          transform: 'translateX(-50%)',
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        {/* Logo mark */}
        <div className="flex justify-center mb-4">
          <div
            className="flex items-center gap-2"
            style={{ color: '#93C5FD' }}
          >
            <div
              className="w-1 h-1 rounded-full"
              style={{ background: '#3B82F6', boxShadow: '0 0 6px #3B82F6' }}
            />
            <div
              className="w-8 h-px"
              style={{ background: 'linear-gradient(90deg, #3B82F6, #06B6D4)' }}
            />
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: '#06B6D4', boxShadow: '0 0 8px #06B6D4' }}
            />
            <div
              className="w-8 h-px"
              style={{ background: 'linear-gradient(90deg, #06B6D4, #8B5CF6)' }}
            />
            <div
              className="w-1 h-1 rounded-full"
              style={{ background: '#8B5CF6', boxShadow: '0 0 6px #8B5CF6' }}
            />
          </div>
        </div>

        {text?.trim() && (
          <p className="text-sm" style={{ color: '#BFDBFE' }}>
            {text}
          </p>
        )}

        {/* Admin login entry */}
        <Link
          to="/admin"
          className="inline-flex items-center gap-1.5 mt-4 text-sm transition-all duration-200"
          style={{ color: '#94A3B8' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#BFDBFE'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          管理入口
        </Link>
      </div>
    </footer>
  );
}
