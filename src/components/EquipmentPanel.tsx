"use client";

import { useState } from "react";
import { canEquip, CLASSES } from "@/data/classes";
import { EQUIP_SLOTS } from "@/lib/battle";
import { computeSetEffects, getSetDef } from "@/data/sets";
import { QUALITIES } from "@/data/quality";
import ItemIcon from "@/components/ItemIcon";
import PixelGlyph from "@/components/PixelGlyph";
import GlyphText from "@/components/GlyphText";
import { rarityLabel, rarityStyle, slotLabel } from "@/lib/ui";
import { useGameStore } from "@/store/gameStore";
import type { Equipment, EquipmentSlot, EquippedItems } from "@/types/game";

export default function EquipmentPanel() {
  const equipped = useGameStore((s) => s.equipped);
  const unequip = useGameStore((s) => s.unequipItem);
  const classId = useGameStore((s) => s.classId);
  const setEff = computeSetEffects(equipped, classId);
  const [detail, setDetail] = useState<EquipmentSlot | null>(null);
  const detailItem = detail ? equipped[detail] : null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-bold text-gray-300">装備中</h2>

      {setEff.activeTiers.length > 0 && (
        <div className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 p-2">
          <p className="text-[10px] font-bold text-fuchsia-200">発動中のセット効果</p>
          <ul className="mt-1 space-y-1 text-[10px] text-fuchsia-100">
            {setEff.activeTiers.map((t) => {
              const def = getSetDef(t.key);
              return (
                <li key={t.key}>
                  <GlyphText text={t.icon} size={12} /> {t.name} ({t.pieces}部位)
                  <ul className="ml-3 text-gray-300">
                    {def?.bonuses
                      .filter((b) => t.pieces >= b.pieces)
                      .map((b) => (
                        <li key={b.pieces}>・{b.pieces}部位: {b.desc}</li>
                      ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {(setEff.attackPct > 0 || setEff.maxHpPct > 0) && (
        <div className="rounded-xl border border-cyan-400/50 bg-cyan-400/10 p-2">
          <p className="text-[10px] font-bold text-cyan-200">固有共鳴 / セット集中</p>
          <p className="mt-1 text-[10px] text-cyan-100">
            {setEff.attackPct > 0 && <span>攻撃 +{Math.round(setEff.attackPct * 100)}% </span>}
            {setEff.maxHpPct > 0 && <span>最大HP +{Math.round(setEff.maxHpPct * 100)}%</span>}
          </p>
        </div>
      )}

      {setEff.synergies.length > 0 && (
        <div className="rounded-xl border border-amber-400/50 bg-amber-400/10 p-2">
          <p className="flex items-center gap-1 text-[10px] font-bold text-amber-200"><PixelGlyph kind="stun" size={12} /> シナジー発動</p>
          <ul className="mt-1 space-y-0.5 text-[10px] text-amber-100">
            {setEff.synergies.map((s) => (
              <li key={s.name}>
                <span className="font-bold">{s.name}</span> — {s.desc}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-2">
        {EQUIP_SLOTS.map((slot) => {
          const item = equipped[slot as keyof EquippedItems];
          return (
            <div
              key={slot}
              className={`flex items-center justify-between rounded-xl border p-2 ${
                item ? rarityStyle[item.rarity].border : "border-white/10"
              } ${item ? rarityStyle[item.rarity].bg : "bg-black/20"}`}
            >
              <button
                onClick={() => item && setDetail(slot)}
                disabled={!item}
                className="flex min-w-0 flex-1 items-center gap-2 text-left active:scale-[0.98] disabled:active:scale-100"
              >
                {item && <ItemIcon item={item} size={48} />}
                <div className="min-w-0">
                  <span className="text-[10px] text-gray-400">{slotLabel[slot]}</span>
                  {item ? (
                    <p className={`truncate font-bold ${item.rarity === "legendary" ? "legendary-glow" : rarityStyle[item.rarity].text}`}>
                      {item.name}
                    </p>
                  ) : (
                    <p className="text-gray-500">なし</p>
                  )}
                </div>
              </button>
              {item && (
                <button
                  onClick={() => unequip(slot as keyof EquippedItems)}
                  className="ml-2 shrink-0 rounded-lg bg-white/10 px-3 py-1 text-xs active:scale-95"
                >
                  外す
                </button>
              )}
            </div>
          );
        })}
      </div>

      {detail && detailItem && (
        <EquippedDetail
          item={detailItem}
          onUnequip={() => {
            unequip(detail);
            setDetail(null);
          }}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function EquippedDetail({
  item,
  onUnequip,
  onClose,
}: {
  item: Equipment;
  onUnequip: () => void;
  onClose: () => void;
}) {
  const style = rarityStyle[item.rarity];
  const ok = CLASSES.filter((c) => canEquip(item, c.id));
  const set = item.setId ? getSetDef(item.setId) : null;
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className={`w-full max-w-sm animate-pop rounded-2xl border bg-[#15131f] p-4 ${style.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <ItemIcon item={item} size={64} />
          <h3 className={`min-w-0 flex-1 text-lg font-extrabold ${item.rarity === "legendary" ? "legendary-glow" : style.text}`}>
            {item.name}
          </h3>
        </div>
        <span className="text-[10px] text-gray-400">
          {slotLabel[item.slot]} ・ {rarityLabel[item.rarity]}
          {item.quality ? ` ・ ${QUALITIES[item.quality].label}` : ""}
          {item.modTier ? ` ・ ★${item.modTier}` : ""}
          {item.forgeLevel ? ` ・ 鍛冶+${item.forgeLevel}` : ""}
        </span>
        <p className="mt-1 text-[10px] text-gray-400">
          {ok.length >= CLASSES.length ? "装備可能: 全職業" : `装備可能: ${ok.map((c) => c.name).join(" / ")}`}
        </p>
        <p className="mt-2 text-sm text-gray-200">{item.description}</p>

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {item.attack !== 0 && <span className="rounded-md bg-white/10 px-2 py-1">攻撃 +{item.attack}</span>}
          {item.defense !== 0 && <span className="rounded-md bg-white/10 px-2 py-1">防御 +{item.defense}</span>}
          {item.maxHp !== 0 && <span className="rounded-md bg-white/10 px-2 py-1">HP +{item.maxHp}</span>}
          {item.rerollModifier !== 0 && (
            <span className="rounded-md bg-white/10 px-2 py-1">リロール {item.rerollModifier > 0 ? "+" : ""}{item.rerollModifier}</span>
          )}
        </div>

        {item.diceModifiers.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2">
            <p className="text-[10px] font-bold text-amber-300">✦ 出目の変化</p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-100">
              {item.diceModifiers.map((mod, i) => (
                <li key={i}>・{mod.description}</li>
              ))}
            </ul>
          </div>
        )}

        {set && (
          <div className="mt-3 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 p-2">
            <p className="text-[10px] font-bold text-fuchsia-300">
              <GlyphText text={set.icon} size={12} /> {set.name}セット
            </p>
            <ul className="mt-1 space-y-0.5 text-[10px] text-fuchsia-100">
              {set.bonuses.map((b) => (
                <li key={b.pieces}>・{b.pieces}部位: {b.desc}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-xl bg-white/10 font-bold active:scale-95">
            閉じる
          </button>
          <button onClick={onUnequip} className="h-12 flex-1 rounded-xl bg-white/10 font-bold active:scale-95">
            外す
          </button>
        </div>
      </div>
    </div>
  );
}
