import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PartyQuest — Game untuk Dimainkan Bersama",
  description: "Pilih permainan sosial untuk dimainkan bersama teman. Undercover adalah game pertama PartyQuest.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Browser extensions (e.g. ColorZilla) add attributes to <body> before React hydrates.
  return <html lang="id"><body suppressHydrationWarning>{children}</body></html>;
}
