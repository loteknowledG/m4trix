import { cn } from '@/lib/utils';

/** Square rounded pushable classes for sidebar nav rows (flat → hover lift → click press). */
export function menuItemClassName(active: boolean, extra?: string) {
  return cn('m4-menu-item', active && 'm4-menu-item-active', extra);
}
