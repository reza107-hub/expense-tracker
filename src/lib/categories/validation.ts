export const CATEGORY_NAME_MAX = 40;

export type CategoryFormState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      /** Kept so the typed name is still in the box after a failed attempt. */
      name: string;
      fieldError?: string;
    };

/** State for one-button actions (archive, restore) that can only fail with a message. */
export type CategoryActionState =
  | { status: "idle" }
  | { status: "error"; message: string };

type Checked = { ok: true; name: string } | { ok: false; name: string; fieldError: string };

/** Reads the category form: one name, trimmed, between 1 and 40 characters. */
export function validateCategory(formData: FormData): Checked {
  const raw = formData.get("name");
  const name = (typeof raw === "string" ? raw : "").trim().replace(/\s+/g, " ");
  if (!name) return { ok: false, name, fieldError: "Enter a name for the category." };
  if (name.length > CATEGORY_NAME_MAX) {
    return { ok: false, name, fieldError: `Use ${CATEGORY_NAME_MAX} characters or fewer.` };
  }
  return { ok: true, name };
}
