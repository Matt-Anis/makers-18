import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contract Privacy Gateway",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
