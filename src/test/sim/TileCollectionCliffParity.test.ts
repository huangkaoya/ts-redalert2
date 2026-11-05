import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("TileCollection cliff-back", () => {
    test("computeLandBehindCliffTiles requires z-delta >= 4 and no rampType gate", () => {
        const src = readFileSync(
            join(ROOT, "src/game/map/TileCollection.ts"),
            "utf8",
        );
        const start = src.indexOf("computeLandBehindCliffTiles(");
        const end = src.indexOf("\n    ", start + 1);
        // Method may be followed by another method; slice to next method-ish indent at class level
        const bodyStart = src.indexOf("{", start);
        let depth = 0;
        let i = bodyStart;
        for (; i < src.length; i++) {
            const c = src[i];
            if (c === "{") depth++;
            else if (c === "}") {
                depth--;
                if (depth === 0) {
                    i++;
                    break;
                }
            }
        }
        const body = src.slice(start, i);
        expect(body).toContain("cliffTile.z - neighborTile.z >= 4");
        expect(body).toContain("TerrainType.Cliff");
        expect(body).toContain("TerrainType.Rough");
        expect(body).toContain("LandType.Rock");
        expect(body).not.toContain("rampType === 0");
        expect(body).not.toContain("neighborTile.z < cliffTile.z");
    });
});
