import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-xl font-semibold">Nothing on the menu here</h1>
      <p className="text-sm text-muted-foreground">That page doesn't exist.</p>
      <Link to="/" className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground no-underline">
        Back to tonight
      </Link>
    </div>
  );
}
