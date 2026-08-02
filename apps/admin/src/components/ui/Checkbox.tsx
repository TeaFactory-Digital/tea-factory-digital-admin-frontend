import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

export const Checkbox = forwardRef<
  ElementRef<typeof RadixCheckbox.Root>,
  ComponentPropsWithoutRef<typeof RadixCheckbox.Root>
>(({ className, ...props }, ref) => (
  <RadixCheckbox.Root
    ref={ref}
    className={cn(
      'peer flex size-4 shrink-0 items-center justify-center rounded-sm border border-border bg-surface',
      'data-[state=checked]:bg-primary data-[state=checked]:text-primary-contrast',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
      className,
    )}
    {...props}
  >
    <RadixCheckbox.Indicator className="flex items-center justify-center">
      <Check className="size-3" />
    </RadixCheckbox.Indicator>
  </RadixCheckbox.Root>
));
