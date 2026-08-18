"use client";

import { useId, type ReactNode } from "react";

/** Controle de formulário padrão. A altura mínima de 44 px vem de app/globals.css. */
export const fieldClass =
  "w-full rounded-md border border-gray-300 bg-surface-card px-3 py-2 text-sm text-ink placeholder:text-ink-subtle";

interface FieldShellProps {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}

export function Field({ id, label, hint, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-sm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: ReactNode;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  id?: string;
  className?: string;
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  placeholder,
  multiline,
  rows = 3,
  id,
  className = "",
}: TextFieldProps) {
  // O formulário antigo tinha rótulo solto, sem `htmlFor`: clicar no rótulo não
  // focava o campo e o leitor de tela não anunciava o nome.
  const gerado = useId();
  const fieldId = id || gerado;
  const shared = {
    id: fieldId,
    value,
    placeholder,
    "aria-describedby": hint ? `${fieldId}-hint` : undefined,
    className: `${fieldClass} ${className}`,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  };

  return (
    <Field id={fieldId} label={label} hint={hint}>
      {multiline ? <textarea {...shared} rows={rows} /> : <input {...shared} type="text" />}
    </Field>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  hint?: ReactNode;
  id?: string;
}

export function SelectField({ label, value, onChange, options, hint, id }: SelectFieldProps) {
  const gerado = useId();
  const fieldId = id || gerado;
  return (
    <Field id={fieldId} label={label} hint={hint}>
      <select
        id={fieldId}
        value={value}
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClass}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
