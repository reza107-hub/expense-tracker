import Link from "next/link";
import { getDashboard } from "@/data/reports";
import { monthName } from "@/lib/entries/display";
import { formatTaka } from "@/lib/money";

function Figure({ label, poisha, tone }: { label: string; poisha: number; tone?: "alert" }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-card-foreground">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-semibold tracking-tight tabular-nums ${tone === "alert" && poisha < 0 ? "text-destructive" : ""}`}
      >
        ৳ {formatTaka(poisha)}
      </p>
    </div>
  );
}

export default async function DashboardContent() {
  const overview = await getDashboard();

  return (
    <>
      <section
        aria-label="Current balance"
        className="rounded-lg border border-border bg-card p-5 text-card-foreground"
      >
        <p className="text-sm text-muted-foreground">Current balance</p>
        <p
          className={`mt-1 text-3xl font-semibold tracking-tight tabular-nums ${overview.totalBalance < 0 ? "text-destructive" : ""}`}
        >
          ৳ {formatTaka(overview.totalBalance)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Across all your active wallets, worked out from your entries.
        </p>
      </section>

      <section aria-label="Overview" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Figure label="Net position" poisha={overview.netPosition} tone="alert" />
        <Figure label="You owe" poisha={overview.owe} />
        <Figure label="Others owe you" poisha={overview.owed} />
      </section>
      <p className="-mt-3 text-xs text-muted-foreground">
        Net position is your total balance plus what others owe you, minus what you owe.
      </p>

      <Link
        href="/reports"
        className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="text-sm text-muted-foreground">
          Spending in {monthName(overview.period.year, overview.period.month)}
        </span>
        <span className="text-xl font-semibold tracking-tight tabular-nums">
          ৳ {formatTaka(overview.monthSpending)}
        </span>
        <span className="text-xs text-muted-foreground">See the full report</span>
      </Link>

      <section aria-labelledby="wallets-heading" className="flex flex-col gap-3">
        <h2 id="wallets-heading" className="text-base font-semibold tracking-tight">
          Wallets
        </h2>
        {overview.wallets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            You have no wallets yet.{" "}
            <Link href="/wallets" className="font-medium text-primary hover:underline">
              Add a wallet
            </Link>{" "}
            to start.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {overview.wallets.map((wallet) => (
              <li
                key={wallet.id}
                className="flex items-baseline justify-between gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
              >
                <span className="min-w-0 truncate text-sm font-medium">{wallet.name}</span>
                <span
                  className={`text-base font-semibold tabular-nums ${wallet.balance < 0 ? "text-destructive" : ""}`}
                >
                  ৳ {formatTaka(wallet.balance)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
