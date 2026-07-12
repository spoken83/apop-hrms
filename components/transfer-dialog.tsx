"use client";

import { useActionState, useState } from "react";
import { transferEmployee, type FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { id: string; name: string };

export function TransferDialog({
  employeeId,
  employeeName,
  currentEntityName,
  targetEntities,
}: {
  employeeId: string;
  employeeName: string;
  currentEntityName: string;
  targetEntities: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    transferEmployee.bind(null, employeeId),
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Transfer employee</Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Transfer {employeeName}</DialogTitle>
            <DialogDescription>
              This ends the current employment at {currentEntityName} on the
              day before the transfer date and starts a new employment at the
              target entity with the same terms. This is a new employment for
              CPF and IR8A purposes and cannot be undone from this screen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="targetEntityId">Transfer to</Label>
            <select
              id="targetEntityId"
              name="targetEntityId"
              className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50 outline-none"
              required
            >
              <option value="">Select entity…</option>
              {targetEntities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transferDate">
              Transfer date (first day at the new entity)
            </Label>
            <Input id="transferDate" name="transferDate" type="date" required />
          </div>

          {state.errors?.form ? (
            <p className="text-sm text-destructive">{state.errors.form}</p>
          ) : null}
          {state.message === "Transfer completed" ? (
            <p className="text-sm text-success">Transfer completed.</p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Transferring…" : "Confirm transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
