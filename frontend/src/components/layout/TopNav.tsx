import { useCallback, useEffect, useRef, useState } from "react";
import type { Section } from "../../types";

const NAV_HEIGHT = 80;

interface Props {
  sections: Section[];
  activeId: string | null;
}

export default function TopNav({ sections, activeId }: Props) {
  const [isSticky, setIsSticky] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Sticky detection
  useEffect(() => {
    const handleScroll = () => {
      setIsSticky(window.scrollY > 180);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Overflow detection
  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const tolerance = 2;
    setCanScrollLeft(el.scrollLeft > tolerance);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - tolerance);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkOverflow, { passive: true });
    window.addEventListener("resize", checkOverflow);
    return () => {
      el.removeEventListener("scroll", checkOverflow);
      window.removeEventListener("resize", checkOverflow);
    };
  }, [checkOverflow, sections]);

  // Mouse wheel → horizontal scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollBy({ left: e.deltaY, behavior: "smooth" });
  }, []);

  // Arrow click → scroll by half container width
  const scrollBy = useCallback((dir: 1 | -1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.5, behavior: "smooth" });
  }, []);

  // Scroll to section with offset
  const scrollToSection = (id: number) => {
    const el = document.getElementById(`section-${id}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  // Auto-scroll active tab into view
  useEffect(() => {
    if (!activeId || !scrollRef.current) return;
    const container = scrollRef.current;
    const activeBtn = container.querySelector<HTMLButtonElement>("[data-active='true']");
    if (activeBtn) {
      const left = activeBtn.offsetLeft - container.offsetLeft - container.clientWidth / 2 + activeBtn.clientWidth / 2;
      container.scrollTo({ left, behavior: "smooth" });
    }
  }, [activeId]);

  if (sections.length === 0) return null;

  return (
    <nav
      className={`sticky top-0 z-40 transition-all duration-500 ${
        isSticky ? "glass-nav shadow-glow-sm" : ""
      }`}
      style={{
        background: isSticky ? undefined : 'var(--nav-bg)',
        borderBottom: '1px solid var(--nav-border)',
      }}
    >
      <div className="max-w-5xl mx-auto relative">
        {/* Left fade mask */}
        {/* Left arrow + fade */}
        {canScrollLeft && (
          <button
            onClick={() => scrollBy(-1)}
            className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pr-3 transition-opacity duration-200"
            style={{
              background: `linear-gradient(to right, var(--nav-bg) 40%, transparent)`,
            }}
            aria-label="向左滚动"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.5 }}>
              <path d="M12.5 15L7.5 10L12.5 5" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {/* Right arrow + fade */}
        {canScrollRight && (
          <button
            onClick={() => scrollBy(1)}
            className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pl-3 transition-opacity duration-200"
            style={{
              background: `linear-gradient(to left, var(--nav-bg) 40%, transparent)`,
            }}
            aria-label="向右滚动"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.5 }}>
              <path d="M7.5 15L12.5 10L7.5 5" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        <div
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-hide"
          onWheel={handleWheel}
        >
          {sections.map((section) => {
            const sectionDomId = `section-${section.id}`;
            const isActive = activeId === sectionDomId;
            return (
              <button
                key={section.id}
                data-active={isActive}
                onClick={() => scrollToSection(section.id)}
                className="flex-none px-8 py-5 text-xl font-bold whitespace-nowrap transition-all duration-200 relative tracking-widest"
                style={{
                  color: isActive ? 'var(--color-primary)' : 'var(--text-muted)',
                  textShadow: isActive ? '0 0 12px var(--glow-primary)' : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-base)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                  }
                }}
              >
                {section.title_zh}

                {/* Active indicator: glowing bottom border */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2 rounded-t"
                    style={{
                      height: '2px',
                      background: 'linear-gradient(90deg, var(--color-primary), var(--color-gradient))',
                      boxShadow: '0 0 8px var(--glow-primary), 0 0 16px var(--glow-purple)',
                    }}
                  />
                )}

                {/* Hover indicator */}
                {!isActive && (
                  <span
                    className="absolute bottom-0 left-2 right-2 rounded-t transition-all duration-200 opacity-0 group-hover:opacity-100"
                    style={{
                      height: '1px',
                      background: 'rgba(59,130,246,0.3)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
