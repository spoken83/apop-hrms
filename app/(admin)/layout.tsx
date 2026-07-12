import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { entities } from "@/lib/db/schema";
import { getSelectedEntityId } from "@/lib/entity-context";
import { EntitySwitcher } from "@/components/entity-switcher";
import { AppSidebarNav } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [allEntities, selected] = await Promise.all([
    db.select().from(entities).orderBy(asc(entities.createdAt)),
    getSelectedEntityId(),
  ]);

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-60 shrink-0 flex-col gap-4 bg-sidebar p-4">
        <div className="px-1 text-lg font-semibold tracking-tight text-sidebar-foreground">
          APOP <span className="font-normal opacity-70">HRMS</span>
        </div>
        <EntitySwitcher
          entities={allEntities.map(({ id, name }) => ({ id, name }))}
          selected={selected}
        />
        <AppSidebarNav />
      </aside>
      <main className="min-w-0 flex-1 px-8 py-6">{children}</main>
      <Toaster />
    </div>
  );
}
