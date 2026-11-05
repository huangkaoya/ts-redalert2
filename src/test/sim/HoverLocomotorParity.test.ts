import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("HoverLocomotor", () => {
    test("tick brake floor is Math.max(1, ...) and turn uses adjusted rotationSpeed", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/locomotor/HoverLocomotor.ts"),
            "utf8",
        );
        const start = src.indexOf("tick(unit:");
        const body = src.slice(start, src.indexOf("private computeBrakeDistance"));
        expect(body).toContain("Math.max(1, this.currentSpeed - this.deceleration)");
        expect(body).not.toContain("Math.max(0, this.currentSpeed - this.deceleration)");
        expect(body).toContain("let rotationSpeed = unit.rules.rot");
        expect(body).toContain("rotationSpeed =");
        expect(body).toContain(
            "FacingUtil.tick(unit.direction, desiredFacing, rotationSpeed)",
        );
        expect(body).not.toContain("const remainingTime = angleDiff");
    });
});
