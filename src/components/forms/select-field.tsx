type Option = { value: number | string; label: string };

type SelectFieldProps = {
  id: string;
  name: string;
  label: string;
  options: Option[];
  /** The first, empty choice. A form cannot be saved while it is picked. */
  placeholder: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
};

/** A labelled drop-down with an error or hint line underneath. */
export default function SelectField({
  id,
  name,
  label,
  options,
  placeholder,
  defaultValue = "",
  error,
  hint,
}: SelectFieldProps) {
  const messageId = `${id}-message`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {/* React reads a select's defaultValue only when it mounts, and a form reset after a
          failed save falls back to it. Keying on the value remounts the select so the
          choice made before the error is kept. */}
      <select
        key={defaultValue}
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? messageId : undefined}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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
