"use client";

import { useActionState, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { deleteEntryAction } from "@/actions/entries-modify";
import { entryLabel, formatDate, walletEffect } from "@/lib/entries/display";
import type { ListedEntry } from "@/lib/entries/list";
import type { EntryActionState } from "@/lib/entries/validation";
import { formatTaka } from "@/lib/money";
import EditEntryForm, { type CategoryChoice, type WalletChoice } from "./edit-entry-form";
import { useT } from "@/i18n/client";

const idle: EntryActionState = { status: "idle" };

const quietButton =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

function Amount({ entry }: { entry: ListedEntry }) {
  const effect = walletEffect(entry);
  if (effect === null) {
    return <span className="text-foreground">৳ {formatTaka(entry.amount)}</span>;
  }
  return (
    <span className={effect < 0 ? "text-destructive" : "text-success"}>
      {effect < 0 ? "-" : "+"}৳ {formatTaka(Math.abs(effect))}
    </span>
  );
}

type Props = {
  entries: ListedEntry[];
  wallets: WalletChoice[];
  categories: CategoryChoice[];
};

export default function EntryRows({ entries, wallets, categories }: Props) {
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => (
        <EntryRow key={entry.id} entry={entry} wallets={wallets} categories={categories} />
      ))}
    </ul>
  );
}

function EntryRow({
  entry,
  wallets,
  categories,
}: Omit<Props, "entries"> & { entry: ListedEntry }) {
  const t = useT();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [deleteState, deleteAction, deleting] = useActionState(
    deleteEntryAction.bind(null, entry.id),
    idle,
  );
  // Loan principal, repayments and their interest or fees change together, so they are
  // managed on the Loans page.
  const managedByLoan = entry.loanId !== null || entry.type === "loan_principal" || entry.type === "loan_repayment";

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground">
      {mode === "edit" ? (
        <EditEntryForm
          entry={entry}
          wallets={wallets}
          categories={categories}
          onClose={() => setMode("view")}
        />
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{entryLabel(entry, t)}</p>
              <p className="text-sm text-muted-foreground">
                {entry.type === "transfer"
                  ? t("entries.row.route", { from: entry.walletName, to: entry.toWalletName ?? "" })
                  : entry.walletName}
                {entry.categoryName ? ` · ${entry.categoryName}` : ""}
                {entry.loanCounterparty ? ` · ${entry.loanCounterparty}` : ""}
              </p>
              {entry.note ? (
                <p className="mt-1 text-sm break-words text-foreground">{entry.note}</p>
              ) : null}
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(entry.entryDate, t)}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums">
              <Amount entry={entry} />
            </p>
          </div>

          {managedByLoan ? (
            <p className="text-xs text-muted-foreground">{t("entries.row.managedByLoan")}</p>
          ) : mode === "delete" ? (
            <form action={deleteAction} className="panel-enter flex flex-col gap-2">
              <p className="text-sm text-foreground">{t("entries.row.deleteConfirm")}</p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={deleting}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {deleting ? t("common.deleting") : t("common.yesDelete")}
                </button>
                <button type="button" onClick={() => setMode("view")} className={quietButton}>
                  {t("common.keepIt")}
                </button>
              </div>
              {deleteState.status === "error" ? (
                <p role="alert" className="text-sm text-destructive">
                  {deleteState.message}
                </p>
              ) : null}
            </form>
          ) : (
            <div className="flex gap-1">
              <button type="button" onClick={() => setMode("edit")} className={quietButton}>
                <Pencil className="size-4" aria-hidden="true" />
                {t("common.edit")}
              </button>
              <button type="button" onClick={() => setMode("delete")} className={quietButton}>
                <Trash2 className="size-4" aria-hidden="true" />
                {t("common.delete")}
              </button>
            </div>
          )}
        </>
      )}
    </li>
  );
}
