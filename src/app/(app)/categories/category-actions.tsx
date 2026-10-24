"use client";

import { useActionState, useEffect, useState } from "react";
import { Archive, Pencil, Save, X } from "lucide-react";
import { archiveCategoryAction, renameCategoryAction } from "@/actions/categories";
import InputField from "@/components/forms/input-field";
import {
  CATEGORY_NAME_MAX,
  type CategoryActionState,
  type CategoryFormState,
} from "@/lib/categories/validation";
import { useT } from "@/i18n/client";

const idleForm: CategoryFormState = { status: "idle" };
const idleAction: CategoryActionState = { status: "idle" };

const buttonClass =
  "inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";
const quietButton = `${buttonClass} text-muted-foreground hover:bg-muted hover:text-foreground`;

type Props = { categoryId: number; name: string };

/** Rename and archive controls for one active category. */
export default function CategoryActions({ categoryId, name }: Props) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [archiveState, archiveAction, archiving] = useActionState(
    archiveCategoryAction.bind(null, categoryId),
    idleAction,
  );

  return (
    <div className="flex flex-col gap-3">
      {editing ? (
        <RenameForm categoryId={categoryId} name={name} onClose={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setEditing(true)} className={quietButton}>
            <Pencil className="size-4" aria-hidden="true" />
            {t("categories.rename")}
          </button>
          <form action={archiveAction}>
            <button type="submit" disabled={archiving} className={quietButton}>
              <Archive className="size-4" aria-hidden="true" />
              {archiving ? t("common.archiving") : t("common.archive")}
            </button>
          </form>
        </div>
      )}

      {archiveState.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {archiveState.message}
        </p>
      ) : null}
    </div>
  );
}

function RenameForm({ categoryId, name, onClose }: Props & { onClose: () => void }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(
    renameCategoryAction.bind(null, categoryId),
    idleForm,
  );
  const failed = state.status === "error" ? state : null;

  useEffect(() => {
    if (state.status === "saved") onClose();
  }, [state, onClose]);

  return (
    <form action={formAction} className="panel-enter flex flex-col gap-4">
      <InputField
        id={`category-${categoryId}-name`}
        name="name"
        label={t("common.name")}
        required
        maxLength={CATEGORY_NAME_MAX}
        defaultValue={failed?.name ?? name}
        error={failed?.fieldError}
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`${buttonClass} bg-primary text-primary-foreground hover:opacity-90`}
        >
          <Save className="size-4" aria-hidden="true" />
          {pending ? t("common.saving") : t("common.save")}
        </button>
        <button type="button" onClick={onClose} className={quietButton}>
          <X className="size-4" aria-hidden="true" />
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
