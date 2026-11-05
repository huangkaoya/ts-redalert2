import { BoxedVar } from '@/util/BoxedVar';
import { CompositeDisposable } from '@/util/disposable/CompositeDisposable';
import { CanvasMetrics } from '@/gui/CanvasMetrics';
import { Pointer } from '@/gui/Pointer';
import { UiScene } from '@/gui/UiScene';
import { GeneralOptions } from '@/gui/screen/options/GeneralOptions';
import { WorldView } from '@/gui/screen/game/WorldView';
import { Minimap } from '@/gui/screen/game/component/Minimap';
import { WorldInteractionFactory } from '@/gui/screen/game/worldInteraction/WorldInteractionFactory';
import { Engine } from '@/engine/Engine';
import { IsoCoords } from '@/engine/IsoCoords';
import { Renderer } from '@/engine/gfx/Renderer';
import { TheaterType } from '@/engine/TheaterType';
import { ResourceType } from '@/engine/resourceConfigs';
import { PointerType } from '@/engine/type/PointerType';
import { UiAnimationLoop } from '@/engine/UiAnimationLoop';
import { ConsoleVars } from '@/ConsoleVars';
import { GameFactory } from '@/game/GameFactory';
import { Coords } from '@/game/Coords';
import { Rules } from '@/game/rules/Rules';
import { OrderActionContext } from '@/game/action/OrderActionContext';
import { OrderUnitsAction } from '@/game/action/OrderUnitsAction';
import { OrderFactory } from '@/game/order/OrderFactory';
import { OrderType } from '@/game/order/OrderType';
import { TileSets } from '@/game/theater/TileSets';
import { VxlGeometryPool } from '@/engine/renderable/builder/vxlGeometry/VxlGeometryPool';
import { VxlGeometryCache } from '@/engine/gfx/geometry/VxlGeometryCache';
import { ObjectType } from '@/engine/type/ObjectType';
import { BuildStatus } from '@/game/gameobject/Building';
import { Infantry } from '@/game/gameobject/Infantry';
import { VeteranLevel } from '@/game/gameobject/unit/VeteranLevel';
import { getZoneType, ZoneType } from '@/game/gameobject/unit/ZoneType';
import { RadialTileFinder } from '@/game/map/tileFinder/RadialTileFinder';
import { MapTileIntersectHelper } from '@/engine/util/MapTileIntersectHelper';
import { MapPanningHelper } from '@/engine/util/MapPanningHelper';
import { SuperWeaponStatus } from '@/game/SuperWeapon';
import { SuperWeaponType } from '@/game/type/SuperWeaponType';
import { SuperWeaponsTrait } from '@/game/trait/SuperWeaponsTrait';
import { TestToolSupport, type TestToolRuntimeContext } from '@/tools/TestToolSupport';

type StringsLike = {
    get(key: string): string | undefined;
    has?(key: string): boolean;
};

type SceneSandboxOptions = {
    mapName?: string;
};

type SpawnKind = 'infantry' | 'vehicle' | 'naval' | 'aircraft' | 'building' | 'superweapon';
type SpawnOwner = 'local' | 'enemy';
type HealthPreset = 'full' | 'half' | 'low';
type TickMultiplier = 1 | 2 | 4 | 8;

type SpawnPreset = {
    label: string;
    kind: SpawnKind;
    name: string;
};

type SandboxState = {
    kind: SpawnKind;
    objectName: string;
    owner: SpawnOwner;
    veteranLevel: VeteranLevel;
    health: HealthPreset;
    count: number;
    placementActive: boolean;
    demolitionActive: boolean;
    superWeaponTargetingActive: boolean;
    activeSuperWeaponName: string;
    panelCollapsed: boolean;
    tickMultiplier: TickMultiplier;
    spawnedCount: number;
    lastMessage: string;
};

type SandboxRuntime = {
    game: any;
    localPlayer: any;
    enemyPlayer: any;
    worldScene: any;
    worldInteraction: any;
    pointer: Pointer;
    tileHelper: MapTileIntersectHelper;
    orderActionContext: OrderActionContext;
    orderAcceptedSerial: number;
    catalog: Record<SpawnKind, string[]>;
    spawnSelect: HTMLSelectElement;
    superWeaponSelect: HTMLSelectElement;
    statusEl: HTMLDivElement;
    strings: StringsLike;
};

export class SceneSandboxTester {
    private static disposables = new CompositeDisposable();
    private static renderer?: Renderer;
    private static uiAnimationLoop?: UiAnimationLoop;
    private static gameTickTimer?: number;
    private static runtime?: SandboxRuntime;
    private static shiftPlacementActive = false;
    private static pendingSuperWeaponTile?: any;
    private static readonly tickMultipliers: TickMultiplier[] = [1, 2, 4, 8];
    private static readonly bridgePickRadius = 3;
    private static readonly maxBridgePickDistance = 48;
    private static readonly superWeaponPointerTypes = new Map<SuperWeaponType, PointerType>()
        .set(SuperWeaponType.MultiMissile, PointerType.Nuke)
        .set(SuperWeaponType.LightningStorm, PointerType.Storm)
        .set(SuperWeaponType.IronCurtain, PointerType.Iron)
        .set(SuperWeaponType.ChronoSphere, PointerType.Chrono)
        .set(SuperWeaponType.ChronoWarp, PointerType.Chrono);
    private static state: SandboxState = {
        kind: 'vehicle',
        objectName: '',
        owner: 'local',
        veteranLevel: VeteranLevel.None,
        health: 'full',
        count: 1,
        placementActive: false,
        demolitionActive: false,
        superWeaponTargetingActive: false,
        activeSuperWeaponName: '',
        panelCollapsed: false,
        tickMultiplier: 2,
        spawnedCount: 0,
        lastMessage: '选择单位后点击“进入放置模式”，再在地图上左键放置。',
    };
    private static readonly fallbackObjectDisplayNames: Record<string, string> = {
        E1: '美国大兵',
        E2: '动员兵',
        GGI: '重装大兵',
        ENGINEER: '工程师',
        SNIPE: '狙击手',
        TANY: '谭雅',
        SEAL: '海豹部队',
        SPY: '间谍',
        DOG: '警犬',
        ADOG: '警犬',
        CLEG: '超时空军团兵',
        YURI: '尤里',
        IVAN: '疯狂伊文',
        FLKT: '防空步兵',
        TERROR: '恐怖分子',
        DESO: '辐射工兵',
        MTNK: '灰熊坦克',
        HTNK: '犀牛坦克',
        MGTK: '幻影坦克',
        SREF: '光棱坦克',
        FV: '多功能步兵车',
        TNKD: '坦克杀手',
        HARV: '矿车',
        CMIN: '超时空采矿车',
        AMCV: '盟军机动建设车',
        SMCV: '苏军机动建设车',
        PCV: '尤里机动建设车',
        APOC: '天启坦克',
        V3: 'V3 火箭车',
        DRON: '恐怖机器人',
        HTK: '防空履带车',
        SAPC: '装甲运兵船',
        LCRF: '两栖运输艇',
        DEST: '驱逐舰',
        AEGIS: '神盾巡洋舰',
        CARRIER: '航空母舰',
        DLPH: '海豚',
        SUB: '台风攻击潜艇',
        DRED: '无畏级战舰',
        SQD: '巨型乌贼',
        ORCA: '入侵者战机',
        BEAG: '黑鹰战机',
        ZEP: '基洛夫飞艇',
        GACNST: '盟军建造厂',
        NACNST: '苏军建造厂',
        YACNST: '尤里建造厂',
        GAPOWR: '盟军发电厂',
        NAPOWR: '磁能反应炉',
        YAPOWR: '生化反应炉',
        GAREFN: '盟军矿石精炼厂',
        NAREFN: '苏军矿石精炼厂',
        YAREFN: '奴隶矿场',
        GAPILE: '盟军兵营',
        NAHAND: '苏军兵营',
        YABRCK: '尤里兵营',
        GAWEAP: '盟军战车工厂',
        NAWEAP: '苏军战车工厂',
        YAWEAP: '尤里战车工厂',
        GAAIRC: '空指部',
        NARADR: '雷达塔',
        GAYARD: '盟军船坞',
        NAYARD: '苏军船坞',
        YAYARD: '尤里船坞',
        GATECH: '盟军作战实验室',
        NATECH: '苏军作战实验室',
        YATECH: '尤里作战实验室',
        GACSPH: '超时空传送仪',
        GAWEAT: '天气控制机',
        NAIRON: '铁幕装置',
        NAMISL: '核弹发射井',
        NAMSLO: '核弹发射井',
        YAPPET: '心灵控制器',
        YAGNTC: '基因突变器',
    };

