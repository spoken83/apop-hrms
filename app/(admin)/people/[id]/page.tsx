import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { employments, entities } from "@/lib/db/schema";
import { deriveStatutory } from "@/lib/statutory";
import { formatDate, formatSGD, maskIdNumber } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactForm } from "@/components/contact-form";
import { TransferDialog } from "@/components/transfer-dialog";

export const dynamic = "force-dynamic";

const RESIDENCY_LABELS: Record<string, string> = {
  citizen: "Singapore Citizen",
  pr: "Permanent Resident",
  wp: "Work Permit",
  spass: "S Pass",
  ep: "Employment Pass",
};

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-sm tabular-nums" : "text-sm"}>
        {value ?? "—"}
      </dd>
    </div>
  );
}

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const employee = await db.query.employees.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!employee) notFound();

  const [history, allEntities] = await Promise.all([
    db.query.employments.findMany({
      where: eq(employments.employeeId, id),
      with: { entity: true, outlet: true },
      orderBy: [desc(employments.startDate)],
    }),
    db.select().from(entities).orderBy(asc(entities.createdAt)),
  ]);

  const current = history.find((e) => e.endDate === null);
  const statutory = deriveStatutory(employee);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {employee.fullName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {current
              ? `${current.roleTitle} · ${current.entity.name}${current.outlet ? ` · ${current.outlet.name}` : ""}`
              : "No active employment"}
          </p>
        </div>
        {current ? (
          <TransferDialog
            employeeId={employee.id}
            employeeName={employee.fullName}
            currentEntityName={current.entity.name}
            targetEntities={allEntities
              .filter((e) => e.id !== current.entityId)
              .map(({ id, name }) => ({ id, name }))}
          />
        ) : null}
      </div>

      <Tabs defaultValue="personal">
        <TabsList>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="statutory">Statutory</TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6 pt-4">
          <dl className="grid grid-cols-3 gap-x-6 gap-y-4">
            <Detail
              label={employee.idType === "nric" ? "NRIC" : "FIN"}
              value={maskIdNumber(employee.idNumber)}
              mono
            />
            <Detail label="Date of birth" value={formatDate(employee.dob)} />
            <Detail label="Nationality" value={employee.nationality} />
            <Detail
              label="Residency"
              value={RESIDENCY_LABELS[employee.residencyStatus]}
            />
            <Detail
              label="Race"
              value={
                employee.race
                  ? employee.race[0].toUpperCase() + employee.race.slice(1)
                  : "—"
              }
            />
            {employee.passExpiryDate ? (
              <Detail
                label="Pass expiry"
                value={formatDate(employee.passExpiryDate)}
              />
            ) : null}
          </dl>
          <div>
            <h2 className="mb-3 text-sm font-medium">Contact & bank</h2>
            <ContactForm
              employeeId={employee.id}
              defaults={{
                email: employee.email,
                mobile: employee.mobile,
                bankName: employee.bankName,
                bankAccountNo: employee.bankAccountNo,
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="employment" className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Pay</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((employment) => (
                <TableRow key={employment.id}>
                  <TableCell>{employment.entity.name}</TableCell>
                  <TableCell>{employment.roleTitle}</TableCell>
                  <TableCell className="capitalize">
                    {employment.employmentType}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {employment.employmentType === "monthly"
                      ? `${formatSGD(employment.baseSalary)}/mo`
                      : `${formatSGD(employment.hourlyRate)}/hr`}
                  </TableCell>
                  <TableCell>{formatDate(employment.startDate)}</TableCell>
                  <TableCell>{formatDate(employment.endDate)}</TableCell>
                  <TableCell>
                    {employment.endDate === null ? (
                      <Badge className="bg-success text-success-foreground">
                        Current
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="statutory" className="space-y-3 pt-4">
          {statutory.map((line) => (
            <Card key={line.scheme}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  {line.scheme}
                  {line.applies ? (
                    <Badge className="bg-success text-success-foreground">
                      Applies
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Not applicable</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>{line.detail}</p>
                {line.note ? (
                  <p className="rounded-md bg-warning/20 px-2 py-1 text-xs text-warning-foreground">
                    ⚠ {line.note}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ))}
          <p className="text-xs text-muted-foreground">
            Derived from profile data. Actual contributions are computed by the
            payroll engine (Phase 2) against versioned rate tables.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
