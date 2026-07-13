"use client";

import { usePathname } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { ALL_ENTITIES } from "@/lib/entity-constants";
import { cn } from "@/lib/utils";

type EntityOption = { id: string; name: string };

// Entity scope as a list of plain <a> links. Selecting one navigates to the
// /entity/set route, which sets the cookie server-side and redirects back to
// the current page. No client state, no hydration dependency — a stale bundle
// or failed hydration cannot break it. usePathname only builds the return path
// and highlights the active entity; the anchors work regardless.
export function EntitySwitcher({
  entities,
  selected,
}: {
  entities: EntityOption[];
  selected: string;
}) {
  const pathname = usePathname() || "/";
  const options = [...entities, { id: ALL_ENTITIES, name: "All entities" }];

  return (
    <div className="space-y-1">
      <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/50">
        Entity
      </p>
      <div className="flex flex-col gap-0.5">
        {options.map((option) => {
          const active = option.id === selected;
          return (
            <a
              key={option.id}
              href={`/entity/set?id=${option.id}&next=${encodeURIComponent(pathname)}`}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                option.id === ALL_ENTITIES && !active && "text-sidebar-foreground/55",
              )}
            >
              {option.name}
              {active ? <CheckIcon className="size-3.5" /> : null}
            </a>
          );
        })}
      </div>
    </div>
  );
}
