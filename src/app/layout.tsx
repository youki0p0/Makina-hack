import type { Metadata, Viewport } from "next";
import AudioController from "@/components/AudioController";
import AchievementToaster from "@/components/AchievementToaster";
import PWARegister from "@/components/PWARegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dice Ex Machina",
  description: "装備で出目が書き換わる、スマホ向けコマンド式ハクスラRPG",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Dice Ex Machina",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0a12",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AudioController />
        <PWARegister />
        <AchievementToaster />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
