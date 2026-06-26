# iOS アプリのビルド手順（Capacitor）

このリポジトリの Web 版（Next.js）を、コードを書き直さずに Capacitor で
ネイティブの殻に包み、App Store へ提出するための手順です。

> 重要: ここまでの準備（Capacitor 導入・`ios/` プロジェクト生成・縦画面固定・
> セーフエリア対応）はリポジトリ側で完了済み。**ビルド・署名・申請は Mac + Xcode が必須**です。
> 通常の Web ビルド / Vercel デプロイには一切影響しません（静的書き出しは `CAP_BUILD=1` の時だけ有効）。

## 必要なもの

- macOS + Xcode（最新版）
- Apple Developer Program（取得済み）
- CocoaPods … `sudo gem install cocoapods` もしくは `brew install cocoapods`
- Node.js（このリポジトリの開発環境と同じ）

## 1. 依存をインストール

```bash
npm install
sudo gem install cocoapods   # 初回のみ
```

## 2. Web を静的書き出し → ネイティブへ同期

```bash
npm run sync:ios
```

`npm run build:ios`（= `CAP_BUILD=1 next build` で `out/` を生成）→ `cap sync ios`
（`out/` を `ios/App/App/public` へコピー＋プラグイン更新＋`pod install`）をまとめて実行します。

## 3. Xcode で開く

```bash
npm run open:ios   # = cap open ios
```

Xcode が `ios/App/App.xcworkspace` を開きます（`.xcodeproj` ではなく **workspace** を使うこと）。

## 4. 署名とアプリ情報

- ターゲット **App** → **Signing & Capabilities** で自分の Team を選択。
- Bundle Identifier: `com.diceexmachina.dungeon`
  （変更する場合は `capacitor.config.ts` の `appId` と Xcode 両方を合わせる）。
- バージョン/ビルド番号は General タブで設定。

## 5. アイコンとスプラッシュ画像

**設定済み**。アプリアイコン（1024×1024・透過なし）とスプラッシュ（2732×2732・暗背景＋
中央ロゴ）はリポジトリに組み込み済みなので、このままビルドできます。

- アプリアイコン: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- スプラッシュ: `ios/App/App/Assets.xcassets/Splash.imageset/*.png`
- 生成元素材: `assets/icon.png` / `assets/splash.png`

差し替えたい・各サイズを最適化したい場合は、Mac 側で Capacitor のアセット生成ツールを使えます。

```bash
# assets/icon.png (1024x1024), assets/splash.png (2732x2732) を差し替えてから:
npm install --save-dev @capacitor/assets
npx capacitor-assets generate --ios
```

> 注: `@capacitor/assets` は `sharp` を使うため Mac 側で実行してください。

> アイコンは角丸と金枠が画像に焼き込まれています。iOS は独自の角丸マスクを上から重ねるため、
> 角の金枠がわずかに削れる場合があります。気になる場合は角を含まないフルブリード版に差し替えてください。

## 6. 実機/シミュレータで確認 → 提出

- シミュレータまたは実機を選んで Run（▶）。
- 問題なければ **Product → Archive** → Organizer から **Distribute App** で
  App Store Connect へアップロード。
- App Store Connect でメタデータ・スクリーンショット・プライバシー情報を登録して審査提出。

## 注意点（審査・運用）

- **ネット通信**: ランキング/echo 機能は Supabase へ HTTPS 通信します。App の
  Privacy（データ収集）に該当する場合は App Store Connect で申告してください。
- **Service Worker / バージョンゲート**: ネイティブ殻内では自動で無効化済み
  （`src/components/PWARegister.tsx`）。アプリの更新は App Store の再申請で行います。
- **Web 版は別系統**: Vercel への Web デプロイは従来どおり。iOS 用の変更は
  デプロイ挙動を変えません。

## よく使うコマンド早見表

| 目的 | コマンド |
| --- | --- |
| 静的書き出し | `npm run build:ios` |
| 書き出し＋ネイティブ同期 | `npm run sync:ios` |
| Xcode を開く | `npm run open:ios` |
