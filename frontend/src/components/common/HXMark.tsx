import { useId, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";

interface Props {
  variant: "mark" | "divider";
  /** mark variant only: one-time stroke draw-in on first viewport entry (§3.3, §7.1 contract) */
  animated?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * HX-Wave Mark (§3) — approved prototype geometry, do not redesign.
 * Gradient id is per-instance via useId (colons stripped for SVG safety).
 */
export default function HXMark({ variant, animated = false, className, style }: Props) {
  const rawId = useId();
  const gradId = `hx-grad-${rawId.replace(/:/g, "")}`;
  const svgRef = useRef<SVGSVGElement>(null);

  // §7.1 contract: hidden state pre-paint (useLayoutEffect), IO adds hx-drawn once,
  // IO missing → drawn immediately. reduced-motion: transition killed globally → instant final state.
  useLayoutEffect(() => {
    if (!animated || variant !== "mark") return;
    const el = svgRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("hx-drawn");
      return;
    }
    el.classList.add("hx-draw-pending");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("hx-drawn");
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [animated, variant]);

  if (variant === "divider") {
    return (
      <svg
        ref={svgRef}
        className={className}
        style={style}
        viewBox="0 0 120 12"
        fill="none"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--color-primary)" />
            <stop offset="100%" stopColor="var(--color-gradient)" />
          </linearGradient>
        </defs>
        <path
          d="M2 6 h44 l3 -8 l4 16 l4 -8 h61"
          stroke={`url(#${gradId})`}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      ref={svgRef}
      className={className}
      style={style}
      viewBox="0 0 70 64"
      fill="none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" />
          <stop offset="100%" stopColor="var(--color-gradient)" />
        </linearGradient>
      </defs>
      {/* H */}
      <path
        className="hx-stroke"
        d="M10 8 v48 M34 8 v48 M10 32 h12"
        stroke={`url(#${gradId})`}
        strokeWidth={8}
        strokeLinecap="square"
        style={{ "--hx-len": "115" } as CSSProperties}
      />
      {/* X */}
      <path
        className="hx-stroke"
        d="M44 8 L60 56 M60 8 L44 56"
        stroke={`url(#${gradId})`}
        strokeWidth={8}
        strokeLinecap="square"
        style={{ "--hx-len": "105", transitionDelay: "0.2s" } as CSSProperties}
      />
      {/* waveform-spike crossbar */}
      <path
        className="hx-stroke"
        d="M22 32 h4 l3.5 -13 l5 26 l3.5 -13 h22"
        stroke={`url(#${gradId})`}
        strokeWidth={5}
        style={{ "--hx-len": "85", transitionDelay: "0.45s" } as CSSProperties}
      />
    </svg>
  );
}
