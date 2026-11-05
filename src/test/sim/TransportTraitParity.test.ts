import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("TransportTrait", () => {
    test("spawnSurvivors selects survivors, sinks water deaths, clears deathWeapon", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/TransportTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("private spawnSurvivors(");
        const end = src.indexOf("\n    getHash(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("getUnitSelection()");
        expect(body).toContain("isSelected(transport)");
        expect(body).toContain("addToSelection(unit)");
        expect(body).toContain("ZoneType.Water");
        expect(body).toContain("DeathType.Sink");
        expect(body).toContain("armedTrait?.deathWeapon");
        expect(body).toContain("deathWeapon = undefined");
    });

    test("NotifyDestroy force path copies deathType to passengers", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/TransportTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("[NotifyDestroy.onDestroy]");
        const end = src.indexOf("\n    private spawnSurvivors(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("unit.deathType = gameObject.deathType");
        expect(body).toContain("destroyObject(unit, context, true)");
        expect(body).toContain("spawnSurvivors(world)");
    });
});

