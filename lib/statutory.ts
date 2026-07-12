import type { Employee } from "./db/schema";
import { computeShg } from "./payroll/shg";
import { formatCents } from "./payroll/money";
import { SHG_TABLES, resolveTable, type ShgFund } from "./payroll/rate-tables";

// Display-only derivation for the Statutory panel (UI/UX spec §4.3).
// The real payroll engine (Phase 2) reads versioned rate_tables; these
// headline rates exist only to describe what applies to a person and why.
// Rates effective 1 Jan 2026 — verify against cpf.gov.sg before first live run.

const CPF_AGE_BANDS = [
  { label: "55 and below", maxAge: 55, employer: 17, employee: 20 },
  { label: "above 55 to 60", maxAge: 60, employer: 16, employee: 18 },
  { label: "above 60 to 65", maxAge: 65, employer: 12.5, employee: 12.5 },
  { label: "above 65 to 70", maxAge: 70, employer: 9, employee: 7.5 },
  { label: "above 70", maxAge: Infinity, employer: 7.5, employee: 5 },
] as const;

const SHG_FUNDS: Record<string, { fund: string; code: string }> = {
  chinese: { fund: "CDAC", code: "cdac" },
  indian: { fund: "SINDA", code: "sinda" },
  malay: { fund: "MBMF", code: "mbmf" },
  eurasian: { fund: "ECF", code: "ecf" },
};

export type StatutoryLine = {
  scheme: string;
  applies: boolean;
  detail: string;
  note?: string;
};

function ageOn(dob: Date, on: Date): number {
  let age = on.getFullYear() - dob.getFullYear();
  const m = on.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age--;
  return age;
}

// New CPF rates apply from the first day of the month AFTER the
// 55th/60th/65th/70th birthday, not the birthday itself.
function nextBandChange(dob: Date, currentAge: number): string | null {
  const thresholds = [55, 60, 65, 70];
  const next = thresholds.find((t) => currentAge < t);
  if (!next) return null;
  const birthday = new Date(dob.getFullYear() + next, dob.getMonth(), 1);
  const effective = new Date(birthday.getFullYear(), birthday.getMonth() + 1, 1);
  return effective.toLocaleDateString("en-SG", { month: "short", year: "numeric" });
}

const PASS_LABELS: Record<string, string> = {
  wp: "Work Permit",
  spass: "S Pass",
  ep: "Employment Pass",
};

export function deriveStatutory(
  employee: Employee,
  monthlyWagesCents?: number,
): StatutoryLine[] {
  const lines: StatutoryLine[] = [];
  const isLocal =
    employee.residencyStatus === "citizen" || employee.residencyStatus === "pr";
  const dob = new Date(employee.dob);
  const age = ageOn(dob, new Date());

  // CPF
  if (isLocal) {
    const band = CPF_AGE_BANDS.find((b) => age <= b.maxAge)!;
    const change = nextBandChange(dob, age);
    lines.push({
      scheme: "CPF",
      applies: true,
      detail: `Age band ${band.label} — employer ${band.employer}%, employee ${band.employee}% (rates from 1 Jan 2026)`,
      note: change ? `Next band change: ${change}` : undefined,
      ...(employee.residencyStatus === "pr"
        ? {
            note: `PR graduated rates (years 1–2) not yet supported — verify before first run.${
              change ? ` Next band change: ${change}` : ""
            }`,
          }
        : {}),
    });
  } else {
    lines.push({
      scheme: "CPF",
      applies: false,
      detail: `Not applicable (${PASS_LABELS[employee.residencyStatus] ?? "foreign pass holder"})`,
    });
  }

  // SDL — payable for every employee including Work Permit holders.
  lines.push({
    scheme: "SDL",
    applies: true,
    detail: "0.25% of monthly remuneration (min $2, cap $11.25). Applies to all employees including pass holders.",
  });

  // SHG
  if (isLocal && employee.race && SHG_FUNDS[employee.race]) {
    const { fund, code } = SHG_FUNDS[employee.race];
    const optedOut = employee.shgOptOut?.[code] === true;
    let tierNote = "tiered deduction by wage band";
    if (!optedOut && monthlyWagesCents && monthlyWagesCents > 0) {
      const shg = computeShg(
        code as ShgFund,
        monthlyWagesCents,
        false,
        resolveTable(SHG_TABLES, new Date().toISOString().slice(0, 7)),
      );
      tierNote = `${formatCents(shg.amountCents)}/month tier at current salary`;
    }
    lines.push({
      scheme: "SHG",
      applies: !optedOut,
      detail: optedOut
        ? `${fund} — opted out`
        : `${fund} — ${tierNote}, remitted with CPF submission`,
    });
  } else if (isLocal) {
    lines.push({
      scheme: "SHG",
      applies: false,
      detail: "No fund applicable (race: other)",
    });
  } else {
    lines.push({
      scheme: "SHG",
      applies: false,
      detail: "Not applicable to foreign pass holders",
      note:
        employee.race === "malay"
          ? "Verify: MBMF may apply to Muslim employees regardless of nationality, including WP holders."
          : undefined,
    });
  }

  // FWL — employer cost, never a payslip deduction.
  if (employee.residencyStatus === "wp" || employee.residencyStatus === "spass") {
    lines.push({
      scheme: "FWL",
      applies: true,
      detail: `Foreign Worker Levy applies (${PASS_LABELS[employee.residencyStatus]}, services sector). Tracked as employer cost, not a payslip deduction. R1/R2 tier TBC.`,
      note: employee.passExpiryDate
        ? undefined
        : "Pass expiry date missing — required for levy tracking.",
    });
  } else {
    lines.push({
      scheme: "FWL",
      applies: false,
      detail:
        employee.residencyStatus === "ep"
          ? "Not applicable (Employment Pass — no levy)"
          : "Not applicable (local employee)",
    });
  }

  return lines;
}
