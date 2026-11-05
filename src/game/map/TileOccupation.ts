import { LandType, getLandType } from '@/game/type/LandType';
import { EventDispatcher } from '@/util/event';
import { ZoneType, getZoneType } from '@/game/gameobject/unit/ZoneType';
export enum LayerType {
    All = 0,
    Ground = 1,
    Air = 2
}
export class TileOccupation {
    private tiles: any;
    private tileOccupation: Set<any>[][];
    private emptyTiles: Set<any>;
    private _onChange: EventDispatcher<TileOccupation>;
    get onChange() {
        return this._onChange.asEvent();
    }
    constructor(tiles: any) {
        this.tiles = tiles;
        this.tileOccupation = [];
        this.emptyTiles = new Set();
        this._onChange = new EventDispatcher();
        let occupation = this.tileOccupation;
        for (const tile of tiles.getAll()) {
            occupation[tile.rx] = occupation[tile.rx] || [];
            occupation[tile.rx][tile.ry] = new Set();
            this.emptyTiles.add(tile);
        }
    }
    occupyTileRange(pos: any, obj: any) {
        const tiles = this.calculateTilesForGameObject(pos, obj);
        tiles.forEach(tile => this.occupyTile(tile, obj));
        this._onChange.dispatch(this, {
            tiles,
            object: obj,
            type: 'added'
        });
    }
    unoccupyTileRange(pos: any, obj: any) {
        const tiles = this.calculateTilesForGameObject(pos, obj);
        tiles.forEach(tile => this.unoccupyTile(tile, obj));
        this._onChange.dispatch(this, {
            tiles,
            object: obj,
            type: 'removed'
        });
    }
    occupySingleTile(tile: any, obj: any) {
        this.occupyTile(tile, obj);
        this._onChange.dispatch(this, {
            tiles: [tile],
            object: obj,
            type: 'added'
        });
    }
    unoccupySingleTile(tile: any, obj: any) {
        this.unoccupyTile(tile, obj);
        this._onChange.dispatch(this, {
            tiles: [tile],
            object: obj,
            type: 'removed'
        });
    }
    calculateTilesForGameObject(pos: any, obj: any) {
        return this.tiles.getInRectangle(pos, obj.getFoundation());
    }
    occupyTile(tile: any, obj: any) {
        const occupation = this.tileOccupation[tile.rx]?.[tile.ry];
        if (occupation) {
            occupation.add(obj);
            this.emptyTiles.delete(tile);
            tile.landType = this.computeTileLandType(tile);
            tile.onBridgeLandType = this.computeOnBridgeLandType(tile);
        }
    }
    unoccupyTile(tile: any, obj: any) {
        const occupation = this.tileOccupation[tile.rx]?.[tile.ry];
        if (occupation) {
            occupation.delete(obj);
            if (!occupation.size) {
                this.emptyTiles.add(tile);
            }
            tile.landType = this.computeTileLandType(tile);
            tile.onBridgeLandType = this.computeOnBridgeLandType(tile);
        }
    }
    isTileOccupiedBy(tile: any, obj: any): boolean {
        return !!this.tileOccupation[tile.rx]?.[tile.ry]?.has(obj);
    }
    computeTileLandType(tile: any): LandType {
        if (tile.landType === LandType.Rock)
            return LandType.Rock;
        const baseLandType = getLandType(tile.terrainType);
        for (const obj of this.tileOccupation[tile.rx]?.[tile.ry] ?? []) {
            if (obj.isBuilding() && obj.rules.wall) {
                return LandType.Wall;
            }
            if (obj.isOverlay() && !obj.isBridge() && !obj.isBridgePlaceholder()) {
                if (obj.getLandType() !== LandType.Clear) {
                    return obj.getLandType();
                }
            }
        }
        return baseLandType;
    }
    computeOnBridgeLandType(tile: any): LandType | undefined {
        for (const obj of this.tileOccupation[tile.rx]?.[tile.ry] ?? []) {
            if (obj.isOverlay() && obj.isBridge()) {
                return obj.getLandType();
            }
        }
    }
    getTileZone(tile: any, useBaseLandType: boolean = false): ZoneType {
        return getZoneType(useBaseLandType ? tile.landType : (tile.onBridgeLandType ?? tile.landType));
    }
    getBridgeOnTile(tile: any) {
        for (const obj of this.tileOccupation[tile.rx]?.[tile.ry] ?? []) {
            if (obj.isOverlay() && obj.isBridge()) {
                return obj;
            }
        }
    }
    getObjectsOnTile(tile: any): any[] {
        return [...(this.tileOccupation[tile.rx]?.[tile.ry] ?? [])];
    }
    getGroundObjectsOnTile(tile: any): any[] {
        const objects: any[] = [];
        for (const obj of this.tileOccupation[tile.rx]?.[tile.ry] ?? []) {
            if (!(obj.isTechno() && !obj.isBuilding() && obj.zone === ZoneType.Air)) {
                objects.push(obj);
            }
        }
        return objects;
    }
    getAirObjectsOnTile(tile: any): any[] {
        const objects: any[] = [];
        for (const obj of this.tileOccupation[tile.rx]?.[tile.ry] ?? []) {
            if (obj.isUnit() && obj.zone === ZoneType.Air) {
                objects.push(obj);
            }
        }
        return objects;
    }
    getObjectsOnTileByLayer(tile: any, layer: LayerType): any[] {
        switch (layer) {
            case LayerType.Ground:
                return this.getGroundObjectsOnTile(tile);
            case LayerType.Air:
                return this.getAirObjectsOnTile(tile);
            case LayerType.All:
                return this.getObjectsOnTile(tile);
            default:
                throw new Error(`Unhandled layer type "${layer}"`);
        }
    }
    getEmptyTiles(): any[] {
        return [...this.emptyTiles];
    }
}
