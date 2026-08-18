import type { ReactNode } from "react";

const FIELD_CLASS =
  "w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-base text-ink placeholder:text-ink-subtle focus:border-brand-focus focus:ring-2 focus:ring-brand-focus/30";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
  children?: ReactNode;
}

export function Field({ id, label, hint, required, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink">
        {label}
        {required && <span className="text-ink-muted"> (obrigatório)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

interface TextFieldProps extends FieldProps {
  value: string;
  onChange: (value: string) => void;
  linhas?: number;
  maxLength?: number;
  autoComplete?: string;
}

export function TextField({ value, onChange, linhas, ...field }: TextFieldProps) {
  const shared = {
    id: field.id,
    name: field.id,
    value,
    required: field.required,
    maxLength: field.maxLength,
    "aria-describedby": field.hint ? `${field.id}-hint` : undefined,
    className: FIELD_CLASS,
    onChange: (event: { target: { value: string } }) => onChange(event.target.value),
  };

  return (
    <Field {...field}>
      {linhas ? (
        <textarea {...shared} rows={linhas} className={`${FIELD_CLASS} min-h-[9rem] leading-6`} />
      ) : (
        <input {...shared} type="text" autoComplete={field.autoComplete} />
      )}
    </Field>
  );
}

interface ChoiceProps {
  legend: string;
  name: string;
  hint?: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}

export function BooleanChoice({ legend, name, hint, value, onChange }: ChoiceProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="mb-2 text-sm text-ink-muted">{hint}</p>}
      <div className="flex flex-wrap gap-3">
        {[
          { rotulo: "Sim", valor: true },
          { rotulo: "Não", valor: false },
        ].map((opcao) => (
          <label
            key={opcao.rotulo}
            className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm font-medium ${
              value === opcao.valor
                ? "border-brand-action bg-brand-pale text-brand-action"
                : "border-gray-300 bg-surface-card text-ink hover:bg-surface-subtle"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={String(opcao.valor)}
              checked={value === opcao.valor}
              onChange={() => onChange(opcao.valor)}
              className="h-4 w-4 accent-[rgb(var(--color-blue))]"
            />
            {opcao.rotulo}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
