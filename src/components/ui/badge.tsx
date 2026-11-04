import * as React from "react";
import { cn } from "~/lib/utils";

export function Badge({
  className,
  tone = "muted",
  ...props
}: React.ComponentProps<"span"> & { tone?: "muted" | "accent" | "primary" | "custom" }) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    accent: "bg-accent/15 text-accent",
    primary: "bg-primary/10 text-primary",
    custom: "",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
