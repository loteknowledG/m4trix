'use client';
import { Menu } from '@/components/admin-panel/menu';
import { useSidebar } from '@/hooks/use-sidebar';
import { useStore } from '@/hooks/use-store';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';
import { useTheme } from 'next-themes';

function LogoBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={event => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className="group relative flex h-12 w-12 shrink-0 items-center justify-center transition-transform duration-200 hover:scale-[1.03]"
      aria-label="Toggle color mode"
      title="Toggle color mode"
    >
      <div className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_50%_50%,rgba(236,72,153,0.18),rgba(109,40,217,0.08)_45%,transparent_72%)] opacity-90" />
      <div className="relative h-10 w-10 drop-shadow-[0_0_18px_rgba(244,114,182,0.22)]">
        <Image
          src="/matrix icon/matrix_sacred_1.neon-iridescent.png"
          alt="m4trix emblem"
          fill
          sizes="40px"
          className="object-contain opacity-95 transition duration-200 group-hover:brightness-125"
          priority
        />
      </div>
    </button>
  );
}

function LogoWordmark() {
  const logoLines = [
    '≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈',
    '≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈[ m4trix ]≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈',
    '≈≈≈≈███╗≈≈≈███╗≈≈≈≈██╗≈████████╗≈██████╗≈≈██╗≈██╗≈≈██╗',
    '≈≈≈≈████╗≈████║≈≈≈███║≈╚══██╔══╝≈██╔══██╗≈██║≈╚██╗██╔╝',
    '≈≈≈≈██╔████╔██║≈≈██╔██║≈≈≈≈██║≈≈≈≈██████╔╝≈██║≈≈╚███╔╝≈',
    '≈≈≈≈██║╚██╔╝██║≈███████║≈≈≈██║≈≈≈≈██╔══██╗≈██║≈≈██╔██╗≈',
    '≈≈≈≈██║≈╚═╝≈██║≈╚════██║≈≈≈██║≈≈≈≈██║≈≈██║≈██║≈██╔╝╚██╗',
    '≈≈≈≈╚═╝≈≈≈≈≈╚═╝≈≈≈≈≈╚═╝≈≈≈╚═╝≈≈≈≈╚═╝≈≈╚═╝≈╚═╝≈╚═╝≈≈╚═╝',
    '≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈',
    '<====[ ansi core // signal trace // registry dream ]==>',
  ];

  const getCharClassName = (char: string, lineIndex: number) => {
    if (char === '≈') return 'text-fuchsia-400/55';
    if (char === '<' || char === '>' || char === '[' || char === ']' || char === '=') {
      return 'text-pink-300/85';
    }
    if (lineIndex === 1 && char !== '≈') return 'text-white';
    if (lineIndex === 9) return 'text-fuchsia-100/95';
    if ('█╔╗╝║'.includes(char)) return 'text-pink-50';
    return 'text-violet-200/92';
  };

  return (
    <div className="flex flex-col leading-none">
      <pre className="font-mono text-[7px] font-bold uppercase leading-[0.88] tracking-[-0.08em] drop-shadow-[0_0_12px_rgba(244,114,182,0.35)]">
        {logoLines.map((line, lineIndex) => (
          <div key={`${lineIndex}-${line}`}>
            {Array.from(line).map((char, charIndex) => (
              <span
                key={`${lineIndex}-${charIndex}`}
                className={cn(
                  getCharClassName(char, lineIndex),
                  char === '≈' && 'drop-shadow-[0_0_6px_rgba(217,70,239,0.2)]',
                  'transition-colors duration-200'
                )}
              >
                {char}
              </span>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function Sidebar() {
  const sidebar = useStore(useSidebar, x => x);
  const { setTheme, theme } = useTheme();
  if (!sidebar) return null;
  const { getOpenState, setIsHover, settings } = sidebar;
  const isOpen = getOpenState();

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 z-20 h-screen -translate-x-full transition-[width] duration-300 ease-in-out lg:translate-x-0',
        !isOpen ? 'w-[90px]' : 'w-72',
        settings.disabled && 'hidden'
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
              'relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-fuchsia-400/15 bg-[#09090d] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(217,70,239,0.04)] transition-all duration-300 hover:bg-[#0d0d12]',
              !isOpen ? 'justify-center px-2.5' : 'justify-start'
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_34%,rgba(244,114,182,0.16),transparent_24%),radial-gradient(circle_at_28%_18%,rgba(217,70,239,0.10),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_28%,transparent_72%,rgba(255,255,255,0.02))]" />
            <div className="pointer-events-none absolute left-3 top-3 h-12 w-12 rounded-xl border border-fuchsia-300/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))]" />
            {/* <LogoBadge onClick={toggleTheme} /> */}
            <Link
              href="/heap"
              className={cn(
                'relative origin-left whitespace-nowrap no-underline transition-[transform,opacity,width] duration-300 ease-in-out',
                !isOpen ? 'w-0 -translate-x-4 opacity-0' : 'w-auto translate-x-0 opacity-100'
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
