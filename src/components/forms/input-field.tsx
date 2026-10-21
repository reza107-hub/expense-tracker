import type { Ref } from "react";

type InputFieldProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  maxLength?: number;
  type?: "text" | "date";
  max?: string;
  inputMode?: "text" | "decimal";
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
  ref?: Ref<HTMLInputElement>;
};

/** A labelled text box with an error or hint line underneath. */
export default function InputField({
  id,
  name,
  label,
  defaultValue,
  error,
  hint,
  maxLength,
  type = "text",
  max,
  inputMode = "text",
  autoComplete = "off",
  required = false,
  placeholder,
  ref,
}: InputFieldProps) {
  const messageId = `${id}-message`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        name={name}
        type={type}
        max={max}
        inputMode={inputMode}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
      />
      {error ? (
        <p id={messageId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