    static async main(_mixFileLoader: any, gameMapFile: any, parentElement: HTMLElement, strings: StringsLike, context: TestToolRuntimeContext = {}, options: SceneSandboxOptions = {}): Promise<void> {
        const theaterType = gameMapFile.theaterType ?? TheaterType.Temperate;
        await TestToolSupport.ensureTheater(theaterType, context.cdnResourceLoader, [
            ResourceType.UiAlly,
            ResourceType.Vxl,
            ResourceType.Anims,
        ]);

        const viewport = this.getViewport();
        const host = TestToolSupport.prepareHost(context, viewport.width, viewport.height);
        host.style.background = '#0f1416';
        host.style.overflow = 'hidden';
        parentElement.style.background = '#0f1416';

        const renderer = (this.renderer = new Renderer(viewport.width, viewport.height));
        renderer.init(host);
        const canvas = TestToolSupport.placeRendererCanvas(renderer, 0, 0);
        canvas.dataset.testid = 'scene-sandbox-canvas';
        canvas.addEventListener('contextmenu', (event) => event.preventDefault());
        renderer.initStats(document.body);
        this.disposables.add(renderer);

        const canvasMetrics = new CanvasMetrics(canvas, window);
        canvasMetrics.init();
        this.disposables.add(canvasMetrics);

        const generalOptions = new GeneralOptions();
        // RA2 风格：左键移动、右键拖动卷动地图（与真实游戏默认一致）。
        generalOptions.rightClickMove.value = false;
        generalOptions.rightClickScroll.value = true;
        generalOptions.targetLines.value = true;
        const runtimeVars = new ConsoleVars();
        runtimeVars.freeCamera.value = false;

        const pointer = Pointer.factory(
            Engine.getImages().get('mouse.shp'),
            Engine.getPalettes().get('mousepal.pal'),
            renderer,
            document,
            canvasMetrics,
            generalOptions.mouseAcceleration,
        );
        pointer.init();
        pointer.unlock();
        this.disposables.add(pointer);

        const uiScene = UiScene.factory(viewport);
        uiScene.add(pointer.getSprite());
        this.disposables.add(uiScene);

        const theater = await Engine.loadTheater(theaterType);
        const game = this.createGame(gameMapFile, options.mapName);
        const localPlayer = game.getPlayerByName('沙盒玩家');
        const enemyPlayer = game.getPlayerByName('目标方');

        IsoCoords.init({
            x: 0,
            y: (game.map.mapBounds.getFullSize().width * Coords.getWorldTileSize()) / 2,
        });
        game.init(localPlayer);
        this.removeBaseUnits(game, localPlayer, enemyPlayer);
        this.disableSandboxEndConditions(game, localPlayer, enemyPlayer);
        game.mapShroudTrait.revealMap(localPlayer, game);
        game.mapShroudTrait.revealMap(enemyPlayer, game);
        game.start();

        const minimap = new Minimap(game, localPlayer, 0xffd84a, game.rules.general.radar);
        minimap.setPointerEvents(pointer.pointerEvents);
        this.disposables.add(minimap);
        uiScene.add(minimap);
        this.layoutMinimap(minimap, viewport);

        const silentSound = {
            getSoundSpec: (key: unknown) => ({
                name: String(key),
                volume: 0,
                minVolume: 0,
                type: [],
                control: new Set(),
                limit: 0,
                range: 0,
            }),
            playWithOptions: () => undefined,
        };

        const worldView = new WorldView(
            { width: 0, height: 0 },
            game,
            silentSound as any,
            renderer,
            runtimeVars,
            minimap,
            strings,
            generalOptions,
            new VxlGeometryPool(new VxlGeometryCache(null, null)),
            new Map(),
        );
        const worldViewInit = worldView.init(localPlayer, viewport, theater);
        const worldScene = worldViewInit.worldScene;
        worldScene.create3DObject?.();
        this.disposables.add(worldView);

        const keyBinds = {
            getCommandType() {
                return undefined;
            },
        };
        const worldInteraction = new WorldInteractionFactory(
            localPlayer,
            game,
            game.unitSelection,
            worldViewInit.renderableManager,
            uiScene,
            worldScene,
            pointer,
            renderer,
            keyBinds,
            generalOptions,
            runtimeVars.freeCamera,
            runtimeVars.debugPaths,
            true,
            document,
            minimap,
            strings,
            '#ffd84a',
            game.debugText,
            undefined,
        ).create();
        worldInteraction.init?.();
        this.disposables.add(worldInteraction);
        const orderActionContext = new OrderActionContext();
        const handleOrder = (event: any) => this.executeLocalOrder(event);
        worldInteraction.defaultActionHandler.onOrder.subscribe(handleOrder);
        this.disposables.add(() => worldInteraction.defaultActionHandler.onOrder.unsubscribe(handleOrder));

        renderer.addScene(worldScene);
        renderer.addScene(uiScene);
        host.appendChild(uiScene.getHtmlContainer().getElement());
        this.disposables.add(() => uiScene.getHtmlContainer().getElement().remove());

        const catalog = this.buildCatalog(game.rules, game.art, strings);
        this.state = {
            ...this.state,
            kind: 'vehicle',
            objectName: this.pickInitialObject(catalog),
            owner: 'local',
            veteranLevel: VeteranLevel.None,
            health: 'full',
            count: 1,
            placementActive: false,
            demolitionActive: false,
            superWeaponTargetingActive: false,
            activeSuperWeaponName: '',
            panelCollapsed: false,
            tickMultiplier: this.state.tickMultiplier,
            spawnedCount: 0,
            lastMessage: `已载入 ${options.mapName ?? '测试地图'}。左侧选择单位后进入放置模式。`,
        };

        const panel = this.buildControlPanel(host, catalog, options.mapName ?? gameMapFile.name ?? '测试地图');
        this.disposables.add(() => panel.remove());

        const tileHelper = new MapTileIntersectHelper(game.map, worldScene);
        const getCanvasPointer = (event: MouseEvent) => canvasMetrics.toCanvasOffset(event.offsetX, event.offsetY);
        const handleShiftPlacementMouseDown = (event: MouseEvent) => {
            if (event.button !== 0 || !event.shiftKey || this.isPanelControlEventTarget(event.target)) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
        };
        const handleShiftPlacementMouseUp = (event: MouseEvent) => {
            if (event.button !== 0 || !event.shiftKey || this.isPanelControlEventTarget(event.target)) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
            const tile = this.getTargetTileAtScreenPoint(getCanvasPointer(event));
            if (!tile) {
                this.setStatus('按住 Shift：没有找到可放置的地图格。');
                return;
            }
            const spawnedCount = this.spawnAt(tile);
            if (spawnedCount > 0) {
                this.setStatus('按住 Shift：已放置单位，松开 Shift 后恢复正常交互。');
            }
        };
        canvas.addEventListener('mousedown', handleShiftPlacementMouseDown, true);
        canvas.addEventListener('mouseup', handleShiftPlacementMouseUp, true);
        this.disposables.add(() => {
            canvas.removeEventListener('mousedown', handleShiftPlacementMouseDown, true);
            canvas.removeEventListener('mouseup', handleShiftPlacementMouseUp, true);
        });
        this.runtime = {
            game,
            localPlayer,
            enemyPlayer,
            worldScene,
            worldInteraction,
            pointer,
            tileHelper,
            orderActionContext,
            orderAcceptedSerial: 0,
            catalog,
            spawnSelect: panel.querySelector('[data-testid="sandbox-object"]') as HTMLSelectElement,
            superWeaponSelect: panel.querySelector('[data-testid="sandbox-superweapon"]') as HTMLSelectElement,
            statusEl: panel.querySelector('[data-testid="sandbox-status"]') as HTMLDivElement,
            strings,
        };
        this.syncControls();

        const handlePlacementClick = (event: any) => {
            if (!this.runtime) {
                return;
            }
            if (this.state.demolitionActive) {
                if (event.button === 2) {
                    this.setDemolitionActive(false);
                    return;
                }
                if (event.button !== 0) {
                    return;
                }
                const building = this.findDemolishableBuildingAtScreenPoint(event.pointer);
                if (!building) {
                    this.setStatus('拆除失败：当前位置没有可拆除的建筑。');
                    this.updateDemolitionPointer(event.pointer);
                    return;
                }
                this.demolishBuilding(building);
                this.updateDemolitionPointer(event.pointer);
                return;
            }
            if (this.state.superWeaponTargetingActive) {
                if (event.button === 2) {
                    this.setSuperWeaponTargetingActive(false);
                    return;
                }
                if (event.button !== 0) {
                    return;
                }
                const tile = this.getTargetTileAtScreenPoint(event.pointer);
                if (!tile) {
                    this.setStatus('超级武器瞄准失败：没有找到地图格。');
                    return;
                }
                this.triggerSuperWeaponAt(tile);
                return;
            }
            if (!this.state.placementActive) {
                return;
            }
            if (event.button === 2) {
                this.shiftPlacementActive = false;
                this.setPlacementActive(false);
                return;
            }
            if (event.button !== 0) {
                return;
            }
            const tile = this.getTargetTileAtScreenPoint(event.pointer);
            if (!tile) {
                this.setStatus('没有找到可放置的地图格。');
                return;
            }
            const spawnedCount = this.spawnAt(tile);
            if (!this.shiftPlacementActive) {
                this.setPlacementActive(false, spawnedCount > 0
                    ? '已放置并退出放置模式：当前可直接右键移动/攻击，也可以框选其他单位。'
                    : '已退出放置模式：可正常选择单位并右键移动/攻击。');
            }
            else if (this.shiftPlacementActive && spawnedCount > 0) {
                this.setStatus('按住 Shift：继续临时放置模式。');
            }
        };
        pointer.pointerEvents.addEventListener('canvas', 'mouseup', handlePlacementClick);
        this.disposables.add(() => pointer.pointerEvents.removeEventListener('canvas', 'mouseup', handlePlacementClick));

        const handleDemolitionPointerMove = (event: any) => {
            if (this.state.demolitionActive) {
                this.updateDemolitionPointer(event.pointer);
            }
        };
        pointer.pointerEvents.addEventListener('canvas', 'mousemove', handleDemolitionPointerMove);
        this.disposables.add(() => pointer.pointerEvents.removeEventListener('canvas', 'mousemove', handleDemolitionPointerMove));

        const handleKeyDown = (event: KeyboardEvent) => {
            if (this.handleSandboxShortcut(event)) {
                return;
            }
            if (event.key !== 'Shift' ||
                event.repeat ||
                this.state.demolitionActive ||
                this.state.superWeaponTargetingActive ||
                this.isPanelControlEventTarget(event.target)) {
                return;
            }
            if (!this.state.placementActive) {
                this.shiftPlacementActive = true;
                this.setPlacementActive(true, '按住 Shift：临时放置模式已开启。');
            }
        };
        const handleKeyUp = (event: KeyboardEvent) => {
            if (event.key !== 'Shift') {
                return;
            }
            if (this.shiftPlacementActive) {
                this.shiftPlacementActive = false;
                this.setPlacementActive(false, 'Shift 已松开：恢复正常交互。');
            }
        };
        const handleWindowBlur = () => {
            if (this.shiftPlacementActive) {
                this.shiftPlacementActive = false;
                this.setPlacementActive(false, '窗口失焦：已退出临时放置模式。');
            }
        };
        document.addEventListener('keydown', handleKeyDown, true);
        document.addEventListener('keyup', handleKeyUp, true);
        window.addEventListener('blur', handleWindowBlur);
        this.disposables.add(() => {
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('keyup', handleKeyUp, true);
            window.removeEventListener('blur', handleWindowBlur);
        });

        this.uiAnimationLoop = new UiAnimationLoop(renderer);
        this.uiAnimationLoop.start();
        this.disposables.add(() => this.uiAnimationLoop?.destroy());

        this.gameTickTimer = window.setInterval(() => {
            try {
                for (let tick = 0; tick < this.state.tickMultiplier; tick += 1) {
                    game.update();
                }
            }
            catch (error) {
                console.error('[SceneSandboxTester] game.update failed', error);
                this.setStatus(`游戏更新失败：${String(error)}`);
            }
        }, 33);
        this.disposables.add(() => {
            if (this.gameTickTimer) {
                clearInterval(this.gameTickTimer);
                this.gameTickTimer = undefined;
            }
        });

        TestToolSupport.setState('scene-sandbox', {
            mapName: options.mapName ?? gameMapFile.name,
            theater: TheaterType[theaterType],
            catalogCounts: {
                infantry: catalog.infantry.length,
                vehicle: catalog.vehicle.length,
                naval: catalog.naval.length,
                aircraft: catalog.aircraft.length,
                building: catalog.building.length,
                superweapon: catalog.superweapon.length,
            },
        });
    }

