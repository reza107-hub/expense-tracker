import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { wallets, type Wallet } from "@/db/schema";
import type { AnyDb } from "@/db/types";

export type WalletWithBalance = Wallet & {
  /** Opening balance plus every entry that touches the wallet, in poisha. */
  balance: number;
};

/**
 * What one ledger row does to the wallet it names in `wallet_id`, in poisha.
 * Loan rows depend on the loan's direction: money borrowed comes in and is paid back
 * out, money lent goes out and comes back in. A transfer takes money out of the source
 * here. The destination side is counted separately below.
 */
const EFFECT_ON_WALLET = sql`case
  when e.type in ('income', 'adjustment') then e.amount
  when e.type in ('expense', 'transfer') then -e.amount
  when e.type = 'loan_principal' then case l.direction when 'borrowed' then e.amount else -e.amount end
  when e.type = 'loan_repayment' then case l.direction when 'borrowed' then -e.amount else e.amount end
  else 0
end`;

/**
 * Every wallet a user owns with its calculated balance. Balances are never stored, so
 * they always match the current entries, including after an edit or a delete.
 * Archived wallets are left out unless asked for.
 */
export async function listWalletsWithBalance(
  db: AnyDb,
  userId: string,
  { archived = false }: { archived?: boolean } = {},
): Promise<WalletWithBalance[]> {
  const ownEntries = sql`select sum(${EFFECT_ON_WALLET})
    from entries e
    left join loans l on l.user_id = e.user_id and l.id = e.loan_id
    where e.user_id = ${wallets.userId} and e.wallet_id = ${wallets.id}`;
  const transfersIn = sql`select sum(e.amount)
    from entries e
    where e.user_id = ${wallets.userId} and e.to_wallet_id = ${wallets.id}`;

  const rows = await db
    .select({
      wallet: wallets,
      balance: sql<number>`${wallets.openingBalance}
        + coalesce((${ownEntries}), 0)
        + coalesce((${transfersIn}), 0)`.mapWith(Number),
    })
    .from(wallets)
    .where(
      and(
        eq(wallets.userId, userId),
        archived ? isNotNull(wallets.archivedAt) : isNull(wallets.archivedAt),
      ),
    )
    .orderBy(asc(wallets.createdAt), asc(wallets.id));

  return rows.map(({ wallet, balance }) => ({ ...wallet, balance }));
}

/** One wallet of the user's with its balance, or null if it is not theirs. */
export async function getWalletWithBalance(
  db: AnyDb,
  userId: string,
  walletId: number,
): Promise<WalletWithBalance | null> {
  const [active, archived] = await Promise.all([
    listWalletsWithBalance(db, userId),
    listWalletsWithBalance(db, userId, { archived: true }),
  ]);
  return [...active, ...archived].find((wallet) => wallet.id === walletId) ?? null;
}

/** The total of the user's active wallet balances, in poisha. */
export async function totalBalance(db: AnyDb, userId: string): Promise<number> {
  const active = await listWalletsWithBalance(db, userId);
  return active.reduce((sum, wallet) => sum + wallet.balance, 0);
}
