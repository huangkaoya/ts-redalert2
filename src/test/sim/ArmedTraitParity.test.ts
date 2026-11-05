import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("ArmedTrait", () => {
    test("selectSpecialWeapon uses weaponCount < 1 without !weaponCount guard", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/ArmedTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("private selectSpecialWeapon(");
        const end = src.indexOf("\n    public toggleEliteWeapons(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("weaponCount < 1");
        expect(body).not.toContain("!weaponCount || weaponCount < 1");
        expect(body).toContain("getEliteWeaponAtIndex");
        expect(body).toContain("getWeaponAtIndex");
        expect(body).toContain("getSpecialWeaponFlh");
    });
});
