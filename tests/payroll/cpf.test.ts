import { describe, expect, it } from "vitest";
import { computeCpf, type CpfInput } from "@/lib/payroll/cpf";
import { CPF_TABLES, resolveTable } from "@/lib/payroll/rate-tables";

// Expected values computed by hand from the CPF Board formulas (rates
// effective 1 Jan 2026). Validation protocol: every case must ALSO be
// cross-checked against the CPF Board online contribution calculator
// before go-live (build plan §11.1).

const table = resolveTable(CPF_TABLES, "2026-07");

function run(input: Partial<CpfInput> & { owCents: number }) {
  return computeCpf(
    {
      dob: "1990-06-15",
      payMonth: "2026-07",
      residencyStatus: "citizen",
      ...input,
    },
    table,
  );
}

describe("CPF full rates by age band (OW $4,000)", () => {
  const ow = 4000_00;

  it("age 55 and below: 37% total, EE 20%", () => {
    const r = run({ owCents: ow, dob: "1990-06-15" });
    expect(r.totalCents).toBe(1480_00);
    expect(r.employeeCents).toBe(800_00);
    expect(r.employerCents).toBe(680_00);
    expect(r.ageBandId).toBe("le55");
  });

  it("above 55 to 60: 34% total, EE 18%", () => {
    const r = run({ owCents: ow, dob: "1970-01-15" }); // 56 in Jul 2026
    expect(r.totalCents).toBe(1360_00);
    expect(r.employeeCents).toBe(720_00);
    expect(r.employerCents).toBe(640_00);
    expect(r.ageBandId).toBe("a55to60");
  });

  it("above 60 to 65: 25% total, EE 12.5%", () => {
    const r = run({ owCents: ow, dob: "1964-01-15" }); // 62
    expect(r.totalCents).toBe(1000_00);
    expect(r.employeeCents).toBe(500_00);
    expect(r.employerCents).toBe(500_00);
  });

  it("above 65 to 70: 16.5% total, EE 7.5%", () => {
    const r = run({ owCents: ow, dob: "1959-01-15" }); // 67
    expect(r.totalCents).toBe(660_00);
    expect(r.employeeCents).toBe(300_00);
    expect(r.employerCents).toBe(360_00);
  });

  it("above 70: 12.5% total, EE 5%", () => {
    const r = run({ owCents: ow, dob: "1954-01-15" }); // 72
    expect(r.totalCents).toBe(500_00);
    expect(r.employeeCents).toBe(200_00);
    expect(r.employerCents).toBe(300_00);
  });
});

describe("rounding rules", () => {
  it("total rounds to nearest dollar, EE drops cents, ER = total − EE", () => {
    // OW $3,456.78: total 37% = $1,279.0086 → $1,279; EE 20% = $691.356 → $691
    const r = run({ owCents: 3456_78 });
    expect(r.totalCents).toBe(1279_00);
    expect(r.employeeCents).toBe(691_00);
    expect(r.employerCents).toBe(588_00);
  });

  it("exactly 50 cents rounds up", () => {
    // OW $750: 37% = $277.50 → $278
    const r = run({ owCents: 750_00 });
    expect(r.totalCents).toBe(278_00);
    expect(r.employeeCents).toBe(150_00);
    expect(r.employerCents).toBe(128_00);
  });
});

describe("age band transition month", () => {
  // 55th birthday 15 Mar 2026: old rates through March, new from 1 April.
  const dob = "1971-03-15";

  it("birthday month keeps 55-and-below rates", () => {
    const r = run({ owCents: 4000_00, dob, payMonth: "2026-03" });
    expect(r.ageBandId).toBe("le55");
    expect(r.totalCents).toBe(1480_00);
  });

  it("month after birthday moves to above-55 rates", () => {
    const r = run({ owCents: 4000_00, dob, payMonth: "2026-04" });
    expect(r.ageBandId).toBe("a55to60");
    expect(r.totalCents).toBe(1360_00);
  });
});

describe("wage bands (part-timers)", () => {
  it("TW $40 (≤ $50): no CPF", () => {
    const r = run({ owCents: 40_00 });
    expect(r.totalCents).toBe(0);
    expect(r.employeeCents).toBe(0);
  });

  it("TW $300 ($50–$500): employer share only", () => {
    // ER 17% × 300 = $51
    const r = run({ owCents: 300_00 });
    expect(r.totalCents).toBe(51_00);
    expect(r.employeeCents).toBe(0);
    expect(r.employerCents).toBe(51_00);
  });

  it("TW $600 ($500–$750): ER full + phased EE", () => {
    // total = 17%×600 + 0.6×(600−500) = 102 + 60 = $162; EE = $60
    const r = run({ owCents: 600_00 });
    expect(r.totalCents).toBe(162_00);
    expect(r.employeeCents).toBe(60_00);
    expect(r.employerCents).toBe(102_00);
  });

  it("TW $749 (just under full rates)", () => {
    // total = 127.33 + 149.4 = 276.73 → $277; EE = floor(149.4) = $149
    const r = run({ owCents: 749_00 });
    expect(r.totalCents).toBe(277_00);
    expect(r.employeeCents).toBe(149_00);
    expect(r.employerCents).toBe(128_00);
  });

  it("phased band for above-55 worker uses 0.54 factor", () => {
    // 56yo, TW $600: total = 16%×600 + 0.54×100 = 96 + 54 = $150; EE $54
    const r = run({ owCents: 600_00, dob: "1970-01-15" });
    expect(r.totalCents).toBe(150_00);
    expect(r.employeeCents).toBe(54_00);
  });
});

