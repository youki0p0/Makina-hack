"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BESTIARY_BOSSES, ENEMY_ABILITY_LABEL, ENEMY_TEMPLATES } from "@/data/enemies";
import { ITEMS } from "@/data/items";
import {
  FLOOR_ACHIEVEMENTS,
  milestoneSouls,
  nextMilestoneFloor,
} from "@/data/milestones";
import { TITLES, isTitleUnlocked, titleSouls } from "@/data/titles";
import { SETS } from "@/data/sets";
import EnemyIcon from "@/components/EnemyIcon";
import PixelGlyph from "@/components/PixelGlyph";
import GlyphText from "@/components/GlyphText";
import { rarityLabel, rarityStyle } from "@/lib/ui";
import {
  MUSIC_TRACKS,
  initAudio,
  isMuted,
  setBgmTheme,
  setMuted,
  startBgm,
  stopBgm,
} from "@/lib/audio";
import { useGameStore } from "@/store/gameStore";

type Tab = "achievements" | "items" | "sets" | "enemies" | "music";

const TAB_LABEL: Record<Tab, string> = {
  achievements: "実績",
  items: "装備",
  sets: "セット",
  enemies: "敵",
  music: "音楽",
};

export default function CollectionPage() {
  const hydrate = useGameStore((s) => s.hydrate);
  const hydrated = useGameStore((s) => s.hydrated);
  const progress = useGameStore((s) => s.progress);
  const titleId = useGameStore((s) => s.titleId);
  const setTitle = useGameStore((s) => s.setTitle);
  const [tab, setTab] = useState<Tab>("achievements");
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Stop the jukebox and restore the menu theme when leaving the 音楽 tab.
  useEffect(() => {
    if (tab !== "music" && playingId !== null) {
      setBgmTheme("dungeon");
      setPlayingId(null);
    }
  }, [tab, playingId]);

  const playTrack = (track: (typeof MUSIC_TRACKS)[number]) => {
    initAudio();
    if (playingId === track.id) {
      stopBgm();
      setPlayingId(null);
      return;
    }
    if (isMuted()) setMuted(false); // 鑑賞のためサウンドを有効化
    setBgmTheme(track.theme, track.transpose ?? 1);
    startBgm();
    setPlayingId(track.id);
  };

  if (!hydrated) {
    return (
      <main className="flex min-h-dvh items-center justify-center text-gray-500">読み込み中…</main>
    );
  }

  const enemies = [...ENEMY_TEMPLATES, ...BESTIARY_BOSSES];

  return (
    <main className="flex min-h-dvh flex-col gap-3 p-3">
      <div className="flex items-center justify-between">
        <Link href="/" className="rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95">
          ← ホーム
        </Link>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-center">
        <h1 className="flex items-center justify-center gap-1 font-bold"><PixelGlyph kind="codex" size={18} /> 実績 / 図鑑</h1>
        <div className="mt-1 grid grid-cols-3 gap-1 text-[10px] text-gray-300">
          <span>最深 {progress.maxFloor}階</span>
          <span>最高到達 {progress.highestFloorReached}階</span>
          <span>撃破 {progress.kills}</span>
          <span>ボス {progress.bossKills}</span>
          <span>転生 {progress.rebirths}</span>
          <span>最大連勝 {progress.maxStreak}</span>
        </div>
        <p className="mt-2 text-[10px] text-violet-300">
          次の転生ポイント: {nextMilestoneFloor(progress.highestFloorReached)}階 で +
          {milestoneSouls(nextMilestoneFloor(progress.highestFloorReached))}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-1">
        {(["achievements", "items", "sets", "enemies", "music"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`h-10 rounded-xl text-[11px] font-bold active:scale-95 ${
              tab === t ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "achievements" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">階層実績（到達で素材・転生ポイント獲得）</p>
          <div className="grid grid-cols-2 gap-1">
            {FLOOR_ACHIEVEMENTS.map((fa) => {
              const done = progress.claimedFloorAchievements.includes(fa.id);
              return (
                <div
                  key={fa.id}
                  className={`rounded-lg border p-2 text-[10px] ${
                    done
                      ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 bg-black/20 text-gray-400"
                  }`}
                >
                  <p className="font-bold">
                    <PixelGlyph kind={done ? "star" : "lock"} size={12} /> {fa.name}
                  </p>
                  <p>
                    素材+{fa.gachaPoints}
                    {fa.souls ? ` / 転生+${fa.souls}` : ""}
                  </p>
                </div>
              );
            })}
          </div>

          {/* 称号（旧・称号タブを統合）。獲得で転生ポイント、名前の前に表示。 */}
          <div className="pt-2">
            <p className="text-xs font-bold text-amber-200">称号</p>
            <p className="text-[11px] text-gray-400">
              名前の前に表示される称号を選べる。獲得すると転生ポイント(0.5〜1)を獲得。
            </p>
            <p className="mt-0.5 text-[11px] text-amber-300">
              獲得 {TITLES.filter((t) => t.tier && isTitleUnlocked(t.id, progress)).length} / {TITLES.filter((t) => t.tier).length}
            </p>
          </div>
          <div className="space-y-2">
            {TITLES.map((t) => {
              const unlocked = isTitleUnlocked(t.id, progress);
              const current = t.id === titleId;
              // Hidden titles stay masked (name + desc) until unlocked.
              const mask = !unlocked && t.hidden;
              return (
                <button
                  key={t.id || "none"}
                  onClick={() => unlocked && setTitle(t.id)}
                  disabled={!unlocked}
                  className={`flex w-full items-center justify-between gap-2 rounded-xl border p-2 text-left active:scale-[0.98] disabled:opacity-50 ${
                    current ? "border-amber-500/60 bg-amber-500/10" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`font-bold ${current ? "text-amber-200" : unlocked ? "text-gray-100" : "text-gray-500"}`}>
                      {unlocked ? <>《<GlyphText text={t.name} size={13} />》</> : <><PixelGlyph kind="lock" size={12} /> ???</>}
                    </p>
                    <p className="text-[10px] text-gray-400">{mask ? "??????（隠し称号）" : t.desc}</p>
                  </div>
                  {current ? (
                    <span className="shrink-0 text-[10px] text-amber-300">選択中</span>
                  ) : t.tier ? (
                    <span className="shrink-0 text-[10px] text-violet-300">転生+{titleSouls(t)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === "items" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            発見 {ITEMS.filter((i) => progress.discoveredItems.includes(i.id)).length} / {ITEMS.length}
            <span className="ml-1 text-[10px] text-gray-500">（署名・セット装備のみ。素材装備は対象外）</span>
          </p>
          {ITEMS.map((item) => {
            const found = progress.discoveredItems.includes(item.id);
            const style = rarityStyle[item.rarity];
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-2 ${found ? `${style.border} ${style.bg}` : "border-white/10 bg-black/20"}`}
              >
                {found ? (
                  <>
                    <p className={`font-bold ${style.text}`}>
                      {item.name} <span className="text-[10px] text-gray-400">{rarityLabel[item.rarity]}</span>
                    </p>
                    <p className="text-[10px] text-gray-300">{item.description}</p>
                  </>
                ) : (
                  <p className="text-gray-500">??? （未発見）</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "sets" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            セット装備は2/4/6部位でビルドが変わる。装飾以外は職業制限あり。
            深層では新しいセットが手続き生成で無限に出現する。
          </p>
          {SETS.map((set) => (
            <div key={set.key} className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-2">
              <p className="font-bold text-fuchsia-200">
                <GlyphText text={set.icon} size={14} /> {set.name}セット
              </p>
              <ul className="mt-1 space-y-0.5 text-[10px] text-fuchsia-100">
                {set.bonuses.map((b) => (
                  <li key={b.pieces}>・{b.pieces}部位: {b.desc}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "enemies" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            撃破 {enemies.filter((e) => progress.defeatedEnemies.includes(e.id)).length} / {enemies.length}
          </p>
          {enemies.map((e) => {
            const found = progress.defeatedEnemies.includes(e.id);
            return (
              <div
                key={e.id}
                className={`flex items-center gap-3 rounded-xl border p-2 ${
                  found ? "border-white/15 bg-black/30" : "border-white/10 bg-black/20 opacity-70"
                }`}
              >
                <div className="text-3xl">
                  {found ? (
                    <EnemyIcon enemy={{ templateId: e.id, isBoss: e.isBoss, modTier: 0 }} size={40} />
                  ) : (
                    "❓"
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold">
                    {found ? e.name : "???"}
                    {found && e.ability && (
                      <span className="ml-2 text-[10px] text-rose-300">
                        {ENEMY_ABILITY_LABEL[e.ability]}
                      </span>
                    )}
                    {found && e.isBoss && <span className="ml-1 text-[10px] text-red-400">BOSS</span>}
                  </p>
                  <p className="text-[10px] text-gray-400">{found ? e.desc : "未発見の敵"}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "music" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            ゲーム中のBGMをループ再生で鑑賞できる。曲をタップで再生、もう一度で停止。
            <span className="ml-1 text-[10px] text-gray-500">（再生するとサウンドがオンになります）</span>
          </p>

          <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-[10px] text-violet-200">
            <p className="flex items-center gap-1 font-bold">
              <PixelGlyph kind="star" size={12} /> 楽曲クレジット
            </p>
            <p className="mt-1 leading-relaxed text-gray-300">
              本作のBGMは全{MUSIC_TRACKS.length}曲すべて書き下ろしのオリジナル・チップチューン。
              音声ファイルは使わず、Web Audioでリアルタイムに合成しています
              （迷宮/拠点・各章フィールド・大ボス戦・カジノ・鍛冶屋・ダイスラッシュ(AT)、
              そしてスタッフロール曲まで）。
            </p>
          </div>

          {MUSIC_TRACKS.map((t) => {
            const playing = playingId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => playTrack(t)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left active:scale-[0.98] ${
                  playing ? "border-emerald-500/60 bg-emerald-500/10" : "border-white/10 bg-black/20"
                }`}
              >
                <div className="min-w-0">
                  <p className={`font-bold ${playing ? "text-emerald-200" : "text-gray-100"}`}>
                    {t.name}
                    {playing && <span className="ml-2 text-[10px] text-emerald-300">再生中…</span>}
                  </p>
                  <p className="text-[10px] text-gray-400">{t.desc}</p>
                </div>
                <span className={`shrink-0 text-lg ${playing ? "text-emerald-300" : "text-gray-400"}`}>
                  {playing ? "⏸" : "▶"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}
