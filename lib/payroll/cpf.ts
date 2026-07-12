import { cpfAgeBand } from "./age";
import { formatCents, type Cents } from "./money";
import type { CpfRateTable } from "./rate-tables";

export type ResidencyStatus = "citizen" | "pr" | "wp" | "spass" | "ep";

// PR graduated rates (years 1-2) are out of scope for v1. The hook exists so
// adding them later is a rate-table entry + profile value, not a refactor.
export type ResidencyProfile = "full" | "pr_year1" | "pr_year2";

export type CalcTrace = {
  formula: string;
  inputs: Record<string, string | number>;
  rateTable: string;
};

export type CpfInput = {
  dob: string; // YYYY-MM-DD
  payMonth: string; // YYYY-MM
  residencyStatus: ResidencyStatus;
  residencyProfile?: ResidencyProfile;
  /** Ordinary wages actually paid this calendar month (prorate before calling) */
  owCents: Cents;
  /** Additional wages (bonus/AW) paid this month */
  awCents?: Cents;
  /** OW already subjected to CPF in earlier months of this calendar year */
  ytdOwSubjectCents?: Cents;
  /** AW already subjected to CPF in earlier months of this calendar year */
  ytdAwSubjectCents?: Cents;
  /** Total CPF (ER+EE) already contributed this calendar year */
  ytdContributionsCents?: Cents;
};

export type CpfResult = {
  applicable: boolean;
  reason?: string;
  ageBandId: string;
  ageBandLabel: string;
  owSubjectCents: Cents;
  awSubjectCents: Cents;
  awCeilingRemainingCents: Cents;
  totalCents: Cents;
  employeeCents: Cents;
  employerCents: Cents;
  trace: CalcTrace;
};

const ZERO_TRACE = (reason: string, table: CpfRateTable): CalcTrace => ({
  formula: reason,
  inputs: {},
  rateTable: table.version,
});

export function computeCpf(input: CpfInput, table: CpfRateTable): CpfResult {
  const {
    residencyStatus,
    residencyProfile = "full",
    owCents,
    awCents = 0,
    ytdOwSubjectCents = 0,
    ytdAwSubjectCents = 0,
    ytdContributionsCents = 0,
  } = input;

  // Guard clause: foreigners (WP / S Pass / EP) have no CPF at all.
  if (residencyStatus !== "citizen" && residencyStatus !== "pr") {
    return {
      applicable: false,
      reason: "No CPF for foreign pass holders",
      ageBandId: "n/a",
      ageBandLabel: "n/a",
      owSubjectCents: 0,
      awSubjectCents: 0,
      awCeilingRemainingCents: 0,
      totalCents: 0,
      employeeCents: 0,
      employerCents: 0,
      trace: ZERO_TRACE("Not applicable: foreign pass holder", table),
    };
  }

  if (residencyProfile !== "full") {
    throw new Error(
      `Residency profile "${residencyProfile}" not implemented: add a rate table entry for PR graduated rates`,
    );
  }

  const band = cpfAgeBand(table, input.dob, input.payMonth);

  // OW ceiling applies per month; AW ceiling = base - OW subject for the year.
  const owSubject = Math.min(owCents, table.owCeiling);
  const awCeilingRemaining = Math.max(
    0,
    table.awCeilingBase - (ytdOwSubjectCents + owSubject) - ytdAwSubjectCents,
  );
  const awSubject = Math.min(awCents, awCeilingRemaining);
  const tw = owSubject + awSubject;

  const inputs: Record<string, string | number> = {
    payMonth: input.payMonth,
    ageBand: band.label,
    ow: formatCents(owCents),
    owSubject: formatCents(owSubject),
    ...(awCents > 0
      ? {
          aw: formatCents(awCents),
          awSubject: formatCents(awSubject),
          awCeilingRemaining: formatCents(awCeilingRemaining),
        }
      : {}),
  };

  let totalCents = 0;
  let employeeCents = 0;
  let formula: string;

  if (tw <= table.noContributionBelow) {
    formula = `Total wages ${formatCents(tw)} ≤ ${formatCents(table.noContributionBelow)}: no CPF payable`;
  } else if (tw <= table.employerOnlyUpTo) {
    // Employer share only
    const employerBp = band.totalBp - band.employeeBp;
    totalCents =
      Math.floor((employerBp * tw + 500_000) / 1_000_000) * 100;
    formula = `Employer only: ${employerBp / 100}% × ${formatCents(tw)} = ${formatCents(totalCents)} (wage band ${formatCents(table.noContributionBelow)}–${formatCents(table.employerOnlyUpTo)})`;
  } else if (tw < table.fullRatesFrom) {
    // Employer full rate + phased-in employee share
    const employerBp = band.totalBp - band.employeeBp;
    const excess = tw - table.employerOnlyUpTo;
    const totalNumerator = employerBp * tw + band.phasedFactorBp * excess;
    totalCents = Math.floor((totalNumerator + 500_000) / 1_000_000) * 100;
    employeeCents =
      Math.floor((band.phasedFactorBp * excess) / 1_000_000) * 100;
    formula = `Phased band: ER ${employerBp / 100}% × ${formatCents(tw)} + EE ${band.phasedFactorBp / 10000} × (${formatCents(tw)} − ${formatCents(table.employerOnlyUpTo)}); total ${formatCents(totalCents)}, EE ${formatCents(employeeCents)}`;
  } else {
    // Full rates: total rounded to nearest dollar (50¢ up), EE cents dropped,
    // ER = total − EE. This must match EZPay exactly.
    totalCents = Math.floor((band.totalBp * tw + 500_000) / 1_000_000) * 100;
    employeeCents = Math.floor((band.employeeBp * tw) / 1_000_000) * 100;
    formula = `${formatCents(tw)} × ${band.totalBp / 100}% = ${formatCents(totalCents)} total; EE ${band.employeeBp / 100}% = ${formatCents(employeeCents)}; ER = ${formatCents(totalCents - employeeCents)} (age band ${band.label})`;
  }

  // CPF Annual Limit safety cap. With mandatory wages the AW ceiling already
  // keeps totals within the limit; this guards data errors and future rates.
  const remainingAnnual = Math.max(0, table.annualLimit - ytdContributionsCents);
  if (totalCents > remainingAnnual) {
    totalCents = remainingAnnual;
    employeeCents = Math.min(employeeCents, totalCents);
    formula += `; capped by CPF Annual Limit (${formatCents(table.annualLimit)})`;
  }

  return {
    applicable: true,
    ageBandId: band.id,
    ageBandLabel: band.label,
    owSubjectCents: owSubject,
    awSubjectCents: awSubject,
    awCeilingRemainingCents: awCeilingRemaining,
    totalCents,
    employeeCents,
    employerCents: totalCents - employeeCents,
    trace: { formula, inputs, rateTable: table.version },
  };
}
