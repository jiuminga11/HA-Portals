import { useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "../../lib/basePath";

interface Props {
  /** Avatar image URL (uploaded /uploads/... or external). */
  src: string;
  /** CSS object-position, e.g. "50% 20%". */
  position: string;
  onChange: (position: string) => void;
}

function parsePosition(pos: string): { x: number; y: number } {
  const m = pos.match(/(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 50, y: 50 };
}

/**
 * Circular avatar preview with drag-to-adjust focal point.
 * The frontend renders the avatar with object-cover + object-position;
 * dragging here moves the visible window the same way.
 */
export default function AvatarCropEditor({ src, position, onChange }: Props) {
  const circleRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  // Ref mirrors the latest position so rapid pointermove events don't read stale props.
  const posRef = useRef(parsePosition(position));
  useEffect(() => {
    posRef.current = parsePosition(position);
  }, [position]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !circleRef.current) return;
    const size = circleRef.current.getBoundingClientRect().width;
    if (size === 0) return;
    // Dragging the image right reveals more of its left side → x decreases.
    const nx = Math.min(100, Math.max(0, posRef.current.x - (e.movementX / size) * 100));
    const ny = Math.min(100, Math.max(0, posRef.current.y - (e.movementY / size) * 100));
    posRef.current = { x: nx, y: ny };
    onChange(`${nx.toFixed(1)}% ${ny.toFixed(1)}%`);
  };

  const stopDragging = () => setDragging(false);

  return (
    <div className="space-y-2">
      <div
        ref={circleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        className="relative w-32 h-32 rounded-full overflow-hidden border border-slate-200 bg-slate-50 select-none"
        style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
        role="img"
        aria-label="头像取景调整"
      >
        <img
          src={resolveMediaUrl(src)}
          alt="头像取景预览"
          draggable={false}
          className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: position }}
        />
      </div>
      <div className="flex items-center gap-3">
        <p className="text-xs text-slate-400">在圆圈内拖动调整取景（与前台圆形裁切一致）</p>
        <button
          type="button"
          onClick={() => onChange("50% 50%")}
          className="text-xs text-primary hover:underline"
        >
          重置居中
        </button>
      </div>
    </div>
  );
}
