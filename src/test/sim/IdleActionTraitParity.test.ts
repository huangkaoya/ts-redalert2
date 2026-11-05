import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("IdleActionTrait", () => {
    test("fraidycat scatter requires owner.isNeutral", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/IdleActionTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("doIdleAction(");
        const end = src.indexOf("\n    actionDueThisTick(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("gameObject.rules.fraidycat");
        expect(body).toContain("gameObject.owner.isNeutral");
        expect(body).toContain("generateRandom() > 0.5");
        expect(body).toContain("ScatterTask");
        expect(body).toContain("noSlopes: true");
    });
});
