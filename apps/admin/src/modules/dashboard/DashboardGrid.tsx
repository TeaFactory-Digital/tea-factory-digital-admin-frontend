/**
 * A grid of dashboard cards this person can rearrange (27 November 2026), with @dnd-kit.
 *
 * Only while customising. Out of that mode the cards are the dashboard as ever: links work,
 * nothing can be picked up by a stray drag on the way to a queue. In it, each card carries a
 * small toolbar (a handle to move it, an eye to hide it) and its own content is `inert`, so
 * a click on a card cannot navigate away mid-arrangement.
 *
 * Mouse, touch and keyboard: the handle is a button (Tab to it, Space to pick up, arrows to
 * move, Space to drop, Escape to cancel), and every step is announced in the console's
 * language. A hidden card stays in the grid while customising, faded, so it can be shown
 * again; outside the mode it is simply not drawn.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/cn';
import { playSound } from '@/lib/sound/uiSound';

export interface GridItem<T extends string> {
  id: T;
  /** The card's name, for its handle, its eye and what a screen reader hears. */
  label: string;
  node: ReactNode;
  /** Its span in the grid (`lg:col-span-2` and so on). */
  className?: string;
  /** Fill the row's height, so cards side by side end level. */
  stretch?: boolean;
  /**
   * A card that holds movable cards of its own (the headline row). While customising it
   * gets a strip of its own above them, with its name, handle and eye, so its toolbar never
   * sits on top of its last tile's.
   */
  group?: boolean;
}

export function DashboardGrid<T extends string>({
  items,
  order,
  hidden,
  editing,
  onReorder,
  onToggle,
  className,
}: {
  items: GridItem<T>[];
  order: T[];
  hidden: T[];
  editing: boolean;
  onReorder: (next: T[]) => void;
  onToggle: (id: T) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const sensors = useSensors(
    // A few pixels before a press becomes a drag, so a click on the eye stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = new Map(items.map((item) => [item.id, item]));
  const shown = order.filter((id) => byId.has(id) && (editing || !hidden.includes(id)));
  const name = (id: UniqueIdentifier) => byId.get(id as T)?.label ?? String(id);
  const place = (id: UniqueIdentifier) => ({ position: shown.indexOf(id as T) + 1, total: shown.length });

  const announcements: Announcements = {
    onDragStart: ({ active }) => t('dashboard.layout.picked', { card: name(active.id), ...place(active.id) }),
    onDragOver: ({ active, over }) =>
      over ? t('dashboard.layout.over', { card: name(active.id), ...place(over.id) }) : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? t('dashboard.layout.dropped', { card: name(active.id), ...place(over.id) })
        : t('dashboard.layout.cancelled', { card: name(active.id) }),
    onDragCancel: ({ active }) => t('dashboard.layout.cancelled', { card: name(active.id) }),
  };

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    onReorder(arrayMove(order, order.indexOf(active.id as T), order.indexOf(over.id as T)));
    playSound('pop');
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: t('dashboard.layout.instructions') },
      }}
    >
      <SortableContext items={shown} strategy={rectSortingStrategy}>
        <div className={className}>
          {shown.map((id) => (
            <Slot
              key={id}
              item={byId.get(id)!}
              editing={editing}
              hidden={hidden.includes(id)}
              onToggle={() => {
                playSound('toggle');
                onToggle(id);
              }}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function Slot<T extends string>({
  item,
  editing,
  hidden,
  onToggle,
}: {
  item: GridItem<T>;
  editing: boolean;
  hidden: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !editing });

  return (
    <div
      ref={setNodeRef}
      data-dashboard-slot={item.id}
      // Translate only: a scale would stretch a wide card dragged over a narrow one.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative min-w-0',
        item.className,
        // The card body only: the toolbar beside it keeps its own size.
        item.stretch && '[&>[data-slot-body]]:h-full [&>[data-slot-body]>*]:h-full',
        editing && 'rounded-lg outline-2 outline-offset-4 outline-border outline-dashed',
        editing && item.group && 'pt-12',
        isDragging && 'z-20 outline-primary',
      )}
    >
      {editing ? (
        <div
          className={cn(
            'absolute z-10 flex items-center gap-xxs rounded-md border border-border bg-surface p-xxs shadow-raised',
            item.group ? 'top-0 right-0 left-0 justify-end' : 'top-sm right-sm',
          )}
        >
          {item.group ? (
            <span className="mr-auto px-sm text-label font-medium text-text-secondary">{item.label}</span>
          ) : null}
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t('dashboard.layout.move', { card: item.label })}
            title={t('dashboard.layout.move', { card: item.label })}
            className="flex size-8 cursor-grab touch-none items-center justify-center rounded-sm text-text-secondary hover:bg-surface-variant hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
          >
            <GripVertical className="size-icon-sm" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={hidden}
            aria-label={t(hidden ? 'dashboard.layout.show' : 'dashboard.layout.hide', { card: item.label })}
            title={t(hidden ? 'dashboard.layout.show' : 'dashboard.layout.hide', { card: item.label })}
            className="flex size-8 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-variant hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {hidden ? <EyeOff className="size-icon-sm" aria-hidden /> : <Eye className="size-icon-sm" aria-hidden />}
          </button>
        </div>
      ) : null}
      {/* While arranging, the card is a picture of itself: no link inside it can be followed. */}
      <div
        data-slot-body
        // Not for a group: its own cards lock themselves, and their handles must stay live.
        inert={(editing && !item.group) || undefined}
        className={cn(editing && !item.group && 'pointer-events-none select-none', hidden && 'opacity-40 grayscale')}
      >
        {item.node}
      </div>
    </div>
  );
}
