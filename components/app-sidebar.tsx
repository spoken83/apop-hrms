"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "People", href: "/people" },
  { label: "Payroll", href: null, phase: "Phase 3" },
  { label: "Roster", href: null, phase: "Phase 5" },
  { label: "Timesheets", href: null, phase: "Phase 5" },
  { label: "Leave", href: null, phase: "Phase 6" },
  { label: "Reports", href: null, phase: "Later" },
  { label: "Settings", href: "/settings" },
] as const;

export function AppSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5">
      {NAV_ITEMS.map((item) =>
        item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              (item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href)) &&
                "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        ) : (
          <span
            key={item.label}
            className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-sidebar-foreground/40"
            title={`Coming in ${item.phase}`}
          >
            {item.label}
            <span className="text-[10px] uppercase tracking-wide">
              {item.phase}
            </span>
          </span>
        ),
      )}
    </nav>
  );
}
