"use client";

import { useActionState } from "react";
import { ArchiveRestore } from "lucide-react";
import { restoreCategoryAction } from "@/actions/categories";
import type { CategoryActionState } from "@/lib/categories/validation";

const idle: CategoryActionState = { status: "idle" };

export default function RestoreButton({ categoryId }: { categoryId: number }) {
  const [state, formAction, pending] = useActionState(
    restoreCategoryAction.bind(null, categoryId),
    idle,
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <ArchiveRestore className="size-4" aria-hidden="true" />
        {pending ? "Restoring" : "Restore"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
