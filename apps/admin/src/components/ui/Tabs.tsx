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
    className={cn('flex flex-wrap gap-xs', className)}
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
      'inline-flex items-center justify-center rounded-md border px-md py-sm text-label outline-none transition-colors',
      'border-border bg-surface text-text-primary hover:bg-surface-variant',
      'data-[state=active]:border-primary data-[state=active]:bg-primary-muted data-[state=active]:font-semibold data-[state=active]:text-primary',
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
