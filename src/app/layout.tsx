import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaEnviar",
  description: "Webapp interna para envíos con trazabilidad y firma.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className="antialiased"
      >
        {children}
      </body>
    </html>
  );
}
