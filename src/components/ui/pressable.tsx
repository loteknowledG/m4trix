import * as React from 'react';
import { cn } from '@/lib/utils';

export const pressableClass =
  'inline-flex items-center justify-center shadow-sm mc-shadow-hover mc-shadow-active pushable-effect cursor-pointer';

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
