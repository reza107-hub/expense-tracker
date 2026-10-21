import { Lock } from "lucide-react";
import { listActiveCategories, listArchivedCategories } from "@/data/categories";
import CategoryActions from "./category-actions";
import CreateCategoryForm from "./create-category-form";
import RestoreButton from "./restore-button";

export default async function CategoriesContent() {
  const [active, archived] = await Promise.all([listActiveCategories(), listArchivedCategories()]);

  return (
    <>
      <CreateCategoryForm />

      <section aria-labelledby="active-heading" className="flex flex-col gap-3">
        <h2 id="active-heading" className="text-base font-semibold tracking-tight">
          Your categories
        </h2>
        <ul className="flex flex-col gap-3">
          {active.map((category) => (
            <li
              key={category.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
            >
              {category.isReserved ? (
                <div className="flex flex-col gap-1">
                  <h3 className="flex items-center gap-2 text-base font-medium">
                    {category.name}
                    <Lock className="size-4 text-muted-foreground" aria-label="Locked" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Used only for loan interest and fees. It is not offered when you add an
                    expense, and it cannot be archived.
                  </p>
                </div>
              ) : (
                <>
                  <h3 className="min-w-0 truncate text-base font-medium">{category.name}</h3>
                  <CategoryActions categoryId={category.id} name={category.name} />
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      {archived.length > 0 ? (
        <section aria-labelledby="archived-heading" className="flex flex-col gap-3">
          <h2 id="archived-heading" className="text-base font-semibold tracking-tight">
            Archived
          </h2>
          <ul className="flex flex-col gap-3">
            {archived.map((category) => (
              <li
                key={category.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
              >
                <h3 className="min-w-0 truncate text-base font-medium text-muted-foreground">
                  {category.name}
                </h3>
                <RestoreButton categoryId={category.id} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
