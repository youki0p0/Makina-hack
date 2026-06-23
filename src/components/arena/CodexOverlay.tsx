"use client";

import { useState } from "react";
import { ACHIEVEMENTS } from "@/lib/arena/achievements";
import { EQUIPMENT, SKILLS } from "@/data/arena/cards";
import { FIELDS } from "@/data/arena/fields";
import { COLOR_DOT, COLOR_LABEL, MONSTERS } from "@/data/arena/monsters";
import { OPERATORS } from "@/data/arena/operators";
import { useArenaStore } from "@/store/arenaStore";
import CardChip from "./CardChip";
import MonsterSprite from "./MonsterSprite";
import OperatorBadge from "./OperatorBadge";

type Tab = "monster" | "card" | "field" | "operator" | "synergy" | "achieve";

const SYNERGY_REF: { emoji: string; name: string; cond: string; effect: string }[] = [
  { emoji: "🌿", name: "森の陣", cond: "緑×3", effect: "毎秒回復+12・防御/HP+18%・攻撃+8%" },
  { emoji: "🔷", name: "魔導陣", cond: "青×3", effect: "CT-35%・速度+15%・シールド+70・防御+20%" },
  { emoji: "🔺", name: "猛火陣", cond: "赤×3", effect: "攻撃+35%・クリ+18%・HP+15%・防御+10%" },
  { emoji: "🌈", name: "三原陣", cond: "緑+青+赤", effect: "全ステータス+8%（役割コンプ）" },
  { emoji: "☠️", name: "毒炎", cond: "緑+赤の2色", effect: "毒に火傷追加・攻撃+10%・HP+6%・回復+5" },
  { emoji: "💨", name: "加速火力", cond: "青+赤の2色", effect: "速度/クリ大・シールド+60・HP+16%・防御+10%" },
  { emoji: "🛡️", name: "守護術式", cond: "緑+青の2色", effect: "防御+18%・回復+28%・シールド+28・CT-8%" },
  { emoji: "🔥", name: "業火結界", cond: "fireタグ×3", effect: "火傷ダメージ+4" },
  { emoji: "🟣", name: "瘴気蔓延", cond: "poisonタグ×3", effect: "毒が拡散" },
  { emoji: "🧱", name: "鉄壁布陣", cond: "defenseタグ×3", effect: "防御+12%" },
  { emoji: "💚", name: "癒やしの輪", cond: "healタグ×2", effect: "回復量+25%" },
  { emoji: "🎯", name: "急所連携", cond: "criticalタグ×2", effect: "クリ率+12%" },
  { emoji: "⚡", name: "疾風連携", cond: "hasteタグ×2", effect: "速度+10%" },
  { emoji: "🪞", name: "鏡面陣", cond: "reflectタグ×2", effect: "防御+5%・反射強化" },
  { emoji: "💢", name: "集中", cond: "1体に技3枚以上", effect: "威力+40%・被ダメ+10%" },
  { emoji: "🤝", name: "分散", cond: "全員が技持ち", effect: "崩れにくい安定布陣" },
];

const TABS: { id: Tab; label: string }[] = [
  { id: "monster", label: "🐲 モンスター" },
  { id: "card", label: "🃏 カード" },
  { id: "field", label: "🌋 フィールド" },
  { id: "operator", label: "🧑‍🚀 操者" },
  { id: "synergy", label: "✦ シナジー" },
  { id: "achieve", label: "🏆 実績" },
];

export default function CodexOverlay({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("monster");
  const unlocked = useArenaStore((s) => s.achievements);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-3">
      <div className="flex max-h-[88dvh] w-full max-w-sm flex-col rounded-2xl border border-white/15 bg-[#14121d]">
        <div className="flex items-center justify-between border-b border-white/10 p-3">
          <h2 className="text-base font-extrabold">📖 ずかん</h2>
          <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1 text-sm active:scale-95">
            閉じる
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-white/10 p-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-2 py-1 text-[10px] font-bold active:scale-95 ${
                tab === t.id ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto p-3">
          {tab === "monster" &&
            MONSTERS.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2">
                <MonsterSprite monster={m} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-bold">
                    {COLOR_DOT[m.color]} {m.name}{" "}
                    <span className="text-[9px] text-gray-400">({COLOR_LABEL[m.color]}・{m.role})</span>
                  </div>
                  <div className="text-[9px] text-gray-300">
                    ❤️{m.hp} ⚔️{m.attack} 🛡️{m.defense} 💨{m.speed}
                  </div>
                  <div className="text-[9px] text-gray-400">{m.desc}</div>
                </div>
              </div>
            ))}

          {tab === "card" && (
            <>
              <div className="text-[10px] font-bold text-fuchsia-300">装備カード</div>
              {EQUIPMENT.map((c) => (
                <CardChip key={c.id} cardId={c.id} />
              ))}
              <div className="mt-2 text-[10px] font-bold text-emerald-300">技カード</div>
              {SKILLS.map((c) => (
                <CardChip key={c.id} cardId={c.id} />
              ))}
            </>
          )}

          {tab === "field" &&
            FIELDS.map((f) => (
              <div
                key={f.id}
                style={{ borderColor: f.accent }}
                className="rounded-xl border bg-white/[0.03] p-2"
              >
                <div className="text-[12px] font-bold" style={{ color: f.accent }}>
                  {f.emoji} {f.name} <span className="text-[9px] text-gray-400">{f.theme}</span>
                </div>
                <div className="text-[10px] text-gray-300">{f.desc}</div>
              </div>
            ))}

          {tab === "operator" &&
            OPERATORS.map((o) => (
              <div key={o.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                <OperatorBadge operator={o} size={36} showPassive />
                <div className="mt-1 text-[9px] text-gray-400">{o.concept}</div>
              </div>
            ))}

          {tab === "achieve" && (
            <>
              <div className="mb-1 text-[10px] text-gray-400">
                {unlocked.length} / {ACHIEVEMENTS.length} 達成
              </div>
              {ACHIEVEMENTS.map((a) => {
                const got = unlocked.includes(a.id);
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2 rounded-xl border p-2 text-[11px] ${
                      got ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-black/20 opacity-60"
                    }`}
                  >
                    <span className="text-lg">{got ? a.emoji : "🔒"}</span>
                    <div>
                      <div className="font-bold text-gray-100">{a.name}</div>
                      <div className="text-[9px] text-gray-400">{a.desc}</div>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {tab === "synergy" && (
            <div className="mb-1 rounded-xl border border-amber-400/40 bg-amber-500/10 p-2 text-[10px] text-amber-100">
              🔺 <b>色の三すくみ</b>：緑 → 赤 → 青 → 緑（緑は赤に強い／赤は青に強い／青は緑に強い）。
              有利な色は与ダメ増。敵の色は毎ラウンド変わるので、単色で染めると得意・不得意が交互に来る。
              色シナジーは <b>単色＝単色陣 / 2色＝該当ペア / 3色＝三原陣</b> のいずれか1つが付く（重複しない）。
            </div>
          )}
          {tab === "synergy" &&
            SYNERGY_REF.map((s) => (
              <div key={s.name} className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2 text-[10px]">
                <span className="text-base">{s.emoji}</span>
                <div>
                  <span className="font-bold text-amber-200">{s.name}</span>{" "}
                  <span className="text-gray-400">[{s.cond}]</span>
                  <div className="text-gray-300">{s.effect}</div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
