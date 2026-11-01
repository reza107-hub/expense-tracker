import { LoaderCircle } from "lucide-react";

/**
 * A small spinning ring for buttons that are waiting on the server. It takes the colour
 * of the button's text, so it works on every button style. Hidden from screen readers:
 * the button's own text already says what is happening ("Saving...").
 */
export default function Spinner({ className = "size-4" }: { className?: string }) {
  return <LoaderCircle className={`${className} animate-spin`} aria-hidden="true" />;
}
