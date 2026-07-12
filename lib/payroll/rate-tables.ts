// Canonical rate table payloads, versioned by effective date. These are the
// source of truth for the rate_tables DB seed AND the direct input to the
// pure engine. Adding a future rate change = append a new entry, never edit.
//
// VERIFY against cpf.gov.sg / SSG / SHG fund sites before the first live run
// (build plan §11). Known future change: CPF 55-65 rates rise 1 Jan 2027.

export type CpfAgeBandRates = {
  id: string;
  label: string;
  // Band applies when the pay month is at or before the month of the
  // upperAge-th birthday of the next band (see age.ts for transition rule).
  upperAge: number | null; // null = no upper bound
  totalBp: number; // total contribution, basis points
  employeeBp: number;
  // Phased employee factor for the $500-$750 wage band: EE = factor x (TW-500)
  phasedFactorBp: number;
};

export type CpfRateTable = {
  version: string;
  // Wage band thresholds (cents/month)
  noContributionBelow: number; // TW <= this: no CPF
  employerOnlyUpTo: number; // TW <= this: employer share only
  fullRatesFrom: number; // TW >= this: full rates
  owCeiling: number; // ordinary wage ceiling, cents/month
  awCeilingBase: number; // annual AW ceiling base, cents/year
  annualLimit: number; // CPF annual contribution limit, cents/year
  ageBands: CpfAgeBandRates[];
};

export const CPF_TABLES: { effectiveFrom: string; payload: CpfRateTable }[] = [
  {
    effectiveFrom: "2026-01-01",
    payload: {
      version: "cpf-2026-01",
      noContributionBelow: 50_00,
      employerOnlyUpTo: 500_00,
      fullRatesFrom: 750_00,
      owCeiling: 8000_00,
      awCeilingBase: 102_000_00,
      annualLimit: 37_740_00,
      ageBands: [
        { id: "le55", label: "55 and below", upperAge: 55, totalBp: 3700, employeeBp: 2000, phasedFactorBp: 6000 },
        { id: "a55to60", label: "above 55 to 60", upperAge: 60, totalBp: 3400, employeeBp: 1800, phasedFactorBp: 5400 },
        { id: "a60to65", label: "above 60 to 65", upperAge: 65, totalBp: 2500, employeeBp: 1250, phasedFactorBp: 3750 },
        { id: "a65to70", label: "above 65 to 70", upperAge: 70, totalBp: 1650, employeeBp: 750, phasedFactorBp: 2250 },
        { id: "a70", label: "above 70", upperAge: null, totalBp: 1250, employeeBp: 500, phasedFactorBp: 1500 },
      ],
    },
  },
];

export type SdlRateTable = {
  version: string;
  rateBp: number; // 0.25% = 25bp
  minCents: number;
  maxCents: number;
};

export const SDL_TABLES: { effectiveFrom: string; payload: SdlRateTable }[] = [
  {
    effectiveFrom: "2026-01-01",
    payload: { version: "sdl-2026-01", rateBp: 25, minCents: 2_00, maxCents: 11_25 },
  },
];

export type ShgTier = { wagesUpTo: number | null; amountCents: number };
export type ShgFund = "cdac" | "sinda" | "mbmf" | "ecf";

export type ShgRateTable = {
  version: string;
  funds: Record<ShgFund, ShgTier[]>;
};

// Tiered flat monthly deductions by total-wage band. wagesUpTo is inclusive.
export const SHG_TABLES: { effectiveFrom: string; payload: ShgRateTable }[] = [
  {
    effectiveFrom: "2026-01-01",
    payload: {
      version: "shg-2026-01",
      funds: {
        cdac: [
          { wagesUpTo: 2000_00, amountCents: 50 },
          { wagesUpTo: 3500_00, amountCents: 1_00 },
          { wagesUpTo: 5000_00, amountCents: 1_50 },
          { wagesUpTo: 7500_00, amountCents: 2_00 },
          { wagesUpTo: null, amountCents: 3_00 },
        ],
        sinda: [
          { wagesUpTo: 1000_00, amountCents: 1_00 },
          { wagesUpTo: 1500_00, amountCents: 3_00 },
          { wagesUpTo: 2500_00, amountCents: 5_00 },
          { wagesUpTo: 4500_00, amountCents: 7_00 },
          { wagesUpTo: 7500_00, amountCents: 9_00 },
          { wagesUpTo: 15_000_00, amountCents: 12_00 },
          { wagesUpTo: null, amountCents: 30_00 },
        ],
        mbmf: [
          { wagesUpTo: 1000_00, amountCents: 3_00 },
          { wagesUpTo: 2000_00, amountCents: 4_50 },
          { wagesUpTo: 3000_00, amountCents: 6_50 },
          { wagesUpTo: 4000_00, amountCents: 15_00 },
          { wagesUpTo: 6000_00, amountCents: 19_50 },
          { wagesUpTo: 8000_00, amountCents: 22_00 },
          { wagesUpTo: 10_000_00, amountCents: 24_00 },
          { wagesUpTo: null, amountCents: 26_00 },
        ],
        ecf: [
          { wagesUpTo: 1000_00, amountCents: 2_00 },
          { wagesUpTo: 1500_00, amountCents: 4_00 },
          { wagesUpTo: 2500_00, amountCents: 6_00 },
          { wagesUpTo: 4000_00, amountCents: 9_00 },
          { wagesUpTo: 7000_00, amountCents: 12_00 },
          { wagesUpTo: 10_000_00, amountCents: 16_00 },
          { wagesUpTo: null, amountCents: 20_00 },
        ],
      },
    },
  },
];

// Pick the table in force for a given pay month (YYYY-MM-01 comparison).
export function resolveTable<T>(
  tables: { effectiveFrom: string; payload: T }[],
  payMonth: string, // "YYYY-MM"
): T {
  const target = `${payMonth}-01`;
  const applicable = tables
    .filter((t) => t.effectiveFrom <= target)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  if (!applicable.length) {
    throw new Error(`No rate table in force for ${payMonth}`);
  }
  return applicable[0].payload;
}
