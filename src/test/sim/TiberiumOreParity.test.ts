import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { OreOverlayTypes } from "@/game/map/OreOverlayTypes";
import { TiberiumType } from "@/engine/type/TiberiumType";

const ROOT = join(import.meta.dir, "../../..");

describe("Tiberium / ore overlay", () => {
    test("getOverlayTibType returns TiberiumType or undefined (not OverlayTibType.NotSpecial)", () => {
        expect(OreOverlayTypes.getOverlayTibType(0)).toBeUndefined();
        expect(OreOverlayTypes.getOverlayTibType(102)).toBe(TiberiumType.Riparius);
        expect(OreOverlayTypes.getOverlayTibType(27)).toBe(TiberiumType.Cruentus);
        expect(OreOverlayTypes.getOverlayTibType(130)).toBe(TiberiumType.Vinifera);
        expect(OreOverlayTypes.getOverlayTibType(150)).toBe(TiberiumType.Aboreus);
    });

    test("TiberiumTrait takes rules and ObjectFactory uses getTiberium", () => {
        const trait = readFileSync(join(ROOT, "src/game/gameobject/trait/TiberiumTrait.ts"), "utf8");
        expect(trait).toContain("constructor(gameObject: GameObject, rules: TiberiumRules)");
        expect(trait).toContain("return this.rules.type");
        const factory = readFileSync(join(ROOT, "src/game/gameobject/ObjectFactory.ts"), "utf8");
        expect(factory).toContain("new TiberiumTrait(gameObject, rulesIni.getTiberium(tibType))");
        expect(factory).not.toContain("hitPoints <= 0");
    });

    test("ReturnOreTask values bails via getBails().reduce", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/task/harvester/ReturnOreTask.ts"), "utf8");
        expect(src).toContain("getBails().reduce");
        expect(src).not.toContain("harvesterTrait.ore *");
    });

    test("TileOccupation.computeOnBridgeLandType uses overlay.getLandType()", () => {
        const src = readFileSync(join(ROOT, "src/game/map/TileOccupation.ts"), "utf8");
        expect(src).toContain("return obj.getLandType()");
    });

    test("ChangeHouseAllExecutor redistributes when target defeated", () => {
        const src = readFileSync(join(ROOT, "src/game/trigger/executor/ChangeHouseAllExecutor.ts"), "utf8");
        expect(src).toContain("isAssetRedistributionEnabled()");
        expect(src).toContain("getAllies(sourcePlayer)");
    });

    test("GarrisonTrait.evacuate sets onBridge from low bridge", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/trait/GarrisonTrait.ts"), "utf8");
        expect(src).toContain("getBridgeOnTile(exitTile)?.isLowBridge()");
        expect(src).toContain("unit.position.tileElevation = 0");
    });

    test("AttackTask fireUp skips WaitTicks when infantry is suppressed", () => {
        const src = readFileSync(join(ROOT, "src/game/gameobject/task/AttackTask.ts"), "utf8");
        expect(src).toContain("suppressionTrait?.isSuppressed()");
    });
});
