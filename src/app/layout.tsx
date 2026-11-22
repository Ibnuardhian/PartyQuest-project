import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PartyQuest — Game untuk Dimainkan Bersama",
  description: "Pilih permainan sosial untuk dimainkan bersama teman. Undercover adalah game pertama PartyQuest.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
