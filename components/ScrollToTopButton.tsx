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
    <div className="fixed bottom-6 right-6 z-40 flex flex-col gap-2">
      {showBottom && (
        <button
          type="button"
          onClick={() =>
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })
          }
          aria-label="Ir para o final"
          title="Ir para o final"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-600 text-white shadow-lg hover:bg-gray-700 transition-colors"
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
          className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          ↑
        </button>
      )}
    </div>
  );
}
