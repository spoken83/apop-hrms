"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Optimistic value so the select reflects the choice immediately instead of
  // snapping back to the server value while the refresh is in flight.
  const [value, setValue] = useState(selected);

  function onChange(next: string) {
    setValue(next);
    startTransition(async () => {
      // Persist the cookie, then force the current route to re-fetch its RSC
      // payload so it re-reads the cookie. revalidatePath alone does not
      // refresh the page that triggered the action.
      await setSelectedEntity(next);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <select
        aria-label="Selected entity"
        value={value}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value)}
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
