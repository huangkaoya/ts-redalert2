import { CompositeDisposable } from '@/util/disposable/CompositeDisposable';
import { WorldScene } from '@/engine/renderable/WorldScene';
import { WorldViewportHelper } from '@/engine/util/WorldViewportHelper';
import { MapTileIntersectHelper } from '@/engine/util/MapTileIntersectHelper';
import { WorldSound } from '@/engine/sound/WorldSound';
import { Engine } from '@/engine/Engine';
import { MapPanningHelper } from '@/engine/util/MapPanningHelper';
import { IsoCoords } from '@/engine/IsoCoords';
import { ImageFinder } from '@/engine/ImageFinder';
import { MapRenderable } from '@/engine/renderable/entity/map/MapRenderable';
import { RenderableFactory } from '@/engine/renderable/entity/RenderableFactory';
import { RenderableManager } from '@/engine/RenderableManager';
import { ChronoFxHandler } from '@/engine/renderable/fx/handler/ChronoFxHandler';
import { Lighting } from '@/engine/Lighting';
import { LightingDirector } from '@/engine/gfx/lighting/LightingDirector';
import { WarheadDetonateFxHandler } from '@/engine/renderable/fx/handler/WarheadDetonateFxHandler';
import { SuperWeaponFxHandler } from '@/engine/renderable/fx/handler/SuperWeaponFxHandler';
import { CrateFxHandler } from '@/engine/renderable/fx/handler/CrateFxHandler';
import { BeaconFxHandler } from '@/engine/renderable/fx/handler/BeaconFxHandler';
import { VxlBuilderFactory } from '@/engine/renderable/builder/VxlBuilderFactory';
import { Coords } from '@/game/Coords';
export class WorldView {
    private disposables = new CompositeDisposable();
    private worldScene?: WorldScene;
    private worldSound?: WorldSound;
    private mapRenderable?: MapRenderable;
    private renderableManager?: RenderableManager;
    constructor(private hudDimensions: {
        width: number;
        height: number;
    }, private game: any, private sound: any, private renderer: any, private runtimeVars: any, private minimap: any, private strings: any, private generalOptions: any, private vxlGeometryPool: any, private buildingImageDataCache: any) { }
    init(localPlayer: any, viewport: any, theater: any): any {
        const mapScreenBounds = this.computeMapScreenBounds(this.game.map.mapBounds.getLocalSize());
        const worldViewport = this.computeWorldViewport(viewport, mapScreenBounds);
        try {
            console.log('[WorldView.init]', {
                hud: this.hudDimensions,
                viewport,
                mapScreenBounds,
                worldViewport
            });
        }
        catch { }
        const worldScene = WorldScene.factory(worldViewport, this.runtimeVars.freeCamera, this.generalOptions.graphics.shadows);
        this.disposables.add(worldScene);
        this.worldScene = worldScene;
        this.updatePanLimits(this.game.map, worldScene.cameraPan, worldViewport);
        const startLocationIndex = (!localPlayer || localPlayer.isObserver)
            ? this.game.getCombatants()[0].startLocation
            : localPlayer.startLocation;
        const startPos = this.game.map.startingLocations[startLocationIndex];
        const panningHelper = new MapPanningHelper(this.game.map);
        worldScene.cameraPan.setPan(panningHelper.computeCameraPanFromTile(startPos.x, startPos.y));
        try {
            console.log('[WorldView.init] startLocation', { startLocationIndex, startPos });
        }
        catch { }
        const fullSize = this.game.map.mapBounds.getFullSize();
        const lightFocus = IsoCoords.screenTileToWorld(fullSize.width / 2, fullSize.height / 2);
        worldScene.setLightFocusPoint(lightFocus.x, lightFocus.y);
        // Include ramps and elevated bridge surfaces that receive voxel shadows.
        worldScene.setShadowReceiverHeights(
            Coords.tileHeightToWorld(this.game.map.tiles.getMinTileHeight()),
            Coords.tileHeightToWorld(this.game.map.tiles.getMaxTileHeight() + 4)
        );
        const viewportHelper = new WorldViewportHelper(worldScene);
        const tileIntersectHelper = new MapTileIntersectHelper(this.game.map, worldScene);
        const playerShroud = localPlayer ? this.game.mapShroudTrait.getPlayerShroud(localPlayer) : undefined;
        const worldSound = new WorldSound(this.sound, localPlayer, playerShroud, viewportHelper, tileIntersectHelper, this.game.getWorld(), worldScene as any, this.renderer);
        worldSound.init();
        this.disposables.add(worldSound, () => (this.worldSound = undefined));
        this.worldSound = worldSound;
        const lighting = new Lighting(this.game.mapLightingTrait);
        this.disposables.add(lighting);
        worldScene.applyLighting(lighting);
        const lightingDirector = new LightingDirector(lighting, this.renderer, this.game.speed);
        lightingDirector.init();
        this.disposables.add(lightingDirector);
        const images = Engine.getImages();
        const voxels = Engine.getVoxels();
        const voxelAnims = Engine.getVoxelAnims();
        const palettes = Engine.getPalettes();
        const imageFinder = new ImageFinder(images as any, theater);
        const mapRenderable = new MapRenderable(this.game.map, playerShroud, this.game.mapRadiationTrait, lighting, theater, this.game.rules, this.game.art, imageFinder, worldScene.camera, this.runtimeVars.debugWireframes, this.game.speed, worldSound, true);
        (worldScene as any).add(mapRenderable as any);
        try {
            console.log('[WorldView.init] MapRenderable added');
        }
        catch { }
        const debugRoot = ((window as any).__ra2debug ??= {});
        debugRoot.worldView = this;
        debugRoot.worldScene = worldScene;
        debugRoot.mapRenderable = mapRenderable;
        debugRoot.game = this.game;
        debugRoot.theater = theater;
        this.disposables.add(mapRenderable, () => (this.mapRenderable = undefined));
        this.mapRenderable = mapRenderable;
        const useInstancing = this.renderer.supportsInstancing?.() ?? false;
        const vxlBuilderFactory = new VxlBuilderFactory(this.vxlGeometryPool, useInstancing, worldScene.camera);
        const renderableFactory = new RenderableFactory(localPlayer, this.game.getUnitSelection(), this.game.alliances, this.game.rules, this.game.art, mapRenderable, imageFinder, palettes, voxels, voxelAnims, theater, worldScene.camera, lighting, lightingDirector as any, this.runtimeVars.debugWireframes, this.runtimeVars.debugText, this.game.speed, worldSound, this.strings, this.generalOptions.flyerHelper, this.generalOptions.hiddenObjects, vxlBuilderFactory, this.buildingImageDataCache, true, useInstancing);
        const renderableManager = new RenderableManager(this.game.getWorld(), worldScene, worldScene.camera as any, renderableFactory);
        renderableManager.init();
        this.disposables.add(renderableManager, () => (this.renderableManager = undefined));
        this.renderableManager = renderableManager;
        const chronoFx = new ChronoFxHandler(this.game, renderableManager as any);
        chronoFx.init();
        this.disposables.add(chronoFx);
        const warheadFx = new WarheadDetonateFxHandler(this.game, renderableManager as any);
        warheadFx.init();
        this.disposables.add(warheadFx);
        const superWeaponFxHandler = new SuperWeaponFxHandler(this.game, renderableManager as any, lightingDirector as any);
        superWeaponFxHandler.init();
        this.disposables.add(superWeaponFxHandler);
        const crateFxHandler = new CrateFxHandler(this.game, renderableManager as any);
        crateFxHandler.init();
        this.disposables.add(crateFxHandler);
        const beaconFxHandler = new BeaconFxHandler(this.game, localPlayer, renderableManager as any, this.renderer, worldSound);
        beaconFxHandler.init();
        this.disposables.add(beaconFxHandler);
        const handleLightingChange = (lightingData: any) => {
            worldScene.applyLighting(lighting);
            renderableManager.updateLighting();
            mapRenderable.updateLighting(lightingData);
        };
        lighting.onChange.subscribe(handleLightingChange);
        this.disposables.add(() => lighting.onChange.unsubscribe(handleLightingChange));
        this.minimap.initWorld(worldScene);
        const onBoundsResize = () => {
            this.handleMapBoundsOrViewportChange(viewport);
            this.minimap.forceRerender();
        };
        this.game.map.mapBounds.onLocalResize.subscribe(onBoundsResize);
        this.disposables.add(() => this.game.map.mapBounds.onLocalResize.unsubscribe(onBoundsResize));
        return {
            worldScene,
            worldSound,
            renderableManager,
            superWeaponFxHandler,
            beaconFxHandler
        };
    }
    handleViewportChange(viewport: any): void {
        this.handleMapBoundsOrViewportChange(viewport);
    }
    changeLocalPlayer(player: any): void {
        const shroud = player ? this.game.mapShroudTrait.getPlayerShroud(player) : undefined;
        this.worldSound?.changeLocalPlayer(player, shroud);
        this.mapRenderable?.setShroud(shroud);
    }
    private handleMapBoundsOrViewportChange(viewport: any): void {
        if (!this.worldScene)
            return;
        const mapScreenBounds = this.computeMapScreenBounds(this.game.map.mapBounds.getLocalSize());
        const newViewport = this.computeWorldViewport(viewport, mapScreenBounds);
        this.worldScene.updateViewport(newViewport);
        this.updatePanLimits(this.game.map, this.worldScene.cameraPan, newViewport);
    }
    private computeWorldViewport(viewport: any, mapScreenBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) {
        const availWidth = Math.max(1, viewport.width - this.hudDimensions.width);
        const availHeight = Math.max(1, viewport.height - this.hudDimensions.height);
        const width = Math.max(1, Math.min(mapScreenBounds.width, availWidth));
        const height = Math.max(1, Math.min(mapScreenBounds.height, availHeight));
        return {
            x: viewport.x,
            y: viewport.y,
            width,
            height,
        };
    }
    private updatePanLimits(map: any, cameraPan: any, worldViewport: any): void {
        const p = new MapPanningHelper(map);
        const mapScreenBounds = this.computeMapScreenBounds(map.mapBounds.getLocalSize());
        cameraPan.setPanLimits(p.computeCameraPanLimits(worldViewport, mapScreenBounds));
    }
    private computeMapScreenBounds(localSize: {
        x: number;
        y: number;
        width: number;
        height: number;
    }) {
        const topLeft = IsoCoords.screenTileToScreen(localSize.x, localSize.y);
        const bottomRight = IsoCoords.screenTileToScreen(localSize.x + localSize.width, localSize.y + localSize.height - 1);
        return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
    }
    dispose(): void {
        this.disposables.dispose();
    }
}
