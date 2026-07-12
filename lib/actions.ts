"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { employees, employments, entities, outlets } from "./db/schema";
import { ENTITY_COOKIE } from "./entity-context";
import { employeeSchema, employmentSchema } from "./validation";

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
};

export async function setSelectedEntity(entityId: string) {
  const store = await cookies();
  store.set(ENTITY_COOKIE, entityId, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

function zodErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

function employeeValues(data: ReturnType<typeof employeeSchema.parse>) {
  return {
    fullName: data.fullName,
    idType: data.idType,
    idNumber: data.idNumber,
    dob: data.dob,
    nationality: data.nationality,
    residencyStatus: data.residencyStatus,
    race: data.race ?? null,
    email: data.email || null,
    mobile: data.mobile || null,
    bankName: data.bankName || null,
    bankAccountNo: data.bankAccountNo || null,
    passExpiryDate: data.passExpiryDate || null,
  };
}

export async function createEmployee(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

  const employeeParsed = employeeSchema.safeParse(raw);
  const employmentParsed = employmentSchema.safeParse({
    ...raw,
    isScheduled: raw.isScheduled === "on",
  });

  if (!employeeParsed.success || !employmentParsed.success) {
    return {
      errors: {
        ...(employeeParsed.success ? {} : zodErrors(employeeParsed.error)),
        ...(employmentParsed.success ? {} : zodErrors(employmentParsed.error)),
      },
      message: "Fix the highlighted fields.",
    };
  }

  const existing = await db.query.employees.findFirst({
    where: eq(employees.idNumber, employeeParsed.data.idNumber),
  });
  if (existing) {
    return {
      errors: { idNumber: "An employee with this NRIC/FIN already exists" },
      message: "Fix the highlighted fields.",
    };
  }

  const emp = employmentParsed.data;
  const employeeId = await db.transaction(async (tx) => {
    const [employee] = await tx
      .insert(employees)
      .values(employeeValues(employeeParsed.data))
      .returning({ id: employees.id });
    await tx.insert(employments).values({
      employeeId: employee.id,
      entityId: emp.entityId,
      startDate: emp.startDate,
      employmentType: emp.employmentType,
      baseSalary: emp.employmentType === "monthly" ? emp.baseSalary : null,
      hourlyRate: emp.employmentType === "hourly" ? emp.hourlyRate : null,
      contractualHoursPerWeek: emp.contractualHoursPerWeek || null,
      isScheduled: emp.isScheduled,
      roleTitle: emp.roleTitle,
      outletId: emp.outletId || null,
    });
    return employee.id;
  });

  revalidatePath("/people");
  redirect(`/people/${employeeId}`);
}

export async function updateEmployeeContact(
  employeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  const mobile = String(formData.get("mobile") ?? "").trim();
  const bankName = String(formData.get("bankName") ?? "").trim();
  const bankAccountNo = String(formData.get("bankAccountNo") ?? "").trim();

  await db
    .update(employees)
    .set({
      email: email || null,
      mobile: mobile || null,
      bankName: bankName || null,
      bankAccountNo: bankAccountNo || null,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, employeeId));

  revalidatePath(`/people/${employeeId}`);
  return { message: "Contact details saved" };
}

// Transfer is a guided close-and-reopen, never a raw field edit (spec §4.3).
// Ends the current employment the day before the transfer date and opens a
// new employment at the target entity with terms carried over.
export async function transferEmployee(
  employeeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const targetEntityId = String(formData.get("targetEntityId") ?? "");
  const transferDate = String(formData.get("transferDate") ?? "");

  if (!targetEntityId || !transferDate) {
    return { errors: { form: "Target entity and transfer date are required" } };
  }

  const current = await db.query.employments.findFirst({
    where: and(
      eq(employments.employeeId, employeeId),
      isNull(employments.endDate),
    ),
  });
  if (!current) {
    return { errors: { form: "No active employment to transfer" } };
  }
  if (current.entityId === targetEntityId) {
    return { errors: { form: "Employee is already employed by this entity" } };
  }
  if (transferDate <= current.startDate) {
    return {
      errors: { form: "Transfer date must be after the current employment start" },
    };
  }

  const dayBefore = new Date(transferDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const endDate = dayBefore.toISOString().slice(0, 10);

  await db.transaction(async (tx) => {
    await tx
      .update(employments)
      .set({ endDate, updatedAt: new Date() })
      .where(eq(employments.id, current.id));
    await tx.insert(employments).values({
      employeeId,
      entityId: targetEntityId,
      startDate: transferDate,
      employmentType: current.employmentType,
      baseSalary: current.baseSalary,
      hourlyRate: current.hourlyRate,
      contractualHoursPerWeek: current.contractualHoursPerWeek,
      isScheduled: current.isScheduled,
      roleTitle: current.roleTitle,
      outletId: null, // outlets belong to an entity; reassign after transfer
    });
  });

  revalidatePath(`/people/${employeeId}`);
  revalidatePath("/people");
  return { message: "Transfer completed" };
}

export async function updateEntity(
  entityId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await db
    .update(entities)
    .set({
      uen: String(formData.get("uen") ?? "").trim() || null,
      csn: String(formData.get("csn") ?? "").trim() || null,
      ssic: String(formData.get("ssic") ?? "").trim() || null,
      bankName: String(formData.get("bankName") ?? "").trim() || null,
      bankAccountNo: String(formData.get("bankAccountNo") ?? "").trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(entities.id, entityId));

  revalidatePath("/settings");
  return { message: "Entity saved" };
}

export async function createOutlet(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const entityId = String(formData.get("entityId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!entityId || !name) {
    return { errors: { form: "Entity and outlet name are required" } };
  }
  await db.insert(outlets).values({ entityId, name });
  revalidatePath("/settings");
  return { message: "Outlet added" };
}
