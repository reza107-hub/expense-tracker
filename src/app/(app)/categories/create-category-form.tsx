"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createCategoryAction } from "@/actions/categories";
import InputField from "@/components/forms/input-field";
import { CATEGORY_NAME_MAX, type CategoryFormState } from "@/lib/categories/validation";

const initialState: CategoryFormState = { status: "idle" };

export default function CreateCategoryForm() {
  const [state, formAction, pending] = useActionState(createCategoryAction, initialState);
  const failed = state.status === "error" ? state : null;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <h2 className="text-base font-semibold tracking-tight">Add a category</h2>
      <InputField
        id="category-name"
        name="name"
        label="Name"
        required
        maxLength={CATEGORY_NAME_MAX}
        defaultValue={failed?.name}
        error={failed?.fieldError}
      />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <Plus className="size-4" aria-hidden="true" />
        {pending ? "Adding" : "Add category"}
      </button>
    </form>
  );
}
