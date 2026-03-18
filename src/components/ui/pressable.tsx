import * as React from 'react';
import { cn } from '@/lib/utils';

export const pressableClass =
  'shadow-sm transition-transform duration-150 ease-out hover:-translate-y-1 hover:-translate-x-1 active:translate-y-1 active:translate-x-1 mc-shadow-hover mc-shadow-active cursor-pointer';

export type PressableProps<T extends React.ElementType> = {
  as?: T;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, 'className'>;

export function Pressable<T extends React.ElementType = 'button'>({
  as,
  className,
  ...props
}: PressableProps<T>) {
  const Component = (as || 'button') as React.ElementType;
  return <Component className={cn(pressableClass, className)} {...props} />;
}
