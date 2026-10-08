"use client";

import { useEffect, useState } from "react";

export function ScrollToTopButton() {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    function onScroll() {
      const scrollY = window.scrollY;
      const viewportHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;
      setShowTop(scrollY > 400);
      setShowBottom(fullHeight - (scrollY + viewportHeight) > 400);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!showTop && !showBottom) return null;

  return (
    <div className="fixed bottom-6 right-6 z-overlay flex flex-col gap-2">
      {showBottom && (
        <button
          type="button"
          onClick={() =>
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })
          }
          aria-label="Ir para o final"
          title="Ir para o final"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-surface-card text-ink shadow-lg transition-colors hover:bg-surface-subtle"
        >
          ↓
        </button>
      )}
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Voltar ao topo"
          title="Voltar ao topo"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-action text-brand-on-dark shadow-lg transition-colors hover:bg-brand-navy"
        >
          ↑
        </button>
      )}
    </div>
  );
}
