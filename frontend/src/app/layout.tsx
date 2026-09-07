import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Form builder",
  description: "A Typeform-inspired draft builder. Full-stack assignment, Stage 1.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
