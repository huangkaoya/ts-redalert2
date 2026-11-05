import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("CaptureOrder", () => {
    test("multiEngineer damage pointer gates on needsEngineer not isNeutral", () => {
        const src = readFileSync(join(ROOT, "src/game/order/CaptureOrder.ts"), "utf8");
        const start = src.indexOf("getPointerType(");
        const end = src.indexOf("\n    isValid(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("multiEngineer");
        expect(body).toContain("!targetObj.rules.needsEngineer");
        expect(body).toContain("engineerAlwaysCaptureTech");
        expect(body).toContain("engineerCaptureLevel");
        expect(body).toContain("PointerType.EngineerDamage");
        expect(body).not.toContain("owner.isNeutral");
    });

    test("isValid rejects buildings already secured by the same owner", () => {
        const src = readFileSync(join(ROOT, "src/game/order/CaptureOrder.ts"), "utf8");
        const start = src.indexOf("isValid(");
        const end = src.indexOf("\n    isAllowed(");
        const body = src.slice(start, end === -1 ? undefined : end);
        expect(body).toContain("secureProgressTrait?.isActiveFrom(this.sourceObject.owner)");
        expect(body).toContain("rules.capturable");
        expect(body).toContain("rules.engineer");
        expect(body).toContain("areFriendly");
    });
});

