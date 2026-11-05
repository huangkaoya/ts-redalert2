import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("MapShroud", () => {
    test("isShrouded delegates to getShroudType(tile, offset)", () => {
        const src = readFileSync(join(ROOT, "src/game/map/MapShroud.ts"), "utf8");
        expect(src).toMatch(/isShrouded\(tile:\s*Tile,\s*offset:\s*number\s*=\s*0\):\s*boolean\s*\{\s*return this\.getShroudType\(tile,\s*offset\)/);
        expect(src).toMatch(/getShroudType\(tile:\s*Tile,\s*offset:\s*number\s*=\s*0\):\s*ShroudType/);
        expect(src).toContain("rxyzToSxy(tile.rx, tile.ry, tile.z + offset)");
        expect(src).toContain("getShroudTypeByShroudCoords(coords)");
    });

    test("setValueAround changedCoords matches 模拟层 raw newValue compare", () => {
        const src = readFileSync(join(ROOT, "src/game/map/MapShroud.ts"), "utf8");
        const body = src.slice(src.indexOf("private setValueAround"), src.indexOf("revealAll()"));
        expect(body).toContain("this.tiles[index] = (newValue ?? currentType) | newFlags");
        expect(body).toContain("if (!(currentType === newValue && currentFlags === newFlags))");
        expect(body).not.toContain("currentType !== nextType");
    });
});
