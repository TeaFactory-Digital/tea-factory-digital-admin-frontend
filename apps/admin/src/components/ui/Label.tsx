import * as RadixLabel from '@radix-ui/react-label';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

export const Label = forwardRef<ElementRef<typeof RadixLabel.Root>, ComponentPropsWithoutRef<typeof RadixLabel.Root>>(
  ({ className, ...props }, ref) => (
    <RadixLabel.Root
      ref={ref}
      className={cn('text-label text-text-primary', className)}
      {...props}
    />
  ),
);
