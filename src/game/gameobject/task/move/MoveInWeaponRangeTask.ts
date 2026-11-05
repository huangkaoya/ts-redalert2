import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { GameObject } from "@/game/gameobject/GameObject";
import { RangeHelper } from "@/game/gameobject/unit/RangeHelper";
import { Coords } from "@/game/Coords";
import { LosHelper } from "@/game/gameobject/unit/LosHelper";
import { RadialTileFinder } from "@/game/map/tileFinder/RadialTileFinder";
import { MovementZone } from "@/game/type/MovementZone";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { MoveState } from "@/game/gameobject/trait/MoveTrait";
import { RandomTileFinder } from "@/game/map/tileFinder/RandomTileFinder";
import { LocomotorType } from "@/game/type/LocomotorType";
import { bresenham } from "@/util/bresenham";
import { FacingUtil } from "@/game/gameobject/unit/FacingUtil";
import { Vector2 } from "@/game/math/Vector2";
export const STRAFE_CLOSE_ENOUGH = 2;
export class MoveInWeaponRangeTask extends MoveTask {
    public target: any;
    private weapon: any;
    private recalcMinRange: boolean = true;
    private cancelRequested: boolean = false;
    private bomberInitialLock: boolean = false;
    private rangeHelper: RangeHelper;
    private losHelper: LosHelper;
    private bomberManeuverTile?: any;
    private bomberQueuedTargetTile?: any;
    static getMoveTargetTile(game: any, target: any): any {
        return target instanceof GameObject
            ? target.isBuilding()
                ? game.map.isWithinBounds((target as any).centerTile)
                    ? (target as any).centerTile
                    : MoveInWeaponRangeTask.getInBoundsFoundationTile(game, target) ?? target.tile
                : target.tile
            : target;
    }

    static getInBoundsFoundationTile(game: any, building: any): any {
        return game.map.tileOccupation
            .calculateTilesForGameObject(building.tile, building)
            .find((tile: any) => game.map.isWithinBounds(tile));
    }

