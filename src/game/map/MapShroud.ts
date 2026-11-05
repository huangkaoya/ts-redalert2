import { EventDispatcher } from '../../util/event';
import { GameSpeed } from '../GameSpeed';
import { TerrainType } from '../../engine/type/TerrainType';
import { clamp } from '../../util/math';
export enum ShroudType {
    Unexplored = 0,
    TemporaryReveal = 1,
    Explored = 2
}
export enum ShroudFlag {
    Darken = 8
}
interface Size {
    width: number;
    height: number;
}
interface ShroudCoords {
    sx: number;
    sy: number;
}
interface WorldCoords {
    rx: number;
    ry: number;
}
interface Tile {
    rx: number;
    ry: number;
    z: number;
    terrainType: TerrainType;
}
interface TileMap {
    getMapSize(): Size;
    getMaxTileHeight(): number;
    getAll(): Tile[];
    getByMapCoords(rx: number, ry: number): Tile | undefined;
}
interface Invalidation {
    center: ShroudCoords;
    elevation: number;
    radius: number;
}
export class MapShroud {
    private invalidations: Map<number, Invalidation>;
    private temporaryReveals: Map<ShroudCoords, number>;
    private fullInvalidation: boolean;
    private _onChange: EventDispatcher;
    private padding: number;
    private size: Size;
    private tiles: Uint8Array;
    private tileElevation: Uint8Array;
    private static readonly TEMPORARY_REVEAL_DURATION = 5;
    private static readonly OBJECT_REVEAL_RADIUS = 4.25;
    private static readonly SHROUD_TYPE_BITS = 3;
    private static readonly SHROUD_TYPE_MASK = (1 << MapShroud.SHROUD_TYPE_BITS) - 1;
    constructor() {
        this.invalidations = new Map();
        this.temporaryReveals = new Map();
        this.fullInvalidation = false;
        this._onChange = new EventDispatcher();
    }
    get onChange() {
        return this._onChange.asEvent();
    }
    fromTiles(map: TileMap): this {
        const mapSize = map.getMapSize();
        const maxHeight = map.getMaxTileHeight();
        this.padding = (maxHeight + (maxHeight % 2)) / 2;
        this.size = {
            width: mapSize.width + this.padding,
            height: mapSize.height + this.padding
        };
        this.tiles = new Uint8Array(this.size.width * this.size.height);
        this.tiles.fill(ShroudType.Unexplored);
        this.tileElevation = new Uint8Array(this.size.width * this.size.height);
        for (const tile of map.getAll()) {
            const index = this.getTileIndex(tile);
            this.tileElevation[index] = Math.max(this.tileElevation[index], tile.terrainType === TerrainType.Cliff && tile.z > 0 ? tile.z - 1 : tile.z);
        }
        return this;
    }
    getSize(): Size {
        return this.size;
    }
    getTileIndex(tile: Tile): number {
        const { sx, sy } = this.rxyzToSxy(tile.rx, tile.ry, tile.z);
        return sx + sy * this.size.width;
    }
    rxyzToSxy(rx: number, ry: number, z: number): ShroudCoords {
        const adjustedZ = (z |= 0) + (z % 2);
        return {
            sx: rx - adjustedZ / 2 + this.padding,
            sy: ry - adjustedZ / 2 + this.padding
        };
    }
    sxyzToRxy(sx: number, sy: number, z: number): WorldCoords {
        return {
            rx: sx + Math.ceil(z / 2) - this.padding,
            ry: sy + Math.ceil(z / 2) - this.padding
        };
    }
    shroudCoordsToWorld(coords: ShroudCoords): WorldCoords {
        return this.sxyzToRxy(coords.sx, coords.sy, 0);
    }
    findTilesAtShroudCoords(coords: ShroudCoords, map: TileMap): Tile[] {
        const maxHeight = map.getMaxTileHeight();
        const adjustedMaxHeight = maxHeight + (maxHeight % 2);
        const tiles: Tile[] = [];
        for (let z = 0; z <= adjustedMaxHeight; z += 2) {
            const adjustedZ = z + (z % 2);
            const { rx, ry } = this.sxyzToRxy(coords.sx, coords.sy, adjustedZ);
            const tile = map.getByMapCoords(rx, ry);
            if (tile?.z === z) {
                tiles.push(tile);
            }
        }
        return tiles;
    }
    clone(): MapShroud {
        const clone = new MapShroud();
        clone.tiles = this.tiles.slice();
        clone.size = this.size;
        clone.padding = this.padding;
        clone.tileElevation = this.tileElevation;
        return clone;
    }
    copy(other: MapShroud): void {
        this.tiles = other.tiles.slice();
        this.size = other.size;
        this.padding = other.padding;
        this.tileElevation = other.tileElevation;
    }
    merge(other: MapShroud): void {
        if (this.size.width !== other.size.width || this.size.height !== other.size.height) {
            throw new Error("Size mismatch");
        }
        const otherTiles = other.tiles;
        for (let i = 0, len = this.tiles.length; i < len; i++) {
            this.tiles[i] =
                Math.max(otherTiles[i] & MapShroud.SHROUD_TYPE_MASK, this.tiles[i] & MapShroud.SHROUD_TYPE_MASK) |
                    (((otherTiles[i] | this.tiles[i]) >> MapShroud.SHROUD_TYPE_BITS) << MapShroud.SHROUD_TYPE_BITS);
        }
    }
    isShrouded(tile: Tile, offset: number = 0): boolean {
        return this.getShroudType(tile, offset) === ShroudType.Unexplored;
    }
    getShroudType(tile: Tile, offset: number = 0): ShroudType {
        const coords = this.rxyzToSxy(tile.rx, tile.ry, tile.z + offset);
        return this.getShroudTypeByShroudCoords(coords);
    }
    isFlagged(tile: Tile, flag: number): boolean {
        return (this.tiles[this.getTileIndex(tile)] & flag) !== 0;
    }
    getShroudTypeByTileCoords(rx: number, ry: number, z: number): ShroudType {
        return this.getShroudTypeByShroudCoords(this.rxyzToSxy(rx, ry, z));
    }
    getShroudTypeByShroudCoords({ sx, sy }: ShroudCoords): ShroudType {
        return sx < 0 || sy < 0 || sx >= this.size.width || sy >= this.size.height
            ? ShroudType.Unexplored
            : this.tiles[sx + sy * this.size.width] & MapShroud.SHROUD_TYPE_MASK;
    }
    invalidateFull(): void {
        this.fullInvalidation = true;
    }
    invalidate(coords: ShroudCoords, elevation: number, radius: number): void {
        const index = coords.sx + coords.sy * this.size.width;
        let invalidation = this.invalidations.get(index);
        if (!invalidation) {
            invalidation = { center: coords, elevation: 0, radius: 0 };
            this.invalidations.set(index, invalidation);
        }
        invalidation.elevation = Math.max(invalidation.elevation, elevation);
        invalidation.radius = Math.max(invalidation.radius, radius);
    }
    revealFrom(object: {
        isBuilding(): boolean;
        wallTrait?: boolean;
        sight?: number;
        tile: Tile;
        tileElevation: number;
    }): void {
        if (!object.isBuilding() || !object.wallTrait) {
            if (object.sight) {
                const elevation = object.tile.z + object.tileElevation;
                const coords = this.rxyzToSxy(object.tile.rx, object.tile.ry, elevation);
                this.invalidate(coords, elevation, object.sight);
            }
        }
    }
    revealAround(tile: Tile, radius: number): void {
        const coords = this.rxyzToSxy(tile.rx, tile.ry, tile.z);
        this.invalidate(coords, Number.POSITIVE_INFINITY, radius);
    }
    unrevealAround(tile: Tile, radius: number): void {
        const coords: ShroudCoords[] = [];
        const center = this.rxyzToSxy(tile.rx, tile.ry, tile.z);
        this.setValueAround(center, radius, Number.POSITIVE_INFINITY, coords, ShroudType.Unexplored, ShroudType.Explored);
        this._onChange.dispatch(this, {
            type: "incremental",
            coords
        });
    }
    revealTemporarily(object: {
        tile: Tile;
        tileElevation: number;
    }): void {
        const coords = this.rxyzToSxy(object.tile.rx, object.tile.ry, object.tile.z + object.tileElevation);
        this.temporaryReveals.set(coords, MapShroud.TEMPORARY_REVEAL_DURATION * GameSpeed.BASE_TICKS_PER_SECOND);
    }
    revealObject(object: {
        tile: Tile;
        tileElevation: number;
    }): void {
        const coords = this.rxyzToSxy(object.tile.rx, object.tile.ry, object.tile.z + object.tileElevation);
        this.invalidate(coords, Number.POSITIVE_INFINITY, MapShroud.OBJECT_REVEAL_RADIUS);
    }
    toggleFlagsAround(tile: Tile, radius: number, flags: number, set: boolean): void {
        const coords: ShroudCoords[] = [];
        const center = this.rxyzToSxy(tile.rx, tile.ry, tile.z);
        this.setValueAround(center, radius, Number.POSITIVE_INFINITY, coords, undefined, undefined, set ? { setFlags: flags } : { clearFlags: flags });
        this._onChange.dispatch(this, {
            type: "incremental",
            coords
        });
    }
    update(): void {
        const changedCoords: ShroudCoords[] = [];
        if (this.invalidations.size) {
            for (const invalidation of this.invalidations.values()) {
                this.setValueAround(invalidation.center, invalidation.radius, invalidation.elevation, changedCoords, ShroudType.Explored, [ShroudType.Unexplored, ShroudType.TemporaryReveal]);
            }
            this.invalidations.clear();
        }
        if (this.temporaryReveals.size) {
            this.temporaryReveals.forEach((duration, coords) => {
                if (duration <= 0) {
                    this.setValueAround(coords, MapShroud.SHROUD_TYPE_BITS, Number.POSITIVE_INFINITY, changedCoords, ShroudType.Unexplored, ShroudType.TemporaryReveal);
                    this.temporaryReveals.delete(coords);
                }
                else {
                    if (duration === MapShroud.TEMPORARY_REVEAL_DURATION * GameSpeed.BASE_TICKS_PER_SECOND) {
                        this.setValueAround(coords, MapShroud.SHROUD_TYPE_BITS, Number.POSITIVE_INFINITY, changedCoords, ShroudType.TemporaryReveal, ShroudType.Unexplored);
                    }
                    this.temporaryReveals.set(coords, duration - 1);
                }
            });
        }
        if (this.fullInvalidation) {
            this.fullInvalidation = false;
            this._onChange.dispatch(this, { type: "full" });
        }
        else if (changedCoords.length) {
            this._onChange.dispatch(this, {
                type: "incremental",
                coords: changedCoords
            });
        }
    }
    private setValueAround(center: ShroudCoords, radius: number, maxElevation: number, changedCoords: ShroudCoords[], newValue?: ShroudType, oldValue?: ShroudType | ShroudType[], flags?: {
        setFlags?: number;
        clearFlags?: number;
    }): void {
        const radiusCeil = Math.ceil(radius);
        const minX = clamp(center.sx - radiusCeil, 0, this.size.width - 1);
        const maxX = clamp(center.sx + radiusCeil, 0, this.size.width - 1);
        const minY = clamp(center.sy - radiusCeil, 0, this.size.height - 1);
        const maxY = clamp(center.sy + radiusCeil, 0, this.size.height - 1);
        const width = this.size.width;
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const index = x + y * width;
                const currentType = this.tiles[index] & MapShroud.SHROUD_TYPE_MASK;
                const currentFlags = (this.tiles[index] >> MapShroud.SHROUD_TYPE_BITS) << MapShroud.SHROUD_TYPE_BITS;
                let newFlags = currentFlags;
                if (flags?.setFlags !== undefined) {
                    newFlags |= flags.setFlags;
                }
                if (flags?.clearFlags !== undefined) {
                    newFlags &= ~flags.clearFlags;
                }
                const matchesOldValue = oldValue === undefined
                    ? true
                    : Array.isArray(oldValue)
                        ? oldValue.includes(currentType)
                        : oldValue === currentType;
                const inRadius = (x - center.sx) * (x - center.sx) + (y - center.sy) * (y - center.sy) <=
                    radius * radius + 1;
                const belowElevationLimit = this.tileElevation[index] < maxElevation + 4;
                if (!matchesOldValue || !inRadius || !belowElevationLimit) {
                    continue;
                }
                // 完善模拟层逻辑：assign (newValue ?? currentType)|flags, then push unless
                // currentType === newValue (raw, not coalesced) AND flags unchanged.
                // When newValue is undefined (e.g. toggleFlagsAround), 模拟层 always pushes.
                this.tiles[index] = (newValue ?? currentType) | newFlags;
                if (!(currentType === newValue && currentFlags === newFlags)) {
                    changedCoords.push({ sx: x, sy: y });
                }
            }
        }
    }
    revealAll(): void {
        this.tiles.fill(ShroudType.Explored);
        this._onChange.dispatch(this, { type: "clear" });
    }
    reset(): void {
        this.tiles.fill(ShroudType.Unexplored);
        this._onChange.dispatch(this, { type: "cover" });
    }
}
