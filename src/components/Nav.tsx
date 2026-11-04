import { Link } from "@tanstack/react-router";
import { CalendarDays, Heart, ShoppingBasket, Sparkles, UtensilsCrossed } from "lucide-react";

const links = [
  { to: "/", label: "Tonight", icon: UtensilsCrossed, exact: true },
  { to: "/week", label: "This week", icon: CalendarDays },
  { to: "/date-night", label: "Date night", icon: Heart },
  { to: "/grocery", label: "Grocery", icon: ShoppingBasket },
] as const;

export function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="hidden text-base font-semibold tracking-tight sm:inline">
            Thoughts on Dinner
          </span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto scroll-x">
          {links.map(({ to, label, icon: Icon, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: "exact" in rest && rest.exact }}
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
  );
}
