import { SpeedType } from '@/game/type/SpeedType';
import { TiberiumTrait } from '@/game/gameobject/trait/TiberiumTrait';
import { TiberiumType } from '@/engine/type/TiberiumType';
import { Vector2 } from '@/game/math/Vector2';
interface Game {
    map: Map;
    getPlayerByName(name: string): Player;
    getWorld(): World;
    mapShroudTrait: {
        getPlayerShroud(player: Player): {
            isShrouded(tile: any, level: number): boolean;
            revealAll?(): void;
        } | undefined;
    };
}
interface Map {
    tiles: {
        getMapSize(): any;
        getByMapCoords(x: number, y: number): any;
        getInRectangle(rect: any, rect2?: any): any[];
    };
    startingLocations: {
        x: number;
        y: number;
    }[];
    getTheaterType(): any;
    mapBounds: {
        isWithinBounds(tile: any): boolean;
    };
    getObjectsOnTile(tile: any): any[];
    tileOccupation: {
        getBridgeOnTile(tile: any): {
            isHighBridge(): boolean;
        };
    };
    terrain: {
        getPassableSpeed(tile: any, speedType: SpeedType, isFoot: boolean, options: any): number;
        computePath(tile: any, isFoot: boolean, startTile: any, startOnBridge: boolean, endTile: any, endOnBridge: boolean, options: any): any[];
        getIslandIdMap?(speedType: SpeedType, onBridge: boolean): {
            get(tile: any, onBridge: boolean): number | undefined;
        };
    };
}
interface Player {
}
interface World {
    getAllObjects(): any[];
}
interface Tile {
    onBridgeLandType?: any;
    id: string;
    isOverlay(): boolean;
    isTiberium(): boolean;
    isTerrain(): boolean;
    rules: {
        spawnsTiberium: boolean;
    };
    traits: {
        get(trait: any): any;
    };
    tile: any;
}
interface ResourceData {
    tile: any;
    ore: number;
    gems: number;
    spawnsOre: boolean;
}
export class MapApi {
    private game: Game;
    private map: Map;
    constructor(game: Game) {
        this.game = game;
        this.map = game.map;
    }
    getRealMapSize() {
        return this.map.tiles.getMapSize();
    }
    getStartingLocations() {
        return this.map.startingLocations.map(loc => new Vector2(loc.x, loc.y));
    }
    getTheaterType() {
        return this.map.getTheaterType();
    }
    getTile(x: number, y: number) {
        const tile = this.map.tiles.getByMapCoords(x, y);
        if (tile && this.map.mapBounds.isWithinBounds(tile)) {
            return tile;
        }
    }
    getTilesInRect(rect: any, rect2?: any) {
        const tiles = rect2
            ? this.map.tiles.getInRectangle(rect, rect2)
            : this.map.tiles.getInRectangle(rect);
        return tiles.filter(tile => this.map.mapBounds.isWithinBounds(tile));
    }
    getObjectsOnTile(tile: Tile) {
        return this.map.getObjectsOnTile(tile).map(obj => obj.id);
    }
    hasBridgeOnTile(tile: Tile) {
        return !!tile.onBridgeLandType;
    }
    hasHighBridgeOnTile(tile: Tile) {
        return !!this.map.tileOccupation.getBridgeOnTile(tile)?.isHighBridge();
    }
    isPassableTile(tile: any, speedType: SpeedType, options: any, isFoot?: boolean) {
        isFoot = isFoot ?? speedType === SpeedType.Foot;
        return this.map.terrain.getPassableSpeed(tile, speedType, isFoot, options) > 0;
    }
    findPath(speedType: any, isFoot: boolean, start: any, end: any, options?: any) {
        // 完善模拟层逻辑：(speedType, isFoot, start, end, options).
        const path = this.game.map.terrain.computePath(
            speedType,
            isFoot,
            start.tile,
            start.onBridge,
            end.tile,
            end.onBridge,
            {
                bestEffort: options?.bestEffort,
                excludeTiles: options?.excludeNodes
                    ? (node: any) => options.excludeNodes({
                        tile: node.tile,
                        onBridge: !!node.onBridge,
                    })
                    : undefined,
                maxExpandedNodes: options?.maxExpandedNodes,
            },
        );
        return path.map((node: any) => ({ tile: node.tile, onBridge: !!node.onBridge }));
    }
    isVisibleTile(tile: any, playerName: string, level: number = 0) {
        const player = this.game.getPlayerByName(playerName);
        if (!player) {
            throw new Error(`Player "${playerName}" doesn't exist`);
        }
        return !this.game.mapShroudTrait.getPlayerShroud(player)?.isShrouded(tile, level);
    }
    private getResourceData(obj: any): ResourceData | undefined {
        if (obj.isOverlay() && obj.isTiberium()) {
            const trait = obj.traits.get(TiberiumTrait);
            const type = trait.getTiberiumType();
            const count = trait.getBailCount();
            return {
                tile: obj.tile,
                // 完善模拟层逻辑：any non-gem tiberium counts as ore (Ore/Vinifera/Aboreus).
                ore: type !== TiberiumType.Gems ? count : 0,
                gems: type === TiberiumType.Gems ? count : 0,
                spawnsOre: false,
            };
        }
        else if (obj.isTerrain() && obj.rules.spawnsTiberium) {
            return {
                tile: obj.tile,
                ore: 0,
                gems: 0,
                spawnsOre: true,
            };
        }
    }
    getTileResourceData(tile: any) {
        const obj = this.map.getObjectsOnTile(tile).find(obj => (obj.isOverlay() && obj.isTiberium()) || (obj.isTerrain() && obj.rules.spawnsTiberium));
        return obj ? this.getResourceData(obj) : undefined;
    }
    getAllTilesResourceData() {
        const data: ResourceData[] = [];
        for (const obj of this.game.getWorld().getAllObjects()) {
            const resourceData = this.getResourceData(obj);
            if (resourceData) {
                data.push(resourceData);
            }
        }
        return data;
    }
    getReachabilityMap(speedType: SpeedType, isInfantry: boolean) {
        const terrain = this.map.terrain as any;
        const islandIdMap = terrain.getIslandIdMap(speedType, isInfantry);
        return {
            isReachable(from: { tile: any; onBridge?: boolean }, to: { tile: any; onBridge?: boolean }): boolean {
                const fromId = this.getRegionId(from);
                const toId = this.getRegionId(to);
                return fromId !== undefined && fromId === toId;
            },
            getRegionId(pos: { tile: any; onBridge?: boolean }): number | undefined {
                return islandIdMap.get(pos.tile, !!pos.onBridge);
            },
        };
    }
}
