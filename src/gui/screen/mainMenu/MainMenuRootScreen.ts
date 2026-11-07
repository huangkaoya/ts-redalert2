import { RootScreen } from '../RootScreen';
import { MainMenu } from './component/MainMenu';
import { MainMenuController } from './MainMenuController';
import { MainMenuScreenType } from '../ScreenType';
import { ScoreScreen } from './score/ScoreScreen';
import { Strings } from '../../../data/Strings';
import { ShpFile } from '../../../data/ShpFile';
import { JsxRenderer } from '../../jsx/JsxRenderer';
import { LazyResourceCollection } from '../../../engine/LazyResourceCollection';
import { MessageBoxApi } from '../../component/MessageBoxApi';
import { Config } from '../../../Config';
import { browserFileSystemAccess } from '../../../engine/gameRes/browserFileSystemAccess';
export interface UiScene {
    menuViewport: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    viewport: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    add(object: any): void;
    remove(object: any): void;
}
export class MainMenuRootScreen extends RootScreen {
    private subScreens: Map<MainMenuScreenType, any>;
    private uiScene: UiScene;
    private strings: Strings;
    private images: LazyResourceCollection<ShpFile>;
    private jsxRenderer: JsxRenderer;
    private messageBoxApi: MessageBoxApi;
    private videoSrc?: string | File;
    private sound?: any;
    private music?: any;
    private appVersion: string;
    private generalOptions?: any;
    private localPrefs?: any;
    private fullScreen?: any;
    private mixer?: any;
    private keyBinds?: any;
    private rootController?: any;
    private config: Config;
    private mainMenu?: MainMenu;
    private mainMenuCtrl?: MainMenuController;
    constructor(subScreens: Map<MainMenuScreenType, any>, uiScene: UiScene, strings: Strings, images: LazyResourceCollection<ShpFile>, jsxRenderer: JsxRenderer, messageBoxApi: MessageBoxApi, appVersion: string, config: Config, videoSrc?: string | File, sound?: any, music?: any, generalOptions?: any, localPrefs?: any, fullScreen?: any, mixer?: any, keyBinds?: any, rootController?: any) {
        super();
        this.subScreens = subScreens;
        this.uiScene = uiScene;
        this.strings = strings;
        this.images = images;
        this.jsxRenderer = jsxRenderer;
        this.messageBoxApi = messageBoxApi;
        this.appVersion = appVersion;
        this.config = config;
        this.videoSrc = videoSrc;
        this.sound = sound;
        this.music = music;
        this.generalOptions = generalOptions;
        this.localPrefs = localPrefs;
        this.fullScreen = fullScreen;
        this.mixer = mixer;
        this.keyBinds = keyBinds;
        this.rootController = rootController;
    }
    createView(): void {
        console.log('[MainMenuRootScreen] Creating view');
        console.log('[MainMenuRootScreen] Using menuViewport:', this.uiScene.menuViewport);
        console.log('[MainMenuRootScreen] Full viewport:', this.uiScene.viewport);
        this.mainMenu = new MainMenu(this.uiScene.menuViewport, this.images, this.jsxRenderer, this.videoSrc as string);
    }
    createViewAndController(): MainMenuController {
        console.log('[MainMenuRootScreen] Creating view and controller');
        this.createView();
        this.mainMenuCtrl = new MainMenuController(this.mainMenu, this.sound, this.music);
        const debugRoot = ((window as any).__ra2debug ??= {});
        debugRoot.mainMenu = this.mainMenu;
        debugRoot.mainMenuController = this.mainMenuCtrl;
        this.mainMenuCtrl.onScreenChange.subscribe((screenType, _controller) => {
            if (screenType !== undefined) {
                console.log(`[MainMenuRootScreen] Navigated to screen: ${screenType}`);
            }
            else {
                console.log('[MainMenuRootScreen] Navigated to previous screen');
            }
        });
        return this.mainMenuCtrl;
    }
    onViewportChange(): void {
        console.log('[MainMenuRootScreen] Viewport changed');
        console.log('[MainMenuRootScreen] New menuViewport:', this.uiScene.menuViewport);
        if (this.mainMenu) {
            this.mainMenu.setViewport(this.uiScene.menuViewport);
        }
        if (this.mainMenuCtrl) {
            this.mainMenuCtrl.rerenderCurrentScreen(true);
        }
    }
    async onEnter(params?: any): Promise<void> {
        console.log('[MainMenuRootScreen] Entering main menu root screen');
        const controller = this.createViewAndController();
        if (!this.subScreens.has(MainMenuScreenType.Score)) {
            this.subScreens.set(MainMenuScreenType.Score, ScoreScreen as any);
        }
        for (const [screenType, screenClass] of this.subScreens) {
            const screen: any = await this.createScreen(screenType, screenClass, controller);
            if (screen) {
                if (screen.setController) {
                    screen.setController(controller);
                }
                controller.addScreen(screenType, screen);
            }
        }
        if (this.mainMenu) {
            this.uiScene.add(this.mainMenu);
        }
        setTimeout(() => {
            if (params?.route) {
                controller.goToScreen(params.route.screenType, params.route.params);
            }
            else {
                controller.goToScreen(MainMenuScreenType.Home);
            }
        }, 0);
    }
    private async createScreen(screenType: MainMenuScreenType, screenClass: any, _controller: any): Promise<any> {
        let screen: any;
        if (screenType === MainMenuScreenType.InfoAndCredits) {
            screen = new screenClass(this.strings, this.messageBoxApi);
        }
        else if (screenType === MainMenuScreenType.Credits) {
            screen = new screenClass(this.strings, this.jsxRenderer);
        }
        else if (screenType === MainMenuScreenType.Options) {
            screen = new screenClass(this.strings, this.jsxRenderer, this.generalOptions, this.localPrefs, this.fullScreen, false, true);
        }
        else if (screenType === MainMenuScreenType.OptionsSound) {
            screen = new screenClass(this.strings, this.jsxRenderer, this.mixer, this.music, this.localPrefs);
        }
        else if (screenType === MainMenuScreenType.OptionsKeyboard) {
            screen = new screenClass(this.strings, this.jsxRenderer, this.keyBinds);
        }
        else if (screenType === MainMenuScreenType.Skirmish) {
            console.log('[MainMenuRootScreen] Creating SkirmishScreen with real dependencies');
            const { ErrorHandler } = await import('../../../ErrorHandler.js');
            const { Rules } = await import('../../../game/rules/Rules.js');
            const { MapFileLoader } = await import('../game/MapFileLoader.js');
            const { Engine } = await import('../../../engine/Engine.js');
            const errorHandler = new ErrorHandler(this.messageBoxApi, this.strings);
            const rules = new Rules(Engine.getRules());
            const { ResourceLoader } = await import('../../../engine/ResourceLoader.js');
            const mapResourceLoader = new ResourceLoader(this.config.mapsBaseUrl ?? '');
            const mapFileLoader = new MapFileLoader(mapResourceLoader, Engine.vfs);
            const mapList = Engine.getMapList();
            const gameModes = Engine.getMpModes();
            screen = new screenClass(this.rootController, errorHandler, this.messageBoxApi, this.strings, rules, this.jsxRenderer, mapFileLoader, mapList, gameModes, this.localPrefs);
        }
        else if (screenType === MainMenuScreenType.MapSelection) {
            console.log('[MainMenuRootScreen] Creating MapSelScreen with real dependencies');
            const { ErrorHandler } = await import('../../../ErrorHandler.js');
            const { MapFileLoader } = await import('../game/MapFileLoader.js');
            const { Engine } = await import('../../../engine/Engine.js');
            const errorHandler = new ErrorHandler(this.messageBoxApi, this.strings);
            const { ResourceLoader } = await import('../../../engine/ResourceLoader.js');
            const mapResourceLoader = new ResourceLoader(this.config.mapsBaseUrl ?? '');
            const mapFileLoader = new MapFileLoader(mapResourceLoader, Engine.vfs);
            const mapList = Engine.getMapList();
            const gameModes = Engine.getMpModes();
            let mapDir: any = undefined;
            try {
                const mapDirHandle = await Engine.getMapDir();
                if (mapDirHandle) {
                    const { RealFileSystemDir } = await import('../../../data/vfs/RealFileSystemDir.js');
                    mapDir = new RealFileSystemDir(mapDirHandle);
                }
            }
            catch (e) {
                console.error("[MainMenuRootScreen] Couldn't get map dir", e);
            }
            const fsAccessLib = browserFileSystemAccess;
            const sentry = undefined as any;
            screen = new screenClass(this.strings, this.jsxRenderer, mapFileLoader, errorHandler, this.messageBoxApi, this.localPrefs, mapList, gameModes, mapDir, fsAccessLib, sentry);
        }
        else if (screenType === MainMenuScreenType.Score) {
            screen = new screenClass(this.strings, this.jsxRenderer, (this as any).wolService);
        }
        else if (screenType === MainMenuScreenType.ReplaySelection) {
            const { ErrorHandler } = await import('../../../ErrorHandler.js');
            const { Rules } = await import('../../../game/rules/Rules.js');
            const { Engine } = await import('../../../engine/Engine.js');
            const errorHandler = new ErrorHandler(this.messageBoxApi, this.strings);
            const rules = new Rules(Engine.getRules());
            const replayManager = (this as any).replayManager;
            const engineVersion = Engine.getVersion();
            const engineModHash = String(Engine.getModHash());
            screen = new screenClass(engineVersion, engineModHash, undefined, undefined, this.rootController, this.strings, this.jsxRenderer, errorHandler, this.messageBoxApi, replayManager, undefined, rules);
        }
        else if (screenType === MainMenuScreenType.LanSetup) {
            const { ErrorHandler } = await import('../../../ErrorHandler.js');
            const { Rules } = await import('../../../game/rules/Rules.js');
            const { MapFileLoader } = await import('../game/MapFileLoader.js');
            const { Engine } = await import('../../../engine/Engine.js');
            const errorHandler = new ErrorHandler(this.messageBoxApi, this.strings);
            const rules = new Rules(Engine.getRules());
            const { ResourceLoader } = await import('../../../engine/ResourceLoader.js');
            const mapResourceLoader = new ResourceLoader(this.config.mapsBaseUrl ?? '');
            const mapFileLoader = new MapFileLoader(mapResourceLoader, Engine.vfs);
            const mapList = Engine.getMapList();
            const gameModes = Engine.getMpModes();
            let mapDir: any = undefined;
            try {
                const mapDirHandle = await Engine.getMapDir();
                if (mapDirHandle) {
                    const { RealFileSystemDir } = await import('../../../data/vfs/RealFileSystemDir.js');
                    mapDir = new RealFileSystemDir(mapDirHandle);
                }
            }
            catch (error) {
                console.error("[MainMenuRootScreen] Couldn't get map dir for LAN setup", error);
            }
            screen = new screenClass(this.rootController, this.strings, this.jsxRenderer, rules, mapFileLoader, mapList, gameModes, this.localPrefs, this.messageBoxApi, mapDir);
        }
        else if (screenType === MainMenuScreenType.Home) {
            screen = new screenClass(this.strings, this.messageBoxApi, this.appVersion, false, false, this.fullScreen);
        }
        else {
            screen = new screenClass(this.strings, this.messageBoxApi, this.appVersion, false, false);
        }
        return screen;
    }
    async onLeave(): Promise<void> {
        console.log('[MainMenuRootScreen] Leaving main menu root screen');
        if (this.mainMenuCtrl) {
            this.mainMenuCtrl.toggleMainVideo(false);
            await this.mainMenuCtrl.leaveCurrentScreen();
            this.mainMenuCtrl.destroy();
            this.mainMenuCtrl = undefined;
        }
        const debugRoot = (window as any).__ra2debug;
        if (debugRoot) {
            delete debugRoot.mainMenu;
            delete debugRoot.mainMenuController;
        }
        if (this.mainMenu) {
            this.uiScene.remove(this.mainMenu);
            this.mainMenu.destroy();
            this.mainMenu = undefined;
        }
    }
    update(deltaTime: number): void {
        if (this.mainMenuCtrl) {
            this.mainMenuCtrl.update(deltaTime);
        }
        if (this.mainMenu) {
            this.mainMenu.update(deltaTime);
        }
    }
    destroy(): void {
        console.log('[MainMenuRootScreen] Destroying');
        if (this.mainMenuCtrl) {
            this.mainMenuCtrl.destroy();
        }
        if (this.mainMenu) {
            this.mainMenu.destroy();
        }
    }
}
