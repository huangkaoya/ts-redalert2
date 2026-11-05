import { describe, expect, test } from "bun:test";
import { RootController } from "../../gui/screen/RootController";
import { ScreenType } from "../../gui/screen/ScreenType";

describe("root screen navigation", () => {
    test("string MainMenuRoot resolves to the registered root screen", async () => {
        const controller = new RootController({ loaded: true });
        let entered = false;
        controller.addScreen(ScreenType.MainMenuRoot, {
            async onEnter() {
                entered = true;
            },
        });
        await controller.goToScreenBlocking("MainMenuRoot" as unknown as ScreenType);
        expect(entered).toBe(true);
        expect(controller.getCurrentScreenType()).toBe(ScreenType.MainMenuRoot);
    });

    test("numeric MainMenuRoot still opens the root screen", async () => {
        const controller = new RootController({ loaded: true });
        let entered = false;
        controller.addScreen(ScreenType.MainMenuRoot, {
            async onEnter() {
                entered = true;
            },
        });
        await controller.goToScreenBlocking(ScreenType.MainMenuRoot);
        expect(entered).toBe(true);
    });
});
