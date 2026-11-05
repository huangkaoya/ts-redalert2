import { TerrainType } from '@/engine/type/TerrainType';
import { LandType } from '@/game/type/LandType';
import { CollisionType } from '@/game/gameobject/unit/CollisionType';
import { ZoneType } from '@/game/gameobject/unit/ZoneType';
interface TileOccupation {
    getObjectsOnTile(tile: any): any[];
    getBridgeOnTile(tile: any): any;
}
interface CollisionOptions {
    walls?: boolean;
    /** 完善模拟层逻辑：false disables unit wall-hits; otherwise a predicate over unit.owner */
    units?: false | ((owner: any) => boolean);
    shore?: boolean;
    ground?: boolean;
    cliffs?: boolean;
}
interface CollisionResult {
    type: CollisionType;
    target?: any;
}
export class CollisionHelper {
    private tileOccupation: TileOccupation;
    constructor(tileOccupation: TileOccupation) {
        this.tileOccupation = tileOccupation;
    }
    checkCollisions(source: any, target: any, options: CollisionOptions): CollisionResult {
        const sourceTile = source.tile;
        let bridge: any, unit: any, wall: any;
        for (const obj of this.tileOccupation.getObjectsOnTile(sourceTile)) {
            if (obj.isOverlay() && obj.isBridge())
                bridge = obj;
            if (obj.isOverlay() && obj.wallTrait)
                wall = obj;
            if (obj.isTechno() && !obj.isDestroyed)
                unit = obj;
        }
        if (options.walls) {
            if (source.tileElevation <= 2 && sourceTile.landType === LandType.Wall) {
                return { type: CollisionType.Wall, target: wall };
            }
            if (options.units &&
                unit?.tile === sourceTile &&
                (!unit.isUnit() || unit.zone === ZoneType.Ground) &&
                source.tileElevation <= 1.1 &&
                options.units(unit.owner)) {
                return { type: CollisionType.Wall, target: unit };
            }
        }
        if (options.shore && sourceTile.landType !== LandType.Water) {
            return { type: CollisionType.Shore };
        }
        if (options.ground && source.tileElevation < 0) {
            return { type: CollisionType.Ground };
        }
        const sourceHeight = source.tileElevation + sourceTile.z;
        const targetHeight = target.tileElevation + target.tile.z;
        if (bridge?.isHighBridge()) {
            const bridgeHeight = bridge.tile.z + bridge.tileElevation;
            if ((bridgeHeight < targetHeight && sourceHeight <= bridgeHeight) ||
                (targetHeight < bridgeHeight && bridgeHeight - 1 <= sourceHeight)) {
                return targetHeight < bridgeHeight
                    ? { type: CollisionType.UnderBridge, target: bridge }
                    : { type: CollisionType.OnBridge, target: bridge };
            }
        }
        else if (bridge?.isLowBridge() && options.shore) {
            return { type: CollisionType.UnderBridge, target: bridge };
        }
        if (options.cliffs) {
            const heightDiff = sourceTile.z - target.tile.z;
            if (source.tileElevation < 0 && heightDiff >= 4) {
                return { type: CollisionType.Cliff };
            }
        }
        return { type: CollisionType.None };
    }
    computeDetonationZone(tile: any, height: number, collisionType: CollisionType): ZoneType {
        const bridge = this.tileOccupation.getBridgeOnTile(tile);
        if (collisionType === CollisionType.None && height > 1.5 + (bridge?.tileElevation ?? 0)) {
            return ZoneType.Air;
        }
        if ((bridge && height > 1.5) ||
            tile.terrainType !== TerrainType.Water ||
            bridge?.isLowBridge()) {
            return ZoneType.Ground;
        }
        return ZoneType.Water;
    }
}
