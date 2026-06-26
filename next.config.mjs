/** @type {import('next').NextConfig} */

// iOS(Capacitor) 用ビルドのときだけ静的書き出しに切り替える。
// 通常の Web ビルド/ Vercel デプロイは従来どおり（env 未設定）なので影響しない。
const isCapacitor = process.env.CAP_BUILD === "1";

const nextConfig = {
  reactStrictMode: true,
  ...(isCapacitor
    ? {
        // Capacitor の WebView へ同梱する静的サイトを out/ に書き出す。
        output: "export",
        // file:// / capacitor:// 配信で相対パスが解決できるようにする。
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
