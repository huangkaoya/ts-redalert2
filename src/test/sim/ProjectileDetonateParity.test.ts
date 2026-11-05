import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Projectile detonate/onSpawn", () => {
    test("no local-only isPrismSupportBeam gate; electricAssault matches 模拟层", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/Projectile.ts"), "utf8");
        expect(src).not.toContain("isPrismSupportBeam");
        expect(src).toContain("warhead.rules.electricAssault");
        expect(src).toContain("overpoweredTrait.chargeFrom");
    });

    test("parasite infantry uses infinite damage via detonate, not a local skip path", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/Projectile.ts"), "utf8");
        expect(src).toContain("damage = Number.POSITIVE_INFINITY");
        expect(src).not.toContain("parasiteInfantryKill");
        expect(src).toMatch(/if \(parasiteSuccess\) \{\s*shouldDetonate = false;/);
    });

    test("homing update gates on distanceToTarget vs LEPTONS_PER_TILE/4 with overshoot detect", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/Projectile.ts"), "utf8");
        const updateIdx = src.indexOf("update(game:");
        const body = src.slice(updateIdx, src.indexOf("\n    detonate(", updateIdx));
        expect(body).toContain("distanceToTarget >= Coords.LEPTONS_PER_TILE / 4");
        expect(body).toContain("distanceToTarget < remainingLength && remainingLength < 2 * Coords.LEPTONS_PER_TILE");
        expect(body).not.toMatch(/if \(moveDistance >= 1\) \{\s*const moveVector = this\.homingMoveDir/);
        expect(body).toContain("game.map.isWithinHardBounds(targetPos)");
    });

    test("shrapnel tile-target gate includes isTerrain || isTechno", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/Projectile.ts"), "utf8");
        const start = src.indexOf("if (this.rules.shrapnelCount &&");
        const body = src.slice(start, start + 700);
        expect(body).toContain("obj.isTerrain() || obj.isTechno()");
        expect(body).not.toMatch(/\.some\(\(obj: any\) => obj\.isTerrain\(\)\)/);
    });
});
