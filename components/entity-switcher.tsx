"use client";

import { useTransition } from "react";
import { ChevronDownIcon } from "lucide-react";
import { setSelectedEntity } from "@/lib/actions";
import { ALL_ENTITIES } from "@/lib/entity-constants";

type EntityOption = { id: string; name: string };

// Native select: reliable across hydration and consistent with the rest of
// the app's dropdowns. Styled to sit on the dark sidebar.
export function EntitySwitcher({
  entities,
  selected,
}: {
  entities: EntityOption[];
  selected: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="relative">
      <select
        aria-label="Selected entity"
        value={selected}
        disabled={isPending}
        onChange={(e) =>
          startTransition(() => setSelectedEntity(e.target.value))
        }
        className="h-9 w-full appearance-none rounded-lg border border-sidebar-border bg-sidebar-accent px-3 pr-8 text-sm font-medium text-sidebar-accent-foreground outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 disabled:opacity-60"
      >
        {entities.map((entity) => (
          <option key={entity.id} value={entity.id}>
            {entity.name}
          </option>
        ))}
        <option value={ALL_ENTITIES}>All entities</option>
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-sidebar-accent-foreground/70" />
    </div>
  );
}
