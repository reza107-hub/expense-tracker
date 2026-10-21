export type SignInState =
  | { status: "idle" }
  | { status: "invalid"; email: string }
  | { status: "locked"; email: string; retryAfterSeconds: number }
  | { status: "error"; email: string; message: string };

export type RegisterField = "email" | "password" | "confirmPassword";

export type RegisterState =
  | { status: "idle" }
  | {
      status: "error";
      /** Kept so the email is still in the box after a failed attempt. */
      email: string;
      fieldErrors: Partial<Record<RegisterField, string>>;
      formError?: string;
    };
