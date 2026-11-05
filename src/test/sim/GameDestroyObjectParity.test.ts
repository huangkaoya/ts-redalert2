import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Game.destroyObject", () => {
    test("kill scoring uses (!building || combatant), not (building || combatant)", () => {
        const src = readFileSync(join(ROOT, "src/game/Game.ts"), "utf8");
        expect(src).toContain("killer && (!obj.isBuilding() || originalOwner.isCombatant())");
        expect(src).not.toContain("killer && (obj.isBuilding() || originalOwner.isCombatant())");
    });
});
