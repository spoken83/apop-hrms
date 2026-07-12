import { formatCents, type Cents } from "./money";
import type { ShgFund, ShgRateTable } from "./rate-tables";
import type { CalcTrace } from "./cpf";

export type ShgResult = {
  fund: ShgFund;
  amountCents: Cents;
  optedOut: boolean;
  trace: CalcTrace;
};

const FUND_LABELS: Record<ShgFund, string> = {
  cdac: "CDAC",
  sinda: "SINDA",
  mbmf: "MBMF",
  ecf: "ECF",
};

// SHG deductions are tiered flat amounts by total-wage band, deducted from
// the employee and remitted with the CPF submission. Fund selection (by race,
// and MBMF religion/nationality nuances) is the caller's decision — the
// engine just prices a fund at a wage level.
export function computeShg(
  fund: ShgFund,
  wagesCents: Cents,
  optedOut: boolean,
  table: ShgRateTable,
): ShgResult {
  if (optedOut) {
    return {
      fund,
      amountCents: 0,
      optedOut: true,
      trace: {
        formula: `${FUND_LABELS[fund]}: opted out`,
        inputs: {},
        rateTable: table.version,
      },
    };
  }

  if (wagesCents <= 0) {
    return {
      fund,
      amountCents: 0,
      optedOut: false,
      trace: {
        formula: `${FUND_LABELS[fund]}: no wages`,
        inputs: {},
        rateTable: table.version,
      },
    };
  }

  const tiers = table.funds[fund];
  const tier =
    tiers.find((t) => t.wagesUpTo !== null && wagesCents <= t.wagesUpTo) ??
    tiers[tiers.length - 1];

  return {
    fund,
    amountCents: tier.amountCents,
    optedOut: false,
    trace: {
      formula: `${FUND_LABELS[fund]} tier for wages ${formatCents(wagesCents)} (≤ ${tier.wagesUpTo === null ? "no limit" : formatCents(tier.wagesUpTo)}): ${formatCents(tier.amountCents)}`,
      inputs: { wages: formatCents(wagesCents) },
      rateTable: table.version,
    },
  };
}
