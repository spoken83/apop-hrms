import { describe, expect, it } from "vitest";
import {
  generateEzpayFile,
  validateEzpayFile,
  type EzpayInput,
} from "@/lib/ezpay";

// Employees from the sample file layout on page 7 of the official spec
// (CPF EZPay FTP File Specifications, effective 16 Jan 2025).
const sampleInput: EzpayInput = {
  uen: "234567891A",
  paymentType: "PTE",
  serialNo: "01",
  adviceCode: "04",
  periodMonth: "2018-01",
  // 18:33:15 SGT = 10:33:15 UTC
  fileCreatedAt: new Date(Date.UTC(2018, 0, 29, 10, 33, 15)),
  sdlTotalCents: 0,
  employees: [
    {
      accountNo: "S1122334A",
      name: "MICKEY TAN AH TAN",
      cpfTotalCents: 1110_00,
      owCents: 3000_00,
      awCents: 0,
      employmentStatus: "L",
      shg: { fund: "cdac", amountCents: 1_00 },
    },
    {
      accountNo: "S2122334B",
      name: "JACKIE JACK",
      cpfTotalCents: 1110_00,
      owCents: 3000_00,
      awCents: 0,
      employmentStatus: "N",
      shg: { fund: "ecf", amountCents: 9_00 },
    },
    {
      accountNo: "S3122334C",
      name: "RAVIDAVI SINGH S/O RAVIDAVI SINGH",
      cpfTotalCents: 1480_00,
      owCents: 4000_00,
      awCents: 0,
      employmentStatus: "E",
      shg: { fund: "sinda", amountCents: 7_00 },
    },
    {
      accountNo: "S4122334D",
      name: "MUHAMMED ALI BIN MUHAMMED ALI",
      cpfTotalCents: 1480_00,
      owCents: 4000_00,
      awCents: 0,
      employmentStatus: "E",
      shg: { fund: "mbmf", amountCents: 19_50 },
    },
  ],
};

function lines(content: string): string[] {
  return content.split("\r\n").filter((l) => l.length > 0);
}

