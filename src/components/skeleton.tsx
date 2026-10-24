/** A pulsing block that stands in for content while it loads. It never holds data. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

/** A card-shaped placeholder with a few lines. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === 0 ? "h-7 w-2/3" : "h-4 w-1/2"} />
      ))}
    </div>
  );
}

/** A stack of list-row placeholders. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
        >
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
    </div>
  );
}

/** A form-shaped placeholder: a title, two boxes and a button. */
export function SkeletonForm() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <Skeleton className="h-5 w-1/3" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
      </div>
      <Skeleton className="h-10 w-28" />
    </div>
  );
}

/** The placeholder used while any page loads: a form, a card and a list. */
export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      <SkeletonCard />
      <SkeletonForm />
      <SkeletonList />
    </div>
  );
}

/*
 * Page placeholders. Each copies the shape of its page so the heading and cards stay
 * where they are when the real content replaces it.
 */

function Busy({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-6">
      {children}
    </div>
  );
}

const Cards = ({ count }: { count: number }) => (
  <div className="grid gap-3 sm:grid-cols-3">
    {Array.from({ length: count }, (_, i) => (
      <SkeletonCard key={i} lines={1} />
    ))}
  </div>
);

export function HomeSkeleton() {
  return (
    <Busy>
      <SkeletonCard lines={2} />
      <Cards count={3} />
      <SkeletonCard lines={1} />
      <SkeletonList rows={4} />
    </Busy>
  );
}

export function WalletsSkeleton() {
  return (
    <Busy>
      <SkeletonCard lines={1} />
      <SkeletonForm />
      <SkeletonList rows={3} />
    </Busy>
  );
}

/** Categories, Entries and Loans: a form (or totals) above a list. */
export function ListPageSkeleton({ withTotals = false }: { withTotals?: boolean }) {
  return (
    <Busy>
      {withTotals ? <Cards count={2} /> : null}
      <SkeletonForm />
      <SkeletonList rows={4} />
    </Busy>
  );
}

export function ReportsSkeleton() {
  return (
    <Busy>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
      </div>
      <SkeletonCard lines={2} />
      <SkeletonList rows={4} />
      <SkeletonCard lines={1} />
    </Busy>
  );
}

export function SettingsSkeleton() {
  return (
    <Busy>
      <SkeletonForm />
      <SkeletonForm />
    </Busy>
  );
}

/** The saving-advice section on Reports. */
export function AdviceSkeleton() {
  return (
    <Busy>
      <SkeletonCard lines={3} />
    </Busy>
  );
}

/** The sign-in and register pages while the language is being read. */
export function AuthSkeleton() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div role="status" aria-busy="true" className="w-full max-w-sm">
        <SkeletonForm />
      </div>
    </main>
  );
}
