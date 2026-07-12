// Dates are never ambiguous: DD MMM YYYY everywhere (UI/UX spec §6.8).
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-SG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// SGD amounts always two decimals.
export function formatSGD(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-SG", {
    style: "currency",
    currency: "SGD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function maskIdNumber(idNumber: string): string {
  if (idNumber.length < 4) return idNumber;
  return `${idNumber[0]}••••${idNumber.slice(-4)}`;
}
