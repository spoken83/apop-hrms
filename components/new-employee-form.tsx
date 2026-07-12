"use client";

import { useActionState, useState } from "react";
import { createEmployee, type FormState } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { id: string; name: string };

const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring/50 outline-none";

function Field({
  label,
  name,
  errors,
  children,
}: {
  label: string;
  name: string;
  errors?: Record<string, string>;
  children: React.ReactNode;
}) {
  const error = errors?.[name];
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function NewEmployeeForm({
  entities,
  outlets,
}: {
  entities: Option[];
  outlets: (Option & { entityId: string })[];
}) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    createEmployee,
    {},
  );
  const [residency, setResidency] = useState("citizen");
  const [employmentType, setEmploymentType] = useState("monthly");
  const [entityId, setEntityId] = useState(entities[0]?.id ?? "");
  const [isScheduled, setIsScheduled] = useState(true);

  const isLocal = residency === "citizen" || residency === "pr";
  const entityOutlets = outlets.filter((o) => o.entityId === entityId);
  const errors = state.errors;

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Field label="Full name (as per NRIC/passport)" name="fullName" errors={errors}>
              <Input id="fullName" name="fullName" required />
            </Field>
          </div>
          <Field label="Residency status" name="residencyStatus" errors={errors}>
            <select
              id="residencyStatus"
              name="residencyStatus"
              className={selectClass}
              value={residency}
              onChange={(e) => setResidency(e.target.value)}
            >
              <option value="citizen">Singapore Citizen</option>
              <option value="pr">Permanent Resident</option>
              <option value="wp">Work Permit</option>
              <option value="spass">S Pass</option>
              <option value="ep">Employment Pass</option>
            </select>
          </Field>
          <Field label={isLocal ? "NRIC" : "FIN"} name="idNumber" errors={errors}>
            <>
              <input type="hidden" name="idType" value={isLocal ? "nric" : "fin"} />
              <Input
                id="idNumber"
                name="idNumber"
                placeholder={isLocal ? "S1234567A" : "G1234567X"}
                className="font-mono uppercase"
                required
              />
            </>
          </Field>
          <Field label="Date of birth" name="dob" errors={errors}>
            <Input id="dob" name="dob" type="date" required />
          </Field>
          <Field label="Nationality" name="nationality" errors={errors}>
            <Input
              id="nationality"
              name="nationality"
              defaultValue={isLocal ? "Singaporean" : "Malaysian"}
              key={isLocal ? "local" : "foreign"}
              required
            />
          </Field>
          <Field
            label={isLocal ? "Race (determines SHG fund)" : "Race (optional)"}
            name="race"
            errors={errors}
          >
            <select id="race" name="race" className={selectClass} defaultValue="">
              <option value="">—</option>
              <option value="chinese">Chinese</option>
              <option value="malay">Malay</option>
              <option value="indian">Indian</option>
              <option value="eurasian">Eurasian</option>
              <option value="other">Other</option>
            </select>
          </Field>
          {!isLocal && (
            <Field label="Pass expiry date" name="passExpiryDate" errors={errors}>
              <Input id="passExpiryDate" name="passExpiryDate" type="date" required />
            </Field>
          )}
          <Field label="Mobile" name="mobile" errors={errors}>
            <Input id="mobile" name="mobile" type="tel" placeholder="9123 4567" />
          </Field>
          <Field label="Email" name="email" errors={errors}>
            <Input id="email" name="email" type="email" />
          </Field>
          <Field label="Bank" name="bankName" errors={errors}>
            <Input id="bankName" name="bankName" placeholder="OCBC" />
          </Field>
          <Field label="Bank account no" name="bankAccountNo" errors={errors}>
            <Input id="bankAccountNo" name="bankAccountNo" className="font-mono" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Employment</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Field label="Entity" name="entityId" errors={errors}>
            <select
              id="entityId"
              name="entityId"
              className={selectClass}
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            >
              {entities.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Role title" name="roleTitle" errors={errors}>
            <Input id="roleTitle" name="roleTitle" placeholder="Barista" required />
          </Field>
          <Field label="Start date" name="startDate" errors={errors}>
            <Input id="startDate" name="startDate" type="date" required />
          </Field>
          <Field label="Pay type" name="employmentType" errors={errors}>
            <select
              id="employmentType"
              name="employmentType"
              className={selectClass}
              value={employmentType}
              onChange={(e) => setEmploymentType(e.target.value)}
            >
              <option value="monthly">Monthly salaried</option>
              <option value="hourly">Hourly (part-time)</option>
            </select>
          </Field>
          {employmentType === "monthly" ? (
            <Field label="Monthly salary (SGD)" name="baseSalary" errors={errors}>
              <Input
                id="baseSalary"
                name="baseSalary"
                type="number"
                step="0.01"
                min="0"
                className="font-mono"
                required
              />
            </Field>
          ) : (
            <Field label="Hourly rate (SGD)" name="hourlyRate" errors={errors}>
              <Input
                id="hourlyRate"
                name="hourlyRate"
                type="number"
                step="0.01"
                min="0"
                className="font-mono"
                required
              />
            </Field>
          )}
          <Field
            label="Contractual hours / week"
            name="contractualHoursPerWeek"
            errors={errors}
          >
            <Input
              id="contractualHoursPerWeek"
              name="contractualHoursPerWeek"
              type="number"
              step="0.5"
              min="0"
              placeholder="44"
            />
          </Field>
          <div className="col-span-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="isScheduled"
              name="isScheduled"
              className="size-4 accent-primary"
              checked={isScheduled}
              onChange={(e) => setIsScheduled(e.target.checked)}
            />
            <Label htmlFor="isScheduled" className="font-normal">
              On the roster (uncheck for admin staff and floaters)
            </Label>
          </div>
          {isScheduled && (
            <Field label="Outlet" name="outletId" errors={errors}>
              <select id="outletId" name="outletId" className={selectClass} defaultValue="">
                <option value="">— none yet —</option>
                {entityOutlets.map((outlet) => (
                  <option key={outlet.id} value={outlet.id}>
                    {outlet.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </CardContent>
      </Card>

      {state.message && errors ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Creating…" : "Create employee"}
      </Button>
    </form>
  );
}
