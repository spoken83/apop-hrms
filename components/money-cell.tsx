"use client";

import { formatCents } from "@/lib/payroll/money";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Trace = {
  formula: string;
  inputs: Record<string, string | number>;
  rateTable: string;
};

// The signature element (UI spec §3): every computed amount is clickable and
// expands to the exact formula with real inputs and the rate table version.
export function MoneyCell({
  amountCents,
  trace,
  className,
}: {
  amountCents: number;
  trace?: Trace | null;
  className?: string;
}) {
  const formatted = formatCents(amountCents);

  if (!trace) {
    return (
      <span className={cn("font-mono tabular-nums", className)}>{formatted}</span>
    );
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "cursor-pointer rounded font-mono tabular-nums underline decoration-dotted underline-offset-2 hover:bg-accent",
          className,
        )}
      >
        {formatted}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-2 text-sm">
        <p className="font-medium">Calculation</p>
        <p className="font-mono text-xs leading-relaxed">{trace.formula}</p>
        {Object.keys(trace.inputs).length > 0 ? (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            {Object.entries(trace.inputs).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono">{String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Rate table: <span className="font-mono">{trace.rateTable}</span>
        </p>
      </PopoverContent>
    </Popover>
  );
}
