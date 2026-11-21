import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "NYXORA",
  description: "Think freely. Share nothing sensitive.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark font-sans", plusJakarta.variable)}>
      <body className="relative min-h-screen bg-background text-foreground antialiased">
        <div className="relative z-10 min-h-screen">
          <AuthProvider>{children}</AuthProvider>
        </div>
      </body>
    </html>
  );
}
