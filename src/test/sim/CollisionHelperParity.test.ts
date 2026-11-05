import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { CollisionHelper } from "@/game/gameobject/unit/CollisionHelper";
import { CollisionType } from "@/game/gameobject/unit/CollisionType";
import { LandType } from "@/game/type/LandType";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";

const ROOT = join(import.meta.dir, "../../..");

describe("CollisionHelper / Debris units option", () => {
    test("Debris passes units: false (!1)", () => {
        const debris = readFileSync(join(ROOT, "src/game/gameobject/Debris.ts"), "utf8");
        expect(debris).toMatch(/units:\s*false/);
        expect(debris).not.toMatch(/units:\s*\(\)\s*=>\s*false/);
    });

    test("units: false disables unit-as-wall hits", () => {
        const tile = { landType: LandType.Clear, z: 0, terrainType: 0 };
        const unit = {
            isOverlay: () => false,
            isBridge: () => false,
            wallTrait: undefined,
            isTechno: () => true,
            isDestroyed: false,
            isUnit: () => true,
            zone: ZoneType.Ground,
            tile,
            owner: { id: 1 },
        };
        const helper = new CollisionHelper({
            getObjectsOnTile: () => [unit],
            getBridgeOnTile: () => undefined,
        });
        const source = { tile, tileElevation: 0.5 };
        const prev = { tile, tileElevation: 1 };
        const withFalse = helper.checkCollisions(source, prev, {
            walls: true,
            units: false,
            ground: false,
            cliffs: false,
            shore: false,
        });
        expect(withFalse.type).toBe(CollisionType.None);

        const withPred = helper.checkCollisions(source, prev, {
            walls: true,
            units: () => true,
            ground: false,
            cliffs: false,
            shore: false,
        });
        expect(withPred.type).toBe(CollisionType.Wall);
        expect(withPred.target).toBe(unit);
    });
});
