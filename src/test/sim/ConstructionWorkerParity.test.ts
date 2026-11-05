import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("ConstructionWorker.canPlaceAt", () => {
    test("adjacency gate uses ignoreAdjacent only (no constructionYard special-case)", () => {
        const src = readFileSync(join(ROOT, "src/game/ConstructionWorker.ts"), "utf8");
        expect(src).not.toContain("buildingRules.constructionYard");
        expect(src).toContain("!ignoreAdjacent && !this.meetsAdjacency");
        const gameApi = readFileSync(join(ROOT, "src/game/api/GameApi.ts"), "utf8");
        expect(gameApi).toContain("placeOptions.ignoreAdjacent = this.rulesApi.getBuilding(buildingType).constructionYard");
    });
});
