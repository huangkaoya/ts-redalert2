import { Task } from "@/game/gameobject/task/system/Task";
import { RangeHelper } from "@/game/gameobject/unit/RangeHelper";
import { RadialTileFinder } from "@/game/map/tileFinder/RadialTileFinder";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { TurnTask } from "@/game/gameobject/task/TurnTask";
import { WaitMinutesTask } from "@/game/gameobject/task/system/WaitMinutesTask";
import { HarvesterTrait, HarvesterStatus } from "@/game/gameobject/trait/HarvesterTrait";
import { TeleportMoveToRefineryTask } from "@/game/gameobject/task/harvester/TeleportMoveToRefineryTask";
import { GatherOreTask } from "@/game/gameobject/task/harvester/GatherOreTask";
import { CallbackTask } from "@/game/gameobject/task/system/CallbackTask";
import { MoveTrait, MoveResult } from "@/game/gameobject/trait/MoveTrait";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { Vector2 } from "@/game/math/Vector2";
export class ReturnOreTask extends Task {
    private game: any;
    private forceTarget: any;
    private resetLastOreSite: boolean;
    private explicitOrder: boolean;
    private rangeHelper: RangeHelper;
    private target?: any;
    private reservedDockNumber?: number;
    constructor(game: any, forceTarget?: any, resetLastOreSite: boolean = false, explicitOrder: boolean = false) {
        super();
        this.game = game;
        this.forceTarget = forceTarget;
        this.resetLastOreSite = resetLastOreSite;
        this.explicitOrder = explicitOrder;
        this.useChildTargetLines = true;
        this.preventOpportunityFire = false;
        this.rangeHelper = new RangeHelper(game.map.tileOccupation);
    }
    onStart(unit: any): void {
        if (!unit.isVehicle() || !unit.harvesterTrait) {
            throw new Error(`Unit ${unit.name} is not a harvester.`);
        }
        unit.harvesterTrait.status = HarvesterStatus.MovingToRefinery;
        if (this.resetLastOreSite) {
            unit.harvesterTrait.lastOreSite = undefined;
        }
    }
    onEnd(unit: any): void {
        if (this.target?.isSpawned) {
            this.target.dockTrait.undockUnit(unit);
            this.target.dockTrait.unreserveDockForUnit(unit);
        }
        if (unit.harvesterTrait.status !== HarvesterStatus.LookingForRefinery) {
            unit.harvesterTrait.status = HarvesterStatus.Idle;
        }
    }
    onTick(unit: any): boolean {
        if (this.isCancelling())
            return true;
        const harvesterTrait = unit.harvesterTrait;
        if (harvesterTrait.status === HarvesterStatus.LookingForRefinery)
            return true;
        if (harvesterTrait.status === HarvesterStatus.MovingToRefinery) {
            if (!this.target ||
                !this.isValidTargetRefinery(this.target, unit) ||
                unit.tile !== this.findRefineryDockingTile(this.target)) {
                const refinery = this.forceTarget ?? this.findClosestReachableRefinery(unit);
                if (!refinery) {
                    harvesterTrait.status = HarvesterStatus.LookingForRefinery;
                    return true;
                }
                if (this.target &&
                    this.target !== refinery &&
                    this.target.dockTrait.hasReservedDockForUnit(unit)) {
                    this.target.dockTrait.unreserveDockForUnit(unit);
                }
                this.target = refinery;
            }
            let dockNumber = this.target.dockTrait.getFirstAvailableDockNumber();
            let needsReservation = false;
            if (dockNumber === undefined) {
                dockNumber = this.target.dockTrait.getFirstEmptyDockNumber();
                if (dockNumber !== undefined) {
                    needsReservation = !this.target.dockTrait.hasReservedDockForUnit(unit);
                }
            }
            const dockingTile = this.findRefineryDockingTile(this.target);
            const distance = this.rangeHelper.tileDistance(unit, dockingTile);
            if (dockNumber === undefined ||
                needsReservation ||
                (distance > this.game.rules.general.harvesterTooFarDistance && !this.explicitOrder)) {
                const queueingTile = this.findReachableQueueingTile(unit);
                if (!queueingTile)
                    return true;
                if (unit.tile !== queueingTile) {
                    this.children.push(unit.rules.teleporter
                        ? new TeleportMoveToRefineryTask(this.game, dockingTile, queueingTile, () => this.chronoMinerCanTeleport(unit, dockingTile, this.target))
                        : new MoveTask(this.game, queueingTile, false), new CallbackTask(() => {
                        if (unit.moveTrait.lastMoveResult === MoveResult.Fail) {
                            harvesterTrait.status = HarvesterStatus.LookingForRefinery;
                        }
                        else if (unit.moveTrait.lastMoveResult === MoveResult.CloseEnough) {
                            this.children.push(new WaitMinutesTask(5 / 60));
                        }
                        else if (unit.moveTrait.lastMoveResult === MoveResult.Success) {
                            this.children.push(new WaitMinutesTask(2 / 60));
                        }
                    }));
                }
                return false;
            }
            if (!this.target.dockTrait.hasReservedDockForUnit(unit)) {
                this.target.dockTrait.reserveDockAt(unit, dockNumber);
            }
            if (this.reservedDockNumber === undefined) {
                this.reservedDockNumber = this.target.dockTrait.getReservedDockForUnit(unit);
            }
            if (unit.tile !== dockingTile) {
                this.children.push(unit.rules.teleporter
                    ? new TeleportMoveToRefineryTask(this.game, dockingTile, undefined, () => this.chronoMinerCanTeleport(unit, dockingTile, this.target))
                    : new MoveTask(this.game, dockingTile, false, {
                        closeEnoughTiles: 0,
                        strictCloseEnough: true,
                    }), new CallbackTask(() => {
                    if (unit.moveTrait.lastMoveResult === MoveResult.Fail) {
                        harvesterTrait.status = HarvesterStatus.LookingForRefinery;
                    }
                }));
                return false;
            }
            harvesterTrait.status = HarvesterStatus.Docking;
        }
        if (!this.isValidTargetRefinery(this.target, unit)) {
            harvesterTrait.status = HarvesterStatus.MovingToRefinery;
            this.forceTarget = undefined;
            return this.onTick(unit);
        }
        if (harvesterTrait.status === HarvesterStatus.Docking) {
            if (unit.direction !== 270) {
                this.children.push(new TurnTask(270));
                return false;
            }
            this.target.dockTrait.dockUnitAt(unit, this.reservedDockNumber);
            this.reservedDockNumber = undefined;
            harvesterTrait.status = HarvesterStatus.PreparingToUnload;
        }
        if (harvesterTrait.status === HarvesterStatus.PreparingToUnload) {
            this.preventOpportunityFire = true;
            this.children.push(new WaitMinutesTask(2 / 60));
            harvesterTrait.status = HarvesterStatus.Unloading;
            return false;
        }
        if (harvesterTrait.status !== HarvesterStatus.Unloading)
            return false;
        const baseOreValue = harvesterTrait.getBails().reduce(
            (sum: number, [type, count]: [any, number]) => sum + count * this.game.rules.getTiberium(type).value,
            0,
        );
        let oreValue = baseOreValue;
        const purifierCount = [...this.target.owner.buildings].filter((building: any) => building.rules.orePurifier &&
            (!building.poweredTrait || !this.target.owner.powerTrait?.isLowPower())).length;
        const purifierBonus = this.game.rules.general.purifierBonus;
        oreValue += purifierCount * Math.floor(baseOreValue * purifierBonus);
        this.target.owner.credits += oreValue;
        this.target.owner.creditsGained += oreValue;
        harvesterTrait.empty();
        if (unit.unitOrderTrait.getTasks().length === 1) {
            unit.unitOrderTrait.addTask(new GatherOreTask(this.game));
        }
        return true;
    }
    private isValidTargetRefinery(refinery: any, unit: any): boolean {
        return refinery.isSpawned &&
            this.game.areFriendly(refinery, unit) &&
            !refinery.warpedOutTrait.isActive();
    }
    private findClosestReachableRefinery(unit: any): any {
        const rangeHelper = this.rangeHelper;
        const isAirUnit = unit.zone === ZoneType.Air;
        const speedType = unit.rules.speedType;
        const isInfantry = unit.isInfantry();
        const islandIdMap = !isAirUnit &&
            this.game.map.terrain.getPassableSpeed(unit.tile, speedType, isInfantry, unit.onBridge)
            ? this.game.map.terrain.getIslandIdMap(speedType, isInfantry)
            : undefined;
        const refineries = [...unit.owner.buildings]
            .filter((building: any) => building.rules.refinery &&
            building.dockTrait &&
            !building.warpedOutTrait.isActive() &&
            this.isReachableRefinery(building, unit, islandIdMap))
            .sort((a: any, b: any) => rangeHelper.distance2(unit, a) - rangeHelper.distance2(unit, b));
        const closestRefinery = refineries[0];
        const availableRefinery = refineries.find((refinery: any) => refinery.dockTrait.getAvailableDockCount() > 0);
        if (!availableRefinery ||
            (closestRefinery &&
                rangeHelper.tileDistance(unit, availableRefinery.centerTile) -
                    rangeHelper.tileDistance(unit, closestRefinery.centerTile) >
                    this.game.rules.general.harvesterTooFarDistance)) {
            return closestRefinery;
        }
        return availableRefinery;
    }
    private isReachableRefinery(refinery: any, unit: any, islandIdMap: any): boolean {
        const dockingTile = this.findRefineryDockingTile(refinery);
        return unit.rules.teleporter ||
            islandIdMap?.get(dockingTile, false) === islandIdMap?.get(unit.tile, unit.onBridge);
    }
    private findReachableQueueingTile(unit: any): any {
        if (this.target.art.queueingCell) {
            const queueingPos = new Vector2(this.target.tile.rx, this.target.tile.ry)
                .add(this.target.art.queueingCell);
            const queueingTile = this.game.map.tiles.getByMapCoords(queueingPos.x, queueingPos.y);
            if (queueingTile && this.isValidQueueingTile(queueingTile, unit)) {
                return queueingTile;
            }
        }
        return new RadialTileFinder(this.game.map.tiles, this.game.map.mapBounds, this.target.tile, this.target.getFoundation(), 1, 1, (tile: any) => this.isValidQueueingTile(tile, unit)).getNextTile();
    }
    private isValidQueueingTile(tile: any, unit: any): boolean {
        const isAirUnit = unit.zone === ZoneType.Air;
        const speedType = unit.rules.speedType;
        const isInfantry = unit.isInfantry();
        const islandIdMap = !isAirUnit &&
            this.game.map.terrain.getPassableSpeed(unit.tile, speedType, isInfantry, unit.onBridge)
            ? this.game.map.terrain.getIslandIdMap(speedType, isInfantry)
            : undefined;
        return isAirUnit ||
            (islandIdMap?.get(tile, false) === islandIdMap?.get(unit.tile, unit.onBridge) &&
                Math.abs(tile.z - this.target.tile.z) < 2 &&
                !tile.onBridgeLandType);
    }
    private findRefineryDockingTile(refinery: any): any {
        const dockingPos = {
            x: refinery.tile.rx + refinery.getFoundation().width - 1,
            y: refinery.tile.ry + Math.floor(refinery.getFoundation().height / 2),
        };
        return this.game.map.tiles.getByMapCoords(dockingPos.x, dockingPos.y);
    }
    private chronoMinerCanTeleport(unit: any, targetTile: any, refinery: any): boolean {
        const rangeHelper = this.rangeHelper;
        const distance = rangeHelper.tileDistance(unit, targetTile);
        return !(!this.forceTarget &&
            distance > this.game.rules.general.chronoHarvTooFarDistance) &&
            !(distance <= 1) &&
            !!this.isValidTargetRefinery(refinery, unit) &&
            !(refinery.dockTrait.getAvailableDockCount() === 0 &&
                !refinery.dockTrait.hasReservedDockForUnit(unit));
    }
}
