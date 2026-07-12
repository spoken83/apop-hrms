import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { payslipLines, payslips } from "@/lib/db/schema";
import { formatCents } from "@/lib/payroll/money";
import { formatDate, maskIdNumber } from "@/lib/format";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

// Standalone printable payslip (outside the admin shell): itemised per the
// Employment Act — basic, allowances, OT, deductions, employer CPF, net pay,
// period and payment date. Browser Print → Save as PDF.
export default async function PayslipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const slip = await db.query.payslips.findFirst({
    where: eq(payslips.id, id),
    with: {
      run: { with: { entity: true } },
      employment: { with: { employee: true } },
      lines: { orderBy: [asc(payslipLines.sortOrder)] },
    },
  });
  if (!slip) notFound();

  const period = new Date(`${slip.run.periodMonth}-01T00:00:00`).toLocaleDateString(
    "en-SG",
    { month: "long", year: "numeric" },
  );
  const earnings = slip.lines.filter((l) =>
    ["basic", "hourly_pay", "ot", "ph_pay", "allowance", "bonus"].includes(l.lineType),
  );
  const deductions = slip.lines.filter((l) =>
    ["cpf_ee", "npl_deduction", "deduction", "shg_cdac", "shg_sinda", "shg_mbmf", "shg_ecf"].includes(
      l.lineType,
    ),
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8 print:p-0">
      <div className="flex items-start justify-between border-b pb-4">
        <div>
          <h1 className="text-xl font-semibold">{slip.run.entity.name}</h1>
          <p className="text-sm text-muted-foreground">Itemised payslip — {period}</p>
        </div>
        <PrintButton />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Employee</dt>
          <dd className="font-medium">{slip.employment.employee.fullName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">
            {slip.employment.employee.idType === "nric" ? "NRIC" : "FIN"}
          </dt>
          <dd className="font-mono">{maskIdNumber(slip.employment.employee.idNumber)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Role</dt>
          <dd>{slip.employment.roleTitle}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Issued</dt>
          <dd>{formatDate(slip.run.confirmedAt ?? slip.createdAt)}</dd>
        </div>
      </dl>

      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b text-left">
            <th className="py-1.5 font-medium" colSpan={2}>
              Earnings
            </th>
          </tr>
          {earnings.map((l) => (
            <tr key={l.id}>
              <td className="py-1">{l.label}</td>
              <td className="py-1 text-right font-mono tabular-nums">
                {formatCents(l.amountCents)}
              </td>
            </tr>
          ))}
          <tr className="border-b border-t text-left">
            <th className="py-1.5 font-medium" colSpan={2}>
              Deductions
            </th>
          </tr>
          {deductions.map((l) => (
            <tr key={l.id}>
              <td className="py-1">{l.label}</td>
              <td className="py-1 text-right font-mono tabular-nums">
                {formatCents(l.amountCents)}
              </td>
            </tr>
          ))}
          <tr className="border-t">
            <td className="py-2 text-base font-semibold">Net pay</td>
            <td className="py-2 text-right font-mono text-base font-semibold tabular-nums">
              {formatCents(slip.netCents)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="rounded-md bg-muted p-3 text-sm">
        <p className="font-medium">Employer contributions (not deducted from pay)</p>
        <div className="mt-1 flex justify-between">
          <span>CPF (employer share)</span>
          <span className="font-mono tabular-nums">{formatCents(slip.cpfEmployerCents)}</span>
        </div>
        <div className="flex justify-between">
          <span>Skills Development Levy</span>
          <span className="font-mono tabular-nums">{formatCents(slip.sdlCents)}</span>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        CPF contributions for {period} are payable by the 14th of the following
        month. Keep this payslip for your records.
      </p>
    </div>
  );
}
