import { useCallback, useEffect, useState } from "react";

const KEY = "tod:show-early";

/**
 * "Show events before 5" preference. Off by default (weekday items that end
 * by 5 PM are hidden). Remembered in localStorage; read after mount so the
 * server HTML and the first client render match.
 */
export function useShowEarly(): [boolean, (next: boolean) => void] {
  const [showEarly, setState] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "1") setState(true);
    } catch {
      /* private mode etc. — stay with the default */
    }
  }, []);
  const setShowEarly = useCallback((next: boolean) => {
    setState(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);
  return [showEarly, setShowEarly];
}
