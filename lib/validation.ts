import { z } from "zod";

// NRIC/FIN checksum per the standard algorithm: weights applied to the 7
// digits, prefix offset (T/G +4, M +3), check letter looked up by series.
const WEIGHTS = [2, 7, 6, 5, 4, 3, 2];
const CHECK_LETTERS: Record<string, string[]> = {
  ST: ["J", "Z", "I", "H", "G", "F", "E", "D", "C", "B", "A"],
  FG: ["X", "W", "U", "T", "R", "Q", "P", "N", "M", "L", "K"],
  M: ["K", "L", "J", "N", "P", "Q", "R", "T", "U", "W", "X"],
};

export function isValidNricFin(value: string): boolean {
  const id = value.trim().toUpperCase();
  if (!/^[STFGM]\d{7}[A-Z]$/.test(id)) return false;

  const prefix = id[0];
  const digits = id.slice(1, 8).split("").map(Number);
  let sum = digits.reduce((acc, d, i) => acc + d * WEIGHTS[i], 0);
  if (prefix === "T" || prefix === "G") sum += 4;
  if (prefix === "M") sum += 3;

  const remainder = sum % 11;
  const series =
    prefix === "S" || prefix === "T" ? "ST" : prefix === "M" ? "M" : "FG";
  const expected =
    series === "M"
      ? CHECK_LETTERS.M[10 - remainder]
      : CHECK_LETTERS[series][remainder];
  return id[8] === expected;
}

export const employeeSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required"),
    idType: z.enum(["nric", "fin"]),
    idNumber: z
      .string()
      .trim()
      .toUpperCase()
      .refine(isValidNricFin, "Invalid NRIC/FIN (checksum failed)"),
    dob: z.string().min(1, "Date of birth is required"),
    nationality: z.string().trim().min(1, "Nationality is required"),
    residencyStatus: z.enum(["citizen", "pr", "wp", "spass", "ep"]),
    race: z.enum(["chinese", "malay", "indian", "eurasian", "other"]).optional(),
    email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
    mobile: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    bankAccountNo: z.string().trim().optional(),
    passExpiryDate: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isLocal =
      data.residencyStatus === "citizen" || data.residencyStatus === "pr";
    if (isLocal && data.idType !== "nric") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idType"],
        message: "Citizens and PRs hold an NRIC",
      });
    }
    if (!isLocal && data.idType !== "fin") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["idType"],
        message: "Pass holders hold a FIN",
      });
    }
    if (!isLocal && !data.passExpiryDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passExpiryDate"],
        message: "Pass expiry date is required for pass holders",
      });
    }
    if (isLocal && !data.race) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["race"],
        message: "Race is required for citizens/PRs (SHG fund)",
      });
    }
  });

export const employmentSchema = z
  .object({
    entityId: z.string().uuid("Select an entity"),
    startDate: z.string().min(1, "Start date is required"),
    employmentType: z.enum(["monthly", "hourly"]),
    baseSalary: z.string().optional(),
    hourlyRate: z.string().optional(),
    contractualHoursPerWeek: z.string().optional(),
    isScheduled: z.boolean(),
    roleTitle: z.string().trim().min(1, "Role title is required"),
    outletId: z.string().uuid().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.employmentType === "monthly") {
      if (!data.baseSalary || Number(data.baseSalary) <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["baseSalary"],
          message: "Monthly salary is required",
        });
      }
    } else if (!data.hourlyRate || Number(data.hourlyRate) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hourlyRate"],
        message: "Hourly rate is required",
      });
    }
  });

export type EmployeeInput = z.infer<typeof employeeSchema>;
export type EmploymentInput = z.infer<typeof employmentSchema>;
