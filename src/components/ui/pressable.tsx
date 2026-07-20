import * as React from 'react';
import { cn } from '@/lib/utils';

export const pressableClass =
  'inline-flex items-center justify-center pushable-effect cursor-pointer';

export type PressableProps<T extends React.ElementType> = {
  as?: T;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, 'className'>;

function PressableInner<T extends React.ElementType = 'button'>(
  { as, className, ...props }: PressableProps<T>,
  ref: React.ComponentPropsWithRef<T>['ref'],
) {
  const Component = (as || 'button') as React.ElementType;
  return <Component ref={ref} className={cn(pressableClass, className)} {...props} />;
}

export const Pressable = React.forwardRef(PressableInner) as <
  T extends React.ElementType = 'button',
>(
  props: PressableProps<T> & { ref?: React.ComponentPropsWithRef<T>['ref'] },
) => React.ReactElement | null;
