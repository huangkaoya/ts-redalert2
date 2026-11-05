import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("MoveAsideTask", () => {
    test("pushableUnits filter compares other.owner to moving unit.owner (no param shadow)", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/task/move/MoveAsideTask.ts"),
            "utf8",
        );
        const start = src.indexOf("onTick(unit: any)");
        const body = src.slice(start);
        expect(body).toContain("other.owner === unit.owner");
        expect(body).not.toContain("unit.owner === unit.owner");
        expect(body).toContain(
            "unit.isInfantry() && unit.deployerTrait && unit.deployerTrait.isDeployed()",
        );
        expect(body).not.toContain("deployerTrait?.isDeployed()");
    });
});
