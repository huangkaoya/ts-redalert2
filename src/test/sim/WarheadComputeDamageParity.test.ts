import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Warhead.computeDamage", () => {
    test("verses multiplier has no invented || 1 fallback; bridge gate uses bridgeTrait", () => {
        const src = readFileSync(join(ROOT, "src/game/Warhead.ts"), "utf8");
        expect(src).toContain("damage *= this.rules.verses.get(armorType);");
        expect(src).not.toContain("verses.get(armorType) || 1");
        expect(src).toContain("destroyableBridges && target.isOverlay() && (target as any).bridgeTrait");
    });
});
