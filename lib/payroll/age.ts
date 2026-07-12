import type { CpfAgeBandRates, CpfRateTable } from "./rate-tables";

// CPF age band transition rule: new rates apply from the first day of the
// month AFTER the 55th/60th/65th/70th birthday, not the birthday itself.
// So the band is decided by whether the pay month is strictly after the
// month of the threshold birthday. Day of month is irrelevant.
export function cpfAgeBand(
  table: CpfRateTable,
  dob: string, // YYYY-MM-DD
  payMonth: string, // YYYY-MM
): CpfAgeBandRates {
  const [dobYear, dobMonth] = dob.split("-").map(Number);
  const [payYear, payMonthNum] = payMonth.split("-").map(Number);

  for (const band of table.ageBands) {
    if (band.upperAge === null) return band;
    const thresholdYear = dobYear + band.upperAge;
    const payAfterThresholdMonth =
      payYear > thresholdYear ||
      (payYear === thresholdYear && payMonthNum > dobMonth);
    if (!payAfterThresholdMonth) return band;
  }
  return table.ageBands[table.ageBands.length - 1];
}
