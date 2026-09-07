import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Form builder",
  description: "A Typeform-inspired multi-question draft builder. Full-stack assignment, Stage 2.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
