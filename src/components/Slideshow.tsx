import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import slides from "~/lib/slides.json";
import { cn } from "~/lib/utils";

type Slide = { src: string; width: number; height: number };

const INTERVAL_MS = 5000;

/**
 * A small crossfading slideshow of the photos in public/slides (web-sized by
 * `pnpm slides:optimize`). Auto-advances unless the user prefers reduced
 * motion or is hovering; the first slide is in the server HTML so there's no
 * flash on load.
 */
export function Slideshow({ className }: { className?: string }) {
  const list = slides as Slide[];
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (list.length < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, [list.length, paused]);

  if (list.length === 0) return null;

  const go = (delta: number) => setIndex((i) => (i + delta + list.length) % list.length);

  return (
    <div
      className={cn(
        "group relative aspect-[3/4] overflow-hidden rounded-2xl border bg-muted shadow-sm",
        className,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Photos"
    >
      {list.map((s, i) => (
        <img
          key={s.src}
          src={s.src}
          width={s.width}
          height={s.height}
          alt=""
          loading={i === 0 ? "eager" : "lazy"}
          decoding="async"
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-700 ease-in-out",
            i === index ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={i !== index}
        />
      ))}

      {list.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {list.map((s, i) => (
              <button
                key={s.src}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Photo ${i + 1} of ${list.length}`}
                aria-current={i === index}
                className={cn(
                  "size-1.5 rounded-full bg-white/60 shadow transition-all",
                  i === index && "w-4 bg-white",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
