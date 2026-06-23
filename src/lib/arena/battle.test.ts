import { describe, expect, it } from "vitest";
import { simulateBattle } from "@/lib/arena/battle";
import { generateDraft, newRun } from "@/lib/arena/gameState";
import { computeSynergies } from "@/lib/arena/synergy";
import { fieldTransform } from "@/lib/arena/fieldTransform";
import { SKILLS } from "@/data/arena/cards";
import type { FieldId, MonsterBuild } from "@/types/arena";

const ALL_FIELDS: FieldId[] = ["forest", "volcano", "rain", "thunder", "ruins", "sanctuary"];

function rainbowBuilds(): MonsterBuild[] {
  return [
    { monsterId: "moss_golem", equipmentIds: ["iron_wall"], skillIds: ["guard_stance", "taunt_roar"] },
    { monsterId: "frost_sprite", equipmentIds: ["swift_boots"], skillIds: ["healing_light"] },
    { monsterId: "ember_imp", equipmentIds: ["steel_sword"], skillIds: ["flame_slash"] },
  ];
}

describe("simulateBattle", () => {
  it("各フィールドで戦闘が完走し、結果を返す", () => {
    for (const field of ALL_FIELDS) {
      for (let round = 1; round <= 6; round++) {
        const res = simulateBattle(rainbowBuilds(), "calibrator", field, round, "short");
        expect(typeof res.win).toBe("boolean");
        expect(res.frames.length).toBeGreaterThan(1);
        expect(res.allyHpLeft).toBeGreaterThanOrEqual(0);
        expect(res.enemyHpLeft).toBeGreaterThanOrEqual(0);
        expect(res.field).toBe(field);
      }
    }
  });

  it("同じ入力なら決定論的に同じ結果になる", () => {
    const a = simulateBattle(rainbowBuilds(), "calibrator", "volcano", 3, "short");
    const b = simulateBattle(rainbowBuilds(), "calibrator", "volcano", 3, "short");
    expect(a.win).toBe(b.win);
    expect(a.log.length).toBe(b.log.length);
  });

  it("空ビルド（技なし）でもクラッシュしない", () => {
    const empty: MonsterBuild[] = [
      { monsterId: "moss_golem", equipmentIds: [], skillIds: [] },
      { monsterId: "venom_toad", equipmentIds: [], skillIds: [] },
      { monsterId: "storm_hawk", equipmentIds: [], skillIds: [] },
    ];
    const res = simulateBattle(empty, "warden", "ruins", 1, "long");
    expect(res.frames.length).toBeGreaterThan(0);
  });
});

describe("computeSynergies", () => {
  it("三色そろうと三原陣が点く", () => {
    const { views } = computeSynergies(rainbowBuilds(), "calibrator");
    expect(views.some((v) => v.id === "gbr")).toBe(true);
  });

  it("青3体で魔導陣（CT短縮）が点く", () => {
    const blue: MonsterBuild[] = [
      { monsterId: "frost_sprite", equipmentIds: [], skillIds: [] },
      { monsterId: "storm_hawk", equipmentIds: [], skillIds: [] },
      { monsterId: "tide_mage", equipmentIds: [], skillIds: [] },
    ];
    const { views, mods } = computeSynergies(blue, "conductor");
    expect(views.some((v) => v.id === "bbb")).toBe(true);
    expect(mods.cdMult).toBeLessThan(1);
  });
});

describe("fieldTransform", () => {
  it("火炎斬りは火山で噴火斬り（波及）に変わる", () => {
    const flame = SKILLS.find((s) => s.id === "flame_slash")!;
    const t = fieldTransform(flame, "volcano", 0);
    expect(t.name).toBe("噴火斬り");
    expect(t.splash).toBeGreaterThan(0);
  });

  it("火炎斬りは雨で蒸気斬り（火傷→暗闇）に変わる", () => {
    const flame = SKILLS.find((s) => s.id === "flame_slash")!;
    const t = fieldTransform(flame, "rain", 0);
    expect(t.name).toBe("蒸気斬り");
    expect(t.apply?.some((a) => a.status === "burn")).toBe(false);
    expect(t.apply?.some((a) => a.status === "blind")).toBe(true);
  });
});

describe("generateDraft / newRun", () => {
  it("ドラフトは3枚を返す", () => {
    expect(generateDraft(1)).toHaveLength(3);
    expect(generateDraft(10)).toHaveLength(3);
  });

  it("newRun はモード設定どおり初期化する", () => {
    const run = newRun("long", "verdant", ["elder_treant", "venom_toad", "magma_beast"]);
    expect(run.life).toBe(5);
    expect(run.builds).toHaveLength(3);
    expect(run.phase).toBe("draft");
  });
});
