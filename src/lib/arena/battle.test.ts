import { describe, expect, it } from "vitest";
import { colorMatchup, isBossRound, simulateBattle, teamColorAdvantage } from "@/lib/arena/battle";
import { budgetForRound, DRAFT_SIZE, generateDraft, newRun } from "@/lib/arena/gameState";
import { computeSynergies, emptyTeamMods } from "@/lib/arena/synergy";
import { applyBlessings, offerBlessings } from "@/lib/arena/blessings";
import { fieldTransform } from "@/lib/arena/fieldTransform";
import { ALL_CARDS, EQUIPMENT, SKILLS, cardCost, isSkill } from "@/data/arena/cards";
import { MONSTERS } from "@/data/arena/monsters";
import { FIELDS } from "@/data/arena/fields";
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

describe("ボスラウンド", () => {
  it("5の倍数だけがボス", () => {
    expect(isBossRound(5)).toBe(true);
    expect(isBossRound(10)).toBe(true);
    expect(isBossRound(7)).toBe(false);
    expect(isBossRound(1)).toBe(false);
  });

  it("ボス戦の結果は boss=true、通常戦は false", () => {
    const b = rainbowBuilds();
    expect(simulateBattle(b, "calibrator", "ruins", 5, "long").boss).toBe(true);
    expect(simulateBattle(b, "calibrator", "ruins", 6, "long").boss).toBe(false);
  });
});

describe("色の三すくみ（緑→赤→青→緑）", () => {
  it("有利な色は1超、不利は1未満、同色/中立は1", () => {
    expect(colorMatchup("green", "red")).toBeGreaterThan(1);
    expect(colorMatchup("red", "blue")).toBeGreaterThan(1);
    expect(colorMatchup("blue", "green")).toBeGreaterThan(1);
    expect(colorMatchup("red", "green")).toBeLessThan(1);
    expect(colorMatchup("green", "green")).toBe(1);
  });

  it("チーム相性：緑単 vs 赤単は有利、その逆は不利", () => {
    const greenVsRed = teamColorAdvantage(["green", "green", "green"], ["red", "red", "red"]);
    const redVsGreen = teamColorAdvantage(["red", "red", "red"], ["green", "green", "green"]);
    expect(greenVsRed).toBeGreaterThan(1);
    expect(redVsGreen).toBeLessThan(1);
  });
});

describe("色シナジーの排他性", () => {
  const mk = (ids: string[]) => ids.map((monsterId) => ({ monsterId, equipmentIds: [], skillIds: [] }));
  it("単色は単色陣のみ、虹は三原陣のみ（ペアは付かない）", () => {
    const mono = computeSynergies(mk(["moss_golem", "venom_toad", "elder_treant"]), "calibrator");
    expect(mono.views.some((v) => v.id === "ggg")).toBe(true);
    expect(mono.views.some((v) => ["gr", "br", "gb", "gbr"].includes(v.id))).toBe(false);

    const rainbow = computeSynergies(mk(["moss_golem", "frost_sprite", "ember_imp"]), "calibrator");
    expect(rainbow.views.some((v) => v.id === "gbr")).toBe(true);
    expect(rainbow.views.some((v) => ["gr", "br", "gb"].includes(v.id))).toBe(false);

    const dual = computeSynergies(mk(["moss_golem", "elder_treant", "ember_imp"]), "calibrator");
    expect(dual.views.some((v) => v.id === "gr")).toBe(true);
    expect(dual.views.some((v) => v.id === "gbr")).toBe(false);
  });
});

describe("新シナジー", () => {
  it("fireタグ3つで業火結界が点く", () => {
    const fire: MonsterBuild[] = [
      { monsterId: "ember_imp", equipmentIds: ["blaze_ring"], skillIds: ["flame_slash"] },
      { monsterId: "magma_beast", equipmentIds: [], skillIds: ["area_blast"] },
      { monsterId: "blade_dancer", equipmentIds: [], skillIds: [] },
    ];
    const { views, mods } = computeSynergies(fire, "calibrator");
    expect(views.some((v) => v.id === "fire3")).toBe(true);
    expect(mods.burnBonus).toBeGreaterThan(0);
  });
});

describe("データ整合性", () => {
  it("モンスターIDは一意（9体以上）、フィールドは6種", () => {
    expect(new Set(MONSTERS.map((m) => m.id)).size).toBe(MONSTERS.length);
    expect(MONSTERS.length).toBeGreaterThanOrEqual(9);
    expect(FIELDS.length).toBe(6);
  });

  it("カードIDは一意、技は cooldown>0 / 装備はステ補正を持つ", () => {
    expect(new Set(ALL_CARDS.map((c) => c.id)).size).toBe(ALL_CARDS.length);
    for (const c of ALL_CARDS) {
      if (isSkill(c)) {
        expect(c.cooldown).toBeGreaterThan(0);
      }
    }
    for (const e of EQUIPMENT) {
      const total =
        (e.hp ?? 0) + (e.attack ?? 0) + (e.defense ?? 0) + (e.speed ?? 0) +
        (e.reflectPct ?? 0) + (e.regen ?? 0) + (e.critAdd ?? 0) + (e.grantRevive ? 1 : 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});

describe("generateDraft / newRun", () => {
  it("ドラフトは規定枚数(6)を返す", () => {
    expect(generateDraft(1)).toHaveLength(DRAFT_SIZE);
    expect(generateDraft(10)).toHaveLength(DRAFT_SIZE);
  });

  it("newRun はモード設定どおり初期化する（予算・祝福を含む）", () => {
    const run = newRun("long", "verdant", ["elder_treant", "venom_toad", "magma_beast"]);
    expect(run.life).toBe(5);
    expect(run.builds).toHaveLength(3);
    expect(run.phase).toBe("draft");
    expect(run.budget).toBeGreaterThan(0);
    expect(run.blessings).toEqual([]);
  });
});

describe("コスト / 祝福", () => {
  it("予算はラウンドと祝福で増える", () => {
    expect(budgetForRound(1, [])).toBe(5);
    expect(budgetForRound(3, [])).toBe(6);
    expect(budgetForRound(1, ["budget"])).toBe(6);
  });

  it("技は装備より割高（レア度+1）", () => {
    const flame = SKILLS[0];
    expect(cardCost(flame)).toBe(flame.rarity + 1);
    const eq = EQUIPMENT[0];
    expect(cardCost(eq)).toBe(eq.rarity);
  });

  it("祝福で攻撃倍率が上がる", () => {
    const m = emptyTeamMods();
    applyBlessings(m, ["atk"]);
    expect(m.atkMult).toBeGreaterThan(1);
  });

  it("祝福3択は3つを返す", () => {
    expect(offerBlessings(123)).toHaveLength(3);
  });
});
