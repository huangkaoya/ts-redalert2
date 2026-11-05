import { RootScreen } from '@/gui/screen/RootScreen';
import { CompositeDisposable } from '@/util/disposable/CompositeDisposable';
import { MedianPing } from './MedianPing';
import { ScreenType, MainMenuScreenType } from '@/gui/screen/ScreenType';
import { sleep } from '@puzzl/core/lib/async/sleep';
import { GameStatus } from '@/game/Game';
import { GameTurnManager } from '@/game/GameTurnManager';
import { ActionFactory } from '@/game/action/ActionFactory';
import { ActionQueue } from '@/game/action/ActionQueue';
import { DevToolsApi } from '@/tools/DevToolsApi';
import { GameAnimationLoop } from '@/engine/GameAnimationLoop';
import { GameResultPopup, GameResultType } from '@/gui/screen/game/component/GameResultPopup';
import { jsx } from '@/gui/jsx/jsx';
import { SoundHandler } from '@/gui/screen/game/SoundHandler';
import { StorageKey } from '@/LocalPrefs';
import { CombatantUi } from '@/gui/screen/game/CombatantUi';
import { ObserverUi } from '@/gui/screen/game/ObserverUi';
import { GameMenu } from '@/gui/screen/game/GameMenu';
import { WorldView } from '@/gui/screen/game/WorldView';
import { Eva } from '@/engine/sound/Eva';
import { EvaSpecs } from '@/engine/sound/EvaSpecs';
import { SideType } from '@/game/SideType';
import { HudFactory } from '@/gui/screen/game/HudFactory';
import { Minimap } from '@/gui/screen/game/component/Minimap';
import { Replay } from '@/network/gamestate/Replay';
import { ReplayRecorder } from '@/network/gamestate/ReplayRecorder';
import { SoloPlayTurnManager } from '@/network/gamestate/SoloPlayTurnManager';
import { LanLockstepTurnManager } from '@/network/lan/LanLockstepTurnManager';
import { LanMatchSession } from '@/network/lan/LanMatchSession';
import { CombatantSidebarModel } from '@/gui/screen/game/component/hud/viewmodel/CombatantSidebarModel';
import { ActionFactoryReg } from '@/game/action/ActionFactoryReg';
import { MessageList } from '@/gui/screen/game/component/hud/viewmodel/MessageList';
import { ChannelType } from '@/engine/sound/ChannelType';
import { ChatNetHandler } from '@/gui/screen/game/ChatNetHandler';
import { ChatTypingHandler } from '@/gui/screen/game/ChatTypingHandler';
import { IrcConnection } from '@/network/IrcConnection';
import { CancellationTokenSource, OperationCanceledError } from '@puzzl/core/lib/async/cancellation';
import { MusicType } from '@/engine/sound/Music';
import { ActionType } from '@/game/action/ActionType';
import { EventType } from '@/game/event/EventType';
import { CommandBarButtonList } from '@/gui/screen/game/component/hud/commandBar/CommandBarButtonList';
import { CommandBarButtonType } from '@/gui/screen/game/component/hud/commandBar/CommandBarButtonType';
import { LoadingScreenType } from '@/gui/screen/game/loadingScreen/LoadingScreenApiFactory';
import { MapFile } from '@/data/MapFile';
import { VirtualFile } from '@/data/vfs/VirtualFile';
import { base64StringToUint8Array, binaryStringToUint8Array } from '@/util/string';
import { MapDigest } from '@/engine/MapDigest';
import { MapSupport } from '@/engine/MapSupport';
import { OBS_COUNTRY_ID } from '@/game/gameopts/constants';
import { MainMenuRoute } from '@/gui/screen/mainMenu/MainMenuRoute';
import { RootRoute } from '@/gui/screen/RootRoute';
import { ChatHistory } from '@/gui/chat/ChatHistory';
import { PingMonitor } from '@/gui/screen/game/PingMonitor';
import { SidebarModel } from '@/gui/screen/game/component/hud/viewmodel/SidebarModel';
import { Engine } from '@/engine/Engine';
import * as A from '@/gui/screen/game/worldInteraction/WorldInteractionFactory';
import { ChatMessageFormat } from '@/gui/chat/ChatMessageFormat';
import { ActionsApi } from '@/game/api/ActionsApi';
import { OrderType } from '@/game/order/OrderType';
import { RadialTileFinder } from '@/game/map/tileFinder/RadialTileFinder';
import { Coords } from '@/game/Coords';
import * as THREE from 'three';
export class GameScreen extends RootScreen {
    private disposables = new CompositeDisposable();
    private avgPing = new MedianPing();
    private preventUnload = true;
    protected controller?: any;
    private game?: any;
    private replay?: any;
    private replayRecorderInstance?: ReplayRecorder;
    private gameTurnMgr?: any;
    private gameAnimationLoop?: any;
    private hud?: any;
    private hudFactory?: any;
    private minimap?: any;
    private worldView?: any;
    private activeWorldScene?: any;
    private playerUi?: any;
    private menu?: any;
    private sidebarModel?: any;
    private loadingScreenApi?: any;
    private lagState = false;
    private chatTypingHandler?: any;
    private chatNetHandler?: any;
    private lanMatchSession?: LanMatchSession;
    private isSinglePlayer = false;
    private isLanGame = false;
    private isTournament = false;
    private playerName = '';
    private returnTo?: any;
    private debugMapFile?: any;
    private pausedAtSpeed?: number;
    private gameEndHandled = false;
    constructor(private workerHostApi: any, private gservCon: any, private wgameresService: any, private wolService: any, private mapTransferService: any, private engineVersion: string, private engineModHash: string, private errorHandler: any, private gameMenuSubScreens: any, private loadingScreenApiFactory: any, private gameOptsParser: any, private gameOptsSerializer: any, private config: any, private strings: any, private renderer: any, private uiScene: any, private runtimeVars: any, private messageBoxApi: any, private toastApi: any, private uiAnimationLoop: any, private viewport: any, private jsxRenderer: any, private pointer: any, private sound: any, private music: any, private mixer: any, private keyBinds: any, private generalOptions: any, private localPrefs: any, private actionLogger: any, private lockstepLogger: any, private replayManager: any, private fullScreen: any, private mapFileLoader: any, private mapDir: any, private mapList: any, private gameLoader: any, private vxlGeometryPool: any, private buildingImageDataCache: any, private mutedPlayers: any, private tauntsEnabled: any, private speedCheat: any, private sentry: any, private battleControlApi: any) {
        super();
        this.onGservClose = (error: any) => {
            if (this.replay) {
                this.replay.finish(this.game.currentTick);
                this.saveReplay(this.replay);
            }
            this.handleError(error, this.strings.get('TXT_YOURE_DISCON'));
            if (this.game) {
                this.sendGameRes(this.game, {
                    disconnect: true,
                    desync: false,
                    quit: false,
                    finished: false,
                });
            }
        };
    }
    setController(controller: any): void {
        this.controller = controller;
    }
    private usesServerConnection(): boolean {
        return !this.isSinglePlayer && !this.isLanGame;
    }
    async onEnter(params: any): Promise<void> {
        this.gameEndHandled = false;
        this.pointer.lock();
        this.pointer.setVisible(false);
        await this.music?.play(MusicType.Loading);
        const cancellationTokenSource = new CancellationTokenSource();
        this.disposables.add(() => cancellationTokenSource.cancel());
        const cancellationToken = cancellationTokenSource.token;
        let gameOpts: any;
        const lanLaunch = params.lanLaunch;
        this.lanMatchSession = params.lanMatchSession;
        const gameId = lanLaunch?.gameId ?? params.gameId;
        const timestamp = lanLaunch?.timestamp ?? params.timestamp;
        this.returnTo = params.returnTo ?? lanLaunch?.returnRoute;
        this.isTournament = params.tournament;
        const playerName = this.playerName = lanLaunch?.localPlayerName ?? params.playerName;
        const isSinglePlayer = this.isSinglePlayer = params.create && params.singlePlayer;
        const isLanGame = this.isLanGame = Boolean(lanLaunch);
        if (isSinglePlayer) {
            gameOpts = params.gameOpts;
        }
        else if (isLanGame) {
            gameOpts = lanLaunch.gameOpts;
        }
        else {
            const credentials = this.wolService.getCredentials();
            if (!credentials || credentials.user !== playerName) {
                this.localPrefs.removeItem(StorageKey.LastConnection);
                this.controller?.goToScreen(ScreenType.MainMenuRoot, {
                    route: new MainMenuRoute(MainMenuScreenType.Login, {
                        forceUser: playerName,
                        afterLogin: (user: any) => new RootRoute(ScreenType.Game, params)
                    })
                });
                return;
            }
            this.wolService.setAutoReconnect(true);
            this.gservCon.onClose.subscribe(this.onGservClose);
            try {
                gameOpts = await this.connectToServerInstance(params, credentials, cancellationToken);
            }
            catch (error) {
                this.handleGservConError(error);
                return;
            }
            const { returnTo, ...connectionParams } = params;
            this.localPrefs.setItem(StorageKey.LastConnection, JSON.stringify(connectionParams));
        }
        if (this.config.devMode) {
            this.runtimeVars.cheatsEnabled.value = this.isSinglePlayer;
        }
        else if (!this.isSinglePlayer) {
            this.runtimeVars.cheatsEnabled.value = false;
        }
        let mapFile: any;
        try {
            const mapFileData = await this.transferAndLoadMapFile(params, gameOpts.mapName, gameOpts.mapDigest, cancellationToken);
            if (!gameOpts.mapOfficial) {
                this.debugMapFile = mapFileData;
                this.disposables.add(() => this.debugMapFile = undefined);
            }
            mapFile = new MapFile(mapFileData);
            const mapSupportError = MapSupport.check(mapFile, this.strings);
            if (mapSupportError) {
                this.handleError(mapSupportError, mapSupportError);
                return;
            }
        }
        catch (error) {
            this.handleMapLoadError(error, gameOpts.mapName);
            return;
        }
        const loadingScreenType =
            isSinglePlayer
                ? LoadingScreenType.SinglePlayer
                : isLanGame
                    ? LoadingScreenType.Lan
                    : LoadingScreenType.MultiPlayer;
        const loadingScreenApi = this.loadingScreenApiFactory.create(loadingScreenType, this.lanMatchSession);
        this.loadingScreenApi = loadingScreenApi;
        this.disposables.add(loadingScreenApi, () => this.loadingScreenApi = undefined);
        this.disposables.add(() => this.gameLoader.clearStaticCaches());
        if (cancellationToken.isCancelled()) {
            return;
        }
        let gameLoadResult: any;
        try {
            gameLoadResult = await this.gameLoader.load(gameId, timestamp, gameOpts, mapFile, playerName, this.isSinglePlayer, loadingScreenApi, cancellationToken);
        }
        catch (error) {
            console.error('[GameScreen] Failed to load game', {
                isLanGame: this.isLanGame,
                isSinglePlayer: this.isSinglePlayer,
                playerName,
                gameId,
                timestamp,
                gameOpts,
                error,
            });
            this.handleGameLoadError(error, params, gameOpts);
            return;
        }
        if (cancellationToken.isCancelled()) {
            return;
        }
        const { game, theater, hudSide, cameoFilenames } = gameLoadResult;
        this.game = game;
        this.disposables.add(game, () => this.game = undefined, () => Engine.unloadTheater(theater.type));
        let localPlayer: any;
        try {
            localPlayer = game.getPlayerByName(playerName);
        }
        catch (error) {
            console.error('[GameScreen] Failed to resolve local player after load', {
                isLanGame: this.isLanGame,
                playerName,
                players: game.getAllPlayers?.().map((player: any) => player.name),
                gameOpts,
                error,
            });
            throw error;
        }
        let uiInitResult: any;
        try {
            uiInitResult = this.loadUi(game, theater, localPlayer, hudSide, cameoFilenames);
        }
        catch (error) {
            const errorMessage = error.message?.match(/memory|allocation/i)
                ? this.strings.get('TS:GameInitOom')
                : this.strings.get('TS:GameInitError') +
                    (game.gameOpts.mapOfficial ? '' : '\n\n' + this.strings.get('TS:CustomMapCrash'));
            this.handleGameError(error, errorMessage, game);
            return;
        }
        const actionFactory = new ActionFactory();
        new ActionFactoryReg().register(actionFactory, game, playerName);
        const actionQueue = new ActionQueue();
        const replay = this.replay = new Replay();
        replay.gameId = gameId;
        replay.gameTimestamp = Math.floor(timestamp / 1000);
        replay.gameOpts = gameOpts;
        replay.engineVersion = this.engineVersion;
        replay.modHash = this.engineModHash;
        replay.timestamp = Date.now();
        const playerNames = (gameOpts.humanPlayers ?? []).map((p: any) => p.name).join(' vs ');
        const mapTitle = gameOpts.mapTitle ?? gameOpts.mapName ?? 'Unknown';
        replay.name = Replay.sanitizeFileName(`${playerNames} - ${mapTitle}`);
        this.disposables.add(() => this.replay = undefined);
        const replayRecorder = this.replayRecorderInstance = new ReplayRecorder(game, replay);
        this.disposables.add(() => this.replayRecorderInstance = undefined);
        if (this.isSinglePlayer) {
            this.gameTurnMgr = new SoloPlayTurnManager(game, localPlayer, actionQueue, this.actionLogger, replayRecorder);
        }
        else if (this.isLanGame) {
            if (!this.lanMatchSession) {
                this.handleError(new Error('Missing LAN match session'), this.strings.get('TS:ConnectFailed'));
                return;
            }
            this.gameTurnMgr = this.initLockstep(game, localPlayer, actionFactory, actionQueue, replayRecorder, this.lanMatchSession);
            this.lagState = false;
        }
        else {
            this.gameTurnMgr = new GameTurnManager(game, actionQueue);
            this.lagState = false;
            if (localPlayer.isObserver) {
                try {
                }
                catch (error) {
                    if (error instanceof IrcConnection.SocketError) {
                        return;
                    }
                    throw error;
                }
            }
            else {
                this.disposables.add(game.events.subscribe(EventType.PlayerDefeated, (event: any) => {
                    if (event.target === localPlayer && localPlayer.isObserver) {
                    }
                }));
            }
        }
        this.gameTurnMgr.init();
        const startGameHandler = () => {
            if (game.status !== GameStatus.Started) {
                try {
                    this.onGameStart(localPlayer, game, uiInitResult, actionQueue, actionFactory, replay);
                }
                catch (error) {
                    const errorMessage = error.message?.match(/memory|allocation/i)
                        ? this.strings.get('TS:GameInitOom')
                        : this.strings.get('TS:GameInitError') +
                            (game.gameOpts.mapOfficial ? '' : '\n\n' + this.strings.get('TS:CustomMapCrash'));
                    this.handleGameError(error, errorMessage, game);
                }
            }
        };
        if (isSinglePlayer) {
            startGameHandler();
            DevToolsApi.registerCommand('reset', async () => {
                await this.onLeave();
                await this.onEnter(params);
            });
            DevToolsApi.registerVar('speed', game.desiredSpeed);
            this.disposables.add(() => DevToolsApi.unregisterCommand('reset'), () => DevToolsApi.unregisterVar('speed'));
            DevToolsApi.registerVar('cheats', this.runtimeVars.cheatsEnabled);
            this.disposables.add(() => DevToolsApi.unregisterVar('cheats'));
        }
        else if (isLanGame) {
            loadingScreenApi.onLoadProgress(100);
            await this.waitForLanPlayersLoaded(cancellationToken);
            if (cancellationToken.isCancelled()) {
                return;
            }
            startGameHandler();
        }
        else if (this.gservCon.isOpen()) {
            const rateChangeHandler = (rate: number) => this.gameTurnMgr.setRate(rate);
            this.gservCon.onRateChange.subscribe(rateChangeHandler);
            this.disposables.add(() => this.gservCon.onRateChange.unsubscribe(rateChangeHandler));
            this.gservCon.onGameStart.subscribe(startGameHandler);
            this.disposables.add(() => this.gservCon.onGameStart.unsubscribe(startGameHandler));
            this.gservCon.sendLoadedPercent(100);
        }
    }

