import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("deathType propagation", () => {
    test("FactoryTrait skips destroying delivering unit on Temporal", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/FactoryTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("[NotifyDestroy.onDestroy]");
        const end = src.indexOf("\n    [NotifyTick.onTick]");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("building.deathType !== DeathType.Temporal");
        expect(body).toContain("destroyObject(this.deliveringUnit");
    });

    test("GarrisonTrait copies building deathType to occupants", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/GarrisonTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("[NotifyDestroy.onDestroy]");
        const end = src.indexOf("\n    getHash(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("unit.deathType = building.deathType");
    });

    test("HospitalTrait copies hospital deathType to patient", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/HospitalTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("[NotifyDestroy.onDestroy]");
        const end = src.indexOf("\n    private evacuate(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("this.unit.deathType = hospital.deathType");
    });

    test("TntChargeTrait skips Sink deathType", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/trait/TntChargeTrait.ts"),
            "utf8",
        );
        const start = src.indexOf("[NotifyDestroy.onDestroy]");
        const end = src.indexOf("\n    private detonateIvanWarhead(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("DeathType.None");
        expect(body).toContain("DeathType.Temporal");
        expect(body).toContain("DeathType.Sink");
    });
});
