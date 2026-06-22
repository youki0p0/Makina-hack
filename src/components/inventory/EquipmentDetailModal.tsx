"use client";

import { canEquip, CLASSES } from "@/data/classes";
import { QUALITIES } from "@/data/quality";
import { getSetDef } from "@/data/sets";
import { SCRAP_VALUE } from "@/lib/loot";
import { itemKey, rarityLabel, rarityStyle, slotLabel } from "@/lib/ui";
import ItemIcon from "@/components/ItemIcon";
import PixelGlyph from "@/components/PixelGlyph";
import GlyphText from "@/components/GlyphText";
import RarityPips from "@/components/inventory/RarityPips";
import type { Equipment } from "@/types/game";

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-gray-500"> (±0)</span>;
  return (
    <span className={value > 0 ? "text-emerald-300" : "text-red-300"}>
      {" "}
      ({value > 0 ? "+" : ""}
      {value})
    </span>
  );
}

export default function EquipmentDetailModal({
  item,
  equippedItem,
  favorite,
  equippable,
  onToggleFavorite,
  onEquip,
  onScrap,
  onClose,
}: {
  item: Equipment;
  equippedItem: Equipment | null;
  favorite: boolean;
  equippable: boolean;
  onToggleFavorite: () => void;
  onEquip: () => void;
  onScrap: () => void;
  onClose: () => void;
}) {
  const style = rarityStyle[item.rarity];
  const isEquipped = equippedItem !== null && itemKey(equippedItem) === itemKey(item);
  const cmp = equippedItem;

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
          <button onClick={onToggleFavorite} className="active:scale-90" aria-label="ロック">
            <PixelGlyph kind={favorite ? "lock" : "unlock"} size={22} />
          </button>
        </div>
        <span className="text-[10px] text-gray-400">
          <RarityPips item={item} /> {slotLabel[item.slot]} ・ {rarityLabel[item.rarity]}
          {item.quality ? ` ・ ${QUALITIES[item.quality].label}` : ""}
          {item.modTier ? ` ・ ★${item.modTier}` : ""}
        </span>

        <p className="mt-1 text-[10px] text-gray-400">
          {(() => {
            const ok = CLASSES.filter((c) => canEquip(item, c.id));
            if (ok.length >= CLASSES.length) return "装備可能: 全職業";
            return `装備可能: ${ok.map((c) => c.name).join(" / ")}`;
          })()}
        </p>

        <p className="mt-2 text-sm text-gray-200">{item.description}</p>

        {item.setId && getSetDef(item.setId) && (
          <div className="mt-3 rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 p-2">
            <p className="text-[10px] font-bold text-fuchsia-300">
              <GlyphText text={getSetDef(item.setId)!.icon} size={12} /> {getSetDef(item.setId)!.name}セット
            </p>
            <ul className="mt-1 space-y-0.5 text-[10px] text-fuchsia-100">
              {getSetDef(item.setId)!.bonuses.map((b) => (
                <li key={b.pieces}>・{b.pieces}部位: {b.desc}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {item.attack !== 0 && <Stat label={`攻撃 +${item.attack}`} />}
          {item.defense !== 0 && <Stat label={`防御 +${item.defense}`} />}
          {item.maxHp !== 0 && <Stat label={`HP +${item.maxHp}`} />}
          {item.rerollModifier !== 0 && (
            <Stat label={`リロール ${item.rerollModifier > 0 ? "+" : ""}${item.rerollModifier}`} />
          )}
          {item.poisonResist ? <Stat label={`毒耐性 ${Math.round(item.poisonResist * 100)}%`} /> : null}
          {item.stunResist ? <Stat label={`麻痺耐性 ${Math.round(item.stunResist * 100)}%`} /> : null}
          {item.volatile && <Stat label="不安定(振れ幅大)" />}
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

        {/* Comparison vs the currently equipped item in this slot. */}
        {!isEquipped && (
          <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
            <p className="text-[10px] font-bold text-gray-300">
              装備中との比較（{slotLabel[item.slot]}）
            </p>
            {cmp ? (
              <>
                <p className="mt-0.5 text-[10px] text-gray-400">現在: {cmp.name}</p>
                <div className="mt-1 space-y-0.5 text-xs text-gray-200">
                  <p>攻撃 {item.attack}<Delta value={item.attack - cmp.attack} /></p>
                  <p>防御 {item.defense}<Delta value={item.defense - cmp.defense} /></p>
                  <p>HP {item.maxHp}<Delta value={item.maxHp - cmp.maxHp} /></p>
                  <p>リロール {item.rerollModifier}<Delta value={item.rerollModifier - cmp.rerollModifier} /></p>
                </div>
              </>
            ) : (
              <p className="mt-0.5 text-[10px] text-emerald-300">このスロットは未装備（装備で全効果が追加）</p>
            )}
          </div>
        )}
        {isEquipped && <p className="mt-3 text-center text-xs text-emerald-300">装備中</p>}

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="h-12 flex-1 rounded-xl bg-white/10 font-bold active:scale-95">
            閉じる
          </button>
          <button
            onClick={onScrap}
            disabled={favorite}
            className="flex h-12 flex-1 items-center justify-center gap-1 rounded-xl bg-amber-700/80 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
          >
            {favorite ? (
              <><PixelGlyph kind="lock" size={14} /> ロック中</>
            ) : (
              <><PixelGlyph kind="material" size={14} /> 分解 +{SCRAP_VALUE[item.rarity]}</>
            )}
          </button>
          <button
            onClick={onEquip}
            disabled={!equippable}
            className="h-12 flex-1 rounded-xl bg-emerald-600 text-sm font-bold text-white active:scale-95 disabled:opacity-40"
          >
            {equippable ? "装備する" : "職業不適合"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label }: { label: string }) {
  return <span className="rounded-md bg-white/10 px-2 py-1 text-gray-200">{label}</span>;
}
