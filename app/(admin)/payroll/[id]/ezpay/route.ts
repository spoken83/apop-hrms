import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { entities, payrollRuns } from "@/lib/db/schema";
import { generateEzpayFile, validateEzpayFile } from "@/lib/ezpay";
import { getEmployeeAccountRows, getRunDetail } from "@/lib/payroll/run-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const run = await db.query.payrollRuns.findFirst({
    where: eq(payrollRuns.id, id),
  });
  if (!run) return new Response("Run not found", { status: 404 });
  if (run.status !== "confirmed") {
    return new Response("Confirm the run before generating the EZPay file", {
      status: 400,
    });
  }

  const entity = await db.query.entities.findFirst({
    where: eq(entities.id, run.entityId),
  });
  if (!entity?.uen) {
    return new Response(
      "Entity UEN is missing — fill it in under Settings before generating the CPF file",
      { status: 400 },
    );
  }

  // CSN = UEN + payment type + serial no. Parse from the stored CSN if it
  // matches, otherwise default PTE/01.
  let paymentType = "PTE";
  let serialNo = "01";
  if (entity.csn && entity.csn.startsWith(entity.uen)) {
    const suffix = entity.csn.slice(entity.uen.length).replace(/[^A-Z0-9]/gi, "");
    if (suffix.length >= 5) {
      paymentType = suffix.slice(0, 3).toUpperCase();
      serialNo = suffix.slice(3, 5);
    }
  }

  const [employeeRows, detail] = await Promise.all([
    getEmployeeAccountRows(id),
    getRunDetail(id),
  ]);
  const sdlTotalCents =
    detail?.payslips.reduce((s, p) => s + p.sdlCents, 0) ?? 0;

  const file = generateEzpayFile({
    uen: entity.uen,
    paymentType,
    serialNo,
    adviceCode: run.adviceCode,
    periodMonth: run.periodMonth,
    fileCreatedAt: new Date(),
    employees: employeeRows,
    sdlTotalCents,
  });

  const problems = validateEzpayFile(file);
  if (problems.length > 0) {
    return new Response(
      `EZPay file failed validation:\n${problems.join("\n")}`,
      { status: 500 },
    );
  }

  return new Response(file.content, {
    headers: {
      "Content-Type": "text/plain; charset=ascii",
      "Content-Disposition": `attachment; filename="${file.filename}"`,
    },
  });
}
