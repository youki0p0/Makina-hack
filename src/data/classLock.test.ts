import { describe, expect, it } from "vitest";
import { canEquip } from "@/data/classes";
import { ITEMS, getItemById } from "@/data/items";
import type { Equipment } from "@/types/game";

const rogueGear = getItemById("rogue_twin_fang")!;
const mageGear = getItemById("mage_truth_staff")!;

describe("クラス限定ロマン装備", () => {
  it("該当クラスのみ装備でき、他職は装備不可（タグより優先）", () => {
    expect(rogueGear.classLock).toBe("rogue");
    expect(canEquip(rogueGear, "rogue")).toBe(true);
    expect(canEquip(rogueGear, "mage")).toBe(false);
    expect(canEquip(rogueGear, "warrior")).toBe(false);
    expect(canEquip(mageGear, "mage")).toBe(true);
    expect(canEquip(mageGear, "rogue")).toBe(false);
  });

  it("classLock 装備は equipTag に関係なくロック職以外不可", () => {
    const locked: Equipment = { ...rogueGear, equipTag: "heavy" };
    expect(canEquip(locked, "warrior")).toBe(false); // heavy 可の戦士でも不可
    expect(canEquip(locked, "rogue")).toBe(true);
  });

  it("通常装備(classLock無し)は従来どおりタグ判定", () => {
    const plain: Equipment = { ...rogueGear, classLock: undefined, equipTag: "light" };
    expect(canEquip(plain, "rogue")).toBe(true);
    expect(canEquip(plain, "warrior")).toBe(true); // 戦士も light 可
  });

  it("ロマン装備は ITEMS に登録され getItemById で復元できる（セーブ互換）", () => {
    expect(getItemById("rogue_twin_fang")?.name).toBe("宵闇の双牙");
    expect(getItemById("mage_truth_staff")?.name).toBe("真理の天杖");
    // 少なくとも rogue/mage の2点が classLock 付きで存在する。
    const locked = ITEMS.filter((i) => i.classLock);
    expect(locked.length).toBeGreaterThanOrEqual(2);
  });
});
