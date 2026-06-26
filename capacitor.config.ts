import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // App Store の Bundle Identifier。必要なら Apple Developer の登録に合わせて変更する。
  appId: "com.diceexmachina.dungeon",
  appName: "ダイスエクスマキナ",
  // next build (CAP_BUILD=1) が静的書き出しする先。
  webDir: "out",
  ios: {
    // 暗い背景にスクロール時の白い跳ね返りを避ける。
    backgroundColor: "#0b0a12",
    // セーフエリアは CSS(env(safe-area-inset-*)) 側で処理する。
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: "#0b0a12",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0a12",
    },
  },
};

export default config;
