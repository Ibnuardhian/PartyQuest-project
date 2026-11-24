"use client";

import { useEffect, useMemo, useState } from "react";
import qrcode from "qrcode-generator";

/** Dark-module coordinates of a QR code for `text` (error correction M, automatic size). */
export function qrModules(text: string) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const size = qr.getModuleCount();
  const cells: Array<[number, number]> = [];
  for (let row = 0; row < size; row += 1) for (let col = 0; col < size; col += 1) if (qr.isDark(row, col)) cells.push([col, row]);
  return { size, cells };
}

/**
 * QR code drawn as inline SVG: always black modules on a white quiet zone, because many scanners
 * cannot read inverted codes on dark themes. `path` is resolved against the page origin.
 */
export function QrCode({ path, label, className }: { path: string; label: string; className?: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setOrigin(window.location.origin), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const url = origin ? `${origin}${path}` : "";
  const qr = useMemo(() => (url ? qrModules(url) : null), [url]);
  if (!qr) return null;
  const quiet = 4;
  const box = qr.size + quiet * 2;
  const d = qr.cells.map(([x, y]) => `M${x + quiet} ${y + quiet}h1v1h-1z`).join("");
  return <figure className={`qr-code${className ? ` ${className}` : ""}`}>
    <svg viewBox={`0 0 ${box} ${box}`} role="img" aria-label={`${label}: ${url}`} shapeRendering="crispEdges">
      <rect width={box} height={box} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
    <figcaption>{label}</figcaption>
  </figure>;
}
