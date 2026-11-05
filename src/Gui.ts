import { Renderer } from './engine/gfx/Renderer.js';
import { UiScene } from './gui/UiScene.js';
import { JsxRenderer } from './gui/jsx/JsxRenderer.js';
import { BoxedVar } from './util/BoxedVar.js';
import { RootController } from './gui/screen/RootController.js';
import { ScreenType, MainMenuScreenType } from './gui/screen/ScreenType.js';
import { MainMenuRootScreen } from './gui/screen/mainMenu/MainMenuRootScreen.js';
import { HomeScreen } from './gui/screen/mainMenu/main/HomeScreen.js';
import { LanSetupScreen } from './gui/screen/mainMenu/lan/LanSetupScreen.js';
import { StorageScreen } from './gui/screen/options/StorageScreen.js';
import { Config } from './Config.js';
import { Strings } from './data/Strings.js';
import { Engine } from './engine/Engine.js';
import { MusicType } from './engine/sound/Music.js';
import { MessageBoxApi } from './gui/component/MessageBoxApi.js';
import { ToastApi } from './gui/component/ToastApi';
import { ShpFile } from './data/ShpFile.js';
import { Palette } from './data/Palette.js';
import { UiAnimationLoop } from './engine/UiAnimationLoop.js';
import { Mixer } from './engine/sound/Mixer.js';
import { ChannelType } from './engine/sound/ChannelType.js';
import { AudioSystem } from './engine/sound/AudioSystem.js';
import { Sound } from './engine/sound/Sound.js';
import { SoundSpecs } from './engine/sound/SoundSpecs.js';
import { Music } from './engine/sound/Music.js';
import { MusicSpecs } from './engine/sound/MusicSpecs.js';
import { LocalPrefs, StorageKey } from './LocalPrefs.js';
import { GeneralOptions } from './gui/screen/options/GeneralOptions.js';
import { FullScreen } from './gui/FullScreen.js';
import { Pointer } from './gui/Pointer.js';
import { CanvasMetrics } from './gui/CanvasMetrics.js';
import { createMobileTouchControls } from './gui/MobileTouchControls.js';
import { ErrorHandler } from './ErrorHandler.js';
import { ResourceLoader } from './engine/ResourceLoader.js';
import { MapFileLoader } from './gui/screen/game/MapFileLoader.js';
import { LoadingScreenApiFactory } from './gui/screen/game/loadingScreen/LoadingScreenApiFactory.js';
import { GameLoader } from './gui/screen/game/GameLoader.js';
import { Rules } from './game/rules/Rules.js';
import { VxlGeometryPool } from './engine/renderable/builder/vxlGeometry/VxlGeometryPool.js';
import { VxlGeometryCache } from './engine/gfx/geometry/VxlGeometryCache.js';
import { GameResConfig } from './engine/gameRes/GameResConfig.js';
import { KeyBinds } from './gui/screen/game/worldInteraction/keyboard/KeyBinds.js';
import { ClientApi } from './ClientApi.js';
import type { ViewportRect } from './gui/Viewport.js';
import { attachPerformanceOptions, installPerformanceDebugApi } from './performance/PerformanceRuntime.js';
export class Gui {
    private appVersion: string;
    private strings: Strings;
    private config: Config;
    private viewport: BoxedVar<ViewportRect>;
    private rootEl: HTMLElement;
    private renderer?: Renderer;
    private uiScene?: UiScene;
    private jsxRenderer?: JsxRenderer;
    private uiAnimationLoop?: UiAnimationLoop;
    private rootController?: RootController;
    private messageBoxApi?: MessageBoxApi;
    private toastApi?: any;
    private runtimeVars?: any;
    private pointer?: Pointer;
    private canvasMetrics?: CanvasMetrics;
    private cdnResourceLoader?: any;
    private gameResConfig?: GameResConfig;
    private mixer?: Mixer;
    private audioSystem?: AudioSystem;
    private sound?: Sound;
    private music?: Music;
    private localPrefs: LocalPrefs;
    private generalOptions?: GeneralOptions;
    private fullScreen?: FullScreen;
    private keyBinds?: any;
    private images: Map<string, ShpFile> = new Map();
    private palettes: Map<string, Palette> = new Map();
    private animationId?: number;
    private lastTime: number = 0;
    constructor(appVersion: string, strings: Strings, config: Config, viewport: BoxedVar<ViewportRect>, rootEl: HTMLElement, cdnResourceLoader?: any, gameResConfig?: GameResConfig, runtimeVars?: any, generalOptions?: GeneralOptions, fullScreen?: FullScreen) {
        this.appVersion = appVersion;
        this.strings = strings;
        this.config = config;
        this.viewport = viewport;
        this.rootEl = rootEl;
        this.localPrefs = new LocalPrefs(localStorage);
        this.cdnResourceLoader = cdnResourceLoader;
        this.gameResConfig = gameResConfig;
        this.runtimeVars = runtimeVars;
        this.generalOptions = generalOptions;
        this.fullScreen = fullScreen;
    }
    async init(): Promise<void> {
        console.log('[Gui] Initializing GUI system');
        this.initRenderer();
        this.initUiScene();
        await this.loadGameResources();
        await this.initAudioSystem();
        await this.initOptionsSystem();
        this.initPointer();
        this.initJsxRenderer();
        this.initRootController();
        this.startAnimationLoop();
        await this.routeToInitialScreen();
        createMobileTouchControls(this.rootEl);
    }
    private initRenderer(): void {
        console.log('[Gui] Initializing renderer');
        const { width, height } = this.viewport.value;
        this.renderer = new Renderer(width, height);
        this.renderer.init(this.rootEl);
        this.uiAnimationLoop = new UiAnimationLoop(this.renderer);
        this.uiAnimationLoop.start();
        console.log('[Gui] UiAnimationLoop started');
        this.viewport.onChange.subscribe(this.handleViewportChange.bind(this));
    }
    private handleViewportChange(newViewport: {
        x: number;
        y: number;
        width: number;
        height: number;
    }): void {
        console.log('[Gui] Viewport changed:', newViewport);
        this.renderer?.setSize(newViewport.width, newViewport.height);
        if (this.uiScene) {
            const newCamera = UiScene.createCamera(newViewport);
            this.uiScene.setCamera(newCamera);
            this.uiScene.setViewport(newViewport);
            if (this.jsxRenderer) {
                this.jsxRenderer.setCamera(newCamera);
            }
            this.rootController?.rerenderCurrentScreen();
            this.canvasMetrics?.notifyViewportChange();
        }
    }
    private initUiScene(): void {
        console.log('[Gui] Initializing UI scene');
        this.uiScene = UiScene.factory(this.viewport.value);
    }
    private initJsxRenderer(): void {
        console.log('[Gui] Initializing JSX renderer');
        if (!this.uiScene) {
            throw new Error('UiScene must be initialized before JsxRenderer');
        }
        this.jsxRenderer = new JsxRenderer(Engine.images, Engine.palettes, this.uiScene.getCamera(), this.pointer?.pointerEvents);
        this.messageBoxApi = new MessageBoxApi(this.viewport, this.uiScene, this.jsxRenderer);
        this.toastApi = new ToastApi(this.viewport, this.uiScene, this.jsxRenderer);
    }
    private initPointer(): void {
        if (!this.renderer || !this.uiScene || !this.generalOptions)
            return;
        const canvasMetrics = new CanvasMetrics(this.renderer.getCanvas(), window);
        canvasMetrics.init();
        this.canvasMetrics = canvasMetrics;
        const pointer = Pointer.factory(Engine.images.get('mouse.shp'), Engine.palettes.get('mousepal.pal'), this.renderer, document, canvasMetrics, this.generalOptions.mouseAcceleration);
        pointer.init();
        this.pointer = pointer;
        this.uiScene.add(pointer.getSprite());
    }
    private initRootController(): void {
        console.log('[Gui] Initializing root controller');
        const serverRegions = { loaded: true } as any;
        this.rootController = new RootController(serverRegions);
    }
    private async loadGameResources(): Promise<void> {
        console.log('[Gui] Loading game resources');
        if (!Engine.vfs) {
            console.warn('[Gui] Engine.vfs not available - skipping resource loading');
            return;
        }
        Engine.images.setVfs(Engine.vfs);
        Engine.palettes.setVfs(Engine.vfs);
        console.log('[Gui] Engine LazyResourceCollections configured with VFS');
        const testImages = ['mnscrnl.shp', 'lwscrnl.shp', 'sdtp.shp'];
        for (const imageName of testImages) {
            try {
                const shpFile = Engine.images.get(imageName);
                if (shpFile) {
                    console.log(`[Gui] Successfully loaded test image: ${imageName} (${shpFile.width}x${shpFile.height})`);
                }
                else {
                    console.warn(`[Gui] Failed to load test image: ${imageName}`);
                }
            }
            catch (error) {
                console.warn(`[Gui] Error loading test image ${imageName}:`, error);
            }
        }
    }
    private async getMainMenuVideoUrl(): Promise<string | File | undefined> {
        console.log('[Gui] Getting main menu video URL');
        const videoFileName = Engine.rfsSettings.menuVideoFileName;
        console.log('[Gui] Video file name:', videoFileName);
        try {
            if (Engine.rfs) {
                console.log('[Gui] Checking RFS for video file...');
                try {
                    const rfsContainsVideo = await Engine.rfs.containsEntry(videoFileName);
                    console.log(`[Gui] RFS contains ${videoFileName}:`, rfsContainsVideo);
                    if (rfsContainsVideo) {
                        console.log('[Gui] Found video file in RFS:', videoFileName);
                        const fileData = await Engine.rfs.getRawFile(videoFileName);
                        const videoFile = new File([fileData], videoFileName, { type: "video/webm" });
                        console.log('[Gui] Created video File object from RFS:', videoFile.name, videoFile.size, 'bytes');
                        if (videoFile.size === 0) {
                            console.warn('[Gui] Video file from RFS is empty!');
                        }
                        else {
                            return videoFile;
                        }
                    }
                }
                catch (error) {
                    console.warn('[Gui] Error checking RFS for video file:', error);
                }
            }
            else {
                console.warn('[Gui] Engine.rfs not available');
            }
            if (!Engine.vfs) {
                console.warn('[Gui] Engine.vfs not available - cannot load video');
                return undefined;
            }
            console.log('[Gui] Checking if video file exists in VFS...');
            console.log('[Gui] Available archives:', Engine.vfs.listArchives());
            console.log(`[Gui] Checking for video file: ${videoFileName}`);
            console.log(`[Gui] VFS fileExists result:`, Engine.vfs.fileExists(videoFileName));
            if (Engine.vfs.fileExists(videoFileName)) {
                console.log('[Gui] Found video file in VFS:', videoFileName);
                const fileData = Engine.vfs.openFile(videoFileName).asFile();
                const videoFile = new File([fileData], videoFileName, { type: "video/webm" });
                console.log('[Gui] Created video File object:', videoFile.name, videoFile.size, 'bytes');
                if (videoFile.size === 0) {
                    console.warn('[Gui] Video file is empty!');
                    return undefined;
                }
                return videoFile;
            }
            else {
                console.warn('[Gui] Video file not found in VFS:', videoFileName);
                const alternativeNames = ['ra2ts_l.bik', 'ra2ts_l.mp4', 'menu.webm', 'menu.mp4', 'ra2ts_l.avi'];
                for (const altName of alternativeNames) {
                    console.log(`[Gui] Checking alternative video file: ${altName}`);
                    if (Engine.vfs.fileExists(altName)) {
                        console.log('[Gui] Found alternative video file:', altName);
                        if (altName.endsWith('.bik')) {
                            console.warn(`[Gui] Found .bik file but cannot play directly: ${altName}`);
                            console.warn('[Gui] .bik files need to be converted to .webm during import process');
                            continue;
                        }
                        const fileData = Engine.vfs.openFile(altName).asFile();
                        const videoFile = new File([fileData], altName, {
                            type: altName.endsWith('.mp4') ? "video/mp4" : "video/webm"
                        });
                        console.log('[Gui] Created alternative video File object:', videoFile.name, videoFile.size, 'bytes');
                        return videoFile;
                    }
                }
                console.warn('[Gui] No playable video file found, will proceed without video');
                return undefined;
            }
        }
        catch (error) {
            console.error('[Gui] Failed to read video file from VFS:', error);
            return undefined;
        }
    }
    private async routeToInitialScreen(): Promise<void> {
        console.log('[Gui] Routing to initial screen');
        if (!this.rootController || !this.uiScene || !this.jsxRenderer || !this.renderer || !this.messageBoxApi) {
            throw new Error('GUI components not properly initialized');
        }
        this.renderer.addScene(this.uiScene);
        this.rootEl.appendChild(this.uiScene.getHtmlContainer().getElement()!);
        console.log('[Gui] Added UiScene HTML container to DOM');
        let hasShownDialog = false;
        if (this.music && !hasShownDialog && this.audioSystem?.isSuspended()) {
            console.log('[Gui] Audio system is suspended, requesting permission');
            await new Promise<void>((resolve) => {
                this.messageBoxApi!.show(this.strings.get("GUI:RequestAudioPermission"), this.strings.get("GUI:OK"), async () => {
                    try {
                        await this.audioSystem!.initMusicLoop();
                        console.log('[Gui] Audio permission granted and music loop initialized');
                    }
                    catch (error) {
                        console.error('[Gui] Failed to initialize music loop:', error);
                    }
                    resolve();
                });
            });
            hasShownDialog = true;
        }
        await this.navigateToMainMenu();
    }
    private async navigateToMainMenu(): Promise<void> {
        console.log('[Gui] Navigating to main menu');
        if (!this.rootController || !this.uiScene || !this.jsxRenderer || !this.renderer || !this.messageBoxApi) {
            throw new Error('GUI components not properly initialized');
        }
        const videoSrc = await this.getMainMenuVideoUrl();
        console.log('[Gui] Video source:', videoSrc);
        const subScreens = new Map<MainMenuScreenType, any>();
        subScreens.set(MainMenuScreenType.Home, HomeScreen);
        subScreens.set(MainMenuScreenType.OptionsStorage, StorageScreen);
        const { SkirmishScreen } = await import('./gui/screen/mainMenu/lobby/SkirmishScreen.js');
        subScreens.set(MainMenuScreenType.Skirmish, SkirmishScreen);
        const { MapSelScreen } = await import('./gui/screen/mainMenu/mapSel/MapSelScreen.js');
        subScreens.set(MainMenuScreenType.MapSelection, MapSelScreen);
        const { TestEntryScreen } = await import('./gui/screen/mainMenu/main/TestEntryScreen.js');
        subScreens.set(MainMenuScreenType.TestEntry, TestEntryScreen);
        subScreens.set(MainMenuScreenType.LanSetup, LanSetupScreen);
        const { InfoAndCreditsScreen } = await import('./gui/screen/mainMenu/infoAndCredits/InfoAndCreditsScreen.js');
        const { CreditsScreen } = await import('./gui/screen/mainMenu/credits/CreditsScreen.js');
        subScreens.set(MainMenuScreenType.InfoAndCredits, InfoAndCreditsScreen);
        subScreens.set(MainMenuScreenType.Credits, CreditsScreen);
        const { OptionsScreen } = await import('./gui/screen/options/OptionsScreen.js');
        const { SoundOptsScreen } = await import('./gui/screen/options/SoundOptsScreen.js');
        const { KeyboardScreen } = await import('./gui/screen/options/KeyboardScreen.js');
        subScreens.set(MainMenuScreenType.Options, OptionsScreen);
        subScreens.set(MainMenuScreenType.OptionsSound, SoundOptsScreen);
        subScreens.set(MainMenuScreenType.OptionsKeyboard, KeyboardScreen);
        const { ReplaySelScreen } = await import('./gui/screen/replay/ReplaySelScreen.js');
        subScreens.set(MainMenuScreenType.ReplaySelection, ReplaySelScreen);
        const { ReplayManager } = await import('./gui/ReplayManager.js');
        let replayManager: any;
        try {
            const replayDirHandle = await Engine.getReplayDir();
            if (replayDirHandle) {
                const { RealFileSystemDir } = await import('./data/vfs/RealFileSystemDir.js');
                const { ReplayStorageFileSystem } = await import('./gui/replay/ReplayStorageFileSystem.js');
                replayManager = new ReplayManager(new ReplayStorageFileSystem(new RealFileSystemDir(replayDirHandle) as any));
            }
        }
        catch (error) {
            console.error('[Gui] Failed to initialize persistent replay storage', error);
        }
        if (!replayManager) {
            const { ReplayStorageMemStorage } = await import('./gui/replay/ReplayStorageMemStorage.js');
            replayManager = new ReplayManager(new ReplayStorageMemStorage());
        }
        const mainMenuRootScreen = new MainMenuRootScreen(subScreens, this.uiScene, this.strings, Engine.images, this.jsxRenderer, this.messageBoxApi, this.appVersion, this.config, videoSrc, this.sound, this.music, this.generalOptions, this.localPrefs, this.fullScreen, this.mixer, this.keyBinds, this.rootController);
        (mainMenuRootScreen as any).replayManager = replayManager;
        this.rootController.addScreen(ScreenType.MainMenuRoot, mainMenuRootScreen);
        const { GameScreen } = await import('./gui/screen/game/GameScreen.js');
        const errorHandler = new ErrorHandler(this.messageBoxApi, this.strings);
        const gameResBaseUrl = this.config.gameresBaseUrl ?? '';
        const mapsBaseUrl = this.config.mapsBaseUrl ?? '';
        console.log('[Gui] Creating game loaders', { gameResBaseUrl, mapsBaseUrl });
        const gameResLoader = this.cdnResourceLoader ?? new ResourceLoader(gameResBaseUrl);
        const mapResLoader = new ResourceLoader(mapsBaseUrl);
        const mapFileLoader = new MapFileLoader(mapResLoader, (Engine as any).vfs);
        const rules = new Rules(Engine.getRules(), undefined);
        const loadingScreenApiFactory = new LoadingScreenApiFactory(rules, this.strings, this.uiScene, this.jsxRenderer!, this.gameResConfig!, undefined as any);
        const gameModes = Engine.getMpModes();
        const speedCheat = new BoxedVar<boolean>(false);
        const mutedPlayers = new Set<string>();
        const tauntsEnabled = new BoxedVar<boolean>(this.localPrefs.getBool(StorageKey.TauntsEnabled, true));
        tauntsEnabled.onChange.subscribe((value: boolean) => {
            this.localPrefs.setItem(StorageKey.TauntsEnabled, String(Number(value)));
        });
        const clientApi = new ClientApi();
        window.dispatchEvent(new CustomEvent('CdApiReady', { detail: clientApi }));
        (window as any).CdApi = clientApi;
        const gameMenuSubScreens = new Map<number, any>();
        gameMenuSubScreens.set((await import('./gui/screen/game/gameMenu/ScreenType.js')).ScreenType.Home, new (await import('./gui/screen/game/gameMenu/GameMenuHomeScreen.js')).GameMenuHomeScreen(this.strings, this.fullScreen!));
        gameMenuSubScreens.set((await import('./gui/screen/game/gameMenu/ScreenType.js')).ScreenType.Diplo, new (await import('./gui/screen/game/gameMenu/DiploScreen.js')).DiploScreen(this.strings, this.jsxRenderer!, this.renderer!, Engine.getMpModes() as any, tauntsEnabled, mutedPlayers));
        gameMenuSubScreens.set((await import('./gui/screen/game/gameMenu/ScreenType.js')).ScreenType.ConnectionInfo, new (await import('./gui/screen/game/gameMenu/ConnectionInfoScreen.js')).ConnectionInfoScreen(this.strings, this.jsxRenderer!));
        gameMenuSubScreens.set((await import('./gui/screen/game/gameMenu/ScreenType.js')).ScreenType.QuitConfirm, new (await import('./gui/screen/game/gameMenu/QuitConfirmScreen.js')).QuitConfirmScreen(this.strings));
        gameMenuSubScreens.set((await import('./gui/screen/game/gameMenu/ScreenType.js')).ScreenType.Options, new (await import('./gui/screen/options/OptionsScreen.js')).OptionsScreen(this.strings, this.jsxRenderer!, this.generalOptions!, this.localPrefs, this.fullScreen!, true, false));
        gameMenuSubScreens.set((await import('./gui/screen/game/gameMenu/ScreenType.js')).ScreenType.OptionsSound, new (await import('./gui/screen/options/SoundOptsScreen.js')).SoundOptsScreen(this.strings, this.jsxRenderer!, this.mixer!, this.music!, this.localPrefs));
        gameMenuSubScreens.set((await import('./gui/screen/game/gameMenu/ScreenType.js')).ScreenType.OptionsKeyboard, new (await import('./gui/screen/options/KeyboardScreen.js')).KeyboardScreen(this.strings, this.jsxRenderer!, this.keyBinds!));
        const sharedVxlGeometryPool = new VxlGeometryPool(new VxlGeometryCache(null, Engine.getActiveMod?.() ?? null), this.generalOptions!.graphics.models.value);
        const buildingImageDataCache = new Map();
        const gameScreen = new GameScreen(undefined, undefined, undefined, undefined, undefined, this.appVersion, '', errorHandler, gameMenuSubScreens, loadingScreenApiFactory, undefined, undefined, this.config, this.strings, this.renderer, this.uiScene, this.runtimeVars || {}, this.messageBoxApi, this.toastApi, this.uiAnimationLoop, this.viewport, this.jsxRenderer, this.pointer, this.sound, this.music, this.mixer, this.keyBinds, this.generalOptions, this.localPrefs, undefined, undefined, replayManager, this.fullScreen, mapFileLoader, undefined, Engine.getMapList?.(), new GameLoader(this.appVersion, undefined, gameResLoader, gameResLoader, rules, gameModes, this.sound, (console as any), console, speedCheat, this.gameResConfig!, sharedVxlGeometryPool, buildingImageDataCache, (this as any).runtimeVars?.debugBotIndex, this.config.devMode ?? false), sharedVxlGeometryPool, buildingImageDataCache, mutedPlayers, tauntsEnabled, speedCheat, undefined, clientApi.battleControl);
        (gameScreen as any).setController?.(this.rootController);
        this.rootController.addScreen(ScreenType.Game, gameScreen as any);
        const { ReplayScreen } = await import('./gui/screen/replay/ReplayScreen.js');
        const replayGameLoader = new GameLoader(this.appVersion, undefined, gameResLoader, gameResLoader, rules, gameModes, this.sound, (console as any), console, speedCheat, this.gameResConfig!, sharedVxlGeometryPool, buildingImageDataCache, (this as any).runtimeVars?.debugBotIndex, this.config.devMode ?? false);
        const replayScreen = new ReplayScreen(this.appVersion, '', errorHandler, gameMenuSubScreens, loadingScreenApiFactory, this.config as any, this.strings, this.renderer as any, this.uiScene as any, this.runtimeVars || {} as any, this.messageBoxApi as any, this.uiAnimationLoop as any, this.viewport as any, this.jsxRenderer as any, this.pointer as any, this.sound as any, this.music as any, this.keyBinds as any, this.generalOptions as any, undefined as any, this.fullScreen as any, mapFileLoader as any, replayGameLoader as any, sharedVxlGeometryPool as any, buildingImageDataCache as any, (params?: any) => {
            this.rootController!.goToScreen(ScreenType.MainMenuRoot, params);
        }, clientApi.battleControl);
        this.rootController.addScreen(ScreenType.Replay, replayScreen as any);
        this.rootController.goToScreen(ScreenType.MainMenuRoot);
    }
    private startAnimationLoop(): void {
        console.log('[Gui] Animation loop already started by UiAnimationLoop');
    }
    getRootController(): RootController {
        if (!this.rootController) {
            throw new Error('Root controller is not initialized');
        }
        return this.rootController;
    }
    getMessageBoxApi(): MessageBoxApi {
        if (!this.messageBoxApi) {
            throw new Error('MessageBoxApi is not initialized');
        }
        return this.messageBoxApi;
    }
    async destroy(): Promise<void> {
        console.log('[Gui] Destroying GUI system');
        try {
            const { ShpBuilder } = await import('./engine/renderable/builder/ShpBuilder.js');
            if (ShpBuilder?.clearCaches) {
                ShpBuilder.clearCaches();
                console.log('[Gui] Cleared ShpBuilder caches');
            }
            const TexUtils = await import('./engine/gfx/TextureUtils.js');
            if (TexUtils?.TextureUtils?.cache) {
                TexUtils.TextureUtils.cache.forEach((tex: any) => tex.dispose?.());
                TexUtils.TextureUtils.cache.clear();
                console.log('[Gui] Cleared TextureUtils caches');
            }
        }
        catch (e) {
            console.warn('[Gui] Failed to clear caches during destroy:', e);
        }
        if (this.messageBoxApi) {
            this.messageBoxApi.destroy();
        }
        if (this.music) {
            this.music.stopPlaying();
            this.music.dispose();
        }
        if (this.sound) {
            this.sound.dispose();
        }
        if (this.audioSystem) {
            this.audioSystem.dispose();
        }
        if (this.mixer) {
            this.localPrefs.setItem(StorageKey.Mixer, this.mixer.serialize());
        }
        if (this.music) {
            this.localPrefs.setItem(StorageKey.MusicOpts, this.music.serializeOptions());
        }
        const debugRoot = (window as any).__ra2debug;
        if (debugRoot) {
            debugRoot.audioSystem = undefined;
            debugRoot.mixer = undefined;
            debugRoot.music = undefined;
            debugRoot.generalOptions = undefined;
            debugRoot.keyBinds = undefined;
            debugRoot.fullScreen = undefined;
            debugRoot.localPrefs = undefined;
        }
        if (this.uiAnimationLoop) {
            this.uiAnimationLoop.destroy();
        }
        if (this.rootController) {
            this.rootController.destroy();
        }
        if (this.uiScene) {
            const htmlElement = this.uiScene.getHtmlContainer().getElement();
            if (htmlElement && this.rootEl.contains(htmlElement)) {
                this.rootEl.removeChild(htmlElement);
            }
            this.uiScene.destroy();
        }
        if (this.renderer) {
            this.rootEl.removeChild(this.renderer.getCanvas());
            this.renderer.dispose();
        }
    }
    private async initAudioSystem(): Promise<void> {
        console.log('[Gui] Initializing audio system');
        try {
            let mixer: Mixer;
            const mixerData = this.localPrefs.getItem(StorageKey.Mixer);
            if (mixerData) {
                try {
                    mixer = new Mixer().unserialize(mixerData);
                    console.log('[Gui] Loaded mixer settings from local storage');
                }
                catch (error) {
                    console.warn('Failed to read mixer values from local storage', error);
                    mixer = this.createDefaultMixer();
                }
            }
            else {
                mixer = this.createDefaultMixer();
            }
            this.mixer = mixer;
            this.audioSystem = new AudioSystem(mixer as any);
            const debugRoot = ((window as any).__ra2debug ??= {});
            debugRoot.audioSystem = this.audioSystem;
            debugRoot.mixer = this.mixer;
            if (Engine.vfs) {
                const soundIni = Engine.getIni('sound.ini');
                const soundSpecs = new SoundSpecs(soundIni);
                const audioVisualRules = {
                    ini: {
                        getString: (key: string) => {
                            try {
                                const rulesIni = Engine.getIni('rules.ini');
                                const audioVisualSection = rulesIni.getSection('AudioVisual');
                                if (audioVisualSection) {
                                    return audioVisualSection.getString(key);
                                }
                            }
                            catch (error) {
                                console.warn(`[Gui] Failed to get AudioVisual setting for key "${key}":`, error);
                            }
                            return undefined;
                        }
                    }
                };
                const soundAudioSystemAdapter = {
                    initialize: () => this.audioSystem!.initialize(),
                    dispose: () => this.audioSystem!.dispose(),
                    playWavFile: (file: any, channel: ChannelType, volume?: number, pan?: number, delay?: number, rate?: number, loop?: boolean) => {
                        return this.audioSystem!.playWavFile(file, channel, volume, pan, delay, rate, loop);
                    },
                    playWavSequence: (files: any[], channel: ChannelType, volume?: number, pan?: number, delay?: number, rate?: number) => {
                        return this.audioSystem!.playWavSequence(files, channel, volume, pan, delay, rate);
                    },
                    playWavLoop: (files: any[], channel: ChannelType, volume?: number, pan?: number, delayMs?: {
                        min: number;
                        max: number;
                    }, rate?: number, attack?: boolean, decay?: boolean, loops?: number) => {
                        return this.audioSystem!.playWavLoop(files, channel, volume, pan, delayMs, rate, attack, decay, loops);
                    },
                    setMuted: (muted: boolean) => this.audioSystem!.setMuted(muted)
                };
                this.sound = new Sound(soundAudioSystemAdapter, Engine.getSounds(), soundSpecs, audioVisualRules, document);
                this.sound.initialize();
                console.log('[Gui] Sound system initialized');
            }
            await this.initMusicSystem();
            console.log('[Gui] Audio system initialization completed');
        }
        catch (error) {
            console.error('[Gui] Failed to initialize audio system:', error);
        }
    }
    private createDefaultMixer(): Mixer {
        const mixer = new Mixer();
        mixer.setVolume(ChannelType.Master, 0.4);
        mixer.setVolume(ChannelType.CreditTicks, 0.2);
        mixer.setVolume(ChannelType.Music, 0.3);
        mixer.setVolume(ChannelType.Ambient, 0.3);
        mixer.setVolume(ChannelType.Effect, 0.5);
        mixer.setVolume(ChannelType.Voice, 0.7);
        mixer.setVolume(ChannelType.Ui, 0.5);
        console.log('[Gui] Created default mixer settings');
        return mixer;
    }
    private async initMusicSystem(): Promise<void> {
        if (!this.audioSystem || !Engine.vfs) {
            console.warn('[Gui] Cannot initialize music system - missing dependencies');
            return;
        }
        try {
            let hasMusicDir = false;
            try {
                hasMusicDir = !!(await Engine.rfs?.containsEntry(Engine.rfsSettings.musicDir));
            }
            catch (error) {
                console.warn('Could not check music directory:', error);
                hasMusicDir = false;
            }
            if (hasMusicDir) {
                const themeIniFileName = Engine.getFileNameVariant('theme.ini');
                const themeIni = Engine.getIni(themeIniFileName);
                const musicSpecs = new MusicSpecs(themeIni);
                const musicAudioSystemAdapter = {
                    playMusicFile: async (file: any, repeat: boolean, onEnded?: () => void): Promise<boolean> => {
                        try {
                            await this.audioSystem!.playMusicFile(file, repeat, onEnded);
                            return true;
                        }
                        catch (error) {
                            console.error('Failed to play music file:', error);
                            return false;
                        }
                    },
                    stopMusic: () => this.audioSystem!.stopMusic()
                };
                this.music = new Music(musicAudioSystemAdapter, Engine.getThemes(), musicSpecs);
                const musicOptions = this.localPrefs.getItem(StorageKey.MusicOpts);
                if (musicOptions) {
                    try {
                        this.music.unserializeOptions(musicOptions);
                        console.log('[Gui] Loaded music options from local storage');
                    }
                    catch (error) {
                        console.warn('Failed to read music options from local storage', error);
                    }
                }
                const debugRoot = ((window as any).__ra2debug ??= {});
                debugRoot.music = this.music;
                console.log('[Gui] Music system initialized');
            }
            else {
                console.warn('[Gui] No music directory found - music system disabled');
            }
        }
        catch (error) {
            console.error('[Gui] Failed to initialize music system:', error);
        }
    }
    private async initOptionsSystem(): Promise<void> {
        console.log('[Gui] Initializing options system');
        if (!this.generalOptions) {
            this.generalOptions = new GeneralOptions();
            const optionsData = this.localPrefs.getItem(StorageKey.Options);
            if (optionsData) {
                try {
                    this.generalOptions.unserialize(optionsData);
                    console.log('[Gui] Loaded general options from local storage');
                }
                catch (error) {
                    console.warn('Failed to read general options from local storage', error);
                }
            }
        }
        if (!this.fullScreen) {
            this.fullScreen = new FullScreen(document);
            this.fullScreen.init();
        }
        const keyboardIniFileName = Engine.getFileNameVariant('keyboard.ini');
        this.keyBinds = new KeyBinds(Engine.rfs?.getRootDirectory?.(), keyboardIniFileName, Engine.getIni(keyboardIniFileName));
        await this.keyBinds.load();
        const debugRoot = ((window as any).__ra2debug ??= {});
        debugRoot.generalOptions = this.generalOptions;
        debugRoot.keyBinds = this.keyBinds;
        debugRoot.fullScreen = this.fullScreen;
        debugRoot.localPrefs = this.localPrefs;
        const performanceOptions = this.generalOptions.performance;
        attachPerformanceOptions(performanceOptions);
        const runtimeVars = this.runtimeVars ?? {};
        this.runtimeVars = Object.assign(runtimeVars, {
            debugWireframes: runtimeVars.debugWireframes ?? new BoxedVar<boolean>(false),
            debugPaths: runtimeVars.debugPaths ?? new BoxedVar<boolean>(false),
            debugText: runtimeVars.debugText ?? new BoxedVar<boolean>(false),
            debugBotIndex: runtimeVars.debugBotIndex ?? new BoxedVar<number>(0),
            debugLogging: runtimeVars.debugLogging ?? new BoxedVar<boolean>(false),
            debugGameState: runtimeVars.debugGameState ?? new BoxedVar<boolean>(false),
            forceResolution: runtimeVars.forceResolution ?? new BoxedVar<string | undefined>(undefined),
            freeCamera: runtimeVars.freeCamera ?? new BoxedVar<boolean>(false),
            fps: runtimeVars.fps ?? new BoxedVar<boolean>(false),
            persistentHoverTags: runtimeVars.persistentHoverTags ?? new BoxedVar<boolean>(false),
            cheatsEnabled: runtimeVars.cheatsEnabled ?? new BoxedVar<boolean>(false),
            fullScreenZoomOut: runtimeVars.fullScreenZoomOut ?? new BoxedVar<number>(1.3),
            perfRaycastHelperReuse: performanceOptions.raycastHelperReuse,
            perfEntityIntersectTraversal: performanceOptions.entityIntersectTraversal,
            perfMapTileHitTest: performanceOptions.mapTileHitTest,
            perfWorldViewportCache: performanceOptions.worldViewportCache,
            perfWorldSoundLoopCache: performanceOptions.worldSoundLoopCache,
            perfTelemetry: performanceOptions.telemetry,
        });
        debugRoot.runtimeVars = this.runtimeVars;
        installPerformanceDebugApi(debugRoot);
        console.log('[Gui] Runtime vars ready', Object.keys(this.runtimeVars));
        console.log('[Gui] Options system initialized');
    }
}
