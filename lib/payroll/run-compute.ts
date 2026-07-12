import { computeCpf, type CalcTrace, type ResidencyStatus } from "./cpf";
import { computeSdl } from "./sdl";
import { computeShg } from "./shg";
import { formatCents, type Cents } from "./money";
import type {
  CpfRateTable,
  SdlRateTable,
  ShgFund,
  ShgRateTable,
} from "./rate-tables";

export type ComputedLine = {
  lineType:
    | "basic"
    | "allowance"
    | "bonus"
    | "deduction"
    | "cpf_ee"
    | "cpf_er"
    | "sdl"
    | "shg_cdac"
    | "shg_sinda"
    | "shg_mbmf"
    | "shg_ecf"
    | "net_pay";
  label: string;
  amountCents: Cents;
  trace?: CalcTrace;
};

export type PayslipComputation = {
  owCents: Cents;
  awCents: Cents;
  owSubjectCents: Cents;
  awSubjectCents: Cents;
  grossCents: Cents;
  cpfEmployeeCents: Cents;
  cpfEmployerCents: Cents;
  sdlCents: Cents;
  shgFund: ShgFund | null;
  shgCents: Cents;
  netCents: Cents;
  ezpayStatus: "E" | "L" | "N" | "O";
  lines: ComputedLine[];
};

const RACE_TO_FUND: Record<string, ShgFund> = {
  chinese: "cdac",
  indian: "sinda",
  malay: "mbmf",
  eurasian: "ecf",
};

export type ComputePayslipInput = {
  periodMonth: string; // YYYY-MM
  employment: {
    startDate: string;
    endDate: string | null;
    baseSalaryCents: Cents;
  };
  employee: {
    dob: string;
    residencyStatus: ResidencyStatus;
    race: string | null;
    shgOptOut: Record<string, boolean>;
  };
  adjustments: { kind: "allowance" | "bonus" | "deduction"; amountCents: Cents; reason: string }[];
  ytd: {
    owSubjectCents: Cents;
    awSubjectCents: Cents;
    contributionsCents: Cents;
  };
  tables: { cpf: CpfRateTable; sdl: SdlRateTable; shg: ShgRateTable };
};

function monthBounds(periodMonth: string): { start: string; end: string; days: number } {
  const [y, m] = periodMonth.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return {
    start: `${periodMonth}-01`,
    end: `${periodMonth}-${String(days).padStart(2, "0")}`,
    days,
  };
}

