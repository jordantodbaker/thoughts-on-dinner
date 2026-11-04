import { useState, type ReactNode } from "react";
import { Button } from "./ui/button";
import { cn } from "~/lib/utils";

/** Items shown on a phone before "Show more". Fixed because the Tailwind
 *  selector below has to be a static class. */
const LIMIT = 8;

/**
 * A list that shows only the first eight items on phones until tapped open;
 * wider screens always show everything. Done with CSS (`nth-child`) rather
 * than slicing so the server HTML is identical for every viewport and
 * nothing shifts on hydration.
 */
export function CollapsibleList({
  items,
  className,
  children,
}: {
  items: number;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const hidden = Math.max(0, items - LIMIT);
  const collapsed = !open && hidden > 0;
  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          className,
          // Hide items past the limit on small screens only.
          collapsed && "max-sm:[&>*:nth-child(n+9)]:hidden",
        )}
      >
        {children}
      </div>
      {hidden > 0 ? (
        <Button variant="outline" size="sm" className="self-center sm:hidden" onClick={() => setOpen((v) => !v)}>
          {open ? "Show fewer" : `Show ${hidden} more`}
        </Button>
      ) : null}
    </div>
  );
}
