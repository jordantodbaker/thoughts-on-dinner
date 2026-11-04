import { Link, type ErrorComponentProps, useRouter } from "@tanstack/react-router";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  const router = useRouter();
  console.error("DefaultCatchBoundary", error);
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <pre className="max-w-full overflow-auto rounded-md bg-muted p-3 text-left text-xs text-muted-foreground">
        {message}
      </pre>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => router.invalidate()}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
        >
          Try again
        </button>
        <Link to="/" className="rounded-md border px-3 py-1.5 text-sm no-underline">
          Home
        </Link>
      </div>
    </div>
  );
}
