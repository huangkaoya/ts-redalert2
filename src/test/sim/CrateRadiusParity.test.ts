import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("CrateGeneratorTrait radius", () => {
    test("getUnitsInCrateRadius does not filter by owner", () => {
        const local = readFileSync(join(ROOT, "src/game/trait/CrateGeneratorTrait.ts"), "utf8");
        const method = local.match(/private getUnitsInCrateRadius\([\s\S]*?\n    \}/)?.[0] ?? "";
        expect(method).toContain("unit.isUnit()");
        expect(method).toContain("tileDistance(unit, tile) <= radius");
        expect(method).not.toContain("unit.owner ===");
        expect(method).toMatch(/getUnitsInCrateRadius\(gameState: any, tile: any\)/);
    });

    test("money powerup still increments creditsGained", () => {
        const local = readFileSync(join(ROOT, "src/game/trait/CrateGeneratorTrait.ts"), "utf8");
        expect(local).toContain("player.creditsGained += amount");
    });

    test("explosion powerup passes SpecialWarheadType.None", () => {
        const local = readFileSync(join(ROOT, "src/game/trait/CrateGeneratorTrait.ts"), "utf8");
        expect(local).toMatch(/grantExplosionPowerup[\s\S]*SpecialWarheadType\.None/);
    });

    test("canPlaceCrateOnTile ignores smudges", () => {
        const local = readFileSync(join(ROOT, "src/game/trait/CrateGeneratorTrait.ts"), "utf8");
        const method =
            local.match(/canPlaceCrateOnTile\(gameState: any, tile: any\): boolean \{[\s\S]*?\n    \}/)?.[0] ??
            "";
        expect(method).toContain(".filter((obj: any) => !obj.isSmudge())");
        expect(method).not.toMatch(/getGroundObjectsOnTile\(tile\)\.length/);
    });

    test("spawn helpers accept radius/timed and search with RadialBackFirstTileFinder", () => {
        const local = readFileSync(join(ROOT, "src/game/trait/CrateGeneratorTrait.ts"), "utf8");
        expect(local).toContain("spawnRandomCrateAt(tile: any, gameState: any, radius = 0, timed = false)");
        expect(local).toContain("spawnCrateAt(tile: any, powerup: any, gameState: any, radius = 0, timed = false)");
        expect(local).toContain("RadialBackFirstTileFinder");
        expect(local).toContain("Number.POSITIVE_INFINITY");
        expect(local).toContain("spawnRandomCrateAt(spawnTile, gameState, 0, true)");
    });

    test("CreateCrateExecutor passes radius 3 and cratesAppear timed flag", () => {
        const local = readFileSync(
            join(ROOT, "src/game/trigger/executor/CreateCrateExecutor.ts"),
            "utf8",
        );
        expect(local).toContain("game.gameOpts.cratesAppear");
        expect(local).toContain("spawnCrateAt(tile, powerup, game, 3, cratesAppear)");
        expect(local).toContain("spawnRandomCrateAt(tile, game, 3, cratesAppear)");
    });
});
