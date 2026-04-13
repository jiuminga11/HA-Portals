import { useState, useEffect, useRef } from "react";

export function useActiveSection(sectionIds: string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);
  const ratioMap = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (sectionIds.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          ratioMap.current.set(entry.target.id, entry.intersectionRatio);
        });

        // Find the section with the highest intersection ratio
        let maxRatio = 0;
        let maxId: string | null = null;
        ratioMap.current.forEach((ratio, id) => {
          if (ratio > maxRatio) {
            maxRatio = ratio;
            maxId = id;
          }
        });

        if (maxId !== null) {
          setActiveId(maxId);
        }
      },
      {
        threshold: [0, 0.3, 0.6, 1.0],
        rootMargin: "-80px 0px 0px 0px",
      }
    );

    // Observe all sections
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        observer.observe(el);
        ratioMap.current.set(id, 0);
      }
    });

    return () => {
      observer.disconnect();
      ratioMap.current.clear();
    };
  }, [sectionIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return activeId;
}