describe("EZPay file structure", () => {
  const file = generateEzpayFile(sampleInput);
  const recs = lines(file.content);

  it("every record is exactly 150 bytes", () => {
    for (const r of recs) expect(r.length).toBe(150);
  });

  it("filename follows <CSN><MonthPaid><AdviceCode>.DTL", () => {
    expect(file.filename).toBe("234567891APTE01JAN201804.DTL");
  });

  it("header lays out per spec columns", () => {
    const h = recs[0];
    expect(h[0]).toBe("F"); // submission mode
    expect(h[1]).toBe(" "); // record type: header
    expect(h.slice(2, 12)).toBe("234567891A"); // UEN
    expect(h.slice(12, 15)).toBe("PTE");
    expect(h.slice(15, 17)).toBe("01");
    expect(h[17]).toBe(" ");
    expect(h.slice(18, 20)).toBe("04"); // advice code
    expect(h.slice(20, 28)).toBe("20180129"); // creation date
    expect(h.slice(28, 34)).toBe("183315"); // creation time
    expect(h.slice(34, 47)).toBe("FTP.DTL      "); // file ID X(13)
    expect(h.slice(47)).toBe(" ".repeat(103));
  });

  it("CPF summary (code 01) totals $5,180.00", () => {
    const s = recs.find((r) => r[1] === "0" && r.slice(26, 28) === "01")!;
    expect(s.slice(20, 26)).toBe("201801"); // relevant month
    expect(s.slice(28, 40)).toBe("000000518000"); // 9(10)V99
    expect(s.slice(40, 47)).toBe("0000000"); // donor count zero for CPF
  });

  it("SHG summaries carry donor counts", () => {
    const mbmf = recs.find((r) => r[1] === "0" && r.slice(26, 28) === "02")!;
    expect(mbmf.slice(28, 40)).toBe("000000001950"); // $19.50
    expect(mbmf.slice(40, 47)).toBe("0000001");
    const cdac = recs.find((r) => r[1] === "0" && r.slice(26, 28) === "04")!;
    expect(cdac.slice(28, 40)).toBe("000000000100"); // $1.00
  });

  it("CPF detail record matches the sample byte layout", () => {
    const d = recs.find(
      (r) => r[1] === "1" && r.slice(28, 37) === "S1122334A" && r.slice(26, 28) === "01",
    )!;
    expect(d.slice(0, 2)).toBe("F1");
    expect(d.slice(20, 26)).toBe("201801");
    expect(d.slice(37, 49)).toBe("000000111000"); // $1,110.00 total CPF
    expect(d.slice(49, 59)).toBe("0000300000"); // OW $3,000.00 9(8)V99
    expect(d.slice(59, 69)).toBe("0000000000"); // AW zero
    expect(d[69]).toBe("L"); // leaver
    expect(d.slice(70, 136)).toBe("MICKEY TAN AH TAN".padEnd(66, " "));
    expect(d.slice(136)).toBe(" ".repeat(14));
  });

  it("SHG detail records zero the wage fields and blank the status", () => {
    const d = recs.find(
      (r) => r[1] === "1" && r.slice(26, 28) === "04", // CDAC
    )!;
    expect(d.slice(28, 37)).toBe("S1122334A");
    expect(d.slice(37, 49)).toBe("000000000100");
    expect(d.slice(49, 59)).toBe("0000000000");
    expect(d.slice(59, 69)).toBe("0000000000");
    expect(d[69]).toBe(" ");
  });

  it("trailer counts all records and sums all summaries", () => {
    const t = recs[recs.length - 1];
    expect(t.slice(0, 2)).toBe("F9");
    // header + 5 summaries (01,02,03,04,05) + 8 details + trailer = 15
    expect(t.slice(20, 27)).toBe("0000015");
    // 5,180 + 19.50 + 7 + 1 + 9 = 5,216.50
    expect(t.slice(27, 42)).toBe("000000000521650");
    expect(file.totalCents).toBe(521650);
  });

  it("passes its own validator", () => {
    expect(validateEzpayFile(file)).toEqual([]);
  });
});

describe("EZPay guards", () => {
  it("includes SDL as summary code 11 with no detail records", () => {
    const file = generateEzpayFile({ ...sampleInput, sdlTotalCents: 45_75 });
    const recs = lines(file.content);
    const sdl = recs.find((r) => r[1] === "0" && r.slice(26, 28) === "11")!;
    expect(sdl.slice(28, 40)).toBe("000000004575");
    expect(recs.filter((r) => r[1] === "1" && r.slice(26, 28) === "11")).toHaveLength(0);
    expect(validateEzpayFile(file)).toEqual([]);
  });

  it("sanitizes forbidden characters in names", () => {
    const file = generateEzpayFile({
      ...sampleInput,
      employees: [
        { ...sampleInput.employees[0], name: "TAN_AH+TAN [TEST]" },
      ],
    });
    expect(validateEzpayFile(file)).toEqual([]);
    expect(file.content).not.toMatch(/[_+\[\]]/);
  });

  it("rejects negative amounts", () => {
    expect(() =>
      generateEzpayFile({
        ...sampleInput,
        employees: [{ ...sampleInput.employees[0], cpfTotalCents: -1 }],
      }),
    ).toThrow(/negative/);
  });

  it("skips zero-CPF employees in details but keeps SDL-only files valid", () => {
    const file = generateEzpayFile({
      ...sampleInput,
      employees: [
        {
          accountNo: "S1122334A",
          name: "WP HOLDER PROXY", // e.g. all-foreign month: CPF empty
          cpfTotalCents: 0,
          owCents: 2000_00,
          awCents: 0,
          employmentStatus: "E",
        },
      ],
      sdlTotalCents: 5_00,
    });
    const recs = lines(file.content);
    expect(recs.filter((r) => r[1] === "1")).toHaveLength(0);
    expect(validateEzpayFile(file)).toEqual([]);
  });
});
