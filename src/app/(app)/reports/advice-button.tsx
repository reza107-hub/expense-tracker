"use client";

import { useActionState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { refreshAdviceAction, type AdviceActionState } from "@/actions/advice";

const idle: AdviceActionState = { status: "idle" };

type Props = {
  /** The month as "YYYY-MM". */
  month: string;
  hasSaved: boolean;
  remaining: number;
  dailyLimit: number;
};

/** The button that asks for advice. It is the only way a request to the model is made. */
export default function AdviceButton({ month, hasSaved, remaining, dailyLimit }: Props) {
  const [state, formAction, pending] = useActionState(refreshAdviceAction.bind(null, month), idle);
  const Icon = hasSaved ? RefreshCw : Sparkles;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
      >
        <Icon className="size-4" aria-hidden="true" />
        {pending ? "Thinking" : hasSaved ? "Refresh advice" : "Get advice"}
      </button>
      <p className="text-xs text-muted-foreground">
        {remaining} of {dailyLimit} new requests left today. Reusing saved advice is free.
      </p>
      {state.status === "done" ? (
        <p
          role={state.kind === "created" || state.kind === "unchanged" ? "status" : "alert"}
          className={
            state.kind === "created" || state.kind === "unchanged"
              ? "text-sm text-success"
              : "text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
