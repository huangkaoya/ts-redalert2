import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("TileOccupation.computeTileLandType", () => {
    test("uses building wall then overlay.getLandType (no invented tiberium/rules.land branches)", () => {
        const src = readFileSync(join(ROOT, "src/game/map/TileOccupation.ts"), "utf8");
        const start = src.indexOf("computeTileLandType(");
        const end = src.indexOf("\n    computeOnBridgeLandType", start);
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("obj.isBuilding() && obj.rules.wall");
        expect(body).toContain("obj.isOverlay() && !obj.isBridge() && !obj.isBridgePlaceholder()");
        expect(body).toContain("obj.getLandType() !== LandType.Clear");
        expect(body).toContain("return obj.getLandType()");
        expect(body).not.toContain("obj.isTiberium()");
        expect(body).not.toContain("obj.rules.land");
        expect(body).not.toContain("obj.isOverlay() || obj.isBuilding()");
    });
});
