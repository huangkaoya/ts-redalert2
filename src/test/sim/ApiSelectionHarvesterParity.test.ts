import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("API / selection / harvester", () => {
    test("HarvesterTrait calls increasePassiveScanCooldown", () => {
        const local = readFileSync(
            join(ROOT, "src/game/gameobject/trait/HarvesterTrait.ts"),
            "utf8",
        );
        expect(local).toContain("increasePassiveScanCooldown(1)");
        expect(local).not.toContain("increasePassiveScanTicks");
        expect(local).not.toContain("increasePassiveScanData");
    });

    test("SelectionModel.isHovered uses bit mask", () => {
        const local = readFileSync(
            join(ROOT, "src/game/gameobject/selection/SelectionModel.ts"),
            "utf8",
        );
        expect(local).toContain(
            "Boolean(this.selectionLevel & SelectionLevel.Hover)",
        );
        expect(local).not.toContain("selectionLevel >> SelectionLevel.Hover");
    });

    test("MapApi resource ore counts any non-gem tiberium", () => {
        const local = readFileSync(join(ROOT, "src/game/api/MapApi.ts"), "utf8");
        expect(local).toContain("type !== TiberiumType.Gems ? count : 0");
        expect(local).not.toContain("type === TiberiumType.Ore ? count : 0");
    });

    test("MapApi.findPath matches 模拟层 five-arg signature", () => {
        const local = readFileSync(join(ROOT, "src/game/api/MapApi.ts"), "utf8");
        expect(local).toContain(
            "findPath(speedType: any, isFoot: boolean, start: any, end: any, options?: any)",
        );
        expect(local).not.toContain("args[0] !== 'boolean'");
    });

    test("ActionsApi.orderUnits uses truthy target coords", () => {
        const local = readFileSync(join(ROOT, "src/game/api/ActionsApi.ts"), "utf8");
        const method = local.match(/orderUnits\([\s\S]*?\n    \}/)?.[0] ?? "";
        expect(method).toContain("if (targetX)");
        expect(method).toContain("if (targetY)");
        expect(method).not.toContain("targetX !== undefined");
        expect(method).not.toContain("targetY !== undefined");
    });
});