    constructor(game: any, target: any, unit: any, weapon: any) {
        super(game, MoveInWeaponRangeTask.getMoveTargetTile(game, target), unit, {
            pathFinderIgnoredBlockers: target instanceof GameObject && weapon.range > 0 ? [target] : undefined,
        });
        this.target = target;
        this.weapon = weapon;
        this.rangeHelper = new RangeHelper(game.map.tileOccupation);
        this.losHelper = new LosHelper(game.map.tiles, game.map.tileOccupation);
    }
    onStart(unit: any) {
        let target = this.target;
        let map = this.game.map;
        if (target instanceof GameObject &&
            target.isBuilding() &&
            unit.rules.movementZone !== MovementZone.Fly) {
            let centerTile = target.tile;
            const foundation = target instanceof GameObject
                ? target.getFoundation()
                : { width: 1, height: 1 };
            const tileFinder = new RadialTileFinder(map.tiles, map.mapBounds, centerTile, foundation, 1, 5, (tile) => map.terrain.getPassableSpeed(tile, unit.rules.speedType, unit.isInfantry(), false) > 0 && Math.abs(tile.z - centerTile.z) < 2);
            const tile = tileFinder.getNextTile();
            if (tile && this.rangeHelper.tileDistance(target, tile) > Math.SQRT2) {
                this.updateTarget(tile, false);
            }
        }
        this.bomberInitialLock = this.isCloseEnoughToDest(unit, unit.tile);
        super.onStart(unit);
    }
    cancel() {
        if (this.bomberManeuverTile) {
            this.cancelRequested = true;
        }
        else {
            super.cancel();
        }
    }
    shouldAirStrafe(unit: any): boolean {
        return (unit.rules.movementZone === MovementZone.Fly &&
            unit.rules.locomotor === LocomotorType.Aircraft &&
            unit.rules.fighter &&
            this.weapon.projectileRules.iniRot > 1);
    }
    isBombingRun(unit: any): boolean {
        return (unit.rules.movementZone === MovementZone.Fly &&
            unit.rules.locomotor === LocomotorType.Aircraft &&
            this.weapon.projectileRules.iniRot <= 1);
    }
    isAirStrafeCloseEnough(unit: any): boolean {
        return (this.rangeHelper.tileDistance(unit, this.targetTile) <
            Math.min(this.weapon.range, STRAFE_CLOSE_ENOUGH));
    }
    bomberCanReturn(unit: any): boolean {
        return (!this.bomberManeuverTile ||
            this.rangeHelper.tileDistance(unit, this.bomberManeuverTile) <= 1);
    }
    findStrafeDestination(unit: any, targetTile: any): any {
        const tileFinder = new RandomTileFinder(this.game.map.tiles, this.game.map.mapBounds, targetTile as any, this.weapon.range, this.game, (tile) => this.rangeHelper.isInWeaponRange(unit, targetTile, this.weapon, this.game.rules, tile as any));
        return tileFinder.getNextTile();
    }
    hasReachedDestination(unit: any): boolean {
        return (super.hasReachedDestination(unit) ||
            this.canStopAtTile(unit, unit.tile, unit.onBridge));
    }
    canStopAtTile(unit: any, tile: any, onBridge: boolean): boolean {
        if (unit.zone !== ZoneType.Air &&
            this.target instanceof GameObject &&
            this.game.map.tileOccupation.isTileOccupiedBy(tile, this.target) &&
            (!this.target.isUnit() ||
                (this.target.tile === tile &&
                    (this.target as any).moveTrait.moveState !== MoveState.Moving &&
                    this.target.position.subCell === unit.position.subCell))) {
            return false;
        }
        if (unit.zone !== ZoneType.Air) {
            if (!super.canStopAtTile(unit, tile, onBridge)) {
                return false;
            }
        }
        else if (this.game.map.tileOccupation
            .getAirObjectsOnTile(tile)
            .filter((obj: any) => obj.isUnit() &&
            obj.moveTrait.moveState !== MoveState.Moving &&
            obj !== unit).length) {
            return false;
        }
        return (!(this.isBombingRun(unit) && !this.bomberCanReturn(tile)) &&
            (this.isCancelling() || this.isCloseEnoughToDest(unit, tile)));
    }
    isCloseEnoughToDest(unit: any, tile: any): boolean {
        if (unit.rules.balloonHover && !unit.rules.hoverAttack) {
            return this.rangeHelper.isInTileRange(tile, this.target, 0, 0);
        }
        if (this.weapon.rules.cellRangefinding || !unit.isInfantry()) {
            return (this.rangeHelper.isInWeaponRange(unit, this.target, this.weapon, this.game.rules, tile) &&
                this.losHelper.hasLineOfSight(tile, this.target, this.weapon));
        }
        const offset = unit.zone === ZoneType.Air
            ? unit.position.computeSubCellOffset(unit.position.desiredSubCell)
            : unit.position.getTileOffset();
        const { minRange, range } = this.rangeHelper.computeWeaponRangeVsTarget(tile, this.target, this.weapon, this.game.rules);
        const worldPos = Coords.tile3dToWorld(tile.rx + offset.x / Coords.LEPTONS_PER_TILE, tile.ry + offset.y / Coords.LEPTONS_PER_TILE, tile.z + unit.position.tileElevation);
        return ((unit.isUnit() && unit.rules.movementZone === MovementZone.Fly
            ? this.rangeHelper.isInRange2(worldPos, this.target, minRange, range)
            : this.rangeHelper.isInRange3(worldPos, this.target, minRange, range)) &&
            this.losHelper.hasLineOfSight(tile, this.target, this.weapon));
    }
    findRelocationTile(fromTile: any, toTile: any, unit: any): any {
        if (unit.rules.movementZone !== MovementZone.Fly) {
            return super.findRelocationTile(fromTile, toTile, unit);
        }
        else {
            const map = this.game.map;
            const tileFinder = new RandomTileFinder(map.tiles, map.mapBounds, fromTile, 1, this.game, (tile) => this.isCancelling() || this.isCloseEnoughToDest(unit, tile));
            return tileFinder.getNextTile();
        }
    }
    retarget(newTarget: any, updatePath: boolean) {
        const targetTile = MoveInWeaponRangeTask.getMoveTargetTile(this.game, newTarget);
        if (this.bomberManeuverTile) {
            this.bomberQueuedTargetTile = targetTile;
        }
        else {
            this.updateTarget(targetTile, updatePath);
            this.recalcMinRange = true;
        }
        this.target = newTarget;
        if (this.options?.ignoredBlockers) {
            this.options.ignoredBlockers =
                newTarget instanceof GameObject ? [newTarget] : undefined;
        }
        if (!this.options) {
            this.options = {};
        }
        this.options.pathFinderIgnoredBlockers =
            newTarget instanceof GameObject ? [newTarget] : undefined;
    }
    onTick(unit: any): boolean {
        if (this.recalcMinRange) {
            this.recalcMinRange = false;
            const relocTile = this.findMinRangeRelocationTile(unit, this.targetTile);
            if (relocTile !== this.targetTile) {
                if (!relocTile) {
                    this.cancel();
                    return false;
                }
                this.updateTarget(relocTile, !!relocTile.onBridgeLandType);
            }
        }
        if (this.shouldAirStrafe(unit) && !this.isCancelling()) {
            this.updateTarget(MoveInWeaponRangeTask.getMoveTargetTile(this.game, this.target), false);
            if (this.isAirStrafeCloseEnough(unit)) {
                const strafeDest = this.findStrafeDestination(unit, this.targetTile);
                if (strafeDest) {
                    this.updateTarget(strafeDest, false);
                }
            }
        }
        if (this.isBombingRun(unit) &&
            !this.isCancelling() &&
            (!unit.ammo || this.weapon.getBurstsFired() || this.bomberInitialLock) &&
            !this.bomberManeuverTile) {
            this.bomberInitialLock = false;
            const unitPos = unit.position.getMapPosition();
            const targetTile = MoveInWeaponRangeTask.getMoveTargetTile(this.game, this.target);
            const direction = new Vector2(targetTile.rx + 0.5, targetTile.ry + 0.5)
                .clone()
                .multiplyScalar(Coords.LEPTONS_PER_TILE)
                .sub(unitPos);
            let distance = direction.length();
            if (!distance) {
                direction.copy(FacingUtil.toMapCoords(unit.direction));
                distance = Number.EPSILON;
            }
            const maneuverPos = unitPos
                .clone()
                .add(direction.setLength(distance + 7 * Coords.LEPTONS_PER_TILE));
            const maneuverMapCoords = maneuverPos
                .multiplyScalar(1 / Coords.LEPTONS_PER_TILE)
                .floor();
            const bresCoords = bresenham(maneuverMapCoords.x, maneuverMapCoords.y, unit.tile.rx, unit.tile.ry);
            if (!bresCoords.length) {
                throw new Error("Bresenham returned no tiles");
            }
            const firstCoord = bresCoords[0];
            this.bomberManeuverTile =
                this.game.map.tiles.getByMapCoords(firstCoord.x, firstCoord.y) ??
                    this.game.map.tiles.getPlaceholderTile(firstCoord.x, firstCoord.y);
            this.options.allowOutOfBoundsTarget = true;
            this.updateTarget(this.bomberManeuverTile, false);
        }
        if (this.bomberManeuverTile && this.bomberCanReturn(unit.tile)) {
            this.bomberManeuverTile = undefined;
            if (this.bomberQueuedTargetTile) {
                this.updateTarget(this.bomberQueuedTargetTile, false);
                this.recalcMinRange = true;
                this.bomberQueuedTargetTile = undefined;
            }
        }
        if (this.cancelRequested) {
            if (!this.bomberManeuverTile) {
                this.cancelRequested = false;
                this.cancel();
            }
        }
        return !!(this.isBombingRun(unit) &&
            this.isCancelling() &&
            this.forceCancel(unit)) || super.onTick(unit);
    }
    forceCancel(unit: any): boolean {
        return !this.bomberManeuverTile && super.forceCancel(unit);
    }
    findMinRangeRelocationTile(unit: any, targetTile: any): any {
        const { minRange, range } = this.rangeHelper.computeWeaponRangeVsTarget(unit, this.target, this.weapon, this.game.rules);
        if (unit.rules.locomotor === LocomotorType.Chrono) {
            return this.rangeHelper.isInRange(unit, this.target, range - 1, range, this.weapon.rules.cellRangefinding)
                ? targetTile
                : (this.findTileInRange(unit, targetTile, range - 1, 2 * range) ?? targetTile);
        }
        else {
            return this.rangeHelper.isInRange(unit, this.target, minRange, Number.POSITIVE_INFINITY, this.weapon.rules.cellRangefinding)
                ? targetTile
                : this.findTileInRange(unit, targetTile, 2 * minRange, range - minRange);
        }
    }
    findTileInRange(unit: any, targetTile: any, minDist: number, maxDist: number): any {
        const map = this.game.map;
        const direction = new Vector2(unit.tile.rx - targetTile.rx, unit.tile.ry - targetTile.ry)
            .setLength(minDist)
            .floor()
            .add(new Vector2(targetTile.rx, targetTile.ry));
        let tile;
        for (const coord of bresenham(direction.x, direction.y, targetTile.rx, targetTile.ry)) {
            tile = map.tiles.getByMapCoords(coord.x, coord.y);
            if (tile)
                break;
        }
        if (tile) {
            const tileFinder = new RadialTileFinder(map.tiles, map.mapBounds, tile as any, { width: 1, height: 1 }, 0, maxDist, (t) => this.rangeHelper.isInWeaponRange(unit, this.target, this.weapon, this.game.rules, t as any) &&
                this.losHelper.hasLineOfSight(t, this.target, this.weapon) &&
                map.terrain.getPassableSpeed(t, unit.rules.speedType, unit.isInfantry(), !!t.onBridgeLandType) > 0 &&
                !map.terrain.findObstacles({ tile: t, onBridge: !!t.onBridgeLandType }, unit).length);
            return tileFinder.getNextTile();
        }
    }
}
