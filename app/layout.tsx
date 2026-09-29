import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { NwisWorkspaceProvider } from "@/components/nwis-workspace-context";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "NWIS | Nearby Wells Intelligence System",
  description: "Standalone offset-well decision-support platform for drilling engineers.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${ibmPlexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-canvas text-ink">
        <NwisWorkspaceProvider>{children}</NwisWorkspaceProvider>
      </body>
    </html>
  );
}
