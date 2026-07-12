// CPF EZPay (FTP) file generator.
//
// Source of truth: "CPF EZPay (FTP) File Specifications (effective from
// 16 January 2025)", cpf.gov.sg (CPFEZPayFTPSpecifications.pdf, Jan 2025).
// Fixed-width 150-byte records. One payment advice per file for our use:
// 1 Employer Header, 1+ Contribution Summary, 0+ Contribution Detail,
// 1 Employer Trailer. Filename: <CSN><MonthPaid><AdviceCode>.DTL
// e.g. 234567891APTE01JAN202201.DTL

const RECORD_LENGTH = 150;

// Note 2 of the spec: no negative amounts, and these characters are
// forbidden anywhere in the file: _+$<>:;?!=[]`^|\"~
const FORBIDDEN_CHARS = /[_+$<>:;?!=\[\]`^|\\"~]/g;

export type EzpayEmployeeRow = {
  /** CPF account no = NRIC, e.g. S1234567A (S/T prefix only) */
  accountNo: string;
  /** Name as on identity card */
  name: string;
  /** Total CPF contribution (employer + employee), cents */
  cpfTotalCents: number;
  owCents: number;
  awCents: number;
  /** E existing, N new joiner, L leaver, O joined and left same month */
  employmentStatus: "E" | "L" | "N" | "O";
  /** SHG deduction for this employee, if any */
  shg?: { fund: "cdac" | "sinda" | "mbmf" | "ecf"; amountCents: number };
};

export type EzpayInput = {
  uen: string;
  paymentType: string; // e.g. PTE
  serialNo: string; // e.g. 01
  adviceCode: string; // 01-99, must differ from previous submission
  periodMonth: string; // YYYY-MM (the month contributions are for)
  fileCreatedAt: Date;
  employees: EzpayEmployeeRow[];
  /** SDL for ALL employees (incl. WP holders), cents. Rides as summary 11. */
  sdlTotalCents: number;
};

const SHG_PAYMENT_CODES = {
  mbmf: "02",
  sinda: "03",
  cdac: "04",
  ecf: "05",
} as const;

function sanitizeText(value: string): string {
  return value.toUpperCase().replace(FORBIDDEN_CHARS, " ");
}

function text(value: string, length: number): string {
  const clean = sanitizeText(value);
  if (clean.length > length) return clean.slice(0, length);
  return clean.padEnd(length, " "); // left justified with spaces
}

function num(value: number, digits: number): string {
  if (value < 0) throw new Error(`EZPay: negative amount not allowed (${value})`);
  const s = Math.round(value).toString();
  if (s.length > digits) {
    throw new Error(`EZPay: value ${value} exceeds ${digits} digits`);
  }
  return s.padStart(digits, "0"); // unused numeric fields zero-padded
}

function assertRecord(line: string, label: string): string {
  if (line.length !== RECORD_LENGTH) {
    throw new Error(
      `EZPay: ${label} record is ${line.length} bytes, expected ${RECORD_LENGTH}`,
    );
  }
  return line;
}

// Columns 3-20 are identical on every record type.
function commonKey(input: EzpayInput): string {
  return (
    text(input.uen, 10) + // 3-12 UEN left justified
    text(input.paymentType, 3) + // 13-15 payment type
    text(input.serialNo, 2) + // 16-17 sno
    " " + // 18 filler
    text(input.adviceCode, 2) // 19-20 advice code
  );
}

function headerRecord(input: EzpayInput): string {
  // Render the creation timestamp in Singapore time regardless of server TZ
  // (containers and Vercel run UTC).
  const d = new Date(input.fileCreatedAt.getTime() + 8 * 3600_000);
  const date =
    `${d.getUTCFullYear()}` +
    `${String(d.getUTCMonth() + 1).padStart(2, "0")}` +
    `${String(d.getUTCDate()).padStart(2, "0")}`;
  const time =
    `${String(d.getUTCHours()).padStart(2, "0")}` +
    `${String(d.getUTCMinutes()).padStart(2, "0")}` +
    `${String(d.getUTCSeconds()).padStart(2, "0")}`;
  const line =
    "F" + // 1 submission mode
    " " + // 2 record type: space = header
    commonKey(input) +
    date + // 21-28 file creation date YYYYMMDD
    time + // 29-34 file creation time HHMMSS
    text("FTP.DTL", 13) + // 35-47 file ID
    " ".repeat(103); // 48-150 fillers
  return assertRecord(line, "header");
}

function summaryRecord(
  input: EzpayInput,
  paymentCode: string,
  amountCents: number,
  donorCount: number,
): string {
  const line =
    "F" +
    "0" + // record type 0 = contribution summary
    commonKey(input) +
    input.periodMonth.replace("-", "") + // 21-26 relevant month YYYYMM
    paymentCode + // 27-28
    num(amountCents, 12) + // 29-40 amount 9(10)V99
    num(donorCount, 7) + // 41-47 donor count (zeros unless SHG/ComChest)
    " ".repeat(103); // 48-150
  return assertRecord(line, `summary ${paymentCode}`);
}

function detailRecord(
  input: EzpayInput,
  paymentCode: string,
  row: EzpayEmployeeRow,
  amountCents: number,
  isShg: boolean,
): string {
  const line =
    "F" +
    "1" + // record type 1 = contribution detail
    commonKey(input) +
    input.periodMonth.replace("-", "") + // 21-26 relevant month
    paymentCode + // 27-28
    text(row.accountNo, 9) + // 29-37 employee account no
    num(amountCents, 12) + // 38-49 contribution amount 9(10)V99
    num(isShg ? 0 : row.owCents, 10) + // 50-59 OW 9(8)V99, zeros for SHG
    num(isShg ? 0 : row.awCents, 10) + // 60-69 AW 9(8)V99, zeros for SHG
    (isShg ? " " : row.employmentStatus) + // 70 status, space for SHG
    text(row.name, 66) + // 71-136 employee name
    " ".repeat(14); // 137-150
  return assertRecord(line, `detail ${paymentCode} ${row.accountNo}`);
}

function trailerRecord(
  input: EzpayInput,
  recordCount: number,
  totalCents: number,
): string {
  const line =
    "F" +
    "9" + // record type 9 = trailer
    commonKey(input) +
    num(recordCount, 7) + // 21-27 total records incl. header + trailer
    num(totalCents, 15) + // 28-42 sum of summary amounts 9(13)V99
    " ".repeat(108); // 43-150
  return assertRecord(line, "trailer");
}

export type EzpayFile = {
  filename: string;
  content: string; // CRLF-terminated 150-byte records
  totalCents: number;
  recordCount: number;
};

export function generateEzpayFile(input: EzpayInput): EzpayFile {
  for (const e of input.employees) {
    if (e.cpfTotalCents < 0 || e.owCents < 0 || e.awCents < 0 || (e.shg?.amountCents ?? 0) < 0) {
      throw new Error(`EZPay: negative amount not allowed for ${e.accountNo}`);
    }
  }
  if (input.sdlTotalCents < 0) {
    throw new Error("EZPay: negative SDL total not allowed");
  }

  const records: string[] = [];
  records.push(headerRecord(input));

  // CPF contribution: summary 01 + one detail per employee with CPF > 0.
  const cpfRows = input.employees.filter((e) => e.cpfTotalCents > 0);
  const cpfTotal = cpfRows.reduce((sum, e) => sum + e.cpfTotalCents, 0);
  const summaries: { code: string; amount: number; donors: number }[] = [
    { code: "01", amount: cpfTotal, donors: 0 },
  ];

  // SHG funds: summary + detail per donor, ordered by payment code.
  const shgByFund = new Map<string, EzpayEmployeeRow[]>();
  for (const row of input.employees) {
    if (row.shg && row.shg.amountCents > 0) {
      const list = shgByFund.get(row.shg.fund) ?? [];
      list.push(row);
      shgByFund.set(row.shg.fund, list);
    }
  }
  for (const [fund, code] of Object.entries(SHG_PAYMENT_CODES)) {
    const rows = shgByFund.get(fund);
    if (!rows) continue;
    summaries.push({
      code,
      amount: rows.reduce((s, r) => s + (r.shg?.amountCents ?? 0), 0),
      donors: rows.length,
    });
  }

  // SDL rides in the same submission as summary code 11 (no details).
  if (input.sdlTotalCents > 0) {
    summaries.push({ code: "11", amount: input.sdlTotalCents, donors: 0 });
  }

  summaries.sort((a, b) => a.code.localeCompare(b.code));
  for (const s of summaries) {
    records.push(summaryRecord(input, s.code, s.amount, s.donors));
  }

  // Details: CPF first, then SHG per fund, grouped like the spec sample.
  for (const row of cpfRows) {
    records.push(detailRecord(input, "01", row, row.cpfTotalCents, false));
  }
  for (const [fund, code] of Object.entries(SHG_PAYMENT_CODES)) {
    for (const row of shgByFund.get(fund) ?? []) {
      records.push(detailRecord(input, code, row, row.shg!.amountCents, true));
    }
  }

  const totalCents = summaries.reduce((s, x) => s + x.amount, 0);
  const recordCount = records.length + 1; // + trailer
  records.push(trailerRecord(input, recordCount, totalCents));

  const monthPaid = new Date(`${input.periodMonth}-01T00:00:00`)
    .toLocaleDateString("en-SG", { month: "short", year: "numeric" })
    .toUpperCase()
    .replace(" ", "");
  const csn = `${input.uen}${input.paymentType}${input.serialNo}`;
  const filename = `${csn}${monthPaid}${input.adviceCode}.DTL`;

  return {
    filename,
    content: records.join("\r\n") + "\r\n",
    totalCents,
    recordCount,
  };
}

// Structural validator: run over every generated file before download.
export function validateEzpayFile(file: EzpayFile): string[] {
  const problems: string[] = [];
  const lines = file.content.split("\r\n").filter((l) => l.length > 0);

  lines.forEach((line, i) => {
    if (line.length !== RECORD_LENGTH) {
      problems.push(`Record ${i + 1}: length ${line.length} ≠ 150`);
    }
    const match = line.match(FORBIDDEN_CHARS);
    if (match) {
      problems.push(`Record ${i + 1}: forbidden character "${match[0]}"`);
    }
    if (line[0] !== "F") problems.push(`Record ${i + 1}: submission mode ≠ F`);
  });

  if (lines[0]?.[1] !== " ") problems.push("First record is not a header");
  if (lines[lines.length - 1]?.[1] !== "9") {
    problems.push("Last record is not a trailer");
  }

  const trailer = lines[lines.length - 1];
  if (trailer) {
    const declaredCount = Number(trailer.slice(20, 27));
    if (declaredCount !== lines.length) {
      problems.push(
        `Trailer record count ${declaredCount} ≠ actual ${lines.length}`,
      );
    }
    const declaredTotal = Number(trailer.slice(27, 42));
    const summaryTotal = lines
      .filter((l) => l[1] === "0")
      .reduce((s, l) => s + Number(l.slice(28, 40)), 0);
    if (declaredTotal !== summaryTotal) {
      problems.push(
        `Trailer total ${declaredTotal} ≠ sum of summaries ${summaryTotal}`,
      );
    }
  }

  return problems;
}
