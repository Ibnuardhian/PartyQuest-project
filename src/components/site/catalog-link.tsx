import Link from "next/link";
import type { ReactNode } from "react";

/** Link back to the game catalog, used on every in-game, lobby, and setup screen so players can always leave a game. */
export function CatalogLink({ className = "text-button", children = "Katalog game" }: { className?: string; children?: ReactNode }) {
  return <Link className={className} href="/">{children}</Link>;
}
