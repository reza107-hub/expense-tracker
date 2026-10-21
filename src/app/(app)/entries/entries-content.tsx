import Link from "next/link";
import { listCategoriesForExpenseForm } from "@/data/categories";
import { getEntryList } from "@/data/entries";
import { listWallets } from "@/data/wallets";
import { parseEntriesQuery } from "@/lib/entries/query-params";
import { todayInDhaka } from "@/lib/period";
import EntryForms from "./entry-forms";
import EntryList from "./entry-list";

export default async function EntriesContent({
  searchParams,
}: {
  searchParams: PageProps<"/entries">["searchParams"];
}) {
  const query = parseEntriesQuery(await searchParams);
  const [wallets, categories, list] = await Promise.all([
    listWallets(),
    listCategoriesForExpenseForm(),
    getEntryList(query),
  ]);

  return (
    <>
      {wallets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          You need a wallet before you can record an entry.{" "}
          <Link href="/wallets" className="font-medium text-primary hover:underline">
            Add a wallet
          </Link>
        </p>
      ) : (
        <EntryForms
          wallets={wallets.map(({ id, name, balance }) => ({ id, name, balance }))}
          categories={categories.map(({ id, name }) => ({ id, name }))}
          today={todayInDhaka()}
        />
      )}
      <EntryList
        period={list.period}
        today={list.today}
        startDay={list.startDay}
        entries={list.entries}
        wallets={list.wallets}
        categories={list.categories}
        filters={{ walletId: query.walletId, categoryId: query.categoryId }}
      />
    </>
  );
}
