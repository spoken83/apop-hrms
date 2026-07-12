// All engine arithmetic is in integer cents. Rates are in basis points (bp,
// 1bp = 0.01%). Products stay well inside Number.MAX_SAFE_INTEGER.

export type Cents = number;

export function dollars(cents: Cents): number {
  return cents / 100;
}

export function toCents(sgd: number | string): Cents {
  const n = typeof sgd === "string" ? Number(sgd) : sgd;
  return Math.round(n * 100);
}

export function formatCents(cents: Cents): string {
  return (cents / 100).toLocaleString("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
  });
}

// rateBp% of amountCents, exact rational value scaled by 10_000.
// e.g. 3700bp x 300000c -> numerator 1_110_000_000 (= $11,100.00 exact)
function bpNumerator(rateBp: number, amountCents: Cents): number {
  return rateBp * amountCents;
}

// CPF total contribution rounding: nearest dollar, exactly 50 cents rounds UP.
export function bpRoundToDollar(rateBp: number, amountCents: Cents): Cents {
  const numerator = bpNumerator(rateBp, amountCents); // cents x 10_000
  // dollars = numerator / 1_000_000, round half up
  return Math.floor((numerator + 500_000) / 1_000_000) * 100;
}

// CPF employee share rounding: drop the cents (round down to whole dollar).
export function bpFloorToDollar(rateBp: number, amountCents: Cents): Cents {
  return Math.floor(bpNumerator(rateBp, amountCents) / 1_000_000) * 100;
}

// Plain bp product, floored to the cent (used by SDL).
export function bpFloorToCent(rateBp: number, amountCents: Cents): Cents {
  return Math.floor(bpNumerator(rateBp, amountCents) / 10_000);
}
