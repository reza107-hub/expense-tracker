import { parseTaka } from "@/lib/money";

/** Quick-pick names offered on the create form. A custom name works just as well. */
export const WALLET_PRESETS = [
  "Cash",
  "Bank",
  "bKash",
  "Nagad",
  "Rocket",
  "Upay",
  "Crypto",
] as const;

export const WALLET_NAME_MAX = 40;

export type WalletField = "name" | "openingBalance";

export type WalletInput = { name: string; openingBalance: number };

export type WalletFormState =
  | { status: "idle" }
  | { status: "saved" }
  | {
      status: "error";
      /** Kept so the typed values are still in the boxes after a failed attempt. */
      values: { name: string; openingBalance: string };
      fieldErrors: Partial<Record<WalletField, string>>;
      formError?: string;
    };

/** State for one-button actions (archive, restore) that can only fail with a message. */
export type WalletActionState =
  | { status: "idle" }
  | { status: "error"; message: string };

type Checked =
  | { ok: true; value: WalletInput }
  | {
      ok: false;
      values: { name: string; openingBalance: string };
      fieldErrors: Partial<Record<WalletField, string>>;
    };

/**
 * Reads the wallet form: a name and an opening balance. Nothing else is accepted, so a
 * wallet never holds a phone number, account number or credential.
 */
export function validateWallet(formData: FormData): Checked {
  const text = (key: string) => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };
  const name = text("name").trim().replace(/\s+/g, " ");
  const typedBalance = text("openingBalance").trim();
  const values = { name, openingBalance: typedBalance };
  const fieldErrors: Partial<Record<WalletField, string>> = {};

  if (!name) fieldErrors.name = "Enter a name for the wallet.";
  else if (name.length > WALLET_NAME_MAX) {
    fieldErrors.name = `Use ${WALLET_NAME_MAX} characters or fewer.`;
  }

  // An empty box means no money to start with.
  const openingBalance = typedBalance === "" ? 0 : parseTaka(typedBalance);
  if (openingBalance === null) {
    fieldErrors.openingBalance =
      "Enter an amount of zero or more, with at most two decimal places.";
  }

  if (Object.keys(fieldErrors).length > 0 || openingBalance === null) {
    return { ok: false, values, fieldErrors };
  }
  return { ok: true, value: { name, openingBalance } };
}
