import * as RadixTabs from '@radix-ui/react-tabs';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

export const Tabs = RadixTabs.Root;

export const TabsList = forwardRef<
  ElementRef<typeof RadixTabs.List>,
  ComponentPropsWithoutRef<typeof RadixTabs.List>
>(({ className, ...props }, ref) => (
  <RadixTabs.List
    ref={ref}
    // A segmented control: one tray, the open tab a tinted key inside it.
    className={cn(
      'inline-flex w-fit flex-wrap gap-xxs rounded-md border border-border bg-surface p-xxs shadow-card',
      className,
    )}
    {...props}
  />
));

export const TabsTrigger = forwardRef<
  ElementRef<typeof RadixTabs.Trigger>,
  ComponentPropsWithoutRef<typeof RadixTabs.Trigger>
>(({ className, ...props }, ref) => (
  <RadixTabs.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center gap-xs rounded-sm px-md py-xs text-label outline-none transition-colors duration-150',
      'text-text-secondary hover:bg-surface-variant hover:text-text-primary',
      'data-[state=active]:bg-primary-muted data-[state=active]:font-semibold data-[state=active]:text-text-primary data-[state=active]:ring-1 data-[state=active]:ring-primary/30 data-[state=active]:ring-inset',
      'disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
));

export const TabsContent = forwardRef<
  ElementRef<typeof RadixTabs.Content>,
  ComponentPropsWithoutRef<typeof RadixTabs.Content>
>(({ className, ...props }, ref) => (
  <RadixTabs.Content ref={ref} className={cn('mt-md', className)} {...props} />
));
