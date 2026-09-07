"use client";

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

function SortableRow({ id, label, disabled, children }: {
  id: string; label: string; disabled: boolean; children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <div ref={setNodeRef} className={"sortable-row" + (isDragging ? " dragging" : "")}
      style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" className="drag-handle icon-button" aria-label={"Reorder " + label}
        disabled={disabled} {...attributes} {...listeners}>
        <GripVertical size={15} aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

export function SortableList<T extends { id: string }>({ items, onReorder, label, disabled, children }: {
  items: T[]; onReorder: (items: T[]) => void; label: (item: T, index: number) => string;
  disabled: boolean; children: (item: T, index: number) => ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
      if (disabled || !over || active.id === over.id) return;
      const from = items.findIndex((item) => item.id === active.id);
      const to = items.findIndex((item) => item.id === over.id);
      if (from >= 0 && to >= 0) onReorder(arrayMove(items, from, to));
    }}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableRow key={item.id} id={item.id} label={label(item, index)} disabled={disabled}>
            {children(item, index)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}
