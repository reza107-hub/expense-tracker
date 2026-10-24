import Link from "next/link";
import { listCategoriesForExpenseForm } from "@/data/categories";
import { getEntryList } from "@/data/entries";
import { listWallets } from "@/data/wallets";
import { parseEntriesQuery } from "@/lib/entries/query-params";
import { todayInDhaka } from "@/lib/period";
import EntryForms from "./entry-forms";
import EntryList from "./entry-list";
import { getTranslator } from "@/i18n/server";

export default async function EntriesContent({
  searchParams,
}: {
  searchParams: PageProps<"/entries">["searchParams"];
}) {
  const query = parseEntriesQuery(await searchParams);
  const [wallets, categories, list, { t }] = await Promise.all([
    listWallets(),
    listCategoriesForExpenseForm(),
    getEntryList(query),
    getTranslator(),
  ]);

  return (
    <>
      {wallets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          {t("entries.needWallet")}{" "}
          <Link href="/wallets" className="font-medium text-primary hover:underline">
            {t("wallets.add.title")}
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
