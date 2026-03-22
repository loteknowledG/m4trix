"use client";
import { Menu } from "@/components/admin-panel/menu";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useTheme } from "next-themes";

function LogoBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className="group relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-[#ff3ab5] via-[#d400ff] to-[#6d28d9] shadow-[0_0_24px_rgba(236,72,153,0.28)] transition-transform duration-200 hover:scale-[1.03]"
      aria-label="Toggle color mode"
      title="Toggle color mode"
    >
      <div className="absolute inset-[3px] rounded-[14px] bg-[#120312]/85 transition-colors duration-200 group-hover:bg-[#170417]" />
      <div className="absolute inset-[6px] rounded-[12px] border border-white/10 bg-gradient-to-b from-white/8 to-transparent" />
      <span className="relative font-mono text-[1.45rem] font-black leading-none tracking-[-0.16em] text-pink-200 drop-shadow-[0_0_10px_rgba(244,114,182,0.6)]">
        M
      </span>
    </button>
  );
}

function LogoWordmark() {
  return (
    <div className="flex flex-col leading-none">
      <pre className="font-mono text-[11px] font-bold uppercase leading-[0.88] tracking-[-0.08em] text-pink-100 drop-shadow-[0_0_10px_rgba(244,114,182,0.35)]">
        {String.raw`|\/|  /\\  7  |2  |><`}
      </pre>
      <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.36em] text-fuchsia-300/80">
        m4trix
      </span>
    </div>
  );
}

export function Sidebar() {
  const sidebar = useStore(useSidebar, (x) => x);
  const { setTheme, theme } = useTheme();
  if (!sidebar) return null;
  const { getOpenState, setIsHover, settings } = sidebar;
  const isOpen = getOpenState();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <aside
      className={cn(
        "fixed top-0 left-0 z-20 h-screen -translate-x-full transition-[width] duration-300 ease-in-out lg:translate-x-0",
        !isOpen ? "w-[90px]" : "w-72",
        settings.disabled && "hidden"
      )}
    >
      <div
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        className="relative flex h-full flex-col overflow-y-auto px-3 py-4 shadow-md dark:shadow-zinc-800"
      >
        <div className="mb-3">
          <div
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border border-white/6 bg-[#09090d] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 hover:bg-[#0d0d12]",
              !isOpen ? "justify-center px-2.5" : "justify-start"
            )}
          >
            <LogoBadge onClick={toggleTheme} />
            <Link
              href="/heap"
              className={cn(
                "origin-left whitespace-nowrap no-underline transition-[transform,opacity,width] duration-300 ease-in-out",
                !isOpen ? "w-0 -translate-x-4 opacity-0" : "w-auto translate-x-0 opacity-100"
              )}
            >
              <LogoWordmark />
            </Link>
          </div>
        </div>
        <Menu isOpen={isOpen} />
      </div>
    </aside>
  );
}