    private static createGame(gameMapFile: any, mapName?: string): any {
        const theaterType = gameMapFile.theaterType ?? TheaterType.Temperate;
        const activeEngine = Engine.getActiveEngine();
        const theaterSettings = Engine.getTheaterSettings(activeEngine, theaterType);
        const theaterIni = Engine.getTheaterIni(activeEngine, theaterType);
        const tileSets = new TileSets(theaterIni);
        tileSets.loadTileData(Engine.getTileData(), theaterSettings.extension);

        const gameModes = Engine.getMpModes();
        const gameModeId = gameModes.hasId(0) ? 0 : gameModes.getAll()[0]?.id ?? 0;
        const baseRules = new Rules(Engine.getRules());
        const countries = baseRules.getMultiplayerCountries().map((country) => country.name);
        const colors = [...baseRules.getMultiplayerColors().keys()];
        const localCountryId = this.findNamedIndex(countries, ['Americans', 'America', 'British']);
        const enemyCountryId = this.findNamedIndex(countries, ['Russians', 'Russia', 'Confederation']);
        const localColorId = this.findNamedIndex(colors, ['DarkRed', 'Red', 'Orange']);
        const enemyColorId = this.findNamedIndex(colors, ['DarkBlue', 'Blue', 'SkyBlue']);
        const startCount = Math.max(1, gameMapFile.startingLocations?.length ?? 0);
        const enemyStart = startCount > 1 ? 1 : 0;
        const timestamp = Date.now();
        const gameOpts: any = {
            gameMode: gameModeId,
            gameSpeed: 5,
            credits: 100000,
            unitCount: 0,
            shortGame: false,
            superWeapons: true,
            buildOffAlly: false,
            mcvRepacks: false,
            cratesAppear: false,
            destroyableBridges: true,
            multiEngineer: false,
            noDogEngiKills: false,
            mapName: mapName ?? gameMapFile.name ?? 'scene-sandbox.map',
            mapTitle: gameMapFile.getOrCreateSection?.('Basic')?.getString?.('Name') ?? '场景沙盒',
            mapDigest: '',
            mapSizeBytes: 0,
            maxSlots: 2,
            mapOfficial: true,
            humanPlayers: [
                { name: '沙盒玩家', countryId: localCountryId, colorId: localColorId, startPos: 0, teamId: 0 },
                { name: '目标方', countryId: enemyCountryId, colorId: enemyColorId, startPos: enemyStart, teamId: 1 },
            ],
            aiPlayers: [],
        };
        const modRules = Engine.getIni(gameModes.getById(gameModeId).rulesOverride);
        return GameFactory.create(
            gameMapFile,
            tileSets,
            Engine.getRules(),
            Engine.getArt(),
            Engine.getAi(),
            modRules,
            [],
            'SceneSandbox',
            timestamp,
            gameOpts,
            gameModes as any,
            true,
            {},
            undefined,
            new BoxedVar(false),
            new BoxedVar(0),
        );
    }

    private static buildCatalog(rules: any, art: any, strings: StringsLike): Record<SpawnKind, string[]> {
        const fromRules = (rulesMap: Map<string, any>, type: ObjectType) => [...rulesMap.keys()]
            .filter((name) => {
                try {
                    return art.hasObject(name, type);
                }
                catch {
                    return false;
                }
            })
            .sort((left, right) => {
                const leftLabel = this.resolveObjectDisplayName(rules, strings, type, left);
                const rightLabel = this.resolveObjectDisplayName(rules, strings, type, right);
                return leftLabel.localeCompare(rightLabel, 'zh-CN') || left.localeCompare(right);
            });
        const vehicles = fromRules(rules.vehicleRules, ObjectType.Vehicle);
        const naval = vehicles.filter((name) => this.isNavalVehicleRules(rules.getObject(name, ObjectType.Vehicle)));
        const buildings = fromRules(rules.buildingRules, ObjectType.Building)
            .filter((name) => !rules.getObject(name, ObjectType.Building).invisibleInGame);
        const superweapon = buildings.filter((name) => this.isMajorSuperWeaponBuilding(rules, name));
        return {
            infantry: fromRules(rules.infantryRules, ObjectType.Infantry),
            vehicle: vehicles.filter((name) => !naval.includes(name)),
            naval,
            aircraft: fromRules(rules.aircraftRules, ObjectType.Aircraft),
            building: buildings,
            superweapon,
        };
    }

    private static isNavalVehicleRules(rules: any): boolean {
        return !!(rules?.naval || rules?.waterBound);
    }

    private static isMajorSuperWeaponBuilding(rules: any, buildingName: string): boolean {
        const superWeaponName = rules.getObject(buildingName, ObjectType.Building).superWeapon;
        if (!superWeaponName) {
            return false;
        }
        try {
            const superWeaponRules = rules.getSuperWeapon(superWeaponName);
            return [
                SuperWeaponType.MultiMissile,
                SuperWeaponType.IronCurtain,
                SuperWeaponType.LightningStorm,
                SuperWeaponType.ChronoSphere,
            ].includes(superWeaponRules.type);
        }
        catch {
            return false;
        }
    }

    private static resolveObjectDisplayName(rules: any, strings: StringsLike | undefined, type: ObjectType, name: string): string {
        try {
            const objectRules = rules.getObject(name, type) as any;
            const uiName = objectRules?.uiName;
            if (typeof uiName === 'string' && uiName.trim()) {
                const key = uiName.trim();
                if (/^NOSTR:/i.test(key)) {
                    return strings?.get(key) || key.replace(/^NOSTR:/i, '');
                }
                if (strings?.has?.(key)) {
                    return strings.get(key) || name;
                }
            }
        }
        catch {
            // Fall through to the internal ID when rules are incomplete.
        }
        return this.fallbackObjectDisplayNames[name] ?? name;
    }

    private static pickInitialObject(catalog: Record<SpawnKind, string[]>): string {
        return catalog.vehicle.find((name) => name === 'MTNK') ??
            catalog.vehicle[0] ??
            catalog.naval[0] ??
            catalog.infantry[0] ??
            catalog.building[0] ??
            catalog.superweapon[0] ??
            catalog.aircraft[0] ??
            '';
    }

