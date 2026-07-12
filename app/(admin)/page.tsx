import Link from "next/link";
import { and, eq, isNull, isNotNull, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { employees, employments } from "@/lib/db/schema";
import { ALL_ENTITIES, getSelectedEntityId } from "@/lib/entity-context";
import { formatDate } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const selectedEntity = await getSelectedEntityId();
  const entityFilter =
    selectedEntity === ALL_ENTITIES
      ? undefined
      : eq(employments.entityId, selectedEntity);

  const in60Days = new Date();
  in60Days.setDate(in60Days.getDate() + 60);
  const cutoff = in60Days.toISOString().slice(0, 10);

  const [activeEmployments, expiringPasses] = await Promise.all([
    db
      .select({ id: employments.id })
      .from(employments)
      .where(and(isNull(employments.endDate), entityFilter)),
    db
      .select({
        employeeId: employees.id,
        fullName: employees.fullName,
        passExpiryDate: employees.passExpiryDate,
      })
      .from(employees)
      .innerJoin(
        employments,
        and(
          eq(employments.employeeId, employees.id),
          isNull(employments.endDate),
          entityFilter,
        ),
      )
      .where(
        and(
          isNotNull(employees.passExpiryDate),
          lte(employees.passExpiryDate, cutoff),
        ),
      ),
  ]);

  const tasks = expiringPasses.map((p) => ({
    key: `pass-${p.employeeId}`,
    href: `/people/${p.employeeId}`,
    label: `${p.fullName} — pass expires ${formatDate(p.passExpiryDate)}`,
    tone: "warning" as const,
  }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {activeEmployments.length} active{" "}
          {activeEmployments.length === 1 ? "employee" : "employees"}
          {selectedEntity === ALL_ENTITIES ? " across all entities" : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What needs you</CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing needs you right now. Payroll, timesheet and leave tasks
              will appear here as those phases ship.
            </p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => (
                <li key={task.key}>
                  <Link
                    href={task.href}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Badge className="bg-warning text-warning-foreground">
                      Pass expiry
                    </Badge>
                    {task.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
