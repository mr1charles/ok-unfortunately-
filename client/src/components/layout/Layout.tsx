import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-surface-light dark:bg-surface-dark">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-3 panel !rounded-none !border-x-0 !border-t-0 px-4 py-3">
          <button onClick={() => setMobileOpen(true)} className="btn-ghost !p-2 rounded-full text-xl" title="Open menu">
            ☰
          </button>
          <span className="font-display font-extrabold">🏝️ Pixel Estates</span>
        </div>
        <main className="flex-1 min-w-0 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
