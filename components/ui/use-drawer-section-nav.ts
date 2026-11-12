"use client";

import { useEffect, useRef, useState } from "react";

export type DrawerNavSection = {
  id: string;
  label: string;
};

/**
 * Scroll spy + navigasi seksi untuk drawer detail yang panjang.
 * Section harus memakai `sectionId` pada FormSection.
 */
export function useDrawerSectionNav(
  sections: DrawerNavSection[],
  enabled: boolean
) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");

  useEffect(() => {
    if (!enabled) {
      setActiveId(sections[0]?.id ?? "");
      return;
    }

    const root = bodyRef.current;
    if (!root) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const rootTop = root.getBoundingClientRect().top;
      let current = sections[0]?.id ?? "";

      for (const section of sections) {
        const element = root.querySelector<HTMLElement>(
          `[data-form-section="${section.id}"]`
        );
        if (!element) continue;
        if (element.getBoundingClientRect().top - rootTop <= 20) {
          current = section.id;
        }
      }

      if (
        sections.length > 0 &&
        root.scrollHeight > root.clientHeight + 2 &&
        root.scrollTop + root.clientHeight >= root.scrollHeight - 2
      ) {
        current = sections[sections.length - 1].id;
      }

      setActiveId((previous) =>
        previous === current ? previous : current
      );
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      root.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled, sections]);

  const scrollToSection = (id: string) => {
    const root = bodyRef.current;
    if (!root) return;
    const element = root.querySelector<HTMLElement>(
      `[data-form-section="${id}"]`
    );
    if (!element) return;

    setActiveId(id);
    const top =
      root.scrollTop +
      element.getBoundingClientRect().top -
      root.getBoundingClientRect().top -
      10;

    root.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  return { bodyRef, activeId, scrollToSection };
}
