import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("AutoLat", () => {
    test("RampBase smooth gate uses rampType/terrainType", () => {
        const src = readFileSync(join(ROOT, "src/game/theater/AutoLat.ts"), "utf8");
        const start = src.indexOf("calculate(");
        const body = src.slice(start);
        expect(body).toContain('getGeneralValue("RampBase")');
        expect(body).toContain("!(tile.rampType < 1 || tile.terrainType > 4)");
        expect(body).not.toContain("tile.rampType >= 1 && tile.rampType <= 4");
        expect(body).toContain('getGeneralValue("RampSmooth")');
    });
});
