import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("TechnoRules locomotor parse", () => {
    test("locomotor map lookups are direct .get without soft optional", () => {
        const src = readFileSync(
            join(ROOT, "src/game/rules/TechnoRules.ts"),
            "utf8",
        );
        expect(src).toContain("locomotorTypesByClsId.get(locomotorString)");
        expect(src).toContain("defaultSpeedsByLocomotor.get(this.locomotor)");
        expect(src).not.toContain("locomotorTypesByClsId?.get");
        expect(src).not.toContain("defaultSpeedsByLocomotor?.get");
    });
});
