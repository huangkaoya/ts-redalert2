import { Coords } from '@/game/Coords';
import * as MathUtil from '@/util/math';
import { ZoneType } from './ZoneType';
import { MovementZone } from '@/game/type/MovementZone';
import { Vector2 } from '../../math/Vector2';
interface Position {
    worldPosition: Vector3;
    tileElevation: number;
}
interface GameObject {
    position: Position;
    tile: Tile;
    tileElevation: number;
    isUnit(): boolean;
    isBuilding(): boolean;
    isTechno(): boolean;
    rules: GameObjectRules;
    zone?: ZoneType;
    getFoundation(): Foundation;
}
interface GameObjectRules {
    movementZone: MovementZone;
    airRangeBonus: number;
}
interface Tile {
    z: number;
    rx: number;
    ry: number;
}
interface Vector3 {
    x: number;
    y: number;
    z: number;
    distanceTo(other: Vector3): number;
}
interface Vector3Like {
    x: number;
    z: number;
    addScalar?: (scalar: number) => void;
}
interface TileCoord {
    rx: number;
    ry: number;
    z: number;
}
interface Weapon {
    minRange: number;
    range: number;
    rules: WeaponRules;
    projectileRules: ProjectileRules;
    warhead: Warhead;
}
interface WeaponRules {
    limboLaunch: boolean;
    cellRangefinding: boolean;
}
interface ProjectileRules {
    arcing: boolean;
    vertical: boolean;
    subjectToElevation: boolean;
    isAntiAir: boolean;
}
interface Warhead {
    rules: WarheadRules;
}
interface WarheadRules {
    ivanBomb: boolean;
}
interface Foundation {
    width: number;
    height: number;
}
interface GameRules {
    elevationModel: ElevationModel;
}
interface ElevationModel {
    getBonus(fromElevation: number, toElevation: number): number;
}
interface TileOccupation {
    calculateTilesForGameObject(tile: Tile, gameObject: GameObject): Tile[];
}
type RangeTarget = GameObject | Vector3Like | TileCoord | Tile[];
const hasPosition = (obj: any): obj is GameObject => obj.position !== undefined;
const hasAddScalar = (obj: any): obj is Vector3Like => obj.addScalar !== undefined;
export class RangeHelper {
    private tileOccupation: TileOccupation;
    constructor(tileOccupation: TileOccupation) {
        this.tileOccupation = tileOccupation;
    }
    isInWeaponRange(shooter: GameObject, target: RangeTarget, weapon: Weapon, gameRules: GameRules, rangeSource?: GameObject): boolean {
        const effectiveShooter = rangeSource ?? shooter;
        if (weapon.rules.limboLaunch) {
            const shooterElevation = hasPosition(effectiveShooter)
                ? effectiveShooter.position.tileElevation + effectiveShooter.tile.z
                : (effectiveShooter as TileCoord).z;
            const targetElevation = hasPosition(target)
                ? target.position.tileElevation + target.tile.z
                : (target as TileCoord).z;
            if (Math.abs(shooterElevation - targetElevation) > 2) {
                return false;
            }
        }
        const { minRange, range } = this.computeWeaponRangeVsTarget(effectiveShooter, target, weapon, gameRules);
        if (weapon.rules.cellRangefinding) {
            return this.isInTileRange(effectiveShooter, target, minRange, range);
        }
        else if (shooter.isUnit() && shooter.rules.movementZone === MovementZone.Fly) {
            return this.isInRange2(effectiveShooter, target, minRange, range);
        }
        else {
            return this.isInRange3(effectiveShooter, target, minRange, range);
        }
    }
    computeWeaponRangeVsTarget(shooter: RangeTarget, target: RangeTarget, weapon: Weapon, gameRules: GameRules): {
        minRange: number;
        range: number;
    } {
        let rangeBonus = 0;
        // 完善模拟层逻辑：for buildings (non-arcing/non-vertical), add (w+h)/4 unless
        // ivanBomb against a foundation with width+height > 2.
        if (hasPosition(target) && target.isBuilding() &&
            !weapon.projectileRules.arcing &&
            !weapon.projectileRules.vertical) {
            const foundation = target.getFoundation();
            if (!(weapon.warhead.rules.ivanBomb && foundation.width + foundation.height > 2)) {
                rangeBonus += (foundation.width + foundation.height) / 4;
            }
        }
        if (!( !weapon.projectileRules.subjectToElevation ||
            (weapon.projectileRules.arcing && !hasPosition(target)) )) {
            const shooterElevation = hasPosition(shooter)
                ? shooter.tile.z + shooter.tileElevation
                : (shooter as TileCoord).z;
            const targetElevation = hasPosition(target)
                ? target.tile.z + target.tileElevation
                : (target as TileCoord).z;
            if (targetElevation < shooterElevation) {
                rangeBonus += gameRules.elevationModel.getBonus(shooterElevation, targetElevation);
            }
        }
        if (weapon.projectileRules.isAntiAir &&
            hasPosition(shooter) && shooter.isTechno() &&
            hasPosition(target) && target.isUnit() &&
            target.zone === ZoneType.Air) {
            rangeBonus += shooter.rules.airRangeBonus;
        }
        return {
            minRange: weapon.minRange,
            range: weapon.range + rangeBonus
        };
    }
    isInRange(source: RangeTarget, target: RangeTarget, minRange: number, maxRange: number, useTileRange = false): boolean {
        if (useTileRange) {
            return this.isInTileRange(source, target, minRange, maxRange);
        }
        else if (hasPosition(source) && source.isUnit() &&
            source.rules.movementZone === MovementZone.Fly) {
            return this.isInRange2(source, target, minRange, maxRange);
        }
        else {
            return this.isInRange3(source, target, minRange, maxRange);
        }
    }
    public isInRange3(source: RangeTarget, target: RangeTarget, minRange: number, maxRange: number): boolean {
        const distance = this.distance3(source, target) / Coords.LEPTONS_PER_TILE;
        return MathUtil.isBetween(distance, minRange, maxRange);
    }
    public isInRange2(source: RangeTarget, target: RangeTarget, minRange: number, maxRange: number): boolean {
        const distance = this.distance2(source, target) / Coords.LEPTONS_PER_TILE;
        return MathUtil.isBetween(distance, minRange, maxRange);
    }
    public distance3(source: RangeTarget, target: RangeTarget): number {
        const sourcePos = this.getWorldPosition3D(source);
        const targetPos = this.getWorldPosition3D(target);
        return sourcePos.distanceTo(targetPos);
    }
    public distance2(source: RangeTarget, target: RangeTarget): number {
        const sourcePos = this.getWorldPosition2D(source);
        const targetPos = this.getWorldPosition2D(target);
        return sourcePos.distanceTo(targetPos);
    }
    private getWorldPosition3D(obj: RangeTarget): Vector3 {
        if (hasPosition(obj)) {
            return obj.position.worldPosition;
        }
        else if (hasAddScalar(obj)) {
            return obj as Vector3;
        }
        else {
            const tile = obj as TileCoord;
            return Coords.tile3dToWorld(tile.rx + 0.5, tile.ry + 0.5, tile.z);
        }
    }
    private getWorldPosition2D(obj: RangeTarget): Vector2 {
        if (hasPosition(obj)) {
            const worldPos = obj.position.worldPosition;
            return new Vector2(worldPos.x, worldPos.z);
        }
        else if (hasAddScalar(obj)) {
            const vec = obj as Vector3Like;
            return new Vector2(vec.x, vec.z);
        }
        else {
            const tile = obj as TileCoord;
            return new Vector2(tile.rx + 0.5, tile.ry + 0.5)
                .multiplyScalar(Coords.LEPTONS_PER_TILE);
        }
    }
    public isInTileRange(source: RangeTarget, target: RangeTarget, minRange: number, maxRange: number): boolean {
        let distance: number;
        if (!Array.isArray(source) && hasPosition(target) && (target as any).isUnit()) {
            const sourceTile = hasPosition(source) ? source.tile : (source as TileCoord);
            distance = new Vector2(sourceTile.rx + 0.5, sourceTile.ry + 0.5).distanceTo(
                (target as any).position.getMapPosition().multiplyScalar(1 / Coords.LEPTONS_PER_TILE),
            );
        } else {
            distance = this.tileDistance(source, target);
        }
        return MathUtil.isBetween(distance, minRange, maxRange);
    }
    public tileDistance(source: RangeTarget, target: RangeTarget): number {
        const sourceTiles = this.getTiles(source);
        const targetTiles = this.getTiles(target);
        const sourceVec = new Vector2();
        const targetVec = new Vector2();
        let minDistance = Number.POSITIVE_INFINITY;
        for (const sourceTile of sourceTiles) {
            for (const targetTile of targetTiles) {
                sourceVec.set(sourceTile.rx, sourceTile.ry);
                targetVec.set(targetTile.rx, targetTile.ry);
                const distance = sourceVec.distanceTo(targetVec);
                if (distance <= minDistance) {
                    minDistance = distance;
                }
            }
        }
        return minDistance;
    }
    private getTiles(obj: RangeTarget): Tile[] {
        if (hasPosition(obj)) {
            return this.tileOccupation.calculateTilesForGameObject(obj.tile, obj);
        }
        else if (Array.isArray(obj)) {
            return obj;
        }
        else {
            return [obj as Tile];
        }
    }
}
