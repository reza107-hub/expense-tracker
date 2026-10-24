import { listArchivedWallets, listWallets } from "@/data/wallets";
import { formatTaka } from "@/lib/money";
import CreateWalletForm from "./create-wallet-form";
import RestoreButton from "./restore-button";
import WalletActions from "./wallet-actions";
import { getTranslator } from "@/i18n/server";

/** Amounts are shown in taka. A negative balance is flagged with the warning colour. */
function Balance({ poisha }: { poisha: number }) {
  return (
    <span className={poisha < 0 ? "text-destructive" : "text-foreground"}>
      ৳ {formatTaka(poisha)}
    </span>
  );
}

export default async function WalletsContent() {
  const [active, archived, { t }] = await Promise.all([
    listWallets(),
    listArchivedWallets(),
    getTranslator(),
  ]);
  const total = active.reduce((sum, wallet) => sum + wallet.balance, 0);

  return (
    <>
      <section
        aria-label={t("wallets.totalBalance")}
        className="rounded-lg border border-border bg-card p-4 text-card-foreground"
      >
        <p className="text-sm text-muted-foreground">{t("wallets.totalBalance")}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          <Balance poisha={total} />
        </p>
      </section>

      <CreateWalletForm />

      <section aria-labelledby="active-heading" className="flex flex-col gap-3">
        <h2 id="active-heading" className="text-base font-semibold tracking-tight">
          {t("wallets.yourWallets")}
        </h2>
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t("wallets.empty")}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((wallet) => (
              <li
                key={wallet.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="min-w-0 truncate text-base font-medium">{wallet.name}</h3>
                  <p className="text-lg font-semibold tabular-nums">
                    <Balance poisha={wallet.balance} />
                  </p>
                </div>
                <WalletActions
                  walletId={wallet.id}
                  name={wallet.name}
                  openingBalance={formatTaka(wallet.openingBalance)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-heading" className="flex flex-col gap-3">
          <h2 id="archived-heading" className="text-base font-semibold tracking-tight">
            {t("common.archived")}
          </h2>
          <ul className="flex flex-col gap-3">
            {archived.map((wallet) => (
              <li
                key={wallet.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-base font-medium text-muted-foreground">
                    {wallet.name}
                  </h3>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    <Balance poisha={wallet.balance} />
                  </p>
                </div>
                <RestoreButton walletId={wallet.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
