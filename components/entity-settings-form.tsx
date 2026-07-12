"use client";

import { useActionState } from "react";
import {
  createOutlet,
  updateEntity,
  type FormState,
} from "@/lib/actions";
import type { Entity, Outlet } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

function LabelledInput({
  label,
  name,
  defaultValue,
  placeholder,
  mono,
}: {
  label: string;
  name: string;
  defaultValue: string | null;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className={mono ? "font-mono" : undefined}
      />
    </div>
  );
}

export function EntitySettingsCard({
  entity,
  outlets,
}: {
  entity: Entity;
  outlets: Outlet[];
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateEntity.bind(null, entity.id),
    {},
  );
  const [outletState, outletAction, outletPending] = useActionState<
    FormState,
    FormData
  >(createOutlet, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{entity.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={formAction} className="grid grid-cols-2 gap-4">
          <LabelledInput label="UEN" name="uen" defaultValue={entity.uen} placeholder="TBC" mono />
          <LabelledInput
            label="CPF Submission Number (CSN)"
            name="csn"
            defaultValue={entity.csn}
            placeholder="UEN-PTE-01"
            mono
          />
          <LabelledInput label="SSIC code" name="ssic" defaultValue={entity.ssic} mono />
          <LabelledInput label="Bank" name="bankName" defaultValue={entity.bankName} placeholder="OCBC" />
          <LabelledInput
            label="Bank account no"
            name="bankAccountNo"
            defaultValue={entity.bankAccountNo}
            mono
          />
          <div className="col-span-2 flex items-center gap-3">
            <Button type="submit" variant="outline" size="sm" disabled={isPending}>
              {isPending ? "Saving…" : "Save entity"}
            </Button>
            {state.message ? (
              <span className="text-sm text-muted-foreground">{state.message}</span>
            ) : null}
          </div>
        </form>

        <Separator />

        <div className="space-y-3">
          <h3 className="text-sm font-medium">Outlets</h3>
          {outlets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No outlets. Scheduled staff need an outlet for rosters (Phase 5).
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {outlets.map((outlet) => (
                <li key={outlet.id}>{outlet.name}</li>
              ))}
            </ul>
          )}
          <form action={outletAction} className="flex items-end gap-2">
            <input type="hidden" name="entityId" value={entity.id} />
            <div className="flex-1 space-y-1.5">
              <Label htmlFor={`outlet-${entity.id}`}>New outlet</Label>
              <Input
                id={`outlet-${entity.id}`}
                name="name"
                placeholder="Robinson Rd"
              />
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={outletPending}>
              Add outlet
            </Button>
          </form>
          {outletState.errors?.form ? (
            <p className="text-sm text-destructive">{outletState.errors.form}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
