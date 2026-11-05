import { rectIntersect } from '@/util/geometry';
import { ObjectType } from '@/engine/type/ObjectType';
import { SpeedType } from '@/game/type/SpeedType';
import { PackBuildingTask } from '@/game/gameobject/task/morph/PackBuildingTask';
import { CallbackTask } from '@/game/gameobject/task/system/CallbackTask';
import { TaskGroup } from '@/game/gameobject/task/system/TaskGroup';
import { CompositeDisposable } from '@/util/disposable/CompositeDisposable';
import { EventType } from '@/game/event/EventType';
import { NotifyTick } from '@/game/gameobject/trait/interface/NotifyTick';
interface PlacementOptions {
    normalizedTile?: boolean;
    ignoreObjects?: any[];
    ignoreAdjacent?: boolean;
}
interface PlacementPreviewTile {
    rx: number;
    ry: number;
    buildable: boolean;
}
interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}
interface Tile {
    rx: number;
    ry: number;
    landType: any;
    rampType: number;
}
interface Building {
    isBuilding(): boolean;
    rules: any;
    art: any;
    tile: Tile;
    name: string;
    owner: any;
    unitOrderTrait: any;
    purchaseValue?: number;
}
interface Player {
    buildings: Building[];
}
interface Game {
    gameOpts: {
        buildOffAlly: boolean;
    };
    alliances: {
        getAllies(player: Player): Player[];
    };
    events: {
        subscribe(eventType: any, callback: Function): any;
    };
    createObject(type: ObjectType, name: string): Building;
    changeObjectOwner(object: Building, player: Player): void;
    spawnObject(object: Building, tile: Tile): void;
    unspawnObject(object: Building): void;
    sellTrait: {
        computePurchaseValue(rules: any, player: Player): number;
    };
    mapShroudTrait: {
        getPlayerShroud(player: Player): {
            isShrouded(tile: Tile): boolean;
        } | null;
    };
}
interface GameMap {
    tiles: {
        getByMapCoords(x: number, y: number): Tile | null;
    };
    tileOccupation: {
        onChange: {
            subscribe(callback: Function): void;
            unsubscribe(callback: Function): void;
        };
        calculateTilesForGameObject(tile: Tile, object: Building): Tile[];
    };
    isWithinBounds(tile: Tile): boolean;
    getObjectsOnTile(tile: Tile): any[];
    getGroundObjectsOnTile(tile: Tile): any[];
}
interface Rules {
    getBuilding(name: string): any;
    getLandRules(landType: any): {
        buildable: boolean;
        getSpeedModifier(speedType: SpeedType): number;
    };
}
interface Art {
    getObject(name: string, type: ObjectType): {
        foundation: {
            width: number;
            height: number;
        };
        foundationCenter: {
            x: number;
            y: number;
        };
    };
}
export class ConstructionWorker {
    private player: Player;
    private rules: Rules;
    private art: Art;
    private map: GameMap;
    private game: Game;
    private adjacencyMaps: Map<number, Rect[]>;
    private disposables: CompositeDisposable;
    constructor(player: Player, rules: Rules, art: Art, map: GameMap, game: Game) {
        this.player = player;
        this.rules = rules;
        this.art = art;
        this.map = map;
        this.game = game;
        this.adjacencyMaps = new Map();
        this.disposables = new CompositeDisposable();
        const onTileOccupationChange = ({ object }: {
            object: any;
        }) => {
            if (object.isBuilding()) {
                this.adjacencyMaps.clear();
            }
        };
        this.map.tileOccupation.onChange.subscribe(onTileOccupationChange);
        this.disposables.add(() => this.map.tileOccupation.onChange.unsubscribe(onTileOccupationChange));
        this.disposables.add(this.game.events.subscribe(EventType.AllianceChange, () => this.adjacencyMaps.clear()), this.game.events.subscribe(EventType.ObjectOwnerChange, (event: any) => {
            if (event.target.isBuilding()) {
                this.adjacencyMaps.clear();
            }
        }), this.game.events.subscribe(EventType.ObjectDestroy, (event: any) => {
            if (event.target.isBuilding() &&
                event.target.rules.leaveRubble) {
                this.adjacencyMaps.clear();
            }
        }));
    }
    private getAdjacentRect(tile: Tile, foundation: any, adjacentRange: number): Rect {
        return {
            x: tile.rx - adjacentRange,
            y: tile.ry - adjacentRange,
            width: foundation.width + 2 * adjacentRange,
            height: foundation.height + 2 * adjacentRange,
        };
    }
    private getAdjacencyMap(adjacentRange: number): Rect[] {
        const adjacentRects: Rect[] = [];
        const buildings = [
            ...this.player.buildings,
            ...(this.game.gameOpts.buildOffAlly
                ? this.game.alliances
                    .getAllies(this.player)
                    .map((ally) => [...ally.buildings].filter((building) => building.rules.eligibileForAllyBuilding))
                    .flat()
                : []),
        ];
        for (const building of buildings) {
            if (building.rules.baseNormal) {
                adjacentRects.push(this.getAdjacentRect(building.tile, building.art.foundation, adjacentRange));
            }
        }
        return adjacentRects;
    }
    private meetsAdjacency(rect: Rect, adjacentRange: number): boolean {
        let adjacencyMap = this.adjacencyMaps.get(adjacentRange);
        if (!adjacencyMap) {
            adjacencyMap = this.getAdjacencyMap(adjacentRange);
            this.adjacencyMaps.set(adjacentRange, adjacencyMap);
        }
        for (const adjacentRect of adjacencyMap) {
            if (rectIntersect(rect, adjacentRect)) {
                return true;
            }
        }
        return false;
    }
    getPlacementPreview(buildingName: string, targetTile: Tile, options: PlacementOptions = {}): PlacementPreviewTile[] {
        const { normalizedTile = false, ignoreObjects, ignoreAdjacent = false, } = options;
        const buildingRules = this.rules.getBuilding(buildingName);
        const buildingArt = this.art.getObject(buildingName, ObjectType.Building);
        const previewTiles: PlacementPreviewTile[] = [];
        const foundation = buildingArt.foundation;
        const placementTile = normalizedTile
            ? targetTile
            : this.normalizePlacementTileCoords(buildingArt, targetTile);
        let canPlace = true;
        const buildingRect = {
            x: placementTile.rx,
            y: placementTile.ry,
            width: foundation.width,
            height: foundation.height,
        };
        if (!ignoreAdjacent && !this.meetsAdjacency(buildingRect, buildingRules.adjacent)) {
            canPlace = false;
        }
        for (let x = 0; x < foundation.width; x++) {
            for (let y = 0; y < foundation.height; y++) {
                const tileCoords = { x: placementTile.rx + x, y: placementTile.ry + y };
                const tile = this.map.tiles.getByMapCoords(tileCoords.x, tileCoords.y);
                if (tile) {
                    previewTiles.push({
                        rx: tileCoords.x,
                        ry: tileCoords.y,
                        buildable: canPlace && this.isTileBuildable(tile, buildingRules, ignoreObjects),
                    });
                }
            }
        }
        if (buildingRules.wall && previewTiles[0].buildable) {
            const connectingTiles = this.getWallConnectingTiles(placementTile, buildingRules);
            connectingTiles.forEach((tile) => {
                previewTiles.push({ rx: tile.rx, ry: tile.ry, buildable: true });
            });
        }
        return previewTiles;
    }
    canPlaceAt(buildingName: string, targetTile: Tile, options: PlacementOptions = {}): boolean {
        const { normalizedTile = false, ignoreObjects, ignoreAdjacent = false, } = options;
        const buildingRules = this.rules.getBuilding(buildingName);
        const buildingArt = this.art.getObject(buildingName, ObjectType.Building);
        const foundation = buildingArt.foundation;
        const placementTile = normalizedTile
            ? targetTile
            : this.normalizePlacementTileCoords(buildingArt, targetTile);
        const buildingRect = {
            x: placementTile.rx,
            y: placementTile.ry,
            width: foundation.width,
            height: foundation.height,
        };
        if (!ignoreAdjacent && !this.meetsAdjacency(buildingRect, buildingRules.adjacent)) {
            return false;
        }
        for (let x = 0; x < foundation.width; x++) {
            for (let y = 0; y < foundation.height; y++) {
                const tileCoords = { x: placementTile.rx + x, y: placementTile.ry + y };
                const tile = this.map.tiles.getByMapCoords(tileCoords.x, tileCoords.y);
                if (!tile || !this.isTileBuildable(tile, buildingRules, ignoreObjects)) {
                    return false;
                }
            }
        }
        return true;
    }
    placeAt(buildingName: string, targetTile: Tile, isNormalized: boolean = false): Building[] {
        const placedBuildings: Building[] = [];
        const buildingRules = this.rules.getBuilding(buildingName);
        const placementTile = isNormalized
            ? targetTile
            : this.normalizePlacementTile(buildingName, targetTile);
        if (buildingRules.wall) {
            const wallPlacements: [
                Tile,
                any
            ][] = [[placementTile, buildingRules]];
            const connectingTiles = this.getWallConnectingTiles(placementTile, buildingRules);
            connectingTiles.forEach((tile) => {
                if (tile !== placementTile) {
                    wallPlacements.push([tile, buildingRules]);
                }
            });
            for (const [tile, rules] of wallPlacements) {
                placedBuildings.push(this.executePlacement(tile, rules));
            }
        }
        else {
            const building = this.executePlacement(placementTile, buildingRules);
            placedBuildings.push(building);
            const occupiedTiles = this.map.tileOccupation.calculateTilesForGameObject(placementTile, building);
            for (const tile of occupiedTiles) {
                const smudge = this.map
                    .getObjectsOnTile(tile)
                    .find((obj) => obj.isSmudge());
                if (smudge) {
                    this.game.unspawnObject(smudge);
                }
            }
        }
        return placedBuildings;
    }
    private normalizePlacementTileCoords(buildingArt: any, targetTile: Tile): Tile {
        const foundationCenter = buildingArt.foundationCenter;
        return {
            rx: targetTile.rx - foundationCenter.x,
            ry: targetTile.ry - foundationCenter.y,
        } as Tile;
    }
    private normalizePlacementTile(buildingName: string, targetTile: Tile): Tile {
        const buildingArt = this.art.getObject(buildingName, ObjectType.Building);
        const normalizedCoords = this.normalizePlacementTileCoords(buildingArt, targetTile);
        const tile = this.map.tiles.getByMapCoords(normalizedCoords.rx, normalizedCoords.ry);
        if (!tile) {
            throw new Error(`Can't build outside map (${normalizedCoords.rx}, ${normalizedCoords.ry})`);
        }
        return tile;
    }
    unplace(building: Building, callback: () => void): void {
        building.unitOrderTrait.cancelAllTasks();
        building.unitOrderTrait.addTasks(new TaskGroup(new PackBuildingTask(this.game), new CallbackTask(() => {
            this.game.unspawnObject(building);
            callback();
        })).setCancellable(false));
        building.unitOrderTrait[NotifyTick.onTick](building, this.game);
    }
    private executePlacement(tile: Tile, buildingRules: any): Building {
        const building = this.game.createObject(ObjectType.Building, buildingRules.name);
        this.game.changeObjectOwner(building, this.player);
        building.purchaseValue = this.game.sellTrait.computePurchaseValue(buildingRules, this.player);
        this.game.spawnObject(building, tile);
        return building;
    }
    private getWallConnectingTiles(placementTile: Tile, buildingRules: any): Tile[] {
        const guardRange = buildingRules.guardRange + 1;
        const connectingTiles: Tile[] = [];
        const directions = [
            [0, 1],
            [0, -1],
            [1, 0],
            [-1, 0],
        ];
        for (const direction of directions) {
            const tilesInDirection: Tile[] = [];
            for (let distance = 0; distance < guardRange; ++distance) {
                const coords = {
                    x: placementTile.rx + direction[0] * distance,
                    y: placementTile.ry + direction[1] * distance,
                };
                const tile = this.map.tiles.getByMapCoords(coords.x, coords.y);
                if (!tile)
                    break;
                const existingWall = this.map
                    .getObjectsOnTile(tile)
                    .find((obj) => obj.isBuilding() &&
                    obj.name === buildingRules.name &&
                    obj.owner === this.player);
                if (existingWall) {
                    connectingTiles.push(...tilesInDirection);
                    break;
                }
                if (!this.isTileBuildable(tile, buildingRules))
                    break;
                tilesInDirection.push(tile);
            }
        }
        return connectingTiles;
    }
    private isTileBuildable(tile: Tile, buildingRules: any, ignoreObjects?: any[]): boolean {
        if (!this.map.isWithinBounds(tile)) {
            return false;
        }
        const playerShroud = this.game.mapShroudTrait.getPlayerShroud(this.player);
        if (playerShroud?.isShrouded(tile)) {
            return false;
        }
        const groundObjects = this.map.getGroundObjectsOnTile(tile);
        const hasBlockingObject = groundObjects.some((obj) => {
            if (ignoreObjects?.includes(obj))
                return false;
            if (obj.isBuilding() && obj.rules.invisibleInGame)
                return false;
            if (obj.isSmudge())
                return false;
            return true;
        });
        if (hasBlockingObject) {
            return false;
        }
        if (buildingRules.waterBound) {
            const landRules = this.rules.getLandRules(tile.landType);
            return landRules.getSpeedModifier(SpeedType.Float) > 0;
        }
        else {
            const landRules = this.rules.getLandRules(tile.landType);
            return tile.rampType === 0 && landRules.buildable;
        }
    }
    dispose(): void {
        this.disposables.dispose();
    }
}
