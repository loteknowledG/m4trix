'use client';

import { Menu } from '@/components/admin-panel/menu';
import { useSidebar } from '@/hooks/use-sidebar';
import { useStore } from '@/hooks/use-store';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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
    '<====[ ansi core // signal trace // registry dream ]=====>',
  ];

  const getCharClassName = (char: string, lineIndex: number) => {
    if (char === '≈') return 'text-fuchsia-200/70';
    if (char === '<' || char === '>' || char === '[' || char === ']' || char === '=') {
      return 'text-fuchsia-300/90';
    }
    if (lineIndex === 1 && char !== '≈') return 'text-fuchsia-100';
    if (lineIndex === 9) return 'text-pink-300/95';
    if ('█╗╚╔╝║'.includes(char)) return 'text-pink-200/90';
    return 'text-fuchsia-200/85';
  };

  return (
    <div className="flex flex-col leading-none">
      <pre className="font-mono text-[7px] font-bold uppercase leading-[0.88] tracking-[-0.08em] drop-shadow-[0_0_12px_rgba(236,72,153,0.32)]">
        {logoLines.map((line, lineIndex) => (
          <div key={`${lineIndex}-${line}`}>
            {Array.from(line).map((char, charIndex) => (
              <span
                key={`${lineIndex}-${charIndex}`}
                className={cn(
                  getCharClassName(char, lineIndex),
                  char === '≈' && 'drop-shadow-[0_0_5px_rgba(217,70,239,0.22)]',
                  lineIndex === 1 && char === '4' && 'text-emerald-300 drop-shadow-[0_0_7px_rgba(52,211,153,0.28)]',
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
  if (!sidebar) return null;
  const { getOpenState, setIsHover, settings } = sidebar;
  const isOpen = getOpenState();

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
              'relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-fuchsia-500/15 bg-[#12081f] px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(217,70,239,0.06)] transition-all duration-300 hover:bg-[#160b27]',
              !isOpen ? 'justify-center px-2.5' : 'justify-start'
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_34%,rgba(244,114,182,0.18),transparent_24%),radial-gradient(circle_at_28%_18%,rgba(217,70,239,0.14),transparent_28%),radial-gradient(circle_at_82%_72%,rgba(34,211,238,0.08),transparent_22%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_28%,transparent_72%,rgba(255,255,255,0.015))]" />
            <div className="pointer-events-none absolute left-3 top-3 h-12 w-12 rounded-xl border border-fuchsia-300/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))]" />
            <Link
              href="/stories"
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
