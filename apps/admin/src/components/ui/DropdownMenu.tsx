import * as RadixDropdownMenu from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react';
import { cn } from '@/lib/cn';

export const DropdownMenu = RadixDropdownMenu.Root;
export const DropdownMenuTrigger = RadixDropdownMenu.Trigger;
export const DropdownMenuGroup = RadixDropdownMenu.Group;
export const DropdownMenuPortal = RadixDropdownMenu.Portal;
export const DropdownMenuSub = RadixDropdownMenu.Sub;
export const DropdownMenuRadioGroup = RadixDropdownMenu.RadioGroup;

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof RadixDropdownMenu.Content>,
  ComponentPropsWithoutRef<typeof RadixDropdownMenu.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <RadixDropdownMenu.Portal>
    <RadixDropdownMenu.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-48 overflow-hidden rounded-md border border-border bg-surface p-1 shadow-lg',
        className,
      )}
      {...props}
    />
  </RadixDropdownMenu.Portal>
));

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof RadixDropdownMenu.Item>,
  ComponentPropsWithoutRef<typeof RadixDropdownMenu.Item>
>(({ className, ...props }, ref) => (
  <RadixDropdownMenu.Item
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm px-md py-sm text-body-small outline-none',
      'text-text-primary data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      'focus:bg-surface-variant',
      className,
    )}
    {...props}
  />
));

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof RadixDropdownMenu.CheckboxItem>,
  ComponentPropsWithoutRef<typeof RadixDropdownMenu.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <RadixDropdownMenu.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-sm pl-8 pr-md text-body-small outline-none',
      'text-text-primary focus:bg-surface-variant',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <RadixDropdownMenu.ItemIndicator>
        <Check className="size-3.5" />
      </RadixDropdownMenu.ItemIndicator>
    </span>
    {children}
  </RadixDropdownMenu.CheckboxItem>
));

export const DropdownMenuRadioItem = forwardRef<
  ElementRef<typeof RadixDropdownMenu.RadioItem>,
  ComponentPropsWithoutRef<typeof RadixDropdownMenu.RadioItem>
>(({ className, children, ...props }, ref) => (
  <RadixDropdownMenu.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-sm pl-8 pr-md text-body-small outline-none',
      'text-text-primary focus:bg-surface-variant',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex size-4 items-center justify-center">
      <RadixDropdownMenu.ItemIndicator>
        <Check className="size-3.5" />
      </RadixDropdownMenu.ItemIndicator>
    </span>
    {children}
  </RadixDropdownMenu.RadioItem>
));

export const DropdownMenuLabel = RadixDropdownMenu.Label;
export const DropdownMenuSeparator = RadixDropdownMenu.Separator;
export const DropdownMenuShortcut = ({ className, ...props }: { className?: string }) => (
  <span className={cn('ml-auto text-caption text-text-secondary', className)} {...props} />
);

export const DropdownMenuSubTrigger = forwardRef<
  ElementRef<typeof RadixDropdownMenu.SubTrigger>,
  ComponentPropsWithoutRef<typeof RadixDropdownMenu.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <RadixDropdownMenu.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default select-none items-center rounded-sm px-md py-sm text-body-small outline-none',
      'text-text-primary focus:bg-surface-variant',
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto size-4" />
  </RadixDropdownMenu.SubTrigger>
));
