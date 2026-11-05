import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Terrain tiberium passability", () => {
    test("constructor builds tiberiumMayChangePassability from land speed modifiers", () => {
        const src = readFileSync(join(ROOT, "src/game/map/Terrain.ts"), "utf8");
        expect(src).toContain("tiberiumMayChangePassability");
        expect(src).toContain("this.rules.getLandRules(LandType.Tiberium)");
        expect(src).toContain("tiberiumMayChangePassability.add(landType)");
    });

    test("handleTileOccupationUpdate matches 模拟层 overlay/tiberium/blocker gates", () => {
        const src = readFileSync(join(ROOT, "src/game/map/Terrain.ts"), "utf8");
        const start = src.indexOf("private handleTileOccupationUpdate");
        const end = src.indexOf("private handleMapBoundsResize", start);
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("object.isBridge()");
        expect(body).toContain("object.isTiberium()");
        expect(body).toContain("this.tiberiumMayChangePassability.has(baseLandType)");
        expect(body).toContain("const isInfantry = !object.isTerrain()");
        expect(body).toContain(
            "this.isBlockerObject(object, tile, false, speedType, isInfantry)",
        );
        expect(body).not.toContain("isBlockerObject(object, tile, true");
        expect(body).not.toContain("SpeedType.Wheel");
        expect(body).toContain("object.isBuilding() && object.rules.leaveRubble");
    });
});
