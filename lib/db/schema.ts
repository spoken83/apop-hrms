import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const idTypeEnum = pgEnum("id_type", ["nric", "fin"]);

// PR graduated rates (year 1/2) are out of scope for v1, but residency_status
// is the hook the rate engine keys on later — do not collapse pr into citizen.
export const residencyStatusEnum = pgEnum("residency_status", [
  "citizen",
  "pr",
  "wp",
  "spass",
  "ep",
]);

export const raceEnum = pgEnum("race", [
  "chinese",
  "malay",
  "indian",
  "eurasian",
  "other",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "monthly",
  "hourly",
]);

export const entities = pgTable("entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  uen: text("uen"),
  csn: text("csn"),
  ssic: text("ssic"),
  sector: text("sector").notNull().default("services"),
  bankName: text("bank_name"),
  bankAccountNo: text("bank_account_no"),
  xeroTenantId: text("xero_tenant_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const outlets = pgTable("outlets", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  fullName: text("full_name").notNull(),
  idType: idTypeEnum("id_type").notNull(),
  idNumber: text("id_number").notNull().unique(),
  dob: date("dob").notNull(),
  nationality: text("nationality").notNull(),
  residencyStatus: residencyStatusEnum("residency_status").notNull(),
  race: raceEnum("race"),
  // Map of SHG fund code -> opted out, e.g. { "cdac": true }
  shgOptOut: jsonb("shg_opt_out")
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  bankName: text("bank_name"),
  bankAccountNo: text("bank_account_no"),
  email: text("email"),
  mobile: text("mobile"),
  passExpiryDate: date("pass_expiry_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// A person's assignment to an entity. A transfer between entities is:
// close the old employment (set end_date), open a new one. Never edit in place.
export const employments = pgTable("employments", {
  id: uuid("id").primaryKey().defaultRandom(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  employmentType: employmentTypeEnum("employment_type").notNull(),
  baseSalary: numeric("base_salary", { precision: 10, scale: 2 }),
  hourlyRate: numeric("hourly_rate", { precision: 7, scale: 2 }),
  contractualHoursPerWeek: numeric("contractual_hours_per_week", {
    precision: 5,
    scale: 2,
  }),
  // Admin staff and floaters are false: fully in payroll, never on rosters.
  isScheduled: boolean("is_scheduled").notNull().default(true),
  roleTitle: text("role_title").notNull(),
  outletId: uuid("outlet_id").references(() => outlets.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Statutory rates are versioned by effective date, never hardcoded in the
// engine. CPF 55-65 rates already have announced increases for 1 Jan 2027.
export const rateTableTypeEnum = pgEnum("rate_table_type", [
  "cpf",
  "sdl",
  "shg",
  "fwl",
]);

export const rateTables = pgTable("rate_tables", {
  id: uuid("id").primaryKey().defaultRandom(),
  tableType: rateTableTypeEnum("table_type").notNull(),
  effectiveFrom: date("effective_from").notNull(),
  effectiveTo: date("effective_to"),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollRunStatusEnum = pgEnum("payroll_run_status", [
  "draft",
  "confirmed",
]);

export const payslipLineTypeEnum = pgEnum("payslip_line_type", [
  "basic",
  "hourly_pay",
  "ot",
  "ph_pay",
  "allowance",
  "bonus",
  "npl_deduction",
  "deduction",
  "cpf_ee",
  "cpf_er",
  "sdl",
  "shg_cdac",
  "shg_sinda",
  "shg_mbmf",
  "shg_ecf",
  "net_pay",
]);

export const adjustmentKindEnum = pgEnum("adjustment_kind", [
  "allowance", // ordinary wages, attracts CPF as OW
  "bonus", // additional wages, attracts CPF as AW
  "deduction", // post-CPF net deduction
]);

export const payrollRuns = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityId: uuid("entity_id")
    .notNull()
    .references(() => entities.id),
  periodMonth: text("period_month").notNull(), // YYYY-MM
  status: payrollRunStatusEnum("status").notNull().default("draft"),
  adviceCode: text("advice_code").notNull(), // 01-99, differs per submission
  rateTableVersions: jsonb("rate_table_versions")
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
  confirmedAt: timestamp("confirmed_at"),
  cpfSubmittedAt: timestamp("cpf_submitted_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// One row per employment per run: aggregates for review table + EZPay file.
// Full line detail with calculation traces lives in payslip_lines.
export const payslips = pgTable("payslips", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => payrollRuns.id),
  employmentId: uuid("employment_id")
    .notNull()
    .references(() => employments.id),
  owCents: integer("ow_cents").notNull().default(0),
  awCents: integer("aw_cents").notNull().default(0),
  owSubjectCents: integer("ow_subject_cents").notNull().default(0),
  awSubjectCents: integer("aw_subject_cents").notNull().default(0),
  grossCents: integer("gross_cents").notNull().default(0),
  cpfEmployeeCents: integer("cpf_ee_cents").notNull().default(0),
  cpfEmployerCents: integer("cpf_er_cents").notNull().default(0),
  sdlCents: integer("sdl_cents").notNull().default(0),
  shgFund: text("shg_fund"), // cdac | sinda | mbmf | ecf | null
  shgCents: integer("shg_cents").notNull().default(0),
  netCents: integer("net_cents").notNull().default(0),
  // EZPay employment status: E existing, N new joiner, L leaver, O both
  ezpayStatus: text("ezpay_status").notNull().default("E"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payslipLines = pgTable("payslip_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  payslipId: uuid("payslip_id")
    .notNull()
    .references(() => payslips.id),
  lineType: payslipLineTypeEnum("line_type").notNull(),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  trace: jsonb("trace"), // { formula, inputs, rateTable }
  sortOrder: integer("sort_order").notNull().default(0),
});

export const runAdjustments = pgTable("run_adjustments", {
  id: uuid("id").primaryKey().defaultRandom(),
  runId: uuid("run_id")
    .notNull()
    .references(() => payrollRuns.id),
  employmentId: uuid("employment_id")
    .notNull()
    .references(() => employments.id),
  kind: adjustmentKindEnum("kind").notNull(),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
  entity: one(entities, {
    fields: [payrollRuns.entityId],
    references: [entities.id],
  }),
  payslips: many(payslips),
  adjustments: many(runAdjustments),
}));

export const payslipsRelations = relations(payslips, ({ one, many }) => ({
  run: one(payrollRuns, {
    fields: [payslips.runId],
    references: [payrollRuns.id],
  }),
  employment: one(employments, {
    fields: [payslips.employmentId],
    references: [employments.id],
  }),
  lines: many(payslipLines),
}));

export const payslipLinesRelations = relations(payslipLines, ({ one }) => ({
  payslip: one(payslips, {
    fields: [payslipLines.payslipId],
    references: [payslips.id],
  }),
}));

export const runAdjustmentsRelations = relations(runAdjustments, ({ one }) => ({
  run: one(payrollRuns, {
    fields: [runAdjustments.runId],
    references: [payrollRuns.id],
  }),
  employment: one(employments, {
    fields: [runAdjustments.employmentId],
    references: [employments.id],
  }),
}));

export type PayrollRun = typeof payrollRuns.$inferSelect;
export type Payslip = typeof payslips.$inferSelect;
export type PayslipLine = typeof payslipLines.$inferSelect;
export type RunAdjustment = typeof runAdjustments.$inferSelect;

export const entitiesRelations = relations(entities, ({ many }) => ({
  outlets: many(outlets),
  employments: many(employments),
}));

export const outletsRelations = relations(outlets, ({ one, many }) => ({
  entity: one(entities, {
    fields: [outlets.entityId],
    references: [entities.id],
  }),
  employments: many(employments),
}));

export const employeesRelations = relations(employees, ({ many }) => ({
  employments: many(employments),
}));

export const employmentsRelations = relations(employments, ({ one }) => ({
  employee: one(employees, {
    fields: [employments.employeeId],
    references: [employees.id],
  }),
  entity: one(entities, {
    fields: [employments.entityId],
    references: [entities.id],
  }),
  outlet: one(outlets, {
    fields: [employments.outletId],
    references: [outlets.id],
  }),
}));

export type Entity = typeof entities.$inferSelect;
export type Outlet = typeof outlets.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Employment = typeof employments.$inferSelect;
