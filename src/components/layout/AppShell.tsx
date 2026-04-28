import { useEffect, useRef, useState, type ReactNode } from "react";
import { MessageSquarePlus } from "lucide-react";
import { NavLink } from "react-router-dom";
import { HeaderBar } from "./HeaderBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { Sidebar } from "./Sidebar";

type AppShellProps = {
  children: ReactNode;
};

/** Fecha o drawer ao deslizar para a esquerda (swipe left) no mobile. */
function useSwipeToClose(isOpen: boolean, onClose: () => void) {
  const startXRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onTouchStart = (e: TouchEvent) => {
      startXRef.current = e.touches[0].clientX;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (startXRef.current === null) return;
      const deltaX = e.changedTouches[0].clientX - startXRef.current;
      if (deltaX < -60) onClose();
      startXRef.current = null;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [isOpen, onClose]);
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useSwipeToClose(isSidebarOpen, () => setIsSidebarOpen(false));

  return (
    <div className="relative min-h-screen text-app-100">
      {/* Overlay backdrop */}
      <div
        className={[
          "fixed inset-0 z-30 bg-app-900/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden",
          isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex min-h-screen max-w-400">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <HeaderBar onMenuClick={() => setIsSidebarOpen(true)} />
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-10 lg:pb-10">
            {children}
          </main>
        </div>
      </div>

      <MobileBottomNav onMenuOpen={() => setIsSidebarOpen(true)} />

      {/* Floating feedback button */}
      <NavLink
        to="/ajuda/feedback"
        className="fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full border border-brand-400/30 bg-brand-500/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg backdrop-blur-sm transition-all hover:bg-brand-400 lg:bottom-6"
        aria-label="Enviar feedback"
      >
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">Feedback</span>
      </NavLink>
    </div>
  );
}
