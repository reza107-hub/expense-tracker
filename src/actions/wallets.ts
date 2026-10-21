"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth/session";
import {
  archiveWallet,
  createWallet,
  restoreWallet,
  updateWallet,
  type WalletResult,
} from "@/lib/wallets/mutations";
import {
  validateWallet,
  type WalletActionState,
  type WalletFormState,
} from "@/lib/wallets/validation";

const DUPLICATE_NAME = "You already have a wallet with this name.";
const NOT_FOUND = "This wallet no longer exists. Refresh the page.";

/** Turns a failed result into the message shown next to the button that caused it. */
function failureMessage(result: Extract<WalletResult, { ok: false }>): string {
  if (result.reason === "balance-not-zero") return result.message;
  return result.reason === "duplicate-name" ? DUPLICATE_NAME : NOT_FOUND;
}

/** Saves a form result: the failure is shown on the name box or as a form message. */
function formError(
  values: { name: string; openingBalance: string },
  result: Extract<WalletResult, { ok: false }>,
): WalletFormState {
  if (result.reason === "duplicate-name") {
    return { status: "error", values, fieldErrors: { name: DUPLICATE_NAME } };
  }
  return { status: "error", values, fieldErrors: {}, formError: failureMessage(result) };
}

export async function createWalletAction(
  _previous: WalletFormState,
  formData: FormData,
): Promise<WalletFormState> {
  const { userId } = await requireUser();
  const checked = validateWallet(formData);
  if (!checked.ok) {
    return { status: "error", values: checked.values, fieldErrors: checked.fieldErrors };
  }

  const result = await createWallet(getDb(), userId, checked.value);
  if (!result.ok) {
    return formError(
      { name: checked.value.name, openingBalance: String(formData.get("openingBalance") ?? "") },
      result,
    );
  }
  revalidatePath("/wallets");
  return { status: "saved" };
}

export async function updateWalletAction(
  walletId: number,
  _previous: WalletFormState,
  formData: FormData,
): Promise<WalletFormState> {
  const { userId } = await requireUser();
  const checked = validateWallet(formData);
  if (!checked.ok) {
    return { status: "error", values: checked.values, fieldErrors: checked.fieldErrors };
  }

  const result = await updateWallet(getDb(), userId, walletId, checked.value);
  if (!result.ok) {
    return formError(
      { name: checked.value.name, openingBalance: String(formData.get("openingBalance") ?? "") },
      result,
    );
  }
  revalidatePath("/wallets");
  return { status: "saved" };
}

export async function archiveWalletAction(walletId: number): Promise<WalletActionState> {
  const { userId } = await requireUser();
  const result = await archiveWallet(getDb(), userId, walletId);
  if (!result.ok) return { status: "error", message: failureMessage(result) };
  revalidatePath("/wallets");
  return { status: "idle" };
}

export async function restoreWalletAction(walletId: number): Promise<WalletActionState> {
  const { userId } = await requireUser();
  const result = await restoreWallet(getDb(), userId, walletId);
  if (!result.ok) return { status: "error", message: failureMessage(result) };
  revalidatePath("/wallets");
  return { status: "idle" };
}
