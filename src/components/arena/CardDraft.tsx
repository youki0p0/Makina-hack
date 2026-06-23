"use client";

import { useRef, useState } from "react";
import { cardCost, getCard, isSkill } from "@/data/arena/cards";
import { fieldTransform } from "@/lib/arena/fieldTransform";
import type { FieldId, TargetMode } from "@/types/arena";

const RARITY_RING: Record<number, string> = {
  1: "border-white/20",
  2: "border-sky-400/60",
  3: "border-amber-400/80",
};
const RARITY_LABEL: Record<number, string> = { 1: "C", 2: "R", 3: "SR" };
const TARGET_LABEL: Record<TargetMode, string> = {
  single: "正面1体",
  lowest: "低HP1体",
  area: "敵全体",
  execute: "瀕死狙い",
  self: "自分",
  allies: "味方全体",
};

/**
 * ドラフト：提示カードを横スクロールで閲覧し、コスト予算内で選んで味方へ割り当てる。
 * リロールは廃止。カードを長押しすると詳細効果を表示。
 */
export default function CardDraft({
  draft,
  budget,
  field,
  selectedCardId,
  onSelect,
}: {
  draft: string[];
  budget: number;
  field: FieldId;
  selectedCardId: string | null;
  onSelect: (id: string) => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressed = useRef(false);

  const startPress = (id: string) => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setDetailId(id);
    }, 350);
  };
  const endPress = (id: string, affordable: boolean) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    if (!longPressed.current && affordable) onSelect(id);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-300">
          🃏 ドラフト（タップで選択 / 長押しで詳細）
        </span>
        <span className="rounded-lg bg-amber-500/20 px-2 py-1 text-[11px] font-bold text-amber-200">
          🪙 予算 {budget}
        </span>
      </div>

      {draft.length === 0 ? (
        <p className="py-3 text-center text-[10px] text-gray-500">
          このラウンドのカードは配り終えた。準備完了でOK！
        </p>
      ) : (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {draft.map((id) => {
            const c = getCard(id);
            if (!c) return null;
            const cost = cardCost(c);
            const affordable = cost <= budget;
            const skill = isSkill(c);
            const eff = skill ? fieldTransform(c, field, 0) : null;
            const changed = eff && (eff.name !== c.name || eff.fieldNote);
            return (
              <button
                key={id}
                onPointerDown={() => startPress(id)}
                onPointerUp={() => endPress(id, affordable)}
                onPointerLeave={() => {
                  if (pressTimer.current) clearTimeout(pressTimer.current);
                }}
                disabled={!affordable}
                className={`relative flex w-28 shrink-0 flex-col gap-1 rounded-xl border p-2 text-left ${
                  RARITY_RING[c.rarity]
                } ${skill ? "bg-emerald-500/10" : "bg-fuchsia-500/10"} ${
                  selectedCardId === id ? "ring-2 ring-amber-300" : ""
                } ${affordable ? "active:scale-95" : "opacity-40"}`}
              >
                <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-black">
                  {cost}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-lg">{c.emoji}</span>
                  <span className="rounded bg-black/30 px-1 text-[8px] text-gray-300">
                    {RARITY_LABEL[c.rarity]}
                  </span>
                </div>
                <span className="text-[11px] font-bold leading-tight">
                  {changed && eff ? eff.name : c.name}
                  {changed && (
                    <span className="ml-0.5 rounded bg-amber-500/30 px-0.5 text-[7px] text-amber-200">
                      変化
                    </span>
                  )}
                </span>
                <span className="text-[8px] leading-tight text-gray-400 line-clamp-2">
                  {changed && eff?.fieldNote ? eff.fieldNote : c.desc}
                </span>
                <span className="mt-auto flex flex-wrap gap-0.5">
                  {c.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded bg-white/10 px-1 text-[7px] text-gray-400">
                      {t}
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {selectedCardId && (
        <p className="mt-1.5 text-center text-[10px] text-emerald-300">
          ⬇ どの味方に持たせる？ 下の3体から選ぶ
        </p>
      )}

      {/* 長押し詳細 */}
      {detailId &&
        (() => {
          const c = getCard(detailId);
          if (!c) return null;
          const skill = isSkill(c);
          return (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
              onClick={() => setDetailId(null)}
            >
              <div
                className="w-full max-w-xs rounded-2xl border border-white/20 bg-[#15131f] p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <span className="text-3xl">{c.emoji}</span>
                  <div>
                    <div className="text-base font-extrabold">{c.name}</div>
                    <div className="text-[10px] text-gray-400">
                      {skill ? "技" : "装備"}・レア{RARITY_LABEL[c.rarity]}・コスト🪙{cardCost(c)}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-gray-200">{c.desc}</p>
                {skill &&
                  (() => {
                    const eff = fieldTransform(c, field, 0);
                    const isChanged = eff.name !== c.name || eff.fieldNote;
                    return (
                      <>
                        {isChanged && (
                          <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/10 p-2 text-[11px] text-amber-100">
                            <div className="font-bold">🌍 このフィールドでの変化</div>
                            <div className="mt-0.5">
                              {eff.name !== c.name ? `→ ${eff.name}：` : ""}
                              {eff.fieldNote ?? "効果が強化される"}
                            </div>
                          </div>
                        )}
                        <div className="mt-2 space-y-0.5 text-[11px] text-gray-300">
                          <div>🎯 対象: {TARGET_LABEL[eff.targeting]}</div>
                          {eff.power > 0 && <div>💥 威力: 攻撃×{eff.power}</div>}
                          {eff.heal ? <div>💚 回復: 攻撃×{eff.heal}</div> : null}
                          {eff.shield ? <div>🛡️ シールド: {eff.shield}</div> : null}
                          {eff.pierce ? <div>🏛️ 防御無視（貫通）</div> : null}
                          <div>⏱️ クールダウン: {eff.cooldown}</div>
                          {eff.apply && eff.apply.length > 0 && (
                            <div>
                              ✨ 付与: {eff.apply.map((a) => `${a.status}(${a.magnitude})`).join(" / ")}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] text-gray-300"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <button
                  onClick={() => setDetailId(null)}
                  className="mt-3 w-full rounded-xl bg-white/10 py-2 text-sm font-bold active:scale-95"
                >
                  閉じる
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
