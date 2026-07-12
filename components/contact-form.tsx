"use client";

import { useActionState } from "react";
import { updateEmployeeContact, type FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ContactForm({
  employeeId,
  defaults,
}: {
  employeeId: string;
  defaults: {
    email: string | null;
    mobile: string | null;
    bankName: string | null;
    bankAccountNo: string | null;
  };
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateEmployeeContact.bind(null, employeeId),
    {},
  );

  return (
    <form action={formAction} className="grid max-w-xl grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="mobile">Mobile</Label>
        <Input id="mobile" name="mobile" defaultValue={defaults.mobile ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={defaults.email ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bankName">Bank</Label>
        <Input id="bankName" name="bankName" defaultValue={defaults.bankName ?? ""} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bankAccountNo">Bank account no</Label>
        <Input
          id="bankAccountNo"
          name="bankAccountNo"
          className="font-mono"
          defaultValue={defaults.bankAccountNo ?? ""}
        />
      </div>
      <div className="col-span-2 flex items-center gap-3">
        <Button type="submit" variant="outline" size="sm" disabled={isPending}>
          {isPending ? "Saving…" : "Save contact details"}
        </Button>
        {state.message ? (
          <span className="text-sm text-muted-foreground">{state.message}</span>
        ) : null}
      </div>
    </form>
  );
}
