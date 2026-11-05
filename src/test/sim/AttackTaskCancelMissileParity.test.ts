import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");
const src = readFileSync(join(ROOT, "src/game/gameobject/task/AttackTask.ts"), "utf8");

describe("AttackTask cancel+missile", () => {
    test("onTick keeps task running while airSpawnTrait is launching missiles", () => {
        const start = src.indexOf("onTick(");
        const end = src.indexOf("\n    findReachableMeleePosition(", start);
        const body = src.slice(start, end > start ? end : undefined);

        const cancelGate = body.indexOf("this.isCancelling() && attackTrait.attackState !== AttackState.FireUp");
        expect(cancelGate).toBeGreaterThan(-1);

        const gateBlock = body.slice(cancelGate, cancelGate + 450);
        expect(gateBlock).toContain("isLaunchingMissiles()");
        // When launching missiles, must return false (task continues), matching 模拟层
        // `return !isLaunchingMissiles() && (moveTask?.cancel(), true)`.
        expect(gateBlock).toMatch(
            /isLaunchingMissiles\(\)\)\s*\{\s*return false;/,
        );
        expect(gateBlock).toContain("moveTask?.cancel()");
        expect(gateBlock).toContain("return true");
        // Forbid the previous mistranslation that always returned true.
        expect(gateBlock).not.toMatch(
            /if\s*\(\s*!obj\.airSpawnTrait\?\.isLaunchingMissiles\(\)\s*\)\s*\{\s*moveTask\?\.cancel\(\);\s*\}\s*return true;/,
        );
    });
});
