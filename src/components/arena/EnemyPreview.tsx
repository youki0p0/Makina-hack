"use client";

import { previewEnemies } from "@/lib/arena/battle";
import { COLOR_DOT } from "@/data/arena/monsters";
import { allyTeamPower, enemyTeamPower } from "@/lib/arena/power";
import type { FieldId, MonsterBuild } from "@/types/arena";

/**
 * 準備中に「次に戦う敵編成」と、自軍★ vs 敵★ の総合力比較を表示する。
 * 相手の色・脅威を読んでフィールド変質技を仕込む“読み”の軸を作る。
 */
export default function EnemyPreview({
  builds,
  field,
  operatorId,
  blessings,
  round,
}: {
  builds: MonsterBuild[];
  field: FieldId;
  operatorId: string;
  blessings: string[];
  round: number;
}) {
  const enemies = previewEnemies(round, field);
  const mine = allyTeamPower(builds, field, operatorId, blessings);
  const theirs = enemyTeamPower(round, field);
  const advantage = mine - theirs;
  const verdict =
    advantage >= theirs * 0.15
      ? { text: "有利", cls: "text-emerald-300" }
      : advantage <= -theirs * 0.15
        ? { text: "不利", cls: "text-rose-300" }
        : { text: "互角", cls: "text-amber-300" };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2">
      {/* 総合力バー */}
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold">
        <span className="text-emerald-300">自軍 ★{mine}</span>
        <span className={verdict.cls}>{verdict.text}</span>
        <span className="text-rose-300">敵 ★{theirs}</span>
      </div>
      <div className="mb-2 flex h-1.5 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full bg-emerald-500"
          style={{ width: `${(mine / (mine + theirs || 1)) * 100}%` }}
        />
        <div className="h-full flex-1 bg-rose-500" />
      </div>

      {/* 次の敵3体 */}
      <div className="mb-1 text-[10px] font-bold text-gray-400">⚔️ 次に戦う敵</div>
      <div className="flex justify-between gap-1">
        {enemies.map((e, i) => (
          <div
            key={i}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg p-1 ${
              e.boss ? "bg-amber-500/15" : "bg-black/20"
            }`}
          >
            <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/arena/monsters/${e.id}.png`}
                alt={e.name}
                style={{ imageRendering: "pixelated", width: "120%", height: "120%", objectFit: "cover" }}
              />
            </div>
            <div className="text-[8px] text-gray-300">{COLOR_DOT[e.color]}</div>
            <div className="text-[7px] leading-tight text-gray-400">{e.threat}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
