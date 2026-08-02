import * as RadixSwitch from '@radix-ui/react-switch';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

export const Switch = forwardRef<
  ElementRef<typeof RadixSwitch.Root>,
  ComponentPropsWithoutRef<typeof RadixSwitch.Root>
>(({ className, ...props }, ref) => (
  <RadixSwitch.Root
    ref={ref}
    className={cn(
      'relative inline-flex h-5 w-9 shrink-0 rounded-full border border-border bg-surface-variant',
      'data-[state=checked]:bg-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
      className,
    )}
    {...props}
  >
    <RadixSwitch.Thumb className="pointer-events-none block size-4 translate-x-0.5 rounded-full bg-surface shadow transition-transform data-[state=checked]:translate-x-4" />
  </RadixSwitch.Root>
));
