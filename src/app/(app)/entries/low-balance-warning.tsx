"use client";

import { TriangleAlert } from "lucide-react";
import { formatTaka } from "@/lib/money";
import { CONFIRM_LOW_BALANCE_FIELD } from "@/lib/entries/validation";
import { useT } from "@/i18n/client";

type Props = {
  walletName: string;
  balanceAfter: number;
  pending: boolean;
  onCancel: () => void;
};

/**
 * Asks the user to confirm an expense or transfer that would take a wallet below zero.
 * "Save anyway" submits the surrounding form again with the confirmation field set.
 */
export default function LowBalanceWarning({ walletName, balanceAfter, pending, onCancel }: Props) {
  const t = useT();
  // The amount is bold, wherever the language puts it in the sentence.
  const [before, after] = t("entries.lowBalance", { wallet: walletName, amount: "\u0000" }).split("\u0000");
  return (
    <div
      role="alert"
      className="panel-enter flex flex-col gap-3 rounded-md border border-warning bg-muted p-3 text-sm"
    >
      <p className="flex items-start gap-2 text-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <span>
          {before}
          <strong>৳ {formatTaka(balanceAfter)}</strong>
          {after}
        </span>
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          name={CONFIRM_LOW_BALANCE_FIELD}
          value="yes"
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-md bg-warning px-3 text-sm font-medium text-warning-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
        >
          {pending ? t("common.saving") : t("entries.saveAnyway")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
