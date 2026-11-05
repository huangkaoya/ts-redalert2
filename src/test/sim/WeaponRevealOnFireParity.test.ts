import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Weapon.revealOnFire", () => {
    test("temporary reveal triggers for Unexplored and TemporaryReveal shroud types", () => {
        const src = readFileSync(join(ROOT, "src/game/Weapon.ts"), "utf8");
        expect(src).toContain("getShroudType(gameObject.tile, gameObject.tileElevation)");
        expect(src).toContain("ShroudType.Unexplored");
        expect(src).toContain("ShroudType.TemporaryReveal");
        expect(src).not.toMatch(/revealOnFire[\s\S]*?isShrouded\(/);
    });
});