    private static buildControlPanel(host: HTMLElement, catalog: Record<SpawnKind, string[]>, mapName: string): HTMLDivElement {
        const panel = document.createElement('div');
        panel.dataset.testid = 'scene-sandbox-panel';
        panel.style.cssText = `
            position: absolute;
            left: 12px;
            top: 56px;
            width: 340px;
            z-index: 1001;
            padding: 10px;
            font: 13px/1.35 Arial, sans-serif;
            box-sizing: border-box;
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; gap: 6px;';
        const title = document.createElement('div');
        title.style.cssText = 'font-weight: bold; font-size: 15px; flex: 1;';
        title.textContent = '场景沙盒';
        header.appendChild(title);
        const homeButton = this.createButton('主页', () => {
            window.location.hash = '/';
        });
        homeButton.dataset.testid = 'sandbox-home';
        homeButton.style.width = '58px';
        header.appendChild(homeButton);
        const collapseButton = this.createButton('收起', () => {
            this.state.panelCollapsed = !this.state.panelCollapsed;
            this.syncControls();
        });
        collapseButton.dataset.testid = 'sandbox-collapse';
        collapseButton.style.width = '68px';
        header.appendChild(collapseButton);
        panel.appendChild(header);

        const body = document.createElement('div');
        body.dataset.testid = 'sandbox-panel-body';
        panel.appendChild(body);

        const mapLine = document.createElement('div');
        mapLine.style.cssText = 'opacity: 0.9; margin-bottom: 8px;';
        mapLine.textContent = `地图：${mapName}`;
        body.appendChild(mapLine);

        const row = (label: string, control: HTMLElement) => {
            const wrap = document.createElement('label');
            wrap.style.cssText = 'display: block; margin: 7px 0;';
            const caption = document.createElement('div');
            caption.textContent = label;
            caption.style.cssText = 'margin-bottom: 3px;';
            wrap.append(caption, control);
            body.appendChild(wrap);
        };

        const kindSelect = document.createElement('select');
        kindSelect.dataset.testid = 'sandbox-kind';
        kindSelect.style.width = '100%';
        [
            ['vehicle', '载具'],
            ['naval', '船只'],
            ['infantry', '步兵'],
            ['aircraft', '飞行器'],
            ['building', '建筑'],
            ['superweapon', '超级武器建筑'],
        ].forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            kindSelect.appendChild(option);
        });
        kindSelect.value = this.state.kind;
        kindSelect.onchange = () => {
            this.state.kind = kindSelect.value as SpawnKind;
            this.state.objectName = catalog[this.state.kind][0] ?? '';
            kindSelect.blur();
            this.syncControls();
        };
        row('类型', kindSelect);

        const objectSelect = document.createElement('select');
        objectSelect.dataset.testid = 'sandbox-object';
        objectSelect.style.width = '100%';
        objectSelect.onchange = () => {
            this.state.objectName = objectSelect.value;
            objectSelect.blur();
            this.syncState();
        };
        row('对象', objectSelect);

        const ownerSelect = document.createElement('select');
        ownerSelect.dataset.testid = 'sandbox-owner';
        ownerSelect.style.width = '100%';
        [
            ['local', '沙盒玩家'],
            ['enemy', '目标方'],
        ].forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            ownerSelect.appendChild(option);
        });
        ownerSelect.onchange = () => {
            this.state.owner = ownerSelect.value as SpawnOwner;
            ownerSelect.blur();
            this.syncState();
        };
        row('归属', ownerSelect);

        const veteranSelect = document.createElement('select');
        veteranSelect.dataset.testid = 'sandbox-veteran';
        veteranSelect.style.width = '100%';
        [
            [VeteranLevel.None, '普通'],
            [VeteranLevel.Veteran, '老兵'],
            [VeteranLevel.Elite, '精英'],
        ].forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = String(value);
            option.textContent = String(label);
            veteranSelect.appendChild(option);
        });
        veteranSelect.onchange = () => {
            this.state.veteranLevel = Number(veteranSelect.value) as VeteranLevel;
            veteranSelect.blur();
            this.syncState();
        };
        row('等级', veteranSelect);

        const healthSelect = document.createElement('select');
        healthSelect.dataset.testid = 'sandbox-health';
        healthSelect.style.width = '100%';
        [
            ['full', '满血'],
            ['half', '半血'],
            ['low', '残血'],
        ].forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            healthSelect.appendChild(option);
        });
        healthSelect.onchange = () => {
            this.state.health = healthSelect.value as HealthPreset;
            healthSelect.blur();
            this.syncState();
        };
        row('血量', healthSelect);

        const countInput = document.createElement('input');
        countInput.dataset.testid = 'sandbox-count';
        countInput.type = 'number';
        countInput.min = '1';
        countInput.max = '100';
        countInput.value = String(this.state.count);
        countInput.style.width = '100%';
        countInput.onchange = () => {
            this.state.count = Math.max(1, Math.min(100, Math.floor(Number(countInput.value) || 1)));
            countInput.value = String(this.state.count);
            this.syncState();
        };
        row('数量', countInput);

        const speedWrap = document.createElement('div');
        speedWrap.style.cssText = 'display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 7px 0;';
        for (const multiplier of this.tickMultipliers) {
            const button = this.createButton(`${multiplier}x`, () => {
                this.state.tickMultiplier = multiplier;
                this.setStatus(`速度倍率已切换为 ${multiplier}x。`);
                this.syncControls();
            });
            button.dataset.testid = 'sandbox-speed';
            button.dataset.speed = String(multiplier);
            speedWrap.appendChild(button);
        }
        row('速度', speedWrap);

        const actions = document.createElement('div');
        actions.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px;';
        const placeButton = this.createButton('进入放置模式（Shift）', () => this.setPlacementActive(!this.state.placementActive));
        placeButton.dataset.testid = 'sandbox-place';
        const demolitionButton = this.createButton('拆除建筑（C）', () => this.setDemolitionActive(!this.state.demolitionActive));
        demolitionButton.dataset.testid = 'sandbox-demolish';
        const clearButton = this.createButton('清空生成物', () => this.clearSpawnedObjects());
        clearButton.dataset.testid = 'sandbox-clear';
        clearButton.style.gridColumn = '1 / -1';
        actions.append(placeButton, demolitionButton, clearButton);
        body.appendChild(actions);

        const superWeaponSelect = document.createElement('select');
        superWeaponSelect.dataset.testid = 'sandbox-superweapon';
        superWeaponSelect.style.width = '100%';
        superWeaponSelect.onchange = () => {
            this.state.activeSuperWeaponName = superWeaponSelect.value;
            this.updateSuperWeaponPointer();
            superWeaponSelect.blur();
            this.syncState();
        };
        row('已拥有超级武器', superWeaponSelect);

        const superWeaponButton = this.createButton('触发超级武器（W）', () => {
            this.setSuperWeaponTargetingActive(!this.state.superWeaponTargetingActive);
        });
        superWeaponButton.dataset.testid = 'sandbox-fire-superweapon';
        superWeaponButton.style.marginTop = '2px';
        body.appendChild(superWeaponButton);

        const quickWrap = document.createElement('div');
        quickWrap.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px;';
        this.getQuickPresets(catalog).forEach((preset) => {
            const button = this.createButton(preset.label, () => {
                this.state.kind = preset.kind;
                this.state.objectName = preset.name;
                this.syncControls();
            });
            button.dataset.quickKind = preset.kind;
            quickWrap.appendChild(button);
        });
        body.appendChild(quickWrap);

        const status = document.createElement('div');
        status.dataset.testid = 'sandbox-status';
        status.style.cssText = 'margin-top: 9px; white-space: pre-wrap; min-height: 38px;';
        body.appendChild(status);

        TestToolSupport.applyPanelTheme(panel);
        this.applyQuickPresetButtonTheme(panel);
        host.appendChild(panel);
        return panel;
    }

    private static createButton(label: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.style.width = '100%';
        button.onclick = onClick;
        return button;
    }

    private static isPanelControlEventTarget(target: EventTarget | null): boolean {
        return !!(target as HTMLElement | null)?.closest?.('[data-testid="scene-sandbox-panel"] input, [data-testid="scene-sandbox-panel"] select, [data-testid="scene-sandbox-panel"] textarea, [contenteditable="true"]');
    }

    private static isTextEditingEventTarget(target: EventTarget | null): boolean {
        const element = target as HTMLElement | null;
        return !!element?.closest?.('input, textarea, [contenteditable="true"]');
    }

    private static applyQuickPresetButtonTheme(panel: HTMLElement): void {
        const themedButtons = [
            {
                kind: 'building',
                background: 'linear-gradient(180deg, #17633d, #0a3324)',
                border: '#39d482',
                color: '#e8fff0',
            },
            {
                kind: 'superweapon',
                background: 'linear-gradient(180deg, #4b2877, #25103f)',
                border: '#ba8cff',
                color: '#f4eaff',
            },
        ];
        for (const theme of themedButtons) {
            const button = panel.querySelector(`[data-quick-kind="${theme.kind}"]`) as HTMLButtonElement | null;
            if (!button) {
                continue;
            }
            button.style.background = theme.background;
            button.style.borderColor = theme.border;
            button.style.color = theme.color;
            button.style.boxShadow = `inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 0 0 1px ${theme.border}33`;
        }
    }

    private static getQuickPresets(catalog: Record<SpawnKind, string[]>): SpawnPreset[] {
        const pick = (kind: SpawnKind, names: string[]) => names.find((name) => catalog[kind].includes(name)) ?? catalog[kind][0];
        const presets: SpawnPreset[] = [
            { label: '基础步兵', kind: 'infantry', name: pick('infantry', ['E1', 'GGI', 'ENGINEER']) },
            { label: '主战坦克', kind: 'vehicle', name: pick('vehicle', ['MTNK', 'HTNK', 'APOC']) },
            { label: '船只', kind: 'naval', name: pick('naval', ['LCRF', 'SAPC', 'DEST']) },
            { label: '飞行器', kind: 'aircraft', name: pick('aircraft', ['ORCA', 'BEAG', 'ZEP']) },
            { label: '基础建筑', kind: 'building', name: pick('building', ['GAPOWR', 'NAPOWR', 'GAREFN', 'GAWEAP']) },
            { label: '超级武器', kind: 'superweapon', name: pick('superweapon', ['NAMISL', 'NAMSLO', 'NAIRON', 'GACSPH', 'GAWEAT', 'YAPPET']) },
        ];
        return presets.filter((preset) => !!preset.name);
    }

    private static syncControls(): void {
        const runtime = this.runtime;
        const panel = document.querySelector('[data-testid="scene-sandbox-panel"]') as HTMLDivElement | null;
        if (!panel) {
            return;
        }
        const kindSelect = panel.querySelector('[data-testid="sandbox-kind"]') as HTMLSelectElement;
        const objectSelect = panel.querySelector('[data-testid="sandbox-object"]') as HTMLSelectElement;
        const ownerSelect = panel.querySelector('[data-testid="sandbox-owner"]') as HTMLSelectElement;
        const veteranSelect = panel.querySelector('[data-testid="sandbox-veteran"]') as HTMLSelectElement;
        const healthSelect = panel.querySelector('[data-testid="sandbox-health"]') as HTMLSelectElement;
        const countInput = panel.querySelector('[data-testid="sandbox-count"]') as HTMLInputElement;
        const placeButton = panel.querySelector('[data-testid="sandbox-place"]') as HTMLButtonElement;
        const demolitionButton = panel.querySelector('[data-testid="sandbox-demolish"]') as HTMLButtonElement;
        const superWeaponSelect = panel.querySelector('[data-testid="sandbox-superweapon"]') as HTMLSelectElement;
        const superWeaponButton = panel.querySelector('[data-testid="sandbox-fire-superweapon"]') as HTMLButtonElement;
        const collapseButton = panel.querySelector('[data-testid="sandbox-collapse"]') as HTMLButtonElement;
        const body = panel.querySelector('[data-testid="sandbox-panel-body"]') as HTMLDivElement;
        const speedButtons = [...panel.querySelectorAll('[data-testid="sandbox-speed"]')] as HTMLButtonElement[];

        const catalog = runtime?.catalog ?? {
            infantry: [],
            vehicle: [],
            naval: [],
            aircraft: [],
            building: [],
            superweapon: [],
        };
        if (!catalog[this.state.kind].includes(this.state.objectName)) {
            this.state.objectName = catalog[this.state.kind][0] ?? '';
        }
        kindSelect.value = this.state.kind;
        objectSelect.replaceChildren();
        for (const name of catalog[this.state.kind]) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = this.getObjectOptionLabel(this.state.kind, name);
            option.title = name;
            option.selected = name === this.state.objectName;
            objectSelect.appendChild(option);
        }
        ownerSelect.value = this.state.owner;
        veteranSelect.value = String(this.state.veteranLevel);
        healthSelect.value = this.state.health;
        countInput.value = String(this.state.count);
        placeButton.textContent = this.state.placementActive ? '退出放置模式（Shift）' : '进入放置模式（Shift）';
        demolitionButton.textContent = this.state.demolitionActive ? '退出拆除建筑（C）' : '拆除建筑（C）';
        demolitionButton.style.outline = this.state.demolitionActive ? '2px solid #ffd84a' : '';
        const superWeapons = this.getAvailableSuperWeapons();
        if (!superWeapons.some((superWeapon) => superWeapon.name === this.state.activeSuperWeaponName)) {
            this.state.activeSuperWeaponName = superWeapons[0]?.name ?? '';
        }
        superWeaponSelect.replaceChildren();
        for (const superWeapon of superWeapons) {
            const option = document.createElement('option');
            option.value = superWeapon.name;
            option.textContent = this.getSuperWeaponLabel(superWeapon);
            option.selected = superWeapon.name === this.state.activeSuperWeaponName;
            superWeaponSelect.appendChild(option);
        }
        superWeaponSelect.disabled = !superWeapons.length;
        superWeaponButton.disabled = !superWeapons.length;
        superWeaponButton.textContent = this.state.superWeaponTargetingActive ? '取消超级武器（W）' : '触发超级武器（W）';
        collapseButton.textContent = this.state.panelCollapsed ? '展开' : '收起';
        body.style.display = this.state.panelCollapsed ? 'none' : 'block';
        panel.style.width = this.state.panelCollapsed ? '214px' : '340px';
        for (const button of speedButtons) {
            const active = Number(button.dataset.speed) === this.state.tickMultiplier;
            button.style.fontWeight = active ? 'bold' : 'normal';
            button.style.outline = active ? '2px solid #ffd84a' : '';
        }
        this.updateStatus();
        this.syncState();
    }

    private static getObjectOptionLabel(kind: SpawnKind, name: string): string {
        const runtime = this.runtime;
        const type = this.objectTypeForKind(kind);
        const displayName = runtime
            ? this.resolveObjectDisplayName(runtime.game.rules, runtime.strings, type, name)
            : this.fallbackObjectDisplayNames[name] ?? name;
        return displayName === name ? name : `${displayName}（${name}）`;
    }

    private static getAvailableSuperWeapons(): any[] {
        return (this.runtime?.localPlayer?.superWeaponsTrait?.getAll?.() ?? [])
            .filter((superWeapon: any) => this.superWeaponPointerTypes.has(superWeapon.rules?.type));
    }

    private static getSuperWeaponLabel(superWeapon: any): string {
        const typeName = superWeapon.rules?.type !== undefined
            ? SuperWeaponType[superWeapon.rules.type] ?? String(superWeapon.rules.type)
            : 'Unknown';
        const statusLabel = superWeapon.status === SuperWeaponStatus.Ready
            ? '就绪'
            : superWeapon.status === SuperWeaponStatus.Paused
                ? '暂停'
                : '充能';
        return `${this.getSuperWeaponDisplayName(superWeapon.name)}（${typeName}，${statusLabel}）`;
    }

    private static getSuperWeaponDisplayName(name: string): string {
        const labels: Record<string, string> = {
            NukeSpecial: '核弹',
            IronCurtainSpecial: '铁幕',
            ChronoSphereSpecial: '超时空传送',
            LightningStormSpecial: '闪电风暴',
            PsychicDominatorSpecial: '心灵控制器',
            GeneticConverterSpecial: '基因突变器',
            ParaDropSpecial: '伞兵',
            AmerParaDropSpecial: '美国伞兵',
        };
        return labels[name] ?? name;
    }

    private static getActiveSuperWeapon(): any | undefined {
        const superWeapons = this.getAvailableSuperWeapons();
        return superWeapons.find((superWeapon) => superWeapon.name === this.state.activeSuperWeaponName) ?? superWeapons[0];
    }

    private static makeSuperWeaponReady(superWeapon: any): void {
        superWeapon.status = SuperWeaponStatus.Ready;
        superWeapon.chargeTicks = 0;
    }

    private static getSuperWeaponPointerType(superWeapon: any | undefined): PointerType {
        const type = superWeapon?.rules?.type;
        return type !== undefined
            ? this.superWeaponPointerTypes.get(type) ?? PointerType.Default
            : PointerType.Default;
    }

    private static updateSuperWeaponPointer(): void {
        if (this.state.superWeaponTargetingActive) {
            this.runtime?.pointer?.setPointerType(this.getSuperWeaponPointerType(this.getActiveSuperWeapon()));
        }
    }

    private static triggerSuperWeaponAt(tile: any): void {
        const runtime = this.runtime;
        const superWeapon = this.getActiveSuperWeapon();
        if (!runtime || !superWeapon) {
            this.setSuperWeaponTargetingActive(false, '没有可触发的超级武器。');
            return;
        }
        const rules = superWeapon.rules;
        if (rules?.type === undefined) {
            this.setSuperWeaponTargetingActive(false, `超级武器 ${superWeapon.name} 缺少 Type，无法触发。`);
            return;
        }
        if (rules.preClick && !this.pendingSuperWeaponTile) {
            this.pendingSuperWeaponTile = tile;
            this.setStatus(`已选择第一个目标 @ ${tile.rx},${tile.ry}，请再左键选择第二个目标。`);
            return;
        }
        const tile1 = this.pendingSuperWeaponTile ?? tile;
        const tile2 = this.pendingSuperWeaponTile ? tile : undefined;
        this.pendingSuperWeaponTile = undefined;
        this.makeSuperWeaponReady(superWeapon);
        runtime.game.traits
            .get(SuperWeaponsTrait)
            .activateSuperWeapon(rules.type, runtime.localPlayer, runtime.game, tile1, tile2);
        this.setSuperWeaponTargetingActive(false, `已触发 ${this.getSuperWeaponDisplayName(superWeapon.name)} @ ${tile1.rx},${tile1.ry}${tile2 ? ` -> ${tile2.rx},${tile2.ry}` : ''}。`);
    }

    private static handleSandboxShortcut(event: KeyboardEvent): boolean {
        if (event.repeat ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey ||
            this.isTextEditingEventTarget(event.target)) {
            return false;
        }
        if (event.key === 'Escape' && (this.state.placementActive || this.state.demolitionActive || this.state.superWeaponTargetingActive)) {
            event.preventDefault();
            event.stopPropagation();
            this.shiftPlacementActive = false;
            this.state.placementActive = false;
            this.state.demolitionActive = false;
            this.setSuperWeaponTargetingActive(false, '已取消当前临时模式。');
            return true;
        }
        const key = event.key.toLowerCase();
        const orderByKey = new Map<string, OrderType>([
            ['s', OrderType.Stop],
            ['g', OrderType.Guard],
            ['d', OrderType.DeploySelected],
            ['x', OrderType.Scatter],
        ]);
        if (key === 'h') {
            event.preventDefault();
            event.stopPropagation();
            this.centerOnHome();
            return true;
        }
        if (key === 'p') {
            event.preventDefault();
            event.stopPropagation();
            this.runtime?.worldInteraction?.unitSelectionHandler?.selectCombatants?.();
            this.setStatus('已选择本方战斗单位。');
            return true;
        }
        if (key === 'w') {
            event.preventDefault();
            event.stopPropagation();
            this.setSuperWeaponTargetingActive(!this.state.superWeaponTargetingActive);
            return true;
        }
        if (key === 'c') {
            event.preventDefault();
            event.stopPropagation();
            this.setDemolitionActive(!this.state.demolitionActive);
            return true;
        }
        const orderType = orderByKey.get(key);
        if (orderType !== undefined) {
            event.preventDefault();
            event.stopPropagation();
            this.executeKeyboardOrder(orderType);
            return true;
        }
        return false;
    }

    private static executeKeyboardOrder(orderType: OrderType): void {
        const runtime = this.runtime;
        if (!runtime) {
            return;
        }
        const selectedUnits = runtime.game.unitSelection
            .getSelectedUnits()
            .filter((unit: any) => unit.owner === runtime.localPlayer && !unit.rules.spawned);
        if (!selectedUnits.length) {
            this.setStatus(`${OrderType[orderType]} 未执行：没有选中的本方单位。`);
            return;
        }
        runtime.orderActionContext
            .getOrCreateSelection(runtime.localPlayer)
            .update(selectedUnits);
        const action = new OrderUnitsAction(
            runtime.game,
            runtime.game.map,
            runtime.orderActionContext,
            new OrderFactory(runtime.game, runtime.game.map),
        );
        action.player = runtime.localPlayer;
        action.orderType = orderType;
        action.target = undefined;
        action.process();
        runtime.orderAcceptedSerial += 1;
        this.setStatus(`已执行快捷键命令：${OrderType[orderType]}。`);
    }

    private static centerOnHome(): void {
        const runtime = this.runtime;
        if (!runtime) {
            return;
        }
        const tile = this.findHomeTile();
        if (!tile) {
            this.setStatus('H 回基地失败：没有找到本方建筑或单位。');
            return;
        }
        const mapPanningHelper = new MapPanningHelper(runtime.game.map);
        runtime.worldScene.cameraPan.setPan(mapPanningHelper.computeCameraPanFromTile(tile.rx, tile.ry));
        this.setStatus(`已回到基地视角 @ ${tile.rx},${tile.ry}。`);
    }

    private static findHomeTile(): any | undefined {
        const runtime = this.runtime;
        if (!runtime) {
            return undefined;
        }
        const owned = runtime.localPlayer.getOwnedObjects?.() ?? [];
        const building = owned.find((obj: any) => obj.isBuilding?.() && obj.tile);
        if (building) {
            return building.tile;
        }
        const baseUnit = owned.find((obj: any) => obj.isUnit?.() && runtime.game.rules.general.baseUnit.includes(obj.name));
        if (baseUnit) {
            return baseUnit.tile;
        }
        const ownedObjectTile = owned.find((obj: any) => obj.tile)?.tile;
        if (ownedObjectTile) {
            return ownedObjectTile;
        }
        const startLocation = runtime.game.map.startingLocations?.[runtime.localPlayer.startLocation];
        return startLocation
            ? runtime.game.map.tiles.getByMapCoords(startLocation.x, startLocation.y)
            : undefined;
    }

    private static setPlacementActive(active: boolean, message?: string): void {
        if (active) {
            this.state.demolitionActive = false;
            this.state.superWeaponTargetingActive = false;
            this.pendingSuperWeaponTile = undefined;
            this.runtime?.pointer?.setPointerType(PointerType.Default);
        }
        this.state.placementActive = active;
        this.updateWorldInteractionEnabled();
        this.setStatus(message ?? (active
            ? '放置模式已开启：在地图上左键放置，右键/按钮退出。'
            : '放置模式已关闭：可正常选择单位并右键移动/攻击。'));
        this.syncControls();
    }

    private static setSuperWeaponTargetingActive(active: boolean, message?: string): void {
        const available = this.getAvailableSuperWeapons();
        if (active && !available.length) {
            this.setStatus('没有可触发的超级武器：先放置一个超级武器建筑。');
            this.syncControls();
            return;
        }
        if (active) {
            this.state.placementActive = false;
            this.shiftPlacementActive = false;
            this.state.demolitionActive = false;
        }
        this.state.superWeaponTargetingActive = active;
        this.pendingSuperWeaponTile = undefined;
        this.updateWorldInteractionEnabled();
        if (active) {
            this.updateSuperWeaponPointer();
        }
        else {
            this.runtime?.pointer?.setPointerType(PointerType.Default);
        }
        this.setStatus(message ?? (active
            ? '超级武器瞄准：左键选择目标，右键取消。'
            : '已退出超级武器瞄准。'));
        this.syncControls();
    }

    private static setDemolitionActive(active: boolean, message?: string): void {
        if (active) {
            this.state.placementActive = false;
            this.state.superWeaponTargetingActive = false;
            this.shiftPlacementActive = false;
            this.pendingSuperWeaponTile = undefined;
        }
        this.state.demolitionActive = active;
        this.updateWorldInteractionEnabled();
        if (active) {
            this.updateDemolitionPointer(this.runtime?.pointer?.getPosition?.());
        }
        else {
            this.runtime?.pointer?.setPointerType(PointerType.Default);
        }
        this.setStatus(message ?? (active
            ? '拆除建筑模式已开启：左键点击建筑触发拆除动画，右键/Esc 退出。'
            : '拆除建筑模式已关闭。'));
        this.syncControls();
    }

    private static updateWorldInteractionEnabled(): void {
        this.runtime?.worldInteraction?.setEnabled?.(!this.state.placementActive && !this.state.demolitionActive && !this.state.superWeaponTargetingActive);
    }

    private static getTargetTileAtScreenPoint(pointer: { x: number; y: number }): any | undefined {
        const runtime = this.runtime;
        if (!runtime) {
            return undefined;
        }
        return this.getHighBridgeTileAtScreenPoint(pointer) ??
            runtime.tileHelper.getTileAtScreenPoint(pointer);
    }

    private static getHighBridgeTileAtScreenPoint(pointer: { x: number; y: number }): any | undefined {
        const runtime = this.runtime;
        if (!runtime) {
            return undefined;
        }
        const result = this.pickClosestBridgeTileByScreenPoint(this.collectHighBridgeCandidates(pointer), pointer);
        return result && result.distance <= this.maxBridgePickDistance
            ? result.tile
            : undefined;
    }

    private static collectHighBridgeCandidates(pointer: { x: number; y: number }): any[] {
        const runtime = this.runtime;
        if (!runtime) {
            return [];
        }
        const candidates: any[] = [];
        const seen = new Set<string>();
        const addTile = (tile: any): void => {
            if (!tile) {
                return;
            }
            const bridge = runtime.game.map.tileOccupation.getBridgeOnTile(tile);
            if (!bridge?.isHighBridge?.()) {
                return;
            }
            const key = `${tile.rx},${tile.ry}`;
            if (!seen.has(key)) {
                seen.add(key);
                candidates.push(tile);
            }
        };
        const addNearbyTiles = (tile: any, radius: number): void => {
            if (!tile) {
                return;
            }
            for (let dx = -radius; dx <= radius; dx += 1) {
                for (let dy = -radius; dy <= radius; dy += 1) {
                    addTile(runtime.game.map.tiles.getByMapCoords(tile.rx + dx, tile.ry + dy));
                }
            }
        };
        for (const tile of runtime.tileHelper.intersectTilesByScreenPos(pointer, 4)) {
            addNearbyTiles(tile, 1);
        }
        for (const tile of runtime.tileHelper.intersectTilesByScreenPos(pointer)) {
            addNearbyTiles(tile, this.bridgePickRadius);
        }
        addNearbyTiles(runtime.tileHelper.getTileAtScreenPoint(pointer), this.bridgePickRadius);
        return candidates;
    }

    private static pickClosestBridgeTileByScreenPoint(tiles: any[], pointer: { x: number; y: number }): { tile: any; distance: number } | undefined {
        const runtime = this.runtime;
        if (!runtime) {
            return undefined;
        }
        let closestTile: any;
        let closestDistance = Number.POSITIVE_INFINITY;
        const seen = new Set<string>();
        for (const tile of tiles) {
            if (!tile) {
                continue;
            }
            const key = `${tile.rx},${tile.ry}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            const bridge = runtime.game.map.tileOccupation.getBridgeOnTile(tile);
            if (!bridge) {
                continue;
            }
            const screenPoint = runtime.tileHelper.getTileCenterScreenPoint?.(tile, bridge.tileElevation ?? 0) ??
                this.getTileCenterScreenPoint(tile, bridge.tileElevation ?? 0);
            const distance = Math.hypot(pointer.x - screenPoint.x, pointer.y - screenPoint.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestTile = tile;
            }
        }
        if (!closestTile) {
            return undefined;
        }
        return { tile: closestTile, distance: closestDistance };
    }

    private static getTileCenterScreenPoint(tile: any, tileElevation: number): { x: number; y: number } {
        const runtime = this.runtime!;
        const viewport = runtime.worldScene.viewport;
        const origin = IsoCoords.worldToScreen(0, 0);
        const pan = runtime.worldScene.cameraPan.getPan();
        const screenPos = IsoCoords.tile3dToScreen(tile.rx + 0.5, tile.ry + 0.5, tile.z + tileElevation);
        return {
            x: screenPos.x - origin.x - pan.x + viewport.x + viewport.width / 2,
            y: screenPos.y - origin.y - pan.y + viewport.y + viewport.height / 2,
        };
    }

    private static updateDemolitionPointer(pointer: { x: number; y: number } | undefined): void {
        const runtime = this.runtime;
        if (!runtime || !this.state.demolitionActive) {
            return;
        }
        const building = pointer ? this.findDemolishableBuildingAtScreenPoint(pointer) : undefined;
        runtime.pointer.setPointerType(building ? PointerType.Sell : PointerType.NoSell);
    }

    private static findDemolishableBuildingAtScreenPoint(pointer: { x: number; y: number }): any | undefined {
        const runtime = this.runtime;
        if (!runtime) {
            return undefined;
        }
        const tiles = [
            runtime.tileHelper.getTileAtScreenPoint(pointer),
            this.getHighBridgeTileAtScreenPoint(pointer),
        ].filter((tile, index, all): tile is any => !!tile && all.indexOf(tile) === index);
        for (const tile of tiles) {
            const building = runtime.game.map
                .getObjectsOnTile(tile)
                .find((obj: any) => this.canDemolishBuilding(obj));
            if (building) {
                return building;
            }
        }
        return undefined;
    }

    private static canDemolishBuilding(obj: any): boolean {
        const runtime = this.runtime;
        return !!(runtime &&
            obj?.isBuilding?.() &&
            obj.isSpawned &&
            !obj.isDestroyed &&
            !obj.isCrashing &&
            obj.buildStatus !== BuildStatus.BuildDown &&
            !obj.rules?.invisibleInGame &&
            (obj.owner === runtime.localPlayer || obj.owner === runtime.enemyPlayer));
    }

    private static demolishBuilding(building: any): void {
        const runtime = this.runtime;
        if (!runtime || !this.canDemolishBuilding(building)) {
            this.setStatus('拆除失败：目标不是可拆除建筑。');
            return;
        }
        const objectLabel = this.resolveObjectDisplayName(runtime.game.rules, runtime.strings, ObjectType.Building, building.name);
        try {
            const worker = runtime.game.getConstructionWorker(building.owner);
            worker.unplace(building, () => {
                building.dispose?.();
                this.state.spawnedCount = Math.max(0, this.state.spawnedCount - 1);
                this.keepSandboxPlayersActive(runtime.game, runtime.localPlayer, runtime.enemyPlayer);
                this.setStatus(`已完成拆除 ${objectLabel}（${building.name}）。`);
                this.syncControls();
            });
            this.setStatus(`正在拆除 ${objectLabel}（${building.name}）：请观察 BuildDown 动画。`);
        }
        catch (error) {
            console.error('[SceneSandboxTester] Failed to demolish building', error);
            this.setStatus(`拆除建筑失败：${String(error)}`);
        }
    }

    private static executeLocalOrder(event: { orderType: number; target: any; feedbackType?: unknown }): void {
        const runtime = this.runtime;
        if (!runtime) {
            return;
        }
        const selectedUnits = runtime.game.unitSelection
            .getSelectedUnits()
            .filter((unit: any) => unit.owner === runtime.localPlayer && !unit.rules.spawned);
        if (!selectedUnits.length) {
            return;
        }
        try {
            runtime.orderActionContext
                .getOrCreateSelection(runtime.localPlayer)
                .update(selectedUnits);
            const action = new OrderUnitsAction(
                runtime.game,
                runtime.game.map,
                runtime.orderActionContext,
                new OrderFactory(runtime.game, runtime.game.map),
            );
            action.player = runtime.localPlayer;
            action.orderType = event.orderType;
            action.target = event.target;
            action.process();
            const acceptedUnits = selectedUnits.filter((unit: any) => !unit.unitOrderTrait?.isIdle?.());
            if (acceptedUnits.length) {
                runtime.orderAcceptedSerial += 1;
                this.setStatus(`已向 ${acceptedUnits.length} 个单位下达命令。`);
            }
            else {
                this.setStatus(`命令未被接受：当前选中 ${selectedUnits.length} 个本方单位。`);
            }
        }
        catch (error) {
            console.error('[SceneSandboxTester] Failed to execute local order', error);
            this.setStatus(`下达命令失败：${String(error)}`);
        }
    }

    private static spawnAt(targetTile: any): number {
        const runtime = this.runtime;
        if (!runtime || !this.state.objectName) {
            return 0;
        }
        const objectType = this.objectTypeForKind(this.state.kind);
        if (objectType === ObjectType.Building) {
            return this.spawnBuildingAt(targetTile);
        }
        const owner = this.state.owner === 'local' ? runtime.localPlayer : runtime.enemyPlayer;
        this.keepSandboxPlayersActive(runtime.game, runtime.localPlayer, runtime.enemyPlayer);
        const unitRules = runtime.game.rules.getObject(this.state.objectName, objectType);
        const objectLabel = this.resolveObjectDisplayName(runtime.game.rules, runtime.strings, objectType, this.state.objectName);
        const spawned: any[] = [];
        for (let index = 0; index < this.state.count; index += 1) {
            const unit = runtime.game.createUnitForPlayer(unitRules, owner);
            const tile = this.findSpawnTile(targetTile, unit, spawned.length);
            if (!tile) {
                unit.dispose?.();
                this.setStatus(`无法在 ${targetTile.rx},${targetTile.ry} 附近找到可放置位置。已生成 ${spawned.length}/${this.state.count}。`);
                break;
            }
            if (unit.isInfantry?.()) {
                unit.position.subCell = Infantry.SUB_CELLS[index % Infantry.SUB_CELLS.length];
            }
            this.applySpawnLayer(unit, tile);
            runtime.game.spawnObject(unit, tile);
            this.applySpawnState(unit);
            spawned.push(unit);
        }
        if (spawned.length && owner === runtime.localPlayer) {
            runtime.game.unitSelection.deselectAll();
            spawned.forEach((unit) => runtime.game.unitSelection.addToSelection(unit));
        }
        this.state.spawnedCount += spawned.length;
        this.setStatus(`已生成 ${spawned.length} 个 ${objectLabel}（${this.state.objectName}）@ ${targetTile.rx},${targetTile.ry}。`);
        this.keepSandboxPlayersActive(runtime.game, runtime.localPlayer, runtime.enemyPlayer);
        return spawned.length;
    }

    private static spawnBuildingAt(targetTile: any): number {
        const runtime = this.runtime;
        if (!runtime || !this.state.objectName) {
            return 0;
        }
        const owner = this.state.owner === 'local' ? runtime.localPlayer : runtime.enemyPlayer;
        this.keepSandboxPlayersActive(runtime.game, runtime.localPlayer, runtime.enemyPlayer);
        const worker = runtime.game.getConstructionWorker(owner);
        const buildingRules = runtime.game.rules.getObject(this.state.objectName, ObjectType.Building);
        const objectLabel = this.resolveObjectDisplayName(runtime.game.rules, runtime.strings, ObjectType.Building, this.state.objectName);
        const spawned: any[] = [];
        for (let index = 0; index < this.state.count; index += 1) {
            const tile = this.findBuildingSpawnTile(targetTile, worker, this.state.objectName, spawned.length);
            if (!tile) {
                this.setStatus(`无法在 ${targetTile.rx},${targetTile.ry} 附近找到可放置建筑的位置。已生成 ${spawned.length}/${this.state.count}。`);
                break;
            }
            const placedBuildings = worker.placeAt(buildingRules.name, tile, false);
            for (const building of placedBuildings) {
                this.applySpawnState(building);
                this.makeBuildingSuperWeaponReady(building);
                spawned.push(building);
            }
        }
        if (spawned.length && owner === runtime.localPlayer) {
            runtime.game.unitSelection.deselectAll();
            spawned.forEach((building) => runtime.game.unitSelection.addToSelection(building));
        }
        this.state.spawnedCount += spawned.length;
        this.setStatus(`已生成 ${spawned.length} 个 ${objectLabel}（${this.state.objectName}）@ ${targetTile.rx},${targetTile.ry}。`);
        this.keepSandboxPlayersActive(runtime.game, runtime.localPlayer, runtime.enemyPlayer);
        this.syncControls();
        return spawned.length;
    }

    private static findBuildingSpawnTile(targetTile: any, worker: any, buildingName: string, offset: number): any | undefined {
        const runtime = this.runtime;
        if (!runtime) {
            return undefined;
        }
        const canPlaceAtTile = (tile: any) => {
            try {
                return worker.canPlaceAt(buildingName, tile, { ignoreAdjacent: true });
            }
            catch {
                return false;
            }
        };
        if (offset === 0 && canPlaceAtTile(targetTile)) {
            return targetTile;
        }
        const foundation = runtime.game.art.getObject(buildingName, ObjectType.Building).foundation;
        const finder = new RadialTileFinder(
            runtime.game.map.tiles,
            runtime.game.map.mapBounds,
            targetTile,
            foundation,
            Math.max(0, offset > 0 ? 1 : 0),
            18,
            canPlaceAtTile,
        );
        return finder.getNextTile();
    }

    private static findSpawnTile(targetTile: any, unit: any, offset: number): any | undefined {
        const runtime = this.runtime;
        if (!runtime) {
            return undefined;
        }
        const canSpawnAtTile = (tile: any) => {
            if (!runtime.game.map.mapBounds.isWithinBounds(tile)) {
                return false;
            }
            const bridge = this.getBridgeForUnit(unit, tile);
            if (runtime.game.map.tileOccupation.getObjectsOnTile(tile).some((obj: any) => obj.isTechno?.() &&
                obj.zone === unit.zone &&
                !!obj.onBridge === !!bridge)) {
                return false;
            }
            if (unit.rules.speedType === undefined || unit.zone === ZoneType.Air) {
                return true;
            }
            return runtime.game.map.terrain.getPassableSpeed(tile, unit.rules.speedType, unit.isInfantry?.() ?? false, !!bridge) > 0 &&
                !runtime.game.map.terrain.findObstacles({ tile, onBridge: bridge }, unit).length;
        };
        if (offset === 0 && canSpawnAtTile(targetTile)) {
            return targetTile;
        }
        const finder = new RadialTileFinder(
            runtime.game.map.tiles,
            runtime.game.map.mapBounds,
            targetTile,
            unit.getFoundation?.() ?? { width: 1, height: 1 },
            Math.max(0, offset > 0 ? 1 : 0),
            10,
            canSpawnAtTile,
        );
        return finder.getNextTile();
    }

    private static getBridgeForUnit(unit: any, tile: any): any | undefined {
        const runtime = this.runtime;
        if (!runtime || unit.zone === ZoneType.Air) {
            return undefined;
        }
        return runtime.game.map.tileOccupation.getBridgeOnTile(tile);
    }

    private static applySpawnLayer(unit: any, tile: any): void {
        if (unit.zone === ZoneType.Air) {
            return;
        }
        const bridge = this.getBridgeForUnit(unit, tile);
        unit.onBridge = !!bridge;
        unit.zone = getZoneType(bridge ? tile.onBridgeLandType : tile.landType);
        unit.position.tileElevation = bridge?.tileElevation ?? 0;
    }

    private static applySpawnState(unit: any): void {
        if (unit.veteranTrait?.setVeteranLevel) {
            unit.veteranTrait.setVeteranLevel(this.state.veteranLevel);
        }
        if (unit.healthTrait) {
            unit.healthTrait.health = this.state.health === 'full'
                ? 100
                : this.state.health === 'half'
                    ? 50
                    : 20;
        }
    }

    private static makeBuildingSuperWeaponReady(building: any): void {
        const superWeapon = building.superWeaponTrait?.getSuperWeapon?.(building);
        if (superWeapon) {
            this.makeSuperWeaponReady(superWeapon);
        }
    }

    private static clearSpawnedObjects(): void {
        const runtime = this.runtime;
        if (!runtime) {
            return;
        }
        const objects = runtime.game.world.getAllObjects()
            .filter((obj: any) => obj.isTechno?.() &&
            (obj.isUnit?.() || obj.isBuilding?.()) &&
            (obj.owner === runtime.localPlayer || obj.owner === runtime.enemyPlayer));
        for (const obj of objects) {
            try {
                runtime.game.unspawnObject(obj);
                obj.dispose?.();
            }
            catch (error) {
                console.warn('[SceneSandboxTester] Failed to clear object', obj, error);
            }
        }
        runtime.game.unitSelection.deselectAll();
        this.state.spawnedCount = 0;
        this.setStatus('已清空沙盒生成的单位和建筑。');
        this.syncControls();
    }

    private static objectTypeForKind(kind: SpawnKind): ObjectType {
        switch (kind) {
            case 'infantry':
                return ObjectType.Infantry;
            case 'aircraft':
                return ObjectType.Aircraft;
            case 'building':
            case 'superweapon':
                return ObjectType.Building;
            case 'naval':
            default:
                return ObjectType.Vehicle;
        }
    }

    private static setStatus(message: string): void {
        this.state.lastMessage = message;
        this.updateStatus();
        this.syncState();
    }

    private static updateStatus(): void {
        const statusEl = this.runtime?.statusEl ?? document.querySelector('[data-testid="sandbox-status"]') as HTMLDivElement | null;
        if (!statusEl) {
            return;
        }
        statusEl.textContent = [
            this.state.lastMessage,
            `已生成：${this.state.spawnedCount}`,
            `速度：${this.state.tickMultiplier}x`,
            this.state.placementActive
                ? '当前：放置模式'
                : this.state.demolitionActive
                    ? '当前：拆除建筑'
                    : this.state.superWeaponTargetingActive
                        ? '当前：超级武器瞄准'
                        : '当前：正常交互',
        ].join('\n');
    }

    private static syncState(): void {
        TestToolSupport.setState('scene-sandbox', {
            kind: this.state.kind,
            objectName: this.state.objectName,
            owner: this.state.owner,
            veteranLevel: VeteranLevel[this.state.veteranLevel],
            health: this.state.health,
            count: this.state.count,
            placementActive: this.state.placementActive,
            demolitionActive: this.state.demolitionActive,
            superWeaponTargetingActive: this.state.superWeaponTargetingActive,
            activeSuperWeaponName: this.state.activeSuperWeaponName,
            panelCollapsed: this.state.panelCollapsed,
            tickMultiplier: this.state.tickMultiplier,
            spawnedCount: this.state.spawnedCount,
            message: this.state.lastMessage,
        });
    }

    private static removeBaseUnits(game: any, localPlayer: any, enemyPlayer: any): void {
        for (const player of [localPlayer, enemyPlayer]) {
            for (const obj of [...player.getOwnedObjects()]) {
                if (!obj.isUnit?.()) {
                    continue;
                }
                try {
                    game.unspawnObject(obj);
                    obj.dispose?.();
                }
                catch (error) {
                    console.warn('[SceneSandboxTester] Failed to remove starting unit', obj, error);
                }
            }
        }
    }

    private static disableSandboxEndConditions(game: any, localPlayer: any, enemyPlayer: any): void {
        game.checkGameEndConditions = () => undefined;
        game.updateDefeatedPlayers = () => undefined;
        this.keepSandboxPlayersActive(game, localPlayer, enemyPlayer);
    }

    private static keepSandboxPlayersActive(_game: any, localPlayer: any, enemyPlayer: any): void {
        for (const player of [localPlayer, enemyPlayer]) {
            player.defeated = false;
            player.isObserver = false;
        }
    }

    private static layoutMinimap(minimap: Minimap, viewport: { width: number; height: number }): void {
        const size = Math.max(120, Math.min(180, Math.floor(Math.min(viewport.width, viewport.height) * 0.22)));
        minimap.setFitSize({ width: size, height: size });
        minimap.setPosition(viewport.width - size - 16, 16);
        minimap.setZIndex(20);
    }

    private static getViewport(): { x: number; y: number; width: number; height: number } {
        return {
            x: 0,
            y: 0,
            width: Math.max(1024, window.innerWidth || 1024),
            height: Math.max(700, window.innerHeight || 700),
        };
    }

    private static findNamedIndex(values: string[], preferred: string[]): string {
        const lowered = values.map((value) => value.toLowerCase());
        for (const name of preferred) {
            const index = lowered.indexOf(name.toLowerCase());
            if (index >= 0) {
                return String(index);
            }
        }
        return '0';
    }

    static destroy(): void {
        TestToolSupport.clearState('scene-sandbox');
        if (this.gameTickTimer) {
            clearInterval(this.gameTickTimer);
            this.gameTickTimer = undefined;
        }
        this.uiAnimationLoop?.destroy();
        this.uiAnimationLoop = undefined;
        this.renderer?.dispose();
        this.renderer = undefined;
        this.runtime = undefined;
        this.shiftPlacementActive = false;
        this.state.demolitionActive = false;
        this.disposables.dispose();
    }
}
