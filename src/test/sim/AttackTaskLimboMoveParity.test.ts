import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");
const src = readFileSync(
    join(ROOT, "src/game/gameobject/task/AttackTask.ts"),
    "utf8",
);

describe("AttackTask limboLaunch / in-range move cancel", () => {
    test("limboLaunch always sets finish-after-fire flag outside move-task gate", () => {
        const start = src.indexOf("let forcedMove = false;");
        const end = src.indexOf("this.weapon.fire(this.target", start);
        const block = src.slice(start, end > start ? end : start + 800);
        expect(block).toContain("if (this.weapon.rules.limboLaunch)");
        // 完善模拟层逻辑：sets i=!0 after the optional forceCancel block, still inside limboLaunch.
        expect(block).toMatch(
            /if \(limboMoveTask\) \{[\s\S]*?\}\s*\/\/ 完善模拟层逻辑：[\s\S]*?forcedMove = true;/,
        );
        // Forbid nesting forcedMove only inside limboMoveTask.
        expect(block).not.toMatch(
            /if \(limboMoveTask\) \{[\s\S]*forcedMove = true;[\s\S]*\}\s*\}/,
        );
    });

    test("in-range move cancel keeps move for balloonHover/fighter/spawned/fly-outer", () => {
        expect(src).toContain("const keepMoveTask =");
        expect(src).toContain("if (!keepMoveTask)");
        expect(src).toContain("moveTask.cancel()");
        // Forbid inverted polarity that cancelled when special rules were true.
        expect(src).not.toContain("const shouldCancelMove =");
        expect(src).not.toContain("if (shouldCancelMove)");
    });
});
