import { bpFloorToCent, formatCents, type Cents } from "./money";
import type { SdlRateTable } from "./rate-tables";
import type { CalcTrace } from "./cpf";

export type SdlResult = {
  amountCents: Cents;
  trace: CalcTrace;
};

// SDL is payable for EVERY employee including Work Permit holders (common
// miss). 0.25% of monthly remuneration, min $2, capped at $11.25.
export function computeSdl(wagesCents: Cents, table: SdlRateTable): SdlResult {
  if (wagesCents <= 0) {
    return {
      amountCents: 0,
      trace: { formula: "No wages: no SDL", inputs: {}, rateTable: table.version },
    };
  }

  const raw = bpFloorToCent(table.rateBp, wagesCents);
  const amountCents = Math.min(Math.max(raw, table.minCents), table.maxCents);

  let formula = `${table.rateBp / 100}% × ${formatCents(wagesCents)} = ${formatCents(raw)}`;
  if (amountCents !== raw) {
    formula +=
      raw < table.minCents
        ? `, minimum ${formatCents(table.minCents)} applies`
        : `, capped at ${formatCents(table.maxCents)}`;
  }

  return {
    amountCents,
    trace: {
      formula,
      inputs: { wages: formatCents(wagesCents) },
      rateTable: table.version,
    },
  };
}
