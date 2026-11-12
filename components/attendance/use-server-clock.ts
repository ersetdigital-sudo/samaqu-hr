"use client";

import { useEffect, useRef, useState } from "react";

/** Jam berjalan yang di-anchor ke waktu server, ditampilkan dalam WIB. */
export function useServerClock(initialIso: string): Date {
  const [now, setNow] = useState(() => new Date(initialIso));
  const offset = useRef(new Date(initialIso).getTime() - Date.now());

  useEffect(() => {
    offset.current = new Date(initialIso).getTime() - Date.now();
    const tick = () => setNow(new Date(Date.now() + offset.current));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [initialIso]);

  return now;
}
