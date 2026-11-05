import { describe, expect, test } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../../..");

describe("Bot context access", () => {
    test("player.actions/production and logger.setDebugLevel use 模拟层 soft style", () => {
        const src = readFileSync(join(ROOT, "src/game/bot/Bot.ts"), "utf8");
        expect(src).toContain("this.context?.player.actions");
        expect(src).toContain("this.context?.player.production");
        expect(src).toContain("this.context.logger.setDebugLevel(this.debugMode)");
        expect(src).toContain("this.context?.logger.setDebugLevel(debug)");
        expect(src).not.toContain("player?.actions");
        expect(src).not.toContain("player?.production");
        expect(src).not.toContain("logger?.setDebugLevel");
    });
});
