import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");
const src = readFileSync(join(ROOT, "src/game/gameobject/task/move/MoveInWeaponRangeTask.ts"), "utf8");

describe("MoveInWeaponRangeTask air-strafe", () => {
    test("findStrafeDestination only runs when already close enough", () => {
        expect(src).toContain("if (this.isAirStrafeCloseEnough(unit))");
        expect(src).not.toContain("if (!this.isAirStrafeCloseEnough(unit))");
        // Keep findStrafeDestination gated by the close-enough check in onTick.
        const closeIdx = src.indexOf("if (this.isAirStrafeCloseEnough(unit))");
        const findIdx = src.indexOf("findStrafeDestination", closeIdx);
        expect(findIdx).toBeGreaterThan(closeIdx);
        expect(findIdx - closeIdx).toBeLessThan(200);
    });
});
