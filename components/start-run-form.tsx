"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { startPayrollRun } from "@/lib/actions-payroll";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StartRunForm({
  entityId,
  defaultMonth,
}: {
  entityId: string;
  defaultMonth: string;
}) {
  const [isPending, startTransition] = useTransition();
  useRouter(); // keep router mounted for the redirect from the server action

  return (
    <form
      action={(formData) => {
        const month = String(formData.get("periodMonth"));
        startTransition(() => startPayrollRun(entityId, month));
      }}
      className="flex items-end gap-2"
    >
      <div className="space-y-1.5">
        <Label htmlFor="periodMonth">Period</Label>
        <Input
          id="periodMonth"
          name="periodMonth"
          type="month"
          defaultValue={defaultMonth}
          required
        />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Computing…" : "Run payroll"}
      </Button>
    </form>
  );
}
