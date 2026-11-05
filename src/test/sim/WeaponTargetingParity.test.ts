import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { WeaponTargeting } from "@/game/WeaponTargeting";
import { WeaponType } from "@/game/WeaponType";

const ROOT = join(import.meta.dir, "../../..");

function makeBaseGameObject(overrides: Record<string, unknown> = {}) {
    return {
        name: "E1",
        owner: { id: "a" },
        rules: {
            navalTargeting: 0,
            landTargeting: 0,
            attackCursorOnFriendlies: false,
            natural: false,
        },
        isUnit: () => true,
        isInfantry: () => true,
        isVehicle: () => false,
        isAircraft: () => false,
        isBuilding: () => false,
        isTechno: () => true,
        ...overrides,
    };
}

describe("WeaponTargeting", () => {
    test("initConditions gates IvanBomb on warheadRules.ivanBomb (not rules.ivan)", () => {
        const src = readFileSync(join(ROOT, "src/game/WeaponTargeting.ts"), "utf8");
        const start = src.indexOf("private initConditions()");
        const end = src.indexOf("public canTarget(", start);
        const body = src.slice(start, end);
        expect(body).toContain("this.warheadRules.ivanBomb");
        expect(body).not.toContain("this.gameObject.rules.ivan");
        expect(body).toContain("alliances!.areFriendly");
        expect(body).toContain("target.warpedOutTrait.isInvulnerable()");
        expect(body).not.toContain("alliances?.areFriendly");
        expect(body).not.toContain("warpedOutTrait?.isInvulnerable");
    });

    test("canTargetZone uses direct tileElevation/zone (no ?? fallback)", () => {
        const src = readFileSync(join(ROOT, "src/game/WeaponTargeting.ts"), "utf8");
        const start = src.indexOf("private canTargetZone(");
        const end = src.indexOf("private canTargetLand(", start);
        const body = src.slice(start, end);
        expect(body).toContain("target.tileElevation > 2");
        expect(body).toContain("zone = target.zone;");
        expect(body).toContain("context.landType === LandType.Water");
        expect(body).not.toContain("tileElevation ?? 0");
        expect(body).not.toContain("target.zone ?? ZoneType.Ground");
        expect(body).not.toContain("context?.landType");
    });

    test("ivanBomb warhead rejects already-charged techno targets", () => {
        const shooter = makeBaseGameObject();
        const targeting = new WeaponTargeting(
            WeaponType.Primary,
            { isAntiGround: true, isAntiAir: false },
            { damage: 10 },
            { ivanBomb: true },
            shooter as any,
            { prism: { type: "PRISM" } },
        );
        const charged = makeBaseGameObject({
            tntChargeTrait: { hasCharge: () => true },
        });
        const uncharged = makeBaseGameObject({
            tntChargeTrait: { hasCharge: () => false },
        });
        const alliances = {
            areFriendly: () => false,
            alliances: { haveSharedIntel: () => true },
        };
        expect(targeting.canTarget(charged as any, { landType: 0 } as any, alliances as any)).toBe(
            false,
        );
        expect(
            targeting.canTarget(uncharged as any, { landType: 0 } as any, alliances as any),
        ).toBe(true);
    });
});