    private async waitForLanPlayersLoaded(cancellationToken: any): Promise<void> {
        while (!cancellationToken.isCancelled() && this.lanMatchSession && !this.lanMatchSession.areAllPlayersLoaded()) {
            await sleep(50);
        }
    }

    async onLeave(): Promise<void> {
        this.pointer.unlock();
        const hadGameAnimationLoop = Boolean(this.gameAnimationLoop);
        if (this.gameAnimationLoop) {
            this.gameAnimationLoop.destroy();
            this.gameAnimationLoop = undefined;
        }
        this.restoreRendererToUiOnly();
        this.clearDebugBridge();
        if (this.hud) {
            this.uiScene.remove(this.hud);
            this.hud.destroy();
            this.hud = undefined;
        }
        this.gameTurnMgr?.dispose();
        this.gameTurnMgr = undefined;
        this.lanMatchSession?.leaveRoom();
        this.lanMatchSession?.dispose();
        this.lanMatchSession = undefined;
        this.disposables.dispose();
        this.activeWorldScene = undefined;
        if (hadGameAnimationLoop) {
            this.uiAnimationLoop.start();
        }
        if (this.usesServerConnection()) {
            this.wolService.setAutoReconnect(false);
            this.gservCon.onClose.unsubscribe(this.onGservClose);
            this.gservCon.close();
        }
    }
    private restoreRendererToUiOnly(): void {
        if (!this.renderer) {
            return;
        }
        const scenesBefore = this.renderer.getScenes?.() ?? [];
        console.log('[GameScreen.onLeave] restoring renderer to UI-only mode', scenesBefore.map((scene: any) => ({
            type: scene?.constructor?.name,
            viewport: scene?.viewport,
        })));
        if (this.activeWorldScene) {
            this.renderer.removeScene(this.activeWorldScene);
        }
        const scenesAfterRemoval = this.renderer.getScenes?.() ?? [];
        if (!scenesAfterRemoval.includes(this.uiScene)) {
            this.renderer.addScene(this.uiScene);
        }
        this.renderer.flush?.();
        const scenesAfter = this.renderer.getScenes?.() ?? [];
        console.log('[GameScreen.onLeave] renderer scenes after cleanup', scenesAfter.map((scene: any) => ({
            type: scene?.constructor?.name,
            viewport: scene?.viewport,
        })));
    }
    private clearDebugBridge(): void {
        const debugRoot = (window as any).__ra2debug;
        if (!debugRoot) {
            return;
        }
        const keysToClear = [
            'gameScreen',
            'worldView',
            'worldScene',
            'mapRenderable',
            'renderableManager',
            'worldInteraction',
            'localPlayer',
            'minimap',
            'game',
            'actionQueue',
            'actionFactory',
            'actionsApi',
            'unitSelection',
            'helpers',
        ];
        for (const key of keysToClear) {
            if (key in debugRoot) {
                debugRoot[key] = undefined;
            }
        }
        console.log('[GameScreen.onLeave] cleared __ra2debug game references');
    }
    onViewportChange(): void {
        this.loadingScreenApi?.updateViewport();
        this.rerenderHud();
    }
    private rerenderHud(): void {
        if (this.hud) {
            this.uiScene.remove(this.hud);
            this.hud.destroy();
            this.hudFactory.setSidebarModel(this.sidebarModel);
            this.hudFactory.setViewport(this.viewport.value);
            const newHud = this.hudFactory.create();
            this.hud = newHud;
            newHud.setMinimap(this.minimap);
            this.worldView?.handleViewportChange(this.viewport.value);
            if (this.playerUi) {
                this.uiScene.add(newHud);
                this.menu?.handleHudChange(newHud);
                this.playerUi.handleHudChange(newHud);
                if (this.chatTypingHandler) {
                    this.initHudChatTypingEvents(this.chatTypingHandler, this.chatNetHandler, newHud);
                }
            }
        }
    }
    private initHudChatTypingEvents(typingHandler: any, netHandler: any, hud: any): void {
        hud.onMessageCancel.subscribe(() => {
            typingHandler.endTyping();
        });
        hud.onMessageSubmit.subscribe((event: any) => {
            typingHandler.endTyping();
            if (event.value.length) {
                netHandler.submitMessage(event.value, event.recipient);
            }
        });
    }
    private onGservClose: (error: any) => void;
    private handleError(error: any, message: string, skipGoToMenu?: boolean): void {
        if (this.gameTurnMgr) {
            this.gameTurnMgr.setErrorState();
        }
        this.pointer.unlock();
        const cleanup = () => {
            if (!this.usesServerConnection()) {
                return;
            }
            this.wolService.closeWolConnection();
            if (this.gservCon.isOpen()) {
                this.gservCon.onClose.unsubscribe(this.onGservClose);
                this.gservCon.close();
            }
        };
        this.errorHandler.handle(error, message, skipGoToMenu ? undefined : () => {
            cleanup();
            this.controller?.goToScreen(ScreenType.MainMenuRoot);
        });
        if (skipGoToMenu) {
            cleanup();
            this.playerUi?.dispose();
        }
    }
    private saveReplay(replay: any): void {
        if (!this.replayManager?.saveReplay) {
            console.warn('[GameScreen.saveReplay] replayManager.saveReplay is unavailable');
            return;
        }
        (async () => {
            try {
                await this.replayManager.saveReplay(replay);
            }
            catch (error) {
                console.error(error);
                try {
                    this.toastApi?.push?.(this.strings.get('GUI:SaveReplayError'));
                }
                catch (toastError) {
                    console.error('[GameScreen.saveReplay] failed to report replay save error', toastError);
                }
            }
        })();
    }
    private async connectToServerInstance(params: any, credentials: any, cancellationToken: any): Promise<any> {
        let messageBoxShown = false;
        try {
            setTimeout(() => {
                if (!cancellationToken.isCancelled()) {
                    this.messageBoxApi.show(this.strings.get('TXT_CONNECTING'));
                    messageBoxShown = true;
                }
            }, 1000);
            await this.gservCon.connect(params.gservUrl);
            await this.gservCon.cvers(this.engineVersion);
            await this.gservCon.login(credentials.user, credentials.pass);
            if (params.create) {
                const serializedOpts = this.gameOptsSerializer.serializeOptions(params.gameOpts);
                const { gameId, timestamp } = params;
                await this.gservCon.createGame(gameId, timestamp, serializedOpts, this.engineVersion, this.engineModHash, params.createPrivateGame);
                console.log(`Created game instance with id ${params.gameId}.`);
                this.localPrefs.removeItem(StorageKey.LastConnection);
            }
            else {
                await this.joinGame(params.gameId, 5, cancellationToken);
                console.log('Joined game instance with id ' + params.gameId);
            }
            const gameOptsData = await this.gservCon.gameOpts();
            return this.gameOptsParser.parseOptions(gameOptsData);
        }
        catch (error) {
            throw error;
        }
        finally {
            if (messageBoxShown) {
                this.messageBoxApi.destroy();
            }
        }
    }
    private async joinGame(gameId: string, retries: number, cancellationToken: any): Promise<void> {
        if (retries) {
            let lastError: any;
            while (retries--) {
                try {
                    console.log(`Attempting to join game with id ${gameId}...`, retries + ' retries left');
                    await this.gservCon.joinGame(gameId, this.engineVersion, this.engineModHash);
                    return;
                }
                catch (error) {
                    lastError = error;
                    await sleep(3000);
                }
            }
            this.localPrefs.removeItem(StorageKey.LastConnection);
            throw lastError;
        }
        await this.gservCon.joinGame(gameId, this.engineVersion, this.engineModHash);
    }
    private async transferAndLoadMapFile(params: any, mapName: string, mapDigest: string, cancellationToken: any): Promise<any> {
        let mapFileData: any;
        if (params.lanMapDataBase64) {
            mapFileData = VirtualFile.fromBytes(base64StringToUint8Array(params.lanMapDataBase64), mapName);
        }
        else if ((params.create && params.singlePlayer) || !params.mapTransfer) {
            mapFileData = await this.mapFileLoader.load(mapName, cancellationToken);
        }
        else {
            this.messageBoxApi.show(this.strings.get('GUI:MapTransfer'));
            if (params.create) {
                mapFileData = await this.mapFileLoader.load(mapName, cancellationToken);
                if (this.mapTransferService.getUrl()) {
                    await this.mapTransferService.putMap(mapFileData.getBytes(), params.gameId, cancellationToken);
                }
                else {
                    this.gservCon.sendMap(mapFileData.readAsString());
                }
            }
            else {
                let transferredMapData: Uint8Array;
                if (this.mapTransferService.getUrl()) {
                    transferredMapData = await this.mapTransferService.getMap(params.gameId, cancellationToken);
                }
                else {
                    transferredMapData = binaryStringToUint8Array(await this.gservCon.getMap());
                }
                mapFileData = VirtualFile.fromBytes(transferredMapData, mapName);
                if (MapDigest.compute(mapFileData) !== mapDigest) {
                    throw new Error('Transferred map is corrupt');
                }
                if (this.mapDir && !(await this.mapDir.containsEntry(mapName))) {
                    try {
                        await this.mapDir.writeFile(mapFileData);
                        this.mapList.addFromMapFile(mapFileData);
                    }
                    catch (error) {
                        console.error('Map couldn\'t be saved', [error]);
                    }
                }
            }
            this.messageBoxApi.destroy();
        }
        return mapFileData;
    }
    private loadUi(game: any, theater: any, localPlayer: any, hudSide: any, cameoFilenames: any): any {
        const sidebarModel = localPlayer.isObserver
            ? new SidebarModel(game, this.replay)
            : new CombatantSidebarModel(localPlayer, game);
        const messageList = new MessageList(game.rules.audioVisual.messageDuration, 6, undefined);
        const chatHistory = new ChatHistory();
        this.sidebarModel = sidebarModel;
        this.disposables.add(() => this.sidebarModel = undefined);
        const uiIni = Engine.getUiIni();
        const commandBarButtonList = new CommandBarButtonList();
        if (!localPlayer.isObserver) {
            commandBarButtonList.fromIni(uiIni.getOrCreateSection(this.isSinglePlayer ? 'AdvancedCommandBar' : 'MultiplayerAdvancedCommandBar'));
        }
        if (this.config.discordUrl) {
            commandBarButtonList.buttons.push(CommandBarButtonType.BugReport);
        }
        this.hudFactory = new HudFactory(hudSide, this.viewport.value, sidebarModel, messageList, chatHistory, game.debugText, this.runtimeVars.debugText, localPlayer.isObserver ? undefined : localPlayer, game.getCombatants(), game.stalemateDetectTrait, game.countdownTimer, cameoFilenames, this.jsxRenderer, this.strings, commandBarButtonList.buttons, this.runtimeVars.persistentHoverTags);
        this.disposables.add(() => this.hudFactory = undefined);
        const hud = this.hudFactory.create();
        this.hud = hud;
        const minimap = this.minimap = new Minimap(game, localPlayer, hud.getTextColor(), game.rules.general.radar);
        hud.setMinimap(minimap);
        this.disposables.add(minimap, () => this.minimap = undefined);
        minimap.setPointerEvents(this.pointer.pointerEvents);
        const hudDimensions = { width: hud.sidebarWidth, height: hud.actionBarHeight } as any;
        const worldView = new WorldView(hudDimensions, game, this.sound, this.renderer, this.runtimeVars, minimap, this.strings, this.generalOptions, this.vxlGeometryPool, this.buildingImageDataCache);
        const worldViewInit = worldView.init(localPlayer, this.viewport.value, theater);
        console.log('[GameScreen.loadUi] hudDimensions', {
            sidebarWidth: hud.sidebarWidth,
            actionBarHeight: hud.actionBarHeight,
            viewport: this.viewport.value
        });
        console.log('[GameScreen.loadUi] worldViewInit keys', Object.keys(worldViewInit || {}));
        this.worldView = worldView;
        this.disposables.add(worldView, () => this.worldView = undefined);
        const ws: any = worldViewInit.worldScene;
        if (ws?.set3DObject && ws?.scene) {
            ws.set3DObject(ws.scene);
        }
        worldViewInit.worldScene.create3DObject?.();
        return {
            worldViewInitResult: worldViewInit,
            messageList,
            chatHistory,
            minimap
        };
    }
    private initLockstep(game: any, localPlayer: any, actionFactory: any, actionQueue: any, replayRecorder: any, lanMatchSession: LanMatchSession): any {
        const lockstepManager = new LanLockstepTurnManager(game, localPlayer, actionQueue, actionFactory, lanMatchSession, this.actionLogger, this.lockstepLogger, replayRecorder);
        const onLagStateChange = (lagState: boolean) => {
            this.lagState = lagState;
        };
        lockstepManager.onLagStateChange.subscribe(onLagStateChange);
        this.disposables.add(() => lockstepManager.onLagStateChange.unsubscribe(onLagStateChange));
        return lockstepManager;
    }
    private onGameStart(localPlayer: any, game: any, uiInitResult: any, actionQueue: any, actionFactory: any, replay: any): void {
        this.localPrefs.removeItem(StorageKey.LastConnection);
        this.loadingScreenApi?.dispose();
        this.music?.play(MusicType.Normal);
        const evaSpecs = new EvaSpecs(SideType.GDI).readIni(Engine.getIni('eva.ini'));
        const eva = new Eva(evaSpecs, this.sound, this.renderer);
        eva.init();
        this.disposables.add(eva);
        this.initUi(localPlayer, game, undefined, actionQueue, actionFactory, this.hud, eva, uiInitResult);
        const worldScene = uiInitResult.worldViewInitResult?.worldScene;
        if (worldScene) {
            this.activeWorldScene = worldScene;
            console.log('[GameScreen.onGameStart] adding worldScene to renderer');
            this.renderer.removeScene(this.uiScene);
            this.renderer.addScene(worldScene);
            this.renderer.addScene(this.uiScene);
            const scenes = this.renderer.getScenes?.() ?? [];
            console.log('[GameScreen.onGameStart] scenes after add', scenes.map((s: any) => ({
                type: s.constructor?.name,
                viewport: s.viewport,
            })));
            console.log('[GameScreen.onGameStart] worldScene.scene children', worldScene.scene?.children?.length);
        }
        const debugRoot = ((window as any).__ra2debug ??= {});
        const actionsApi = new ActionsApi(game, actionFactory, actionQueue, localPlayer);
        const renderableManager = uiInitResult.worldViewInitResult?.renderableManager;
        const worldInteraction = this.playerUi?.worldInteraction;
        debugRoot.gameScreen = this;
        debugRoot.renderer = this.renderer;
        debugRoot.uiScene = this.uiScene;
        debugRoot.worldScene = worldScene;
        debugRoot.renderableManager = renderableManager;
        debugRoot.worldInteraction = worldInteraction;
        debugRoot.localPlayer = localPlayer;
        debugRoot.game = game;
        debugRoot.minimap = this.minimap;
        debugRoot.actionQueue = actionQueue;
        debugRoot.actionFactory = actionFactory;
        debugRoot.actionsApi = actionsApi;
        debugRoot.unitSelection = game.getUnitSelection();
        if (this.lanMatchSession) {
            const updateLanMatchDebugState = (snapshot: any) => {
                debugRoot.lanMatch = snapshot;
            };
            updateLanMatchDebugState(this.lanMatchSession.getSnapshot());
            this.lanMatchSession.onSnapshotChange.subscribe(updateLanMatchDebugState);
            this.disposables.add(() => this.lanMatchSession?.onSnapshotChange.unsubscribe(updateLanMatchDebugState));
        }
        const serializeOwnedUnit = (unit: any) => ({
            id: unit.id,
            name: unit.name,
            type: unit.constructor?.name,
            isSpawned: unit.isSpawned,
            tile: unit.tile ? { rx: unit.tile.rx, ry: unit.tile.ry, z: unit.tile.z } : undefined,
        });
        const serializeOwnedObject = (object: any) => ({
            id: object.id,
            name: object.name,
            className: object.constructor?.name,
            objectType: object.type,
            isSpawned: Boolean(object.isSpawned),
            isDestroyed: Boolean(object.isDestroyed),
            isBuilding: Boolean(object.isBuilding?.()),
            isUnit: Boolean(object.isUnit?.()),
            insignificant: Boolean(object.rules?.insignificant),
            inTransport: Boolean(object.limboData?.inTransport),
            limboData: object.limboData
                ? {
                    selected: Boolean(object.limboData.selected),
                    controlGroup: object.limboData.controlGroup,
                    inTransport: Boolean(object.limboData.inTransport),
                }
                : undefined,
            tile: object.tile ? { rx: object.tile.rx, ry: object.tile.ry, z: object.tile.z } : undefined,
            traits: object.traits?.getAll?.().map((trait: any) => trait.constructor?.name) ?? [],
        });
        const getVictoryBlockers = () => {
            const shortGame = game.gameOpts.shortGame;
            const combatants = game.playerList.getCombatants();
            return combatants.map((player: any) => {
                const ownedObjects = player.getOwnedObjects(true);
                const qualifyingAssets = shortGame
                    ? ownedObjects.filter((object: any) => (object.isBuilding?.() && !object.rules.insignificant) ||
                        game.rules.general.baseUnit.includes(object.name))
                    : ownedObjects.filter((object: any) => !object.rules.insignificant && !object.limboData?.inTransport);
                return {
                    name: player.name,
                    defeated: Boolean(player.defeated),
                    isObserver: Boolean(player.isObserver),
                    isAi: Boolean(player.isAi),
                    ownedCount: ownedObjects.length,
                    qualifyingCount: qualifyingAssets.length,
                    ownedObjects: ownedObjects.map((object: any) => serializeOwnedObject(object)),
                    qualifyingAssets: qualifyingAssets.map((object: any) => serializeOwnedObject(object)),
                };
            });
        };
        const resolveOwnedUnitById = (unitId: number) => {
            const unit = localPlayer.getOwnedObjectById(unitId);
            if (!unit) {
                throw new Error(`No owned unit found with id "${unitId}"`);
            }
            if (!unit.isSpawned) {
                throw new Error(`Owned unit "${unit.name}"#${unit.id} is not spawned`);
            }
            return unit;
        };
        const resolveOwnedUnitByName = (unitName: string) => {
            const unit = localPlayer
                .getOwnedObjects()
                .find((ownedUnit: any) => ownedUnit.name === unitName && ownedUnit.isSpawned);
            if (!unit) {
                throw new Error(`No spawned owned unit found with name "${unitName}"`);
            }
            return unit;
        };
        const resolveOwnedBuildingById = (buildingId: number) => {
            const building = localPlayer.getOwnedObjectById(buildingId);
            if (!building) {
                throw new Error(`No owned building found with id "${buildingId}"`);
            }
            if (!building.isBuilding?.()) {
                throw new Error(`Owned object "${building.name}"#${building.id} is not a building`);
            }
            if (!building.isSpawned) {
                throw new Error(`Owned building "${building.name}"#${building.id} is not spawned`);
            }
            return building;
        };
        const resolveOwnedBuildingByName = (buildingName: string) => {
            const building = localPlayer
                .getOwnedObjects()
                .find((ownedObject: any) => ownedObject.name === buildingName && ownedObject.isBuilding?.() && ownedObject.isSpawned);
            if (!building) {
                throw new Error(`No spawned owned building found with name "${buildingName}"`);
            }
            return building;
        };
        const projectWorldPointToCanvasPoint = (worldPoint: THREE.Vector3) => {
            if (!worldScene?.camera || !worldScene?.viewport) {
                throw new Error('World scene camera or viewport is not available');
            }
            const projected = worldPoint.clone().project(worldScene.camera);
            const viewportPoint = {
                x: worldScene.viewport.x + ((projected.x + 1) / 2) * worldScene.viewport.width,
                y: worldScene.viewport.y + ((1 - projected.y) / 2) * worldScene.viewport.height,
            };
            const resolvedViewportPoint = {
                x: Math.max(worldScene.viewport.x, Math.min(worldScene.viewport.x + worldScene.viewport.width - 1, viewportPoint.x)),
                y: Math.max(worldScene.viewport.y, Math.min(worldScene.viewport.y + worldScene.viewport.height - 1, viewportPoint.y)),
            };
            const canvas = this.renderer.getCanvas?.() ?? document.querySelector('canvas');
            const rect = canvas?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
            return {
                viewportX: resolvedViewportPoint.x,
                viewportY: resolvedViewportPoint.y,
                x: rect.left + resolvedViewportPoint.x,
                y: rect.top + resolvedViewportPoint.y,
            };
        };
        const getOwnedUnitClickPoint = (unit: any) => {
            if (!renderableManager) {
                throw new Error('Renderable manager is not available');
            }
            const renderable = renderableManager.getRenderableByGameObject(unit);
            if (!renderable) {
                throw new Error(`Renderable not found for unit "${unit.name}"#${unit.id}`);
            }
            const renderablePosition = renderable.getPosition?.()?.clone?.() ?? unit.position.worldPosition.clone();
            return {
                unitId: unit.id,
                ...projectWorldPointToCanvasPoint(renderablePosition),
            };
        };
        const getOwnedBuildingClickTargets = (building: any) => {
            const foundation = building.getFoundation?.() ?? { width: 1, height: 1 };
            const baseTile = building.tile;
            if (!baseTile) {
                throw new Error(`Building "${building.name}"#${building.id} does not have a tile`);
            }
            const candidatePoints = [];
            const seen = new Set<string>();
            const pushTilePoint = (tileX: number, tileY: number, label: string) => {
                const key = `${tileX}:${tileY}`;
                if (seen.has(key)) {
                    return;
                }
                seen.add(key);
                const worldPoint = Coords.tile3dToWorld(tileX + 0.5, tileY + 0.5, baseTile.z);
                candidatePoints.push({
                    label,
                    tile: { rx: tileX, ry: tileY, z: baseTile.z },
                    ...projectWorldPointToCanvasPoint(new THREE.Vector3(worldPoint.x, worldPoint.y, worldPoint.z)),
                });
            };
            pushTilePoint(baseTile.rx + Math.floor((foundation.width - 1) / 2), baseTile.ry + Math.floor((foundation.height - 1) / 2), 'center');
            pushTilePoint(baseTile.rx, baseTile.ry, 'topLeft');
            pushTilePoint(baseTile.rx + foundation.width - 1, baseTile.ry, 'topRight');
            pushTilePoint(baseTile.rx, baseTile.ry + foundation.height - 1, 'bottomLeft');
            pushTilePoint(baseTile.rx + foundation.width - 1, baseTile.ry + foundation.height - 1, 'bottomRight');
            return {
                buildingId: building.id,
                buildingName: building.name,
                candidates: candidatePoints,
                centerScreenPoint: candidatePoints[0],
            };
        };
        const resolveSidebarTechnoSlot = (technoName: string) => {
            const sidebarModel = (this.playerUi as any)?.sidebarModel;
            const sidebarCard = (this.hud as any)?.sidebarCard;
            const uiScene = this.uiScene;
            if (!sidebarModel || !sidebarCard) {
                throw new Error('Sidebar model or sidebar card is not available');
            }
            if (!uiScene?.viewport) {
                throw new Error('UI scene viewport is not available');
            }
            const targetTabId = sidebarModel.tabs.findIndex((tab: any) => tab.items.some((item: any) => item.target?.rules?.name === technoName));
            if (targetTabId === -1) {
                throw new Error(`No sidebar item found for techno "${technoName}"`);
            }
            sidebarModel.selectTab(targetTabId);
            const itemIndex = sidebarModel.activeTab.items.findIndex((item: any) => item.target?.rules?.name === technoName);
            if (itemIndex === -1) {
                throw new Error(`Sidebar techno "${technoName}" is not available in the active tab`);
            }
            const normalizedOffset = itemIndex - (itemIndex % 2);
            if ((sidebarCard as any).pagingOffset !== normalizedOffset) {
                sidebarCard.scrollToOffset?.(normalizedOffset);
            }
            sidebarCard.updateSlots?.(sidebarModel.activeTab.items, sidebarCard.props?.slots ?? 0);
            const slotIndex = itemIndex - ((sidebarCard as any).pagingOffset ?? 0);
            const slotContainer = sidebarCard.slotContainers?.[slotIndex];
            if (!slotContainer?.get3DObject) {
                throw new Error(`Sidebar slot ${slotIndex} is not available for techno "${technoName}"`);
            }
            return {
                sidebarModel,
                sidebarCard,
                uiScene,
                targetTabId,
                itemIndex,
                slotIndex,
                slotContainer,
                slotSize: sidebarCard.getSlotSize?.() ?? {
                    width: sidebarCard.props?.slotSize?.width ?? sidebarCard.props?.cameoImages?.width ?? 0,
                    height: sidebarCard.props?.slotSize?.height ?? sidebarCard.props?.cameoImages?.height ?? 0,
                },
                cameoSize: {
                    width: sidebarCard.props?.cameoImages?.width ?? 0,
                    height: sidebarCard.props?.cameoImages?.height ?? 0,
                },
            };
        };
        const getSidebarTechnoClickPointByName = (technoName: string) => {
            const { uiScene, targetTabId, itemIndex, slotIndex, slotContainer, slotSize, } = resolveSidebarTechnoSlot(technoName);
            const clickWorldPoint = new THREE.Vector3(slotSize.width / 2, slotSize.height / 2, 0);
            slotContainer.get3DObject().localToWorld(clickWorldPoint);
            const camera = uiScene.getCamera?.() ?? (uiScene as any).camera;
            const projected = clickWorldPoint.project(camera);
            const viewport = uiScene.viewport;
            const viewportPoint = {
                x: viewport.x + ((projected.x + 1) / 2) * viewport.width,
                y: viewport.y + ((1 - projected.y) / 2) * viewport.height,
            };
            const resolvedViewportPoint = {
                x: Math.max(viewport.x, Math.min(viewport.x + viewport.width - 1, viewportPoint.x)),
                y: Math.max(viewport.y, Math.min(viewport.y + viewport.height - 1, viewportPoint.y)),
            };
            const canvas = this.renderer.getCanvas?.() ?? document.querySelector('canvas');
            const rect = canvas?.getBoundingClientRect?.() ?? { left: 0, top: 0 };
            return {
                technoName,
                tabId: targetTabId,
                itemIndex,
                slotIndex,
                viewportX: resolvedViewportPoint.x,
                viewportY: resolvedViewportPoint.y,
                x: rect.left + resolvedViewportPoint.x,
                y: rect.top + resolvedViewportPoint.y,
            };
        };
        const getSidebarTechnoDebugStateByName = (technoName: string) => {
            const { sidebarModel, sidebarCard, targetTabId, itemIndex, slotIndex, slotContainer, slotSize, cameoSize, } = resolveSidebarTechnoSlot(technoName);
            const slotObject = sidebarCard.slotObjects?.[slotIndex];
            const labelObject = sidebarCard.labelObjects?.[slotIndex];
            const quantityObject = sidebarCard.quantityObjects?.[slotIndex];
            const tagObject = sidebarCard.tagObjects?.[slotIndex];
            const container3D = slotContainer.get3DObject();
            const containerWorldPosition = new THREE.Vector3();
            container3D.getWorldPosition(containerWorldPosition);
            const getFrame = (uiObject: any) => typeof uiObject?.getFrame === 'function' ? uiObject.getFrame() : undefined;
            const getVisible = (uiObject: any) => Boolean(uiObject?.get3DObject?.()?.visible);
            const getPosition = (uiObject: any) => typeof uiObject?.getPosition === 'function' ? uiObject.getPosition() : undefined;
            return {
                technoName,
                tabId: targetTabId,
                activeTabId: sidebarModel.activeTabId,
                itemIndex,
                slotIndex,
                pagingOffset: sidebarCard.pagingOffset ?? 0,
                slotTooltip: container3D.userData?.tooltip,
                width: sidebarCard.props?.cameoImages?.width ?? 0,
                height: sidebarCard.props?.cameoImages?.height ?? 0,
                slotSize,
                cameoSize,
                containerPosition: slotContainer.getPosition?.() ?? undefined,
                containerWorldPosition: {
                    x: containerWorldPosition.x,
                    y: containerWorldPosition.y,
                    z: containerWorldPosition.z,
                },
                centerScreenPoint: getSidebarTechnoClickPointByName(technoName),
                slotFrame: getFrame(slotObject),
                label: {
                    visible: getVisible(labelObject),
                    frame: getFrame(labelObject),
                    position: getPosition(labelObject),
                },
                quantity: {
                    visible: getVisible(quantityObject),
                    frame: getFrame(quantityObject),
                    position: getPosition(quantityObject),
                },
                tag: {
                    visible: getVisible(tagObject),
                    frame: getFrame(tagObject),
                    position: getPosition(tagObject),
                },
            };
        };
        const spawnOwnedUnitCopiesById = (unitId: number, count: number, maxDistance: number = 6) => {
            if (!Number.isInteger(count) || count <= 0) {
                throw new Error(`count must be a positive integer, got "${count}"`);
            }
            const sourceUnit = resolveOwnedUnitById(unitId);
            if (!sourceUnit.isUnit?.()) {
                throw new Error(`Unit "${sourceUnit.name}"#${sourceUnit.id} is not a unit`);
            }
            const canSpawnAtTile = (tile: any) => !game.map.tileOccupation.getObjectsOnTile(tile).length &&
                game.map.terrain.getPassableSpeed(tile, sourceUnit.rules.speedType, sourceUnit.isInfantry?.() ?? false, false) > 0 &&
                !game.map.terrain.findObstacles({ tile, onBridge: undefined }, sourceUnit).length;
            const finder = new RadialTileFinder(game.map.tiles, game.map.mapBounds, sourceUnit.tile, sourceUnit.getFoundation?.() ?? { width: 1, height: 1 }, 1, maxDistance, canSpawnAtTile);
            const spawnedUnits = [];
            for (let index = 0; index < count; index += 1) {
                const spawnTile = finder.getNextTile();
                if (!spawnTile) {
                    throw new Error(`Unable to find enough spawn tiles near unit "${sourceUnit.name}"#${sourceUnit.id}. Spawned ${spawnedUnits.length}/${count}.`);
                }
                const spawnedUnit = game.createUnitForPlayer(sourceUnit.rules, localPlayer);
                game.spawnObject(spawnedUnit, spawnTile);
                spawnedUnits.push(spawnedUnit);
            }
            console.log('[GameScreen.debug] spawned owned unit copies', spawnedUnits.map((unit: any) => serializeOwnedUnit(unit)));
            return spawnedUnits.map((unit: any) => serializeOwnedUnit(unit));
        };
        const despawnOwnedUnitsByIds = (unitIds: number[]) => {
            const despawnedUnits = unitIds.map((unitId) => {
                const unit = resolveOwnedUnitById(unitId);
                game.unspawnObject(unit);
                unit.dispose();
                return serializeOwnedUnit(unit);
            });
            console.log('[GameScreen.debug] despawned owned units', despawnedUnits);
            return despawnedUnits;
        };
        debugRoot.helpers = {
            getSelectedUnitIds: () => game.getUnitSelection().getSelectedUnits().map((unit: any) => unit.id),
            getOwnedUnits: () => localPlayer.getOwnedObjects().map((unit: any) => serializeOwnedUnit(unit)),
            getOwnedUnitClickPointById: (unitId: number) => getOwnedUnitClickPoint(resolveOwnedUnitById(unitId)),
            getOwnedUnitClickPointByName: (unitName: string) => {
                return getOwnedUnitClickPoint(resolveOwnedUnitByName(unitName));
            },
            getOwnedBuildingClickTargetsById: (buildingId: number) => getOwnedBuildingClickTargets(resolveOwnedBuildingById(buildingId)),
            getOwnedBuildingClickTargetsByName: (buildingName: string) => getOwnedBuildingClickTargets(resolveOwnedBuildingByName(buildingName)),
            getSidebarTechnoClickPointByName: (technoName: string) => getSidebarTechnoClickPointByName(technoName),
            getSidebarTechnoDebugStateByName: (technoName: string) => getSidebarTechnoDebugStateByName(technoName),
            spawnOwnedUnitCopiesById: (unitId: number, count: number, maxDistance?: number) => spawnOwnedUnitCopiesById(unitId, count, maxDistance),
            spawnOwnedUnitCopiesByName: (unitName: string, count: number, maxDistance?: number) => spawnOwnedUnitCopiesById(resolveOwnedUnitByName(unitName).id, count, maxDistance),
            despawnOwnedUnitsByIds: (unitIds: number[]) => despawnOwnedUnitsByIds(unitIds),
            selectOwnedUnitByName: (unitName: string) => {
                const unit = resolveOwnedUnitByName(unitName);
                game.getUnitSelection().deselectAll();
                game.getUnitSelection().addToSelection(unit);
                return unit.id;
            },
            deploySelectedUnits: () => {
                const selectedUnits = game.getUnitSelection().getSelectedUnits();
                if (!selectedUnits.length) {
                    throw new Error('No selected units to deploy');
                }
                actionsApi.orderUnits(selectedUnits.map((unit: any) => unit.id), OrderType.DeploySelected);
                return selectedUnits.map((unit: any) => unit.id);
            },
            activateSellMode: () => {
                const sellMode = (this.playerUi as any)?.sellMode;
                if (!sellMode || !worldInteraction) {
                    throw new Error('Sell mode or world interaction is not available');
                }
                worldInteraction.setMode(sellMode);
                return true;
            },
            isSellModeActive: () => {
                const sellMode = (this.playerUi as any)?.sellMode;
                return Boolean(sellMode && worldInteraction?.getMode?.() === sellMode);
            },
            getVictoryBlockers: () => getVictoryBlockers(),
        };
        this.pointer.setVisible(true);
        const gameEndHandler = () => this.onGameEnd(game, localPlayer, eva, replay);
        game.onEnd.subscribe(gameEndHandler);
        this.disposables.add(() => game.onEnd.unsubscribe(gameEndHandler));
        game.start?.();
        if (this.usesServerConnection()) {
            this.initNetStats(localPlayer);
        }
        this.gameAnimationLoop = new GameAnimationLoop(localPlayer, this.renderer, this.sound, this.gameTurnMgr, {
            skipFrames: true,
            skipBudgetMillis: 8,
            onError: this.config.devMode ? undefined : (error: any, isCritical?: boolean) => this.handleError(error, this.strings.get('TS:GameCrashed') +
                (isCritical || game.gameOpts.mapOfficial
                    ? ''
                    : '\n\n' + this.strings.get('TS:CustomMapCrash')), isCritical)
        });
        this.uiAnimationLoop.stop();
        this.gameAnimationLoop.start();
    }
    private initNetStats(localPlayer: any): void {
        const pingMonitor = new PingMonitor(this.gameTurnMgr, this.gservCon, this.avgPing);
        pingMonitor.monitor();
        this.disposables.add(pingMonitor);
    }
    private initUi(localPlayer: any, game: any, replayRecorder: any, actionQueue: any, actionFactory: any, hud: any, eva: any, uiInitResult: any): void {
        const { messageList, chatHistory } = uiInitResult;
        const soundHandler = new SoundHandler(game, uiInitResult.worldViewInitResult.worldSound, eva, this.sound, game.events, messageList, this.strings, localPlayer);
        soundHandler.init?.();
        this.disposables.add(soundHandler);
        this.uiScene.add(hud);
        const menu = this.menu = new GameMenu(this.gameMenuSubScreens, game, localPlayer, chatHistory, this.gservCon, this.isSinglePlayer, this.isTournament);
        menu.init(hud);
        this.initGameMenuEvents(menu, eva, game, localPlayer, actionQueue, actionFactory);
        this.disposables.add(menu, () => this.menu = undefined);
        if (localPlayer.isObserver) {
            const worldScene = uiInitResult.worldViewInitResult.worldScene;
            const renderableManager = uiInitResult.worldViewInitResult.renderableManager;
            const worldInteractionFactory = new A.WorldInteractionFactory(undefined, game, game.unitSelection, renderableManager, this.uiScene, worldScene, this.pointer, this.renderer, this.keyBinds, this.generalOptions, this.runtimeVars.freeCamera, this.runtimeVars.debugPaths, this.config.devMode, document, this.minimap, this.strings, hud.getTextColor?.(), this.runtimeVars.debugText, this.battleControlApi);
            this.playerUi = new ObserverUi(game, undefined, this.sidebarModel, this.replay, this.renderer, worldScene, this.sound, worldInteractionFactory, menu, this.runtimeVars, this.strings, renderableManager, this.messageBoxApi, this.config.discordUrl);
        }
        else {
            const worldScene = uiInitResult.worldViewInitResult.worldScene;
            const superWeaponFxHandler = uiInitResult.worldViewInitResult.superWeaponFxHandler;
            const beaconFxHandler = uiInitResult.worldViewInitResult.beaconFxHandler;
            const renderableManager = uiInitResult.worldViewInitResult.renderableManager;
            const textColor = hud.getTextColor?.();
            const worldInteractionFactory = new A.WorldInteractionFactory(localPlayer, game, game.unitSelection, renderableManager, this.uiScene, worldScene, this.pointer, this.renderer, this.keyBinds, this.generalOptions, this.runtimeVars.freeCamera, this.runtimeVars.debugPaths, this.config.devMode, document, this.minimap, this.strings, textColor, game.debugText, this.battleControlApi);
            this.playerUi = new CombatantUi(game, localPlayer, this.isSinglePlayer, actionQueue, actionFactory, this.sidebarModel, this.renderer, worldScene, soundHandler, messageList, this.sound, eva, worldInteractionFactory, menu, this.pointer, this.runtimeVars, this.speedCheat, this.strings, undefined, renderableManager, superWeaponFxHandler, beaconFxHandler, this.messageBoxApi, this.config.discordUrl);
        }
        this.playerUi.init?.(hud);
        this.disposables.add(this.playerUi, () => this.playerUi = undefined);
        if (this.usesServerConnection()) {
            const chatNetHandler = new ChatNetHandler(this.gservCon, this.wolService, messageList, chatHistory, new ChatMessageFormat(this.strings, localPlayer.name), localPlayer, game, this.replayRecorderInstance, this.mutedPlayers ?? new Set<string>());
            chatNetHandler.init();
            const worldInteraction = this.playerUi.worldInteraction;
            const chatTypingHandler = new ChatTypingHandler(worldInteraction.keyboardHandler, worldInteraction.arrowScrollHandler, messageList, chatHistory);
            this.chatTypingHandler = chatTypingHandler;
            this.chatNetHandler = chatNetHandler;
            this.disposables.add(() => {
                this.chatTypingHandler = this.chatNetHandler = undefined;
            });
            this.initHudChatTypingEvents(chatTypingHandler, chatNetHandler, hud);
        }
    }
    private initGameMenuEvents(menu: any, eva: any, game: any, localPlayer: any, actionQueue: any, actionFactory: any): void {
        menu.onOpen.subscribe(() => {
            this.pointer.unlock();
            this.playerUi.worldInteraction.setEnabled(false);
            if (this.isSinglePlayer) {
                this.pausedAtSpeed = game.speed.value;
                game.desiredSpeed.value = Number.EPSILON;
                this.mixer.setMuted(ChannelType.Effect, true);
                this.mixer.setMuted(ChannelType.Ambient, true);
            }
        });
        menu.onQuit.subscribe(async () => {
            console.log('[Quit] onQuit start', {
                isSinglePlayer: this.isSinglePlayer,
                pausedAtSpeed: this.pausedAtSpeed
            });
            if (!this.controller)
                return;
            if (this.isSinglePlayer && this.pausedAtSpeed) {
                this.mixer.setMuted(ChannelType.Effect, false);
                this.mixer.setMuted(ChannelType.Ambient, false);
            }
            if (!localPlayer.isObserver) {
                console.log('[Quit] play EVA_BattleControlTerminated');
                eva.play('EVA_BattleControlTerminated');
            }
            this.pointer.lock();
            this.pointer.setVisible(false);
            this.playerUi.dispose();
            if (!localPlayer.isObserver && !this.isSinglePlayer && !this.lagState) {
                actionQueue.push(actionFactory.create(ActionType.ResignGame));
                await new Promise<void>((resolve) => {
                    this.gameTurnMgr.onActionsSent.subscribeOnce(() => resolve());
                });
            }
            if (this.isLanGame) {
                this.lanMatchSession?.leaveRoom();
            }
            if (this.usesServerConnection()) {
                try {
                    this.gservCon.onClose.unsubscribe(this.onGservClose);
                    this.gservCon.close();
                }
                catch (e) {
                    console.warn('[Quit] gservCon close skipped', e);
                }
            }
            this.gameTurnMgr.dispose();
            if (this.replay) {
                this.replay.finish(this.game.currentTick);
                this.saveReplay(this.replay);
            }
            if (this.usesServerConnection()) {
                this.sendGameRes(game, {
                    disconnect: false,
                    desync: false,
                    quit: true,
                    finished: false
                });
            }
            if (!localPlayer.isObserver) {
                this.logGame(game, false);
            }
            console.log('[Quit] waiting before navigate');
            await sleep(2000);
            console.log('[Quit] navigating to Score');
            this.controller?.goToScreen(ScreenType.MainMenuRoot, {
                route: new MainMenuRoute(MainMenuScreenType.Score, {
                    game,
                    localPlayer,
                    singlePlayer: this.isSinglePlayer,
                    tournament: this.isTournament,
                    returnTo: this.returnTo ?? new MainMenuRoute(MainMenuScreenType.Home, undefined)
                })
            });
        });
        menu.onObserve.subscribe(() => {
            this.pointer.lock();
            this.playerUi.worldInteraction.setEnabled(true);
            actionQueue.push(actionFactory.create(ActionType.ObserveGame));
            this.logGame(game, false);
        });
        menu.onCancel.subscribe(() => {
            this.pointer.lock();
            this.playerUi.worldInteraction.setEnabled(true);
            if (this.isSinglePlayer && this.pausedAtSpeed) {
                game.desiredSpeed.value = this.pausedAtSpeed;
                this.gameTurnMgr.doGameTurn(performance.now());
                this.pausedAtSpeed = undefined;
                this.mixer.setMuted(ChannelType.Effect, false);
                this.mixer.setMuted(ChannelType.Ambient, false);
            }
        });
    }
    private async onGameEnd(game: any, localPlayer: any, eva: any, replay: any): Promise<void> {
        if (this.gameEndHandled) {
            return;
        }
        this.gameEndHandled = true;

        let gameResultPopup: any;

        try {
            const isObserver = Boolean(localPlayer?.isObserver);
            const isVictory = !localPlayer?.defeated ||
                game?.alliances?.getAllies(localPlayer)?.some((ally: any) => !ally.defeated);

            console.log('[GameScreen] onGameEnd', {
                singlePlayer: this.isSinglePlayer,
                isVictory,
                localPlayer: localPlayer?.name,
                status: game?.status,
                gservConAvailable: Boolean(this.gservCon)
            });

            if (this.jsxRenderer && this.viewport) {
                [gameResultPopup] = this.jsxRenderer.render(jsx(GameResultPopup, {
                    type: isVictory && !isObserver
                        ? GameResultType.MpVictory
                        : GameResultType.MpDefeat,
                    viewport: this.viewport.value
                }));
            }

            this.pointer?.setVisible(false);
            this.gameTurnMgr?.setErrorState?.();
            this.gameAnimationLoop?.stop?.();
            if (this.isLanGame) {
                this.lanMatchSession?.leaveRoom();
            }

            if (this.usesServerConnection() && this.gservCon) {
                this.gservCon.onClose.unsubscribe(this.onGservClose);
                this.gservCon.close();
            }

            if (gameResultPopup) {
                this.uiScene?.add(gameResultPopup);
            }

            if (!isObserver) {
                eva?.play?.(isVictory ? 'EVA_YouAreVictorious' : 'EVA_YouHaveLost', true);
            }

            if (replay) {
                replay.finish(game?.currentTick ?? 0);
                this.saveReplay(replay);
            }

            if (this.usesServerConnection() && game) {
                this.sendGameRes(game, {
                    disconnect: false,
                    desync: false,
                    quit: false,
                    finished: !game.alliances.getHostilePlayers().length
                });
            }

            if (!isObserver && game) {
                this.logGame(game, Boolean(isVictory));
            }

            await sleep(5000);

            if (gameResultPopup) {
                this.uiScene?.remove(gameResultPopup);
                gameResultPopup.destroy?.();
            }

            const route = localPlayer
                ? new MainMenuRoute(MainMenuScreenType.Score, {
                    game,
                    localPlayer,
                    singlePlayer: this.isSinglePlayer,
                    tournament: this.isTournament,
                    returnTo: this.returnTo ?? new MainMenuRoute(MainMenuScreenType.Home, undefined)
                })
                : new MainMenuRoute(MainMenuScreenType.Home, undefined);

            this.controller?.goToScreen(ScreenType.MainMenuRoot, { route });
        }
        catch (error) {
            console.error('[GameScreen] onGameEnd failed', error);
            if (gameResultPopup) {
                this.uiScene?.remove(gameResultPopup);
                gameResultPopup.destroy?.();
            }
            this.controller?.goToScreen(ScreenType.MainMenuRoot, {
                route: new MainMenuRoute(MainMenuScreenType.Home, undefined)
            });
        }
    }
    private logGame(game: any, won: boolean): void {
        (window as any).gtag?.('event', 'game_finish', {
            singlePlayer: Number(this.isSinglePlayer),
            numPlayers: game.gameOpts.humanPlayers.filter((p: any) => p.countryId !== OBS_COUNTRY_ID).length +
                game.gameOpts.aiPlayers.filter((p: any) => !!p).length,
            won: Number(won),
            tournament: Number(this.isTournament),
            duration: game.currentTime
        });
    }
    private handleGservConError(error: any): void {
        if (error instanceof OperationCanceledError) {
            return;
        }
        let errorMessage = this.strings.get('WOL:MatchBadParameters');
        if (error instanceof IrcConnection.SocketError) {
            return;
        }
        if (error instanceof IrcConnection.ConnectError) {
            errorMessage = this.strings.get('TS:ConnectFailed');
        }
        this.handleError(error, errorMessage);
    }
    private handleMapLoadError(error: any, mapName: string): void {
        if (error instanceof OperationCanceledError || error instanceof IrcConnection.SocketError) {
            return;
        }
        let errorMessage = this.strings.get('TXT_MAP_ERROR');
        const message = typeof error === 'string' ? error : error.message;
        if (message?.match(/memory|allocation/i)) {
            errorMessage = this.strings.get('TS:GameInitOom');
        }
        this.handleError(error, errorMessage);
    }
    private handleGameLoadError(error: any, params: any, gameOpts: any): void {
        if (error instanceof OperationCanceledError || error instanceof IrcConnection.SocketError) {
            return;
        }
        let errorMessage = this.strings.get('TS:GameInitError');
        const message = typeof error === 'string' ? error : error.message;
        if (message?.match(/memory|allocation/i)) {
            errorMessage = this.strings.get('TS:GameInitOom');
        }
        else if (!gameOpts.mapOfficial) {
            errorMessage += '\n\n' + this.strings.get('TS:CustomMapCrash');
        }
        this.handleError(error, errorMessage);
    }
    private handleGameError(error: any, message: string, game: any, debugDataProvider?: () => Promise<any>, isCustomMap?: boolean): void {
        const replay = this.replay;
        if (replay) {
            this.saveReplay(replay);
        }
        this.handleError(error, message, isCustomMap);
        if (error === 'desync_error' && this.usesServerConnection()) {
            this.sendGameRes(game, {
                disconnect: false,
                desync: true,
                quit: false,
                finished: false
            });
        }
    }
    private sendDebugInfo(error: any, { gameId, replay, map, official }: {
        gameId?: string;
        replay?: any;
        map?: any;
        official?: boolean;
    } = {}, debugDataProvider?: () => Promise<any>): void {
        console.error('Game error:', error, { gameId, official });
    }
    private sendGameRes(game: any, result: any): void {
        console.log('Game result:', { game: game.id, result });
    }
    private getGameResClientInfo(result: any): any {
        return {
            clientVers: this.engineVersion,
            avgFps: 0,
            avgRtt: this.avgPing.calculate() ?? 0,
            outOfSync: result.desync,
            gameSku: this.wolService.getConfig().getClientSku(),
            accountName: this.playerName,
            suddenDisconnect: result.disconnect,
            quit: result.quit,
            finished: result.finished,
            pingsRecv: 0,
            pingsSent: 0
        };
    }
}
