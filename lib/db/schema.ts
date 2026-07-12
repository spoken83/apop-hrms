import {
  boolean,
  date,
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
