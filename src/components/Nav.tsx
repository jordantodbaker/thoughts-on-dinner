import { Link } from "@tanstack/react-router";
import { CalendarDays, Heart, ShoppingBasket, Sparkles, UtensilsCrossed } from "lucide-react";

const links = [
  { to: "/", label: "Tonight", icon: UtensilsCrossed, exact: true },
  { to: "/week", label: "This week", short: "Week", icon: CalendarDays, exact: false },
  { to: "/date-night", label: "Date night", short: "Date night", icon: Heart, exact: false },
  { to: "/grocery", label: "Grocery", icon: ShoppingBasket, exact: false },
] as const;

/** Top bar everywhere; the links move to a thumb-reachable bottom tab bar on phones. */
export function Nav() {
  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">Thoughts on Dinner</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {links.map(({ to, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground no-underline hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-muted text-foreground font-medium" }}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <div className="grid grid-cols-4">
          {links.map(({ to, label, icon: Icon, exact, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground no-underline"
              activeProps={{ className: "text-primary font-medium" }}
            >
              <Icon className="size-5" />
              <span>{"short" in rest ? rest.short : label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