describe("OW ceiling ($8,000 from 1 Jan 2026)", () => {
  it("caps OW at $8,000", () => {
    const r = run({ owCents: 8500_00 });
    expect(r.owSubjectCents).toBe(8000_00);
    expect(r.totalCents).toBe(2960_00);
    expect(r.employeeCents).toBe(1600_00);
    expect(r.employerCents).toBe(1360_00);
  });

  it("OW exactly at ceiling", () => {
    const r = run({ owCents: 8000_00 });
    expect(r.owSubjectCents).toBe(8000_00);
    expect(r.totalCents).toBe(2960_00);
  });
});

describe("AW ceiling ($102,000 − OW subject for the year)", () => {
  it("bonus fully within remaining ceiling", () => {
    // YTD OW 18,000 + this month 3,000 → ceiling 81,000; AW 1,000 all subject
    const r = run({
      owCents: 3000_00,
      awCents: 1000_00,
      ytdOwSubjectCents: 18_000_00,
    });
    expect(r.awSubjectCents).toBe(1000_00);
    // TW 4,000 → 1,480 / 800 / 680
    expect(r.totalCents).toBe(1480_00);
    expect(r.employeeCents).toBe(800_00);
  });

  it("bonus partially above ceiling (December true-up shape)", () => {
    // 11 months of $8,000 OW = 88,000; December OW 8,000 → 96,000 subject.
    // Ceiling remaining = 102,000 − 96,000 = 6,000. AW 10,000 → 6,000 subject.
    const r = run({
      owCents: 8000_00,
      awCents: 10_000_00,
      ytdOwSubjectCents: 88_000_00,
      payMonth: "2026-12",
    });
    expect(r.awCeilingRemainingCents).toBe(6000_00);
    expect(r.awSubjectCents).toBe(6000_00);
    // TW 14,000 × 37% = 5,180; EE 2,800; ER 2,380
    expect(r.totalCents).toBe(5180_00);
    expect(r.employeeCents).toBe(2800_00);
    expect(r.employerCents).toBe(2380_00);
  });

  it("ceiling exhausted by prior AW: bonus attracts no CPF", () => {
    const r = run({
      owCents: 8000_00,
      awCents: 5000_00,
      ytdOwSubjectCents: 88_000_00,
      ytdAwSubjectCents: 6000_00,
      payMonth: "2026-12",
    });
    expect(r.awSubjectCents).toBe(0);
    expect(r.totalCents).toBe(2960_00); // OW only
  });
});

describe("mid-month joiner", () => {
  it("CPF on actual (prorated) wages paid in the month", () => {
    // Joined mid-month, paid $1,500 of a $3,000 salary
    const r = run({ owCents: 1500_00 });
    expect(r.totalCents).toBe(555_00);
    expect(r.employeeCents).toBe(300_00);
    expect(r.employerCents).toBe(255_00);
  });
});

describe("residency", () => {
  it.each(["wp", "spass", "ep"] as const)(
    "%s holder: zero CPF",
    (status) => {
      const r = run({ owCents: 3000_00, residencyStatus: status });
      expect(r.applicable).toBe(false);
      expect(r.totalCents).toBe(0);
      expect(r.employeeCents).toBe(0);
      expect(r.employerCents).toBe(0);
    },
  );

  it("PR (3rd year+) uses full rates in v1", () => {
    const r = run({ owCents: 3000_00, residencyStatus: "pr" });
    expect(r.totalCents).toBe(1110_00);
    expect(r.employeeCents).toBe(600_00);
  });

  it("PR graduated profile is an explicit not-implemented error", () => {
    expect(() =>
      run({ owCents: 3000_00, residencyStatus: "pr", residencyProfile: "pr_year1" }),
    ).toThrow(/not implemented/);
  });
});

describe("CPF annual limit ($37,740)", () => {
  it("caps the month's total at the remaining limit", () => {
    const r = run({
      owCents: 3000_00,
      ytdContributionsCents: 37_000_00,
    });
    expect(r.totalCents).toBe(740_00);
  });

  it("full-ceiling year lands exactly on the annual limit", () => {
    // 12 × (8,000 OW × 37% = 2,960) = 35,520; plus AW headroom 6,000 × 37%
    // = 2,220 → 37,740 exactly. The limit should never bind for mandatory
    // wages when the OW/AW ceilings are applied correctly.
    const monthly = 2960_00;
    const awMonth = 5180_00; // Dec: 8,000 OW + 6,000 AW subject
    expect(11 * monthly + awMonth).toBe(table.annualLimit);
  });
});

describe("calculation trace", () => {
  it("returns formula, inputs and rate table version", () => {
    const r = run({ owCents: 3200_00 });
    expect(r.trace.rateTable).toBe("cpf-2026-01");
    expect(r.trace.formula).toContain("37%");
    expect(r.trace.inputs.ageBand).toBe("55 and below");
  });
});
