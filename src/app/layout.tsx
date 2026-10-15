import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PharmaLink | Verified pharmaceutical procurement",
  description: "A trusted procurement workspace for manufacturers and stockists.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
