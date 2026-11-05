import { Task } from "@/game/gameobject/task/system/Task";
import { RadialTileFinder } from "@/game/map/tileFinder/RadialTileFinder";
import { HarvesterTrait, HarvesterStatus } from "@/game/gameobject/trait/HarvesterTrait";
import { LandType } from "@/game/type/LandType";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { TiberiumTrait } from "@/game/gameobject/trait/TiberiumTrait";
import { TiberiumType } from "@/engine/type/TiberiumType";
import { WaitMinutesTask } from "@/game/gameobject/task/system/WaitMinutesTask";
import { ReturnOreTask } from "@/game/gameobject/task/harvester/ReturnOreTask";
import { RangeHelper } from "@/game/gameobject/unit/RangeHelper";
import { CallbackTask } from "@/game/gameobject/task/system/CallbackTask";
import { MoveResult } from "@/game/gameobject/trait/MoveTrait";
import { MovementZone } from "@/game/type/MovementZone";
const PRIORITY_MATRIX = [
    [8, 5, 6],
    [3, 0, 2],
    [7, 4, 1],
];
export class GatherOreTask extends Task {
    private game: any;
    private initialTarget: any;
    private explicitOrder: boolean;
    private forceMoveTried: boolean = false;
    private rangeHelper: RangeHelper;
    private scanNearRadius: number;
    private scanFarRadius: number;
    private target?: any;
    public useChildTargetLines: boolean = true;
    public preventOpportunityFire: boolean = false;
    constructor(game: any, initialTarget?: any, explicitOrder: boolean = false) {
        super();
        this.game = game;
        this.initialTarget = initialTarget;
        this.explicitOrder = explicitOrder;
        this.rangeHelper = new RangeHelper(game.map.tileOccupation);
        this.scanNearRadius = game.rules.ai.tiberiumNearScan;
        this.scanFarRadius = game.rules.ai.tiberiumFarScan;
    }
    onStart(unit: any): void {
        if (!unit.isVehicle() || !unit.harvesterTrait) {
            throw new Error(`Unit ${unit.name} is not a harvester.`);
        }
        unit.harvesterTrait.status = HarvesterStatus.MovingToOreSite;
        unit.harvesterTrait.lastGatherExplicit = this.explicitOrder;
    }
    onEnd(unit: any): void {
        if (unit.harvesterTrait.status !== HarvesterStatus.LookingForOreSite) {
            unit.harvesterTrait.status = HarvesterStatus.Idle;
        }
    }
    onTick(unit: any): boolean {
        if (this.isCancelling())
            return true;
        const harvester = unit.harvesterTrait;
        if (harvester.status === HarvesterStatus.MovingToOreSite) {
            const previousTarget = this.target;
            // 完善模拟层逻辑：短路优先级：
            // (this.target || initialTarget?.landType !== Tiberium)
            //   ? (lastOreSite ?? unit.tile) : initialTarget
            // When this.target is set, 模拟层 still rescans from lastOreSite/unit.tile.
            this.target = this.findClosestReachableOreSite(
                unit,
                (this.target || this.initialTarget?.landType !== LandType.Tiberium)
                    ? (harvester.lastOreSite ?? unit.tile)
                    : this.initialTarget,
                true,
            );
            harvester.lastOreSite = this.target;
            if (!this.target) {
                harvester.status = HarvesterStatus.LookingForOreSite;
                const refinery = this.getRefineryOnTile(unit.tile);
                if (refinery && unit.unitOrderTrait.getTasks().length === 1) {
                    const canFly = unit.rules.movementZone === MovementZone.Fly;
                    const finder = new RadialTileFinder(this.game.map.tiles, this.game.map.mapBounds, refinery.tile, refinery.getFoundation(), 1, 5, (tile: any) => canFly || (this.game.map.terrain.getPassableSpeed(tile, unit.rules.speedType, unit.isInfantry(), false) > 0 &&
                        Math.abs(tile.z - unit.tile.z) < 2 &&
                        !this.game.map.terrain.findObstacles({ tile, onBridge: undefined }, unit).length));
                    const waitTile = finder.getNextTile();
                    if (waitTile) {
                        unit.unitOrderTrait.addTasks(new MoveTask(this.game, waitTile, false), new CallbackTask(() => {
                            if (![MoveResult.Success, MoveResult.CloseEnough, MoveResult.Cancel]
                                .includes(unit.moveTrait.lastMoveResult)) {
                                this.children.push(new WaitMinutesTask(1 / 60));
                            }
                        }));
                    }
                }
                return true;
            }
            const closeEnough = this.game.rules.general.closeEnough;
            const wasCloseEnough = previousTarget &&
                this.rangeHelper.tileDistance(unit.tile, this.target) <= closeEnough;
            if (!(unit.tile === this.target ||
                (unit.tile.landType === LandType.Tiberium && wasCloseEnough))) {
                if (unit.tile !== this.target && wasCloseEnough &&
                    unit.tile.landType !== LandType.Tiberium) {
                    const nearbyOre = this.findClosestReachableOreSite(unit, unit.tile, false, true);
                    if (nearbyOre) {
                        this.target = nearbyOre;
                        harvester.lastOreSite = this.target;
                    }
                    else {
                        if (!this.forceMoveTried) {
                            this.forceMoveTried = true;
                            this.children.push(new MoveTask(this.game, this.target, false, {
                                closeEnoughTiles: 0,
                                strictCloseEnough: true
                            }));
                            return false;
                        }
                        this.forceMoveTried = false;
                        if (!harvester.isEmpty()) {
                            this.returnOreIfPossible(unit);
                            return true;
                        }
                        const alternativeTarget = this.findClosestReachableOreSite(unit, unit.tile, true, true);
                        if (!alternativeTarget) {
                            harvester.status = HarvesterStatus.LookingForOreSite;
                            return true;
                        }
                        this.target = alternativeTarget;
                        harvester.lastOreSite = this.target;
                    }
                }
                this.children.push(new MoveTask(this.game, this.target, false, {
                    closeEnoughTiles: closeEnough
                }), new CallbackTask(() => {
                    if (![MoveResult.Success, MoveResult.CloseEnough, MoveResult.Cancel]
                        .includes(unit.moveTrait.lastMoveResult)) {
                        this.children.push(new WaitMinutesTask(5 / 60));
                    }
                }));
                return false;
            }
            this.target = unit.tile;
            harvester.lastOreSite = this.target;
            harvester.status = HarvesterStatus.Harvesting;
            this.forceMoveTried = false;
        }
        if (harvester.status !== HarvesterStatus.Harvesting) {
            return false;
        }
        if (harvester.isFull()) {
            this.returnOreIfPossible(unit);
            return true;
        }
        const tiberiumOverlay = this.game.map
            .getObjectsOnTile(unit.tile)
            .find((obj: any) => obj.isOverlay() && obj.isTiberium());
        if (!tiberiumOverlay) {
            const hasNearbyOre = this.findClosestReachableOreSite(unit, unit.tile, false);
            if (hasNearbyOre || harvester.isEmpty()) {
                harvester.status = HarvesterStatus.MovingToOreSite;
                return this.onTick(unit);
            }
            else {
                this.returnOreIfPossible(unit);
                return true;
            }
        }
        const tiberiumTrait = tiberiumOverlay.traits.get(TiberiumTrait);
        const collectedType = tiberiumTrait.collectBail();
        if (!tiberiumTrait.getBailCount()) {
            this.game.unspawnObject(tiberiumOverlay);
        }
        if (collectedType !== undefined) {
            harvester.addBails(collectedType, 1);
        }
        const hasRefinery = [...unit.owner.buildings].some((building: any) => building.rules.refinery);
        if (!hasRefinery && !this.explicitOrder) {
            return true;
        }
        this.children.push(new WaitMinutesTask(1 / 60));
        return false;
    }
    private findClosestReachableOreSite(unit: any, startTile: any, farScan: boolean, checkObstacles: boolean = false): any {
        const canFly = unit.rules.movementZone === MovementZone.Fly;
        const speedType = unit.rules.speedType;
        const isInfantry = unit.isInfantry();
        const islandMap = !canFly &&
            this.game.map.terrain.getPassableSpeed(unit.tile, speedType, isInfantry, unit.onBridge)
            ? this.game.map.terrain.getIslandIdMap(speedType, isInfantry)
            : undefined;
        const unitIslandId = islandMap?.get(unit.tile, unit.onBridge);
        const isValidTile = (tile: any): boolean => {
            return tile.landType === LandType.Tiberium &&
                islandMap?.get(tile, false) === unitIslandId &&
                (!checkObstacles || canFly ||
                    !this.game.map.terrain.findObstacles({ tile, onBridge: undefined }, unit).length);
        };
        if (isValidTile(startTile)) {
            return startTile;
        }
        let startRadius = 1;
        if (!farScan) {
            const nearbyFinder = new RadialTileFinder(this.game.map.tiles, this.game.map.mapBounds, startTile, { width: 1, height: 1 }, startRadius, startRadius, isValidTile);
            const nearbyTiles: any[] = [];
            let tile;
            while ((tile = nearbyFinder.getNextTile())) {
                nearbyTiles.push(tile);
            }
            if (nearbyTiles.length) {
                const tilesWithOre = nearbyTiles.map(tile => {
                    const ore = this.game.map
                        .getObjectsOnTile(tile)
                        .find((obj: any) => obj.isOverlay() && obj.isTiberium());
                    if (!ore) {
                        throw new Error(`Ore should exist on tile ${tile.rx},${tile.ry} b/c of landType`);
                    }
                    const tibTrait = ore.traits.get(TiberiumTrait);
                    return { tile, ore, tibTrait };
                });
                // 完善模拟层逻辑：1e5*rules.value + 1e3*ore.value + neighbor priority matrix
                tilesWithOre.sort((a, b) => 1e5 * (b.tibTrait.rules.value - a.tibTrait.rules.value) +
                    1e3 * (b.ore.value - a.ore.value) +
                    (PRIORITY_MATRIX[1 + b.tile.ry - startTile.ry][1 + b.tile.rx - startTile.rx] -
                        PRIORITY_MATRIX[1 + a.tile.ry - startTile.ry][1 + a.tile.rx - startTile.rx]));
                return tilesWithOre[0].tile;
            }
            startRadius = 2;
        }
        const maxRadius = farScan ? this.scanFarRadius : this.scanNearRadius;
        const finder = new RadialTileFinder(this.game.map.tiles, this.game.map.mapBounds, startTile, { width: 1, height: 1 }, startRadius, maxRadius, isValidTile);
        return finder.getNextTile();
    }
    private getRefineryOnTile(tile: any): any {
        return this.game.map
            .getObjectsOnTile(tile)
            .find((obj: any) => obj.isBuilding() && obj.rules.refinery);
    }
    private returnOreIfPossible(unit: any): void {
        if (unit.unitOrderTrait.getTasks().length === 1) {
            unit.unitOrderTrait.addTask(new ReturnOreTask(this.game));
        }
    }
    getTargetLinesConfig(unit: any): any {
        return {
            pathNodes: this.initialTarget
                ? [{ tile: this.initialTarget, onBridge: undefined }]
                : []
        };
    }
}
