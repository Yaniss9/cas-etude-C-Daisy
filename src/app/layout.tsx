import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Daisy — Facturation",
  description: "Cas pratique Daisy, sujet C : la facture qui doit être juste",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
