"use client";

import { useTransition } from "react";
import { setSelectedEntity } from "@/lib/actions";
import { ALL_ENTITIES } from "@/lib/entity-constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EntityOption = { id: string; name: string };

export function EntitySwitcher({
  entities,
  selected,
}: {
  entities: EntityOption[];
  selected: string;
}) {
  const [, startTransition] = useTransition();

  return (
    <Select
      value={selected}
      onValueChange={(value) => startTransition(() => setSelectedEntity(value))}
    >
      <SelectTrigger
        className="w-full border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        aria-label="Selected entity"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {entities.map((entity) => (
          <SelectItem key={entity.id} value={entity.id}>
            {entity.name}
          </SelectItem>
        ))}
        <SelectItem value={ALL_ENTITIES}>All entities</SelectItem>
      </SelectContent>
    </Select>
  );
}
