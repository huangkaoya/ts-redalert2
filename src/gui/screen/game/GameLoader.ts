import { DataStream } from '@/data/DataStream';
import { OperationCanceledError } from '@puzzl/core/lib/async/cancellation';
import { ResourceType, theaterSpecificResources } from '@/engine/resourceConfigs';
import { Engine } from '@/engine/Engine';
import { TheaterType } from '@/engine/TheaterType';
import { sleep } from '@/util/time';
import { SideType } from '@/game/SideType';
import { Coords } from '@/game/Coords';
import { IsoCoords } from '@/engine/IsoCoords';
import { ObjectType } from '@/engine/type/ObjectType';
import { ImageFinder, MissingImageError } from '@/engine/ImageFinder';
import { ShpBuilder } from '@/engine/renderable/builder/ShpBuilder';
import { PipOverlay } from '@/engine/renderable/entity/PipOverlay';
import { CanvasSpriteBuilder } from '@/engine/renderable/builder/CanvasSpriteBuilder';
import { TileSets } from '@/game/theater/TileSets';
import { GameFactory } from '@/game/GameFactory';
import { TrailerSmokeFx } from '@/engine/renderable/fx/TrailerSmokeFx';
import { ShpAggregator } from '@/engine/renderable/builder/ShpAggregator';
import { BuildingShpHelper } from '@/engine/renderable/entity/building/BuildingShpHelper';
import { BuildingAnimArtProps } from '@/engine/renderable/entity/building/BuildingAnimArtProps';
import { isBetween } from '@/util/math';
import { MixFile } from '@/data/MixFile';
import { isIpad } from '@/util/userAgent';
import { GameOptRandomGen } from '@/game/gameopts/GameOptRandomGen';
import { DebugRenderable } from '@/engine/renderable/DebugRenderable';
import { MixinRules } from '@/game/ini/MixinRules';
import { isNotNullOrUndefined } from '@/util/typeGuard';
import * as GameApi from '@/game/api';
export class GameLoader {
    constructor(private appVersion: string, private workerHostApi: any, private cdnResourceLoader: any, private appResourceLoader: any, private rules: any, private gameModes: any, private sound: any, private iniLogger: any, private actionLogger: any, private speedCheat: any, private gameResConfig: any, private vxlGeometryPool: any, private buildingImageDataCache: any, private debugBotIndex: any, private devMode: boolean) { }
    async load(gameId: string, timestamp: number, gameOptions: any, mapFile: any, playerName: string, isSinglePlayer: boolean, loadingScreenApi: any, cancellationToken?: any): Promise<any> {
        const loadingPlayerInfos = this.resolveLoadingPlayerInfos(gameId, timestamp, gameOptions);
        loadingScreenApi.start(loadingPlayerInfos, gameOptions.mapTitle, playerName);
        try {
            this.workerHostApi?.warmUpPool?.();
            return await this.doLoad(gameId, timestamp, gameOptions, mapFile, playerName, isSinglePlayer, loadingScreenApi, cancellationToken);
        }
        finally {
            this.workerHostApi?.dispose?.();
        }
    }
    private resolveLoadingPlayerInfos(gameId: string, timestamp: number, gameOptions: any): any[] {
        const randomGen = GameOptRandomGen.factory(gameId, timestamp);
        const generatedColors = randomGen.generateColors(gameOptions);
        const generatedCountries = randomGen.generateCountries(gameOptions, this.rules);
        return gameOptions.humanPlayers.map((player: any) => ({
            ...player,
            colorId: generatedColors.get(player) ?? player.colorId,
            countryId: generatedCountries.get(player) ?? player.countryId,
        }));
    }
    private async doLoad(gameId: string, timestamp: number, gameOptions: any, mapFile: any, playerName: string, isSinglePlayer: boolean, loadingScreenApi: any, cancellationToken?: any): Promise<any> {
        if (!Engine.vfs) {
            throw new Error('Virtual File System not initialized');
        }
        this.clearStaticCaches();
        this.buildingImageDataCache.clear();
        try {
            if (!Engine.getActiveMod()) {
                await this.loadFestiveAssets(cancellationToken);
            }
        }
        catch (error) {
            if (error instanceof OperationCanceledError)
                throw error;
            console.error("Couldn't load festive assets", error);
        }
        await this.loadTheater(mapFile.theaterType, cancellationToken, (percent) => loadingScreenApi.onLoadProgress((percent / 100) * 30));
        await sleep(1);
        const botsLib = await this.loadBotsLib();
        if (!this.devMode && botsLib.version !== this.appVersion) {
            throw new Error(`Bot library version mismatch. Expected ${this.appVersion}, but got ${botsLib.version}`);
        }
        const { game, theater } = await this.createGame(gameId, timestamp, gameOptions, mapFile, isSinglePlayer, botsLib);
        let hudSide = SideType.GDI;
        let localPlayer: any;
        if (playerName) {
            localPlayer = game.getPlayerByName(playerName);
            if (!localPlayer.isObserver) {
                hudSide = localPlayer.country.side;
            }
        }
        let cdnResources: any;
        if (this.gameResConfig.isCdn()) {
            cdnResources = await this.cdnResourceLoader.loadResources([
                ResourceType.Sounds,
                ...(hudSide === SideType.GDI
                    ? [ResourceType.EvaAlly, ResourceType.UiAlly]
                    : [ResourceType.EvaSov, ResourceType.UiSov]),
                ResourceType.Cameo,
            ], cancellationToken, (percent) => loadingScreenApi.onLoadProgress(30 + (percent / 100) * 15));
        }
        if (cdnResources) {
            Engine.vfs.addArchive(new MixFile(new DataStream(cdnResources.pop(ResourceType.Cameo))), this.cdnResourceLoader.getResourceFileName(ResourceType.Cameo));
            await Engine.vfs.addMixFile('cameocd.mix');
        }
        const cameoFilenames = this.collectCameoFileNames(game);
        await this.loadHudSideImages(cdnResources, hudSide);
        loadingScreenApi.onLoadProgress(40);
        await sleep(1);
        if (cdnResources) {
            const soundResources = [
                ResourceType.Sounds,
                hudSide === SideType.GDI ? ResourceType.EvaAlly : ResourceType.EvaSov,
            ];
            for (const resourceType of soundResources) {
                Engine.vfs.addArchive(new MixFile(new DataStream(cdnResources.pop(resourceType))), this.cdnResourceLoader.getResourceFileName(resourceType));
            }
            await Engine.vfs.addBagFile('audio.bag');
        }
        loadingScreenApi.onLoadProgress(45);
        await sleep(1);
        const isMobile = /iPhone|Android|CrOS|Windows Phone|webOS/i.test(navigator.userAgent) || isIpad();
        if (!isMobile) {
            console.time('Load sounds');
            await this.prepareSounds(cancellationToken, (percent) => loadingScreenApi.onLoadProgress(45 + (percent / 100) * 15));
            console.timeEnd('Load sounds');
        }
        loadingScreenApi.onLoadProgress(60);
        await sleep(1);
        if (!isMobile) {
            const images = Engine.getImages();
            const imageFinder = new ImageFinder(images as any, theater);
            console.time('Load textures');
            await this.prepareTextures(game.rules, game.art, mapFile, imageFinder, cancellationToken, (percent) => loadingScreenApi.onLoadProgress(60 + (percent / 100) * 10));
            console.timeEnd('Load textures');
        }
        loadingScreenApi.onLoadProgress(70);
        await sleep(1);
        console.time('Load voxels');
        await this.prepareVxlGeometries(game.rules, game.art, game.map, Engine.getVoxels(), cancellationToken, (percent) => loadingScreenApi.onLoadProgress(70 + (percent / 100) * 20));
        console.timeEnd('Load voxels');
        await sleep(1);
        cancellationToken?.throwIfCancelled();
        IsoCoords.init({
            x: 0,
            y: (game.map.mapBounds.getFullSize().width * Coords.getWorldTileSize()) / 2,
        });
        game.init(localPlayer);
        cancellationToken?.throwIfCancelled();
        loadingScreenApi.onLoadProgress(95);
        await sleep(1);
        return { game, theater, hudSide, cameoFilenames };
    }
    private collectCameoFileNames(game: any): string[] {
        const filenames: string[] = [];
        const objects = [
            ...game.rules.buildingRules.values(),
            ...game.rules.infantryRules.values(),
            ...game.rules.vehicleRules.values(),
            ...game.rules.aircraftRules.values(),
        ];
        for (const obj of objects) {
            if (game.art.hasObject(obj.name, obj.type)) {
                const artObj = game.art.getObject(obj.name, obj.type);
                filenames.push(artObj.cameo + '.shp');
                filenames.push(artObj.altCameo + '.shp');
            }
        }
        for (const superWeapon of game.rules.superWeaponRules.values()) {
            if (superWeapon.sidebarImage.length) {
                filenames.push(superWeapon.sidebarImage + '.shp');
            }
        }
        const filteredFilenames = filenames.filter(filename => Engine.getImages().has(filename));
        return [...new Set(filteredFilenames)];
    }
    private async prepareSounds(cancellationToken?: any, onProgress?: (percent: number) => void): Promise<void> {
        const soundFiles = new Set<any>();
        for (const soundSpec of this.sound.soundSpecs.getAll()) {
            for (const soundName of soundSpec.sounds) {
                const wavFile = this.sound.getWavFile(soundName);
                if (wavFile && wavFile.isRawImaAdpcm()) {
                    soundFiles.add(wavFile);
                }
            }
        }
        let processed = 0;
        const total = soundFiles.size;
        if (total > 0) {
            if (!this.workerHostApi || !this.workerHostApi.concurrency) {
                return;
            }
            const sortedFiles = [...soundFiles].sort((a, b) => a.getRawData().length - b.getRawData().length);
            const concurrency = this.workerHostApi.concurrency;
            try {
                for (let i = 0; i < concurrency; i++) {
                    this.workerHostApi.queueTask(async (worker) => {
                        while (sortedFiles.length && !cancellationToken?.isCancelled()) {
                            const file = sortedFiles.pop()!;
                            const rawData = file.getRawData();
                            const decodedData = await worker.decodeWav(rawData);
                            file.setData(decodedData);
                            processed++;
                            const progress = (processed / total) * 100;
                            if (Math.floor(progress) % 10 === 0) {
                                onProgress?.((processed / total) * 100);
                            }
                        }
                    });
                }
                await Promise.resolve();
                await this.workerHostApi.waitForTasks?.();
                cancellationToken?.throwIfCancelled();
            }
            catch (error) {
                if (error instanceof OperationCanceledError)
                    throw error;
                console.error(error);
            }
        }
    }
    private async loadTheater(theaterType: TheaterType, cancellationToken?: any, onProgress?: (percent: number) => void): Promise<void> {
        if (this.gameResConfig.isCdn()) {
            const theaterResources = theaterSpecificResources.get(theaterType);
            if (!theaterResources) {
                throw new Error(`Unhandled theater type ${TheaterType[theaterType]}`);
            }
            const resourceTypes = [
                ResourceType.BuildGen,
                ResourceType.Anims,
                ResourceType.Vxl,
                ...theaterResources,
            ];
            const resources = await this.cdnResourceLoader.loadResources(resourceTypes, cancellationToken, (percent) => onProgress?.((percent / 100) * 60));
            for (const resourceType of resourceTypes) {
                Engine.vfs.addArchive(new MixFile(new DataStream(resources.pop(resourceType))), this.cdnResourceLoader.getResourceFileName(resourceType));
            }
        }
        else {
            onProgress?.(100);
        }
    }
    private async createGame(gameId: string, timestamp: number, gameOptions: any, mapFile: any, isSinglePlayer: boolean, botsLib: any): Promise<{
        game: any;
        theater: any;
    }> {
        const rulesIni = Engine.getIni(this.gameModes.getById(gameOptions.gameMode).rulesOverride);
        const mixinRulesInis = MixinRules.getTypes(gameOptions)
            .map(type => Engine.mixinRulesFileNames.get(type))
            .filter(isNotNullOrUndefined)
            .map(fileName => Engine.getIni(fileName));
        const theater = await Engine.loadTheater(mapFile.theaterType);
        const activeEngine = Engine.getActiveEngine();
        const theaterSettings = Engine.getTheaterSettings(activeEngine, mapFile.theaterType);
        const theaterIni = Engine.getTheaterIni(activeEngine, mapFile.theaterType);
        const tileSets = new TileSets(theaterIni);
        tileSets.loadTileData(Engine.getTileData(), theaterSettings.extension);
        const game = GameFactory.create(mapFile, tileSets, Engine.getRules(), Engine.getArt(), Engine.getAi(), rulesIni, mixinRulesInis, gameId, timestamp, gameOptions, this.gameModes, isSinglePlayer, botsLib, this.iniLogger, this.speedCheat, this.debugBotIndex, this.actionLogger);
        return { game, theater };
    }
    private async loadBotsLib(): Promise<any> {
        // Replays do not record AI decisions. Always use the checked-in official
        // v0.85 bundle so a newer SystemJS/CDN package cannot change AI behavior.
        const botsLib = await this.loadAmdBotsLib();
        if (!botsLib?.SupalosaBot) {
            throw new Error('The official v0.85 bot bundle did not export SupalosaBot');
        }
        console.info('[GameLoader] Loaded the pinned Chrono Divide v0.85 SupalosaBot bundle.');
        return botsLib;
    }
    private loadAmdBotsLib(): Promise<any> {
        return new Promise((resolve, reject) => {
            const win = window as any;
            const previousDefine = win.define;
            const script = document.createElement('script');
            let settled = false;
            const timeout = window.setTimeout(() => finish(new Error('Timed out loading the v0.85 bot library')), 15000);
            const restore = () => {
                window.clearTimeout(timeout);
                script.remove();
                if (win.define === define) {
                    if (previousDefine === undefined) {
                        delete win.define;
                    }
                    else {
                        win.define = previousDefine;
                    }
                }
            };
            const finish = (error?: Error, value?: any) => {
                if (settled) {
                    return;
                }
                settled = true;
                restore();
                if (error) {
                    reject(error);
                }
                else {
                    resolve(value);
                }
            };
            const define = (moduleName: string, dependencies: string[], factory: (...modules: any[]) => any) => {
                if (moduleName !== 'SPBots') {
                    finish(new Error(`Unexpected AMD module "${moduleName}" from the bot bundle`));
                    return;
                }
                try {
                    const modules = dependencies.map((dependency) => {
                        if (dependency === '@chronodivide/game-api') {
                            return GameApi;
                        }
                        throw new Error(`Unsupported bot library dependency "${dependency}"`);
                    });
                    finish(undefined, factory(...modules));
                }
                catch (error) {
                    finish(error instanceof Error ? error : new Error(String(error)));
                }
            };
            define.amd = {};
            win.define = define;
            script.async = true;
            script.src = '/res/spbots-v0.85.0.min.js';
            script.onerror = () => finish(new Error('Failed to load the local v0.85 bot library'));
            script.onload = () => {
                if (!settled) {
                    finish(new Error('The v0.85 bot bundle did not register its AMD module'));
                }
            };
            document.head.appendChild(script);
        });
    }
    private async loadHudSideImages(cdnResources?: any, hudSide: SideType = SideType.GDI): Promise<void> {
        if (!Engine.vfs)
            throw new Error('VFS is not initialized');
        Engine.vfs.removeArchive('sidec01.mix');
        Engine.vfs.removeArchive('sidec02.mix');
        Engine.vfs.removeArchive('sidec01cd.mix');
        Engine.vfs.removeArchive('sidec02cd.mix');
        Engine.unloadSideMixData();
        if (cdnResources) {
            const resourceType = hudSide === SideType.GDI ? ResourceType.UiAlly : ResourceType.UiSov;
            const fileName = this.cdnResourceLoader.getResourceFileName(resourceType);
            if (!['sidec01.mix', 'sidec02.mix'].includes(fileName)) {
                throw new Error(`Side mix file name "${fileName}" mismatch`);
            }
            Engine.vfs.addArchive(new MixFile(new DataStream(cdnResources.pop(resourceType))), fileName);
        }
        else {
            await Engine.vfs.addMixFile(hudSide === SideType.GDI ? 'sidec01.mix' : 'sidec02.mix');
        }
        await Engine.vfs.addMixFile(hudSide === SideType.GDI ? 'sidec01cd.mix' : 'sidec02cd.mix');
    }
    private async prepareTextures(rules: any, art: any, mapFile: any, imageFinder: ImageFinder, cancellationToken?: any, onProgress?: (percent: number) => void): Promise<void> {
        const buildingShpHelper = new BuildingShpHelper(imageFinder);
        const shpAggregator = new ShpAggregator();
        const animationShpFiles = new Set<string>();
        let lastProgressTime = performance.now();
        const structuresOnMap = new Set<string>();
        for (const structure of mapFile.structures) {
            structuresOnMap.add(structure.name);
        }
        const buildingsToLoad: string[] = [];
        for (const [name, building] of rules.buildingRules) {
            if (structuresOnMap.has(name) || building.techLevel !== -1) {
                buildingsToLoad.push(name);
            }
        }
        let processed = 0;
        const total = buildingsToLoad.length + rules.animationNames.size;
        for (const buildingName of buildingsToLoad) {
            cancellationToken?.throwIfCancelled();
            const now = performance.now();
            if (now - lastProgressTime > 1000) {
                lastProgressTime = now;
                onProgress?.((processed / total) * 100);
                await sleep(0);
            }
            processed++;
            if (!this.buildingImageDataCache.has(buildingName) && art.hasObject(buildingName, ObjectType.Building)) {
                const artObject = art.getObject(buildingName, ObjectType.Building);
                if (!artObject.demandLoad) {
                    const animProps = new BuildingAnimArtProps();
                    animProps.read(artObject.art, art);
                    for (const animList of animProps.getAll().values()) {
                        for (const anim of animList) {
                            animationShpFiles.add(anim.name);
                        }
                    }
                    try {
                        const mainShp = imageFinder.findByObjectArt(artObject);
                        const bibShp = artObject.bibShape
                            ? imageFinder.find(artObject.bibShape, artObject.useTheaterExtension)
                            : undefined;
                        const animShps = buildingShpHelper.collectAnimShpFiles(animProps as any, artObject);
                        const frameInfos = buildingShpHelper.getShpFrameInfos(artObject, mainShp, bibShp, animShps as any);
                        const aggregatedShp = shpAggregator.aggregate([...frameInfos.values()], `agg_${buildingName}.shp`);
                        this.buildingImageDataCache.set(buildingName, aggregatedShp);
                        ShpBuilder.prepareTexture(aggregatedShp.file);
                    }
                    catch (error) {
                        if (error instanceof MissingImageError) {
                            continue;
                        }
                        throw error;
                    }
                }
            }
        }
        for (const animName of rules.animationNames) {
            cancellationToken?.throwIfCancelled();
            const now = performance.now();
            if (now - lastProgressTime > 1000) {
                lastProgressTime = now;
                onProgress?.((processed / total) * 100);
                await sleep(0);
            }
            processed++;
            if (!animationShpFiles.has(animName) && art.hasObject(animName, ObjectType.Animation)) {
                const animation = art.getAnimation(animName);
                try {
                    const shpFile = imageFinder.findByObjectArt(animation);
                    ShpBuilder.prepareTexture(shpFile);
                }
                catch (error) {
                    if (error instanceof MissingImageError) {
                        continue;
                    }
                    throw error;
                }
            }
        }
    }
    private async prepareVxlGeometries(rules: any, art: any, gameMap: any, voxels: any, cancellationToken?: any, onProgress?: (percent: number) => void): Promise<void> {
        if (!this.workerHostApi || !this.workerHostApi.concurrency) {
            return;
        }
        const objectsToLoad = new Set([
            ...rules.vehicleRules.values(),
            ...rules.aircraftRules.values(),
            ...rules.buildingRules.values(),
        ].filter(obj => (obj.techLevel !== -1 || obj.spawned) && art.hasObject(obj.name, obj.type)));
        for (const building of rules.buildingRules.values()) {
            if (building.freeUnit) {
                if (rules.hasObject(building.freeUnit, ObjectType.Vehicle)) {
                    const freeUnit = rules.getObject(building.freeUnit, ObjectType.Vehicle);
                    objectsToLoad.add(freeUnit);
                }
            }
            if (building.undeploysInto && rules.hasObject(building.undeploysInto, ObjectType.Vehicle)) {
                objectsToLoad.add(rules.getObject(building.undeploysInto, ObjectType.Vehicle));
            }
        }
        for (const techno of gameMap.getInitialMapObjects().technos) {
            if ((techno.isVehicle() || techno.isAircraft()) && rules.hasObject(techno.name, techno.type)) {
                objectsToLoad.add(rules.getObject(techno.name, techno.type));
            }
        }
        const vxlFiles = new Map<string, any>();
        for (const obj of objectsToLoad) {
            const artObj = art.getObject(obj.name, obj.type);
            if (artObj.isVoxel || (obj.type === ObjectType.Building && obj.turretAnimIsVoxel)) {
                const imageName = artObj.imageName.toLowerCase();
                const filesToAdd: string[] = [];
                if (obj.type !== ObjectType.Building) {
                    filesToAdd.push(`${imageName}.vxl`);
                    if (obj.spawns && obj.noSpawnAlt) {
                        filesToAdd.push(`${imageName}wo.vxl`);
                    }
                    if (obj.harvester && obj.unloadingClass && rules.hasObject(obj.unloadingClass, ObjectType.Vehicle)) {
                        const unloadingUnit = rules.getObject(obj.unloadingClass, ObjectType.Vehicle);
                        filesToAdd.push(`${unloadingUnit.imageName.toLowerCase()}.vxl`);
                    }
                    if (obj.turret) {
                        for (let i = 0; i < obj.turretCount; ++i) {
                            filesToAdd.push(`${imageName}tur${i || ''}.vxl`);
                        }
                        const barrelFile = `${imageName}barl.vxl`;
                        if (voxels.has(barrelFile)) {
                            filesToAdd.push(barrelFile);
                        }
                    }
                }
                else if (obj.turretAnimIsVoxel) {
                    const turretFile = `${obj.turretAnim.toLowerCase()}.vxl`;
                    filesToAdd.push(turretFile);
                    const barrelFile = turretFile.replace('tur', 'barl');
                    if (voxels.has(barrelFile)) {
                        filesToAdd.push(barrelFile);
                    }
                }
                for (const filename of filesToAdd) {
                    const vxlFile = voxels.get(filename);
                    if (vxlFile) {
                        vxlFiles.set(filename, vxlFile);
                    }
                }
            }
        }
        let loaded = 0;
        const filesToGenerate: Array<[
            string,
            any
        ]> = [];
        for (const [filename, vxlFile] of vxlFiles) {
            cancellationToken?.throwIfCancelled();
            if (await this.vxlGeometryPool.loadFromStorage(vxlFile, filename)) {
                loaded++;
                onProgress?.((loaded / vxlFiles.size) * 100);
            }
            else {
                filesToGenerate.push([filename, vxlFile]);
            }
        }
        if (filesToGenerate.length > 0) {
            filesToGenerate.sort((a, b) => b[1].voxelCount - a[1].voxelCount);
            const concurrency = this.workerHostApi.concurrency;
            const modelQuality = this.vxlGeometryPool.getModelQuality();
            const persistTasks: Array<() => void> = [() => this.vxlGeometryPool.clearOtherModStorage()];
            try {
                for (let i = 0; i < concurrency; i++) {
                    this.workerHostApi.queueTask(async (worker) => {
                        while (filesToGenerate.length && !cancellationToken?.isCancelled()) {
                            const [filename, vxlFile] = filesToGenerate.pop()!;
                            const geometry = await worker.generateVxlGeometry(vxlFile, modelQuality);
                            persistTasks.push(() => this.vxlGeometryPool.persistToStorage(vxlFile, filename, geometry));
                            loaded++;
                            onProgress?.((loaded / vxlFiles.size) * 100);
                        }
                    });
                }
                await this.workerHostApi.waitForTasks();
                cancellationToken?.throwIfCancelled();
            }
            catch (error) {
                if (error instanceof OperationCanceledError)
                    throw error;
                console.error(error);
                console.warn('Failed to pre-load VXL geometries. Skipping.');
            }
            await Promise.all(persistTasks.map(task => task())).catch(error => console.warn('Failed to persist VXL geometry cache', [error]));
        }
    }
    private async loadFestiveAssets(cancellationToken?: any): Promise<void> {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        let festiveResource: ResourceType | undefined;
        if ((month === 10 && isBetween(day, 24, 31)) || (month === 11 && isBetween(day, 1, 6))) {
            festiveResource = ResourceType.HalloweenMix;
        }
        else if (month === 12 && isBetween(day, 16, 31)) {
            festiveResource = ResourceType.XmasMix;
        }
        if (festiveResource !== undefined) {
            const fileName = this.appResourceLoader.getResourceFileName(festiveResource);
            if (!Engine.vfs.hasArchive(fileName)) {
                const resources = await this.appResourceLoader.loadResources([festiveResource], cancellationToken);
                const resourceData = resources.pop(festiveResource);
                const mixFile = new MixFile(new DataStream(resourceData));
                Engine.vfs.addArchive(mixFile, fileName);
            }
        }
    }
    clearStaticCaches(): void {
        PipOverlay.clearCaches();
        ShpBuilder.clearCaches();
        DebugRenderable.clearCaches();
        CanvasSpriteBuilder.clearCaches();
        TrailerSmokeFx.clearTextureCache();
    }
}
