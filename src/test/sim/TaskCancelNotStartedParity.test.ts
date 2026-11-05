import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Task.cancel NotStarted", () => {
    test("marks Cancelled before checking children length", () => {
        const src = readFileSync(
            join(ROOT, "src/game/gameobject/task/system/Task.ts"),
            "utf8",
        );
        const method = src.match(/cancel\(\): void \{[\s\S]*?\n    \}/)?.[0] ?? "";
        expect(method).toContain(
            "this.status === TaskStatus.NotStarted",
        );
        expect(method).toContain("this.status = TaskStatus.Cancelled");
        // Forbid gating Cancelled assignment on children.length.
        expect(method).not.toContain(
            "this.status === TaskStatus.NotStarted &&\n                this.children.length",
        );
    });
});
