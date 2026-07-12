import { describe, expect, it } from "vitest";
import { computeSdl } from "@/lib/payroll/sdl";
import { computeShg } from "@/lib/payroll/shg";
import {
  SDL_TABLES,
  SHG_TABLES,
  resolveTable,
} from "@/lib/payroll/rate-tables";

const sdlTable = resolveTable(SDL_TABLES, "2026-07");
const shgTable = resolveTable(SHG_TABLES, "2026-07");

describe("SDL (0.25%, min $2, cap $11.25 — applies to ALL employees)", () => {
  it("minimum $2 for low wages", () => {
    expect(computeSdl(500_00, sdlTable).amountCents).toBe(2_00);
  });

  it("exactly $2 at $800", () => {
    expect(computeSdl(800_00, sdlTable).amountCents).toBe(2_00);
  });

  it("0.25% in the middle band", () => {
    expect(computeSdl(3000_00, sdlTable).amountCents).toBe(7_50);
  });

  it("capped at $11.25 from $4,500", () => {
    expect(computeSdl(4500_00, sdlTable).amountCents).toBe(11_25);
    expect(computeSdl(12_000_00, sdlTable).amountCents).toBe(11_25);
  });

  it("zero wages → zero SDL", () => {
    expect(computeSdl(0, sdlTable).amountCents).toBe(0);
  });
});

describe("SHG fund tiers", () => {
  it("CDAC at $3,000 wages: $1.00", () => {
    expect(computeShg("cdac", 3000_00, false, shgTable).amountCents).toBe(1_00);
  });

  it("CDAC boundary: $2,000 is still $0.50 tier", () => {
    expect(computeShg("cdac", 2000_00, false, shgTable).amountCents).toBe(50);
  });

  it("SINDA at $3,000: $7.00", () => {
    expect(computeShg("sinda", 3000_00, false, shgTable).amountCents).toBe(7_00);
  });

  it("MBMF at $3,000 (boundary of $2,001–$3,000 tier): $6.50", () => {
    expect(computeShg("mbmf", 3000_00, false, shgTable).amountCents).toBe(6_50);
  });

  it("MBMF top tier above $10,000: $26.00", () => {
    expect(computeShg("mbmf", 12_000_00, false, shgTable).amountCents).toBe(26_00);
  });

  it("ECF at $3,000: $9.00", () => {
    expect(computeShg("ecf", 3000_00, false, shgTable).amountCents).toBe(9_00);
  });

  it("opt-out zeroes the deduction", () => {
    const r = computeShg("cdac", 3000_00, true, shgTable);
    expect(r.amountCents).toBe(0);
    expect(r.optedOut).toBe(true);
  });

  it("zero wages → no deduction", () => {
    expect(computeShg("sinda", 0, false, shgTable).amountCents).toBe(0);
  });
});

describe("rate table resolution", () => {
  it("throws when no table is in force", () => {
    expect(() => resolveTable(SDL_TABLES, "2020-01")).toThrow(/No rate table/);
  });
});
