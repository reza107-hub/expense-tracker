export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 text-card-foreground">
        <h1 className="text-xl font-semibold tracking-tight">Expense Tracker</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dashboard coming soon.
        </p>
        <span className="mt-4 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
          Dark theme active
        </span>
      </div>
    </main>
  );
}
