import { beforeEach, describe, expect, it } from "vitest";
import { useArenaStore } from "@/store/arenaStore";
import { cardCost, isEquipment, getCard } from "@/data/arena/cards";

// 環境は node（window 無し）のため永続化は no-op。ゲームループのロジックを検証する。
function resetStore() {
  useArenaStore.setState({ run: null, hydrated: false });
}

describe("arenaStore ゲームループ", () => {
  beforeEach(resetStore);

  it("開始→確定→決着→次ラウンドを繰り返すと必ず終局（優勝 or 敗退）に到達する", () => {
    const s = useArenaStore.getState();
    s.hydrate();
    s.startRun("short", "calibrator", ["moss_golem", "frost_sprite", "ember_imp"]);

    let guard = 0;
    while (guard++ < 200) {
      const run = useArenaStore.getState().run!;
      expect(run).toBeTruthy();

      if (run.phase === "victory" || run.phase === "gameover") break;

      if (run.phase === "draft") {
        // 提示カードを予算内で3体に配ってから戦う
        run.draft.slice().forEach((id, i) => {
          const c = getCard(id);
          if (c) useArenaStore.getState().assignCard(id, isEquipment(c) ? i % 3 : (i + 1) % 3);
        });
        useArenaStore.getState().confirmPrep();
        const r2 = useArenaStore.getState().run!;
        expect(r2.phase).toBe("battle");
        expect(r2.lastResult).toBeTruthy();
        useArenaStore.getState().finishBattle();
      } else if (run.phase === "blessing") {
        // 勝利後の祝福3択：先頭を選んで次ラウンドへ
        useArenaStore.getState().chooseBlessing(run.pendingBlessings[0]);
      } else if (run.phase === "result") {
        useArenaStore.getState().nextRound();
      }
    }

    const final = useArenaStore.getState().run!;
    expect(["victory", "gameover"]).toContain(final.phase);
    // 勝利数 or ライフのいずれかが終局条件を満たす
    if (final.phase === "victory") expect(final.wins).toBeGreaterThanOrEqual(10);
    if (final.phase === "gameover") expect(final.life).toBeLessThanOrEqual(0);
  });

  it("メニューへ戻すと run が消える", () => {
    const s = useArenaStore.getState();
    s.startRun("long", "warden", ["moss_golem", "elder_treant", "magma_beast"]);
    expect(useArenaStore.getState().run).toBeTruthy();
    useArenaStore.getState().quitToMenu();
    expect(useArenaStore.getState().run).toBeNull();
  });

  it("カード割り当てでコスト予算が減り、予算オーバーは割り当て不可", () => {
    const s = useArenaStore.getState();
    s.startRun("short", "calibrator", ["moss_golem", "frost_sprite", "ember_imp"]);
    const run = useArenaStore.getState().run!;
    const before = run.budget;
    const firstId = run.draft[0];
    const cost = cardCost(getCard(firstId));
    useArenaStore.getState().assignCard(firstId, 0);
    expect(useArenaStore.getState().run!.budget).toBe(before - cost);

    // 予算を超えるカードは割り当てられない
    useArenaStore.setState({
      run: { ...useArenaStore.getState().run!, budget: 0, draft: [firstId] },
    });
    const draftBefore = useArenaStore.getState().run!.draft.length;
    useArenaStore.getState().assignCard(firstId, 0);
    expect(useArenaStore.getState().run!.draft.length).toBe(draftBefore);
  });
});