export function computePayslip(input: ComputePayslipInput): PayslipComputation {
  const { periodMonth, employment, employee, adjustments, ytd, tables } = input;
  const month = monthBounds(periodMonth);
  const lines: ComputedLine[] = [];

  // Proration for joiners/leavers: calendar-day basis. Documented assumption
  // for v1; the trace makes the basis explicit on every prorated payslip.
  const joinedInMonth = employment.startDate > month.start;
  const leftInMonth =
    employment.endDate !== null && employment.endDate < month.end;
  const firstDay = joinedInMonth ? Number(employment.startDate.slice(8)) : 1;
  const lastDay = leftInMonth
    ? Number(employment.endDate!.slice(8))
    : month.days;
  const daysEmployed = Math.max(0, lastDay - firstDay + 1);

  let basicCents = employment.baseSalaryCents;
  let basicTrace: CalcTrace | undefined;
  if (daysEmployed < month.days) {
    basicCents = Math.round(
      (employment.baseSalaryCents * daysEmployed) / month.days,
    );
    basicTrace = {
      formula: `${formatCents(employment.baseSalaryCents)} × ${daysEmployed}/${month.days} calendar days = ${formatCents(basicCents)}`,
      inputs: { daysEmployed, daysInMonth: month.days },
      rateTable: "proration-calendar-days",
    };
  }
  lines.push({
    lineType: "basic",
    label: "Basic salary",
    amountCents: basicCents,
    trace: basicTrace,
  });

  let allowanceCents = 0;
  let bonusCents = 0;
  let deductionCents = 0;
  for (const adj of adjustments) {
    if (adj.kind === "allowance") {
      allowanceCents += adj.amountCents;
      lines.push({ lineType: "allowance", label: adj.reason, amountCents: adj.amountCents });
    } else if (adj.kind === "bonus") {
      bonusCents += adj.amountCents;
      lines.push({ lineType: "bonus", label: `${adj.reason} (AW)`, amountCents: adj.amountCents });
    } else {
      deductionCents += adj.amountCents;
      lines.push({ lineType: "deduction", label: adj.reason, amountCents: -adj.amountCents });
    }
  }

  const owCents = basicCents + allowanceCents;
  const awCents = bonusCents;
  const grossCents = owCents + awCents;

  const cpf = computeCpf(
    {
      dob: employee.dob,
      payMonth: periodMonth,
      residencyStatus: employee.residencyStatus,
      owCents,
      awCents,
      ytdOwSubjectCents: ytd.owSubjectCents,
      ytdAwSubjectCents: ytd.awSubjectCents,
      ytdContributionsCents: ytd.contributionsCents,
    },
    tables.cpf,
  );
  if (cpf.applicable) {
    lines.push({
      lineType: "cpf_ee",
      label: "CPF (employee)",
      amountCents: -cpf.employeeCents,
      trace: cpf.trace,
    });
    lines.push({
      lineType: "cpf_er",
      label: "CPF (employer)",
      amountCents: cpf.employerCents,
      trace: cpf.trace,
    });
  }

  const sdl = computeSdl(grossCents, tables.sdl);
  lines.push({
    lineType: "sdl",
    label: "SDL (employer)",
    amountCents: sdl.amountCents,
    trace: sdl.trace,
  });

  // SHG: citizens/PRs by race; opt-out per fund. (MBMF for Muslim foreign
  // workers is an open verify item — out of scope for the engine in v1.)
  let shgFund: ShgFund | null = null;
  let shgCents = 0;
  const isLocal =
    employee.residencyStatus === "citizen" || employee.residencyStatus === "pr";
  if (isLocal && employee.race && RACE_TO_FUND[employee.race]) {
    const fund = RACE_TO_FUND[employee.race];
    const optedOut = employee.shgOptOut?.[fund] === true;
    const shg = computeShg(fund, grossCents, optedOut, tables.shg);
    if (shg.amountCents > 0) {
      shgFund = fund;
      shgCents = shg.amountCents;
      lines.push({
        lineType: `shg_${fund}` as ComputedLine["lineType"],
        label: `${fund.toUpperCase()} contribution`,
        amountCents: -shg.amountCents,
        trace: shg.trace,
      });
    }
  }

  const netCents =
    grossCents - cpf.employeeCents - shgCents - deductionCents;
  lines.push({
    lineType: "net_pay",
    label: "Net pay",
    amountCents: netCents,
    trace: {
      formula: `Gross ${formatCents(grossCents)} − CPF EE ${formatCents(cpf.employeeCents)} − SHG ${formatCents(shgCents)}${deductionCents ? ` − deductions ${formatCents(deductionCents)}` : ""} = ${formatCents(netCents)}`,
      inputs: {},
      rateTable: "n/a",
    },
  });

  const ezpayStatus: PayslipComputation["ezpayStatus"] =
    joinedInMonth && leftInMonth
      ? "O"
      : joinedInMonth
        ? "N"
        : leftInMonth
          ? "L"
          : "E";

  return {
    owCents,
    awCents,
    owSubjectCents: cpf.owSubjectCents,
    awSubjectCents: cpf.awSubjectCents,
    grossCents,
    cpfEmployeeCents: cpf.employeeCents,
    cpfEmployerCents: cpf.employerCents,
    sdlCents: sdl.amountCents,
    shgFund,
    shgCents,
    netCents,
    ezpayStatus,
    lines,
  };
}
