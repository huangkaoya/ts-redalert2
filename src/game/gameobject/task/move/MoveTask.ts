import { Task } from "@/game/gameobject/task/system/Task";
import { Infantry } from "@/game/gameobject/Infantry";
import { MovementZone } from "@/game/type/MovementZone";
import { findIndexReverse, findReverse } from "@/util/array";
import { SpeedType } from "@/game/type/SpeedType";
import { LocomotorType } from "@/game/type/LocomotorType";
import { MoveState, CollisionState, MoveResult, MoveTrait } from "@/game/gameobject/trait/MoveTrait";
import { WaitTicksTask } from "@/game/gameobject/task/system/WaitTicksTask";
import { MoveAsideTask } from "@/game/gameobject/task/move/MoveAsideTask";
import { MovePositionHelper } from "@/game/gameobject/unit/MovePositionHelper";
import { RadialTileFinder } from "@/game/map/tileFinder/RadialTileFinder";
import { RangeHelper } from "@/game/gameobject/unit/RangeHelper";
import AppLogger from "@/util/logger";
const Logger = AppLogger;
import { Coords } from "@/game/Coords";
import { TaskStatus } from "@/game/gameobject/task/system/TaskStatus";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { LocomotorFactory } from "@/game/gameobject/locomotor/LocomotorFactory";
import { RandomTileFinder } from "@/game/map/tileFinder/RandomTileFinder";
import { ObjectTeleportEvent } from "@/game/event/ObjectTeleportEvent";
import { NotifyTeleport } from "@/game/gameobject/trait/interface/NotifyTeleport";
import { PowerupType } from "@/game/type/PowerupType";
import { ScatterTask } from "@/game/gameobject/task/ScatterTask";
import { VeteranAbility } from "@/game/gameobject/unit/VeteranAbility";
import { Vector2 } from "@/game/math/Vector2";
import type { Game } from "@/game/Game";
import type { Tile } from "@/game/map/Tile";
import type { GameObject } from "@/game/gameobject/GameObject";
import type { Bridge } from "@/game/gameobject/Bridge";
import type { Unit } from "@/game/gameobject/Unit";
import type { Locomotor } from "@/game/gameobject/locomotor/Locomotor";
import type { Weapon } from "@/game/gameobject/Weapon";
const VELOCITY_FACTOR = 1.5;
const MAX_PLANNING_TICKS = 200;
const WAIT_TICKS = 40;
const MAX_UNREACHABLE_TARGETS = 5;
interface MoveOptions {
    targetOffset?: Vector2;
    allowOutOfBoundsTarget?: boolean;
    forceMove?: boolean;
    strictCloseEnough?: boolean;
    closeEnoughTiles?: number;
    ignoredBlockers?: GameObject[];
    pathFinderIgnoredBlockers?: GameObject[];
    maxExpandedPathNodes?: number;
    stopOnBlocker?: GameObject;
    forceWaitOnPathBlocked?: boolean;
}
interface PathNode {
    tile: Tile;
    onBridge?: Bridge;
}
interface BlockedPathNode {
    node: PathNode;
    obj: GameObject;
}
interface GroundPathPlan {
    path: PathNode[];
    ignoredBlockers: GameObject[];
    blockedPathNodes: BlockedPathNode[];
}
interface TargetLinesConfig {
    pathNodes: PathNode[];
    isRecalc?: boolean;
}
interface UnreachableTarget {
    tile: Tile;
    toBridge: boolean;
}
export class MoveTask extends Task {
    protected game: Game;
    protected targetTile: Tile;
    protected toBridge: boolean;
    protected options?: MoveOptions;
    public preventOpportunityFire = false;
    private logger: typeof Logger;
    private destinationLeptons: Vector2;
    private currentWaypointLeptons: Vector2;
    private needsPathUpdate = false;
    private targetChangeRequested?: {
        tile: Tile;
        toBridge: boolean;
        onlyIfPathExists?: boolean;
    };
    private allObstaclesAreBlockers = false;
    private blockedPathNodes: BlockedPathNode[] = [];
    private unreachableTargets: UnreachableTarget[] = [];
    private pushTried = false;
    private cancelProcessed = false;
    private cancelRepositionPending = false;
    private targetLinesConfig: TargetLinesConfig;
    private path?: PathNode[];
    private groundPathPlan?: GroundPathPlan;
    private targetOffset?: Vector2;
    private inPlanningForTicks?: number;
    constructor(game: Game, targetTile: Tile, toBridge: boolean, options?: MoveOptions) {
        super();
        this.game = game;
        this.targetTile = targetTile;
        this.toBridge = toBridge;
        this.options = options;
        this.logger = AppLogger.get("move") as any;
        this.destinationLeptons = new Vector2();
        this.currentWaypointLeptons = new Vector2();
        this.targetLinesConfig = { pathNodes: [] };
    }
    duplicate(): MoveTask {
        return new MoveTask(this.game, this.targetTile, this.toBridge, this.options);
    }
    setForceMove(force: boolean): void {
        if (force) {
            this.options ??= {};
            this.options.forceMove = true;
        }
        else if (this.options?.forceMove) {
            this.options.forceMove = undefined;
        }
    }
    onStart(unit: Unit): void {
        if (unit.moveTrait.currentWaypoint) {
            throw new Error("Nested move tasks are not supported");
        }
        if (unit.moveTrait.locomotor === undefined) {
            unit.moveTrait.locomotor = new LocomotorFactory(this.game).create(unit);
        }
        if (unit.moveTrait.lastTargetOffset) {
            this.targetOffset = unit.moveTrait.lastTargetOffset;
        }
        else {
            this.targetOffset = this.computeTargetOffset(unit);
        }
        if (unit.moveTrait.lastVelocity) {
            unit.moveTrait.velocity = unit.moveTrait.lastVelocity;
        }
        if (!this.path) {
            if (this.groundPathPlan) {
                if (this.groundPathPlan.path[this.groundPathPlan.path.length - 1].tile === unit.tile) {
                    this.path = this.applyGroundPathPlan(this.groundPathPlan);
                }
                else {
                    this.computePath(unit, unit.moveTrait.locomotor);
                }
                this.groundPathPlan = undefined;
            }
            else {
                this.computePath(unit, unit.moveTrait.locomotor);
            }
            this.targetLinesConfig.isRecalc = false;
        }
        this.updateDestination(this.path, this.targetOffset);
        unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
        unit.moveTrait.lastMoveResult = undefined;
        unit.moveTrait.lastTargetOffset = undefined;
        unit.moveTrait.lastVelocity = undefined;
    }
    private computeTargetOffset(unit: Unit): Vector2 {
        return this.options?.targetOffset ??
            (unit.isInfantry()
                ? unit.position.getTileOffset()
                : unit.position.computeSubCellOffset(0));
    }
    private computePath(unit: Unit, locomotor: Locomotor, onlyIfPathExists = false): boolean {
        let path: PathNode[];
        if (this.options?.allowOutOfBoundsTarget ||
            this.game.map.mapBounds.isWithinBounds(this.targetTile)) {
            if (unit.rules.movementZone === MovementZone.Fly) {
                path = this.computeAirPath(unit);
            }
            else if ((locomotor as any).ignoresTerrain) {
                path = this.computeDirectJumpPath(unit);
            }
            else {
                const plan = this.computeGroundPath(unit);
                if (onlyIfPathExists && !plan.path.length) {
                    return false;
                }
                path = this.applyGroundPathPlan(plan);
            }
        }
        else {
            path = [];
        }
        if (unit.rules.movementZone === MovementZone.Fly) {
            this.targetLinesConfig.pathNodes = path.map(({ tile, onBridge }) => ({
                tile,
                onBridge
            }));
            if (path.length) {
                this.targetLinesConfig.pathNodes[0].onBridge = this.toBridge
                    ? this.game.map.tileOccupation.getBridgeOnTile(this.targetTile)
                    : undefined;
            }
        }
        else {
            this.targetLinesConfig.pathNodes = path;
        }
        this.path = path;
        return true;
    }
    private computeAirPath(unit: Unit): PathNode[] {
        return [
            { tile: this.targetTile, onBridge: undefined },
            { tile: unit.tile, onBridge: undefined }
        ];
    }
    private computeDirectJumpPath(unit: Unit): PathNode[] {
        const map = this.game.map;
        const unitBridge = unit.onBridge
            ? map.tileOccupation.getBridgeOnTile(unit.tile)
            : undefined;
        let targetTile = this.targetTile;
        let targetBridge = this.toBridge
            ? map.tileOccupation.getBridgeOnTile(this.targetTile)
            : undefined;
        const ignoredBlockers = this.options?.ignoredBlockers;
        const finder = new RadialTileFinder(map.tiles, map.mapBounds, targetTile, { width: 1, height: 1 }, 0, 5, (tile) => {
            return (map.terrain.getPassableSpeed(tile, unit.rules.speedType, unit.isInfantry(), !!tile.onBridgeLandType, ignoredBlockers) > 0 &&
                !map.terrain
                    .findObstacles({ tile, onBridge: !!tile.onBridgeLandType as any }, unit)
                    .find((obstacle) => !ignoredBlockers?.includes(obstacle.obj)));
        });
        const newTile = finder.getNextTile();
        if (!newTile) {
            return [];
        }
        if (newTile !== targetTile) {
            targetTile = newTile;
            targetBridge = map.tileOccupation.getBridgeOnTile(targetTile);
        }
        return [
            { tile: targetTile, onBridge: targetBridge },
            { tile: unit.tile, onBridge: unitBridge }
        ];
    }
    private computeGroundPath(unit: Unit): GroundPathPlan {
        let startTile = unit.tile;
        let startBridge = unit.onBridge
            ? this.game.map.tileOccupation.getBridgeOnTile(startTile)
            : undefined;
        if (unit.moveTrait.moveState === MoveState.Moving &&
            unit.moveTrait.currentWaypoint) {
            startTile = unit.moveTrait.currentWaypoint.tile;
            startBridge = unit.moveTrait.currentWaypoint.onBridge;
        }
        const plan: GroundPathPlan = {
            path: [],
            ignoredBlockers: [],
            blockedPathNodes: []
        };
        const startBuilding = this.game.map
            .getObjectsOnTile(startTile)
            .find((obj) => obj.isBuilding());
        if (startBuilding &&
            !this.game.map.terrain.getPassableSpeed(startTile, unit.rules.speedType, unit.isInfantry(), false)) {
            const isIgnored = this.options?.ignoredBlockers?.includes(startBuilding);
            if (!isIgnored) {
                plan.ignoredBlockers.push(startBuilding);
            }
            if (!isIgnored && startBuilding.dockTrait) {
                const dockTiles = new Set(startBuilding.dockTrait?.getAllDockTiles());
                const buildingTiles = this.game.map.tileOccupation.calculateTilesForGameObject(startBuilding.tile, startBuilding);
                buildingTiles
                    .filter((tile) => !dockTiles.has(tile))
                    .forEach((tile) => plan.blockedPathNodes.push({
                    node: { tile, onBridge: undefined },
                    obj: startBuilding
                }));
            }
        }
        const disguisedUnit = this.game.map
            .getGroundObjectsOnTile(this.targetTile)
            .find((obj) => (obj.isInfantry() || obj.isVehicle()) &&
            obj.disguiseTrait?.hasTerrainDisguise() &&
            !(this.game.alliances.haveSharedIntel(unit.owner, obj.owner) ||
                obj.owner.sharedDetectDisguiseTrait?.has(unit)));
        if (disguisedUnit) {
            const bridge = this.toBridge
                ? this.game.map.tileOccupation.getBridgeOnTile(this.targetTile)
                : undefined;
            plan.blockedPathNodes.push({
                node: { tile: this.targetTile, onBridge: bridge },
                obj: disguisedUnit
            });
        }
        const ignoredBlockers = [
            ...new Set([
                ...(this.options?.ignoredBlockers ?? []),
                ...plan.ignoredBlockers
            ])
        ];
        const allBlockedNodes = [...this.blockedPathNodes, ...plan.blockedPathNodes];
        const path = this.game.map.terrain.computePath(unit.rules.speedType, unit.isInfantry(), startTile, !!startBridge, this.targetTile, this.toBridge, {
            maxExpandedNodes: this.allObstaclesAreBlockers
                ? Math.min(300, this.options?.maxExpandedPathNodes ?? Number.POSITIVE_INFINITY)
                : this.options?.maxExpandedPathNodes,
            bestEffort: !this.options?.strictCloseEnough,
            ignoredBlockers: [
                ...new Set([
                    ...ignoredBlockers,
                    ...(this.options?.pathFinderIgnoredBlockers ?? [])
                ])
            ],
            excludeTiles: this.allObstaclesAreBlockers || allBlockedNodes.length
                ? (node) => this.nodeIsBlockedForPathfinding(node, unit, ignoredBlockers, allBlockedNodes)
                : undefined
        });
        plan.path = path;
        return plan;
    }
    private nodeIsBlockedForPathfinding(node: PathNode, unit: Unit, ignoredBlockers: GameObject[], blockedNodes: BlockedPathNode[]): boolean {
        if (this.allObstaclesAreBlockers) {
            return !!this.game.map.terrain
                .findObstacles(node, unit)
                .find((obstacle) => !ignoredBlockers?.includes(obstacle.obj));
        }
        return !!blockedNodes.find(({ node: blockedNode }) => blockedNode.tile === node.tile && blockedNode.onBridge === node.onBridge);
    }
    private applyGroundPathPlan(plan: GroundPathPlan): PathNode[] {
        this.blockedPathNodes = this.blockedPathNodes.filter((blocked) => blocked.obj.isSpawned && blocked.node.tile === blocked.obj.tile);
        if (plan.ignoredBlockers.length) {
            this.options ??= {};
            this.options.ignoredBlockers ??= [];
            this.options.ignoredBlockers.push(...plan.ignoredBlockers);
        }
        this.blockedPathNodes.push(...plan.blockedPathNodes);
        return plan.path;
    }
    private updateDestination(path: PathNode[], offset: Vector2): void {
        const tile = path.length ? path[0].tile : this.targetTile;
        this.destinationLeptons
            .set(tile.rx * Coords.LEPTONS_PER_TILE, tile.ry * Coords.LEPTONS_PER_TILE)
            .add(offset);
    }
    protected canStopAtTile(unit: Unit, tile: Tile, onBridge: boolean): boolean {
        if (unit.zone === ZoneType.Air) {
            if ((!unit.isAircraft() || !unit.airportBoundTrait) &&
                !unit.rules.spawned &&
                (!this.options?.forceMove ||
                    !unit.rules.balloonHover ||
                    unit.rules.hoverAttack) &&
                (!this.game.map.terrain.getPassableSpeed(tile, SpeedType.Amphibious, false, onBridge) ||
                    this.game.map
                        .getObjectsOnTile(tile)
                        .filter((obj) => (obj.isBuilding() &&
                        !obj.isDestroyed &&
                        !obj.dockTrait?.hasReservedDockForUnit(unit) &&
                        !unit.rules.dock.includes(obj.name)) ||
                        (obj.isUnit() &&
                            obj.tile === tile &&
                            obj.moveTrait.moveState !== MoveState.Moving &&
                            obj !== unit)).length)) {
                return false;
            }
        }
        else if (unit.isInfantry()) {
            const infantryOnTile = this.game.map
                .getGroundObjectsOnTile(tile)
                .filter((obj) => obj.isInfantry() &&
                obj.tile === tile &&
                obj.onBridge === onBridge &&
                obj.moveTrait.moveState !== MoveState.Moving &&
                obj !== unit);
            if (infantryOnTile.length > 2 ||
                infantryOnTile.find((inf) => inf.position.subCell === unit.position.subCell)) {
                return false;
            }
        }
        if (unit.zone !== ZoneType.Air &&
            unit.rules.tooBigToFitUnderBridge &&
            !onBridge &&
            tile.onBridgeLandType &&
            this.game.map.tileOccupation
                .getBridgeOnTile(tile)
                ?.isHighBridge()) {
            return false;
        }
        if (!this.isCancelling() &&
            this.options?.strictCloseEnough &&
            this.options?.closeEnoughTiles !== undefined &&
            !this.isCloseEnoughToDest(unit, tile, this.options.closeEnoughTiles)) {
            return false;
        }
        return true;
    }
    protected isCloseEnoughToDest(unit: Unit, tile: Tile, maxDistance?: number): boolean {
        if (maxDistance === undefined) {
            return true;
        }
        const rangeHelper = new RangeHelper(this.game.map.tileOccupation);
        return rangeHelper.tileDistance(this.targetTile, tile) <= maxDistance;
    }
    protected hasReachedDestination(unit: Unit): boolean {
        return !this.path!.length;
    }
    updateTarget(tile: Tile, toBridge: boolean, onlyIfPathExists = false): void {
        this.needsPathUpdate = true;
        this.targetChangeRequested = {
            tile,
            toBridge,
            onlyIfPathExists
        };
    }
    onEnd(unit: Unit): void {
        unit.moveTrait.collisionState = CollisionState.Resolved;
        unit.moveTrait.currentWaypoint = undefined;
        if (!this.targetOffset!.equals(this.computeTargetOffset(unit))) {
            unit.moveTrait.lastTargetOffset = this.targetOffset;
        }
    }
    forceCancel(unit: Unit): boolean {
        if (!this.cancellable || this.children.some((child) => !child.cancellable)) {
            return false;
        }
        if (!this.options?.allowOutOfBoundsTarget &&
            !this.game.map.isWithinBounds(unit.tile)) {
            return false;
        }
        if (this.status === TaskStatus.Running || this.status === TaskStatus.Cancelling) {
            unit.moveTrait.unreservePathNodes();
            unit.moveTrait.lastMoveResult = MoveResult.Cancel;
            this.onEnd(unit);
            unit.moveTrait.lastTargetOffset = this.targetOffset;
            unit.moveTrait.lastVelocity = unit.moveTrait.velocity.clone();
        }
        this.status = TaskStatus.Cancelled;
        return true;
    }
    onTick(unit: Unit): boolean {
        if (unit.moveTrait.isDisabled() &&
            unit.moveTrait.moveState === MoveState.ReachedNextWaypoint) {
            if (this.isCancelling()) {
                unit.moveTrait.lastMoveResult = MoveResult.Cancel;
                return true;
            }
            return false;
        }
        if (this.needsPathUpdate) {
            if (unit.moveTrait.moveState === MoveState.PlanMove) {
                this.inPlanningForTicks = undefined;
                unit.moveTrait.currentWaypoint = undefined;
                unit.moveTrait.collisionState = CollisionState.Resolved;
                unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                unit.moveTrait.velocity.set(0, 0, 0);
            }
            const previousTargetTile = this.targetTile;
            const previousToBridge = this.toBridge;
            if (this.targetChangeRequested) {
                this.targetTile = this.targetChangeRequested.tile;
                this.toBridge = this.targetChangeRequested.toBridge;
            }
            if (this.computePath(unit, unit.moveTrait.locomotor, this.targetChangeRequested?.onlyIfPathExists)) {
                if (!this.path!.length) {
                    this.unreachableTargets.push({
                        tile: this.targetTile,
                        toBridge: this.toBridge
                    });
                }
                this.updateDestination(this.path!, this.targetOffset!);
                this.allObstaclesAreBlockers = false;
            }
            else {
                this.targetTile = previousTargetTile;
                this.toBridge = previousToBridge;
                this.targetLinesConfig.pathNodes = [...this.targetLinesConfig.pathNodes];
            }
            this.targetLinesConfig.isRecalc = !this.targetChangeRequested;
            this.targetChangeRequested = undefined;
            this.needsPathUpdate = false;
        }
        const map = this.game.map;
        if (unit.moveTrait.moveState === MoveState.ReachedNextWaypoint) {
            unit.moveTrait.unreservePathNodes();
            const waypointIndex = this.path!.findIndex((node) => node === unit.moveTrait.currentWaypoint);
            if (waypointIndex !== -1) {
                this.path!.splice(waypointIndex);
            }
            else {
                this.path!.pop();
            }
            unit.moveTrait.currentWaypoint = undefined;
            if (this.isCancelling() ? !this.cancelProcessed : this.hasReachedDestination(unit)) {
                const notCloseEnough = !this.isCancelling() &&
                    !this.isCloseEnoughToDest(unit, unit.tile, this.options?.closeEnoughTiles);
                if (!notCloseEnough && this.canStopAtTile(unit, unit.tile, unit.onBridge)) {
                    unit.moveTrait.lastMoveResult = this.isCancelling()
                        ? MoveResult.Cancel
                        : MoveResult.Success;
                    return true;
                }
                if (this.unreachableTargets.length > MAX_UNREACHABLE_TARGETS) {
                    unit.moveTrait.lastMoveResult = MoveResult.Fail;
                    this.log(unit, "bail_max_unreachable_dest");
                    return true;
                }
                let relocTile = unit.tile;
                let relocBridge = unit.onBridge
                    ? map.tileOccupation.getBridgeOnTile(relocTile)
                    : undefined;
                if (notCloseEnough) {
                    relocTile = this.targetTile;
                    relocBridge = this.toBridge
                        ? map.tileOccupation.getBridgeOnTile(relocTile)
                        : undefined;
                }
                const newTile = this.findRelocationTile(relocTile, relocBridge, unit);
                if (!newTile) {
                    unit.moveTrait.lastMoveResult = notCloseEnough
                        ? MoveResult.Fail
                        : MoveResult.CloseEnough;
                    this.log(unit, "bail_no_free_dest");
                    return true;
                }
                const newBridge = !relocBridge || relocBridge.isHighBridge()
                    ? map.tileOccupation.getBridgeOnTile(newTile)
                    : undefined;
                this.updateTarget(newTile, !!newBridge);
                if (this.isCancelling()) {
                    this.cancelProcessed = true;
                    this.cancelRepositionPending = true;
                }
                return false;
            }
            if (this.cancelProcessed && !this.path!.length) {
                unit.moveTrait.lastMoveResult = MoveResult.Cancel;
                return true;
            }
            this.cancelProcessed = false;
            unit.moveTrait.moveState = MoveState.PlanMove;
            const locomotor = unit.moveTrait.locomotor;
            unit.moveTrait.currentWaypoint = locomotor.selectNextWaypoint
                ? locomotor.selectNextWaypoint(unit, this.path!)
                : this.path![this.path!.length - 1];
            this.currentWaypointLeptons
                .set(unit.moveTrait.currentWaypoint.tile.rx, unit.moveTrait.currentWaypoint.tile.ry)
                .multiplyScalar(Coords.LEPTONS_PER_TILE)
                .add(this.targetOffset!);
            const newWaypointTasks = locomotor.onNewWaypoint(unit, this.currentWaypointLeptons, this.destinationLeptons);
            if (newWaypointTasks) {
                this.children.push(...newWaypointTasks);
                return false;
            }
        }
        if (unit.moveTrait.moveState === MoveState.PlanMove) {
            if (this.isCancelling() && !this.cancelRepositionPending) {
                unit.moveTrait.currentWaypoint = undefined;
                unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                return this.onTick(unit);
            }
            this.inPlanningForTicks = this.inPlanningForTicks === undefined
                ? 0
                : this.inPlanningForTicks + 1;
            if (this.inPlanningForTicks > MAX_PLANNING_TICKS) {
                this.needsPathUpdate = true;
                this.allObstaclesAreBlockers = true;
                unit.moveTrait.velocity.set(0, 0, 0);
                this.log(unit, "repath_plan_timeout");
                return false;
            }
            if (unit.rules.movementZone !== MovementZone.Fly &&
                !unit.moveTrait.locomotor.ignoresTerrain) {
                const pathToCheck = this.path!
                    .slice(this.path!.indexOf(unit.moveTrait.currentWaypoint!))
                    .reverse();
                const currentVelocity = unit.moveTrait.velocity.length();
                for (const node of pathToCheck) {
                    if (node.onBridge?.isDestroyed) {
                        node.onBridge = undefined;
                    }
                }
                for (const node of pathToCheck) {
                    if (!map.terrain.getPassableSpeed(node.tile, unit.rules.speedType, unit.isInfantry(), !!node.onBridge, this.options?.ignoredBlockers)) {
                        if (this.options?.stopOnBlocker &&
                            map.terrain
                                .findObstacles(node, unit)
                                .some((obstacle) => obstacle.obj === this.options.stopOnBlocker)) {
                            unit.moveTrait.lastMoveResult = MoveResult.CloseEnough;
                            return true;
                        }
                        this.needsPathUpdate = true;
                        unit.moveTrait.currentWaypoint = undefined;
                        unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                        return this.onTick(unit);
                    }
                    if (!node.onBridge) {
                        const crate = map
                            .getGroundObjectsOnTile(node.tile)
                            .find((obj) => obj.isOverlay() && obj.rules.crate);
                        if (crate) {
                            if (this.game.crateGeneratorTrait.peekInsideCrate(crate) === PowerupType.Unit) {
                                this.game.crateGeneratorTrait.pickupCrate(unit, crate, this.game);
                                const spawnedUnit = this.game.map
                                    .getGroundObjectsOnTile(node.tile)
                                    .find((obj) => obj.isUnit() && !obj.onBridge);
                                if (spawnedUnit) {
                                    this.needsPathUpdate = true;
                                    this.blockedPathNodes.push({ node, obj: spawnedUnit });
                                    unit.moveTrait.currentWaypoint = undefined;
                                    unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                                    return this.onTick(unit);
                                }
                            }
                        }
                    }
                    const obstacles = map.terrain
                        .findObstacles(node, unit)
                        .filter((obstacle) => !this.options?.ignoredBlockers?.includes(obstacle.obj));
                    for (const obstacle of obstacles) {
                        if (obstacle.static) {
                            this.needsPathUpdate = true;
                            unit.moveTrait.currentWaypoint = undefined;
                            unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                            return this.onTick(unit);
                        }
                        if (obstacle.obj.rules.crushable) {
                            if ([SpeedType.Track, SpeedType.Hover].includes(unit.rules.speedType) &&
                                unit.crusher &&
                                (!obstacle.obj.isTechno() || !this.game.areFriendly(obstacle.obj, unit))) {
                                continue;
                            }
                            if (!obstacle.obj.isTechno()) {
                                this.needsPathUpdate = true;
                                unit.moveTrait.currentWaypoint = undefined;
                                unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                                return this.onTick(unit);
                            }
                        }
                        if (obstacle.obj.isTerrain()) {
                            if (!unit.isInfantry()) {
                                throw new Error(`Obstacle ${obstacle.obj.name} should be a blocker for non infantry`);
                            }
                            const freeSubCell = this.findFreeSubCell(unit, node);
                            if (freeSubCell !== undefined) {
                                this.relocateToSubCell(unit, freeSubCell);
                            }
                            else {
                                this.needsPathUpdate = true;
                                this.blockedPathNodes.push({ node, obj: obstacle.obj });
                                unit.moveTrait.currentWaypoint = undefined;
                                unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                            }
                            return this.onTick(unit);
                        }
                        if (!obstacle.obj.isTechno()) {
                            throw new Error("Unexpected obstacle of type " + obstacle.obj.type);
                        }
                        const blocker = obstacle.obj as Unit;
                        const blockerVelocity = blocker.isUnit() ? blocker.moveTrait.velocity.length() : 0;
                        if (blocker.isAircraft() &&
                            blocker.zone === ZoneType.Ground &&
                            this.options?.ignoredBlockers?.some((ignored) => ignored.isBuilding() && ignored.dockTrait?.isDocked(blocker))) {
                            continue;
                        }
                        if (pathToCheck.length === 1 &&
                            blocker.isUnit() &&
                            blockerVelocity &&
                            currentVelocity &&
                            currentVelocity <= blockerVelocity &&
                            unit.direction === blocker.direction &&
                            blocker.tile === node.tile &&
                            blocker.moveTrait.currentWaypoint?.tile !== node.tile) {
                            break;
                        }
                        if (blocker.isBuilding() ||
                            blocker.moveTrait.moveState === MoveState.Idle ||
                            blocker.moveTrait.collisionState !== CollisionState.Resolved) {
                            if (!currentVelocity &&
                                unit.moveTrait.collisionState !== CollisionState.Resolved &&
                                blocker.isUnit() &&
                                blocker.moveTrait.collisionState !== CollisionState.Resolved) {
                                if (this.inPlanningForTicks + 1 > MAX_PLANNING_TICKS) {
                                    this.needsPathUpdate = true;
                                    this.allObstaclesAreBlockers = true;
                                    this.log(unit, "repath_waited_too_long_blocker " + blocker.id);
                                    unit.moveTrait.velocity.set(0, 0, 0);
                                }
                                return false;
                            }
                            if (blocker.isInfantry() &&
                                unit.isInfantry() &&
                                blocker.moveTrait.collisionState === CollisionState.Resolved) {
                                const freeSubCell = this.findFreeSubCell(unit, node);
                                if (freeSubCell !== undefined) {
                                    this.relocateToSubCell(unit, freeSubCell);
                                    return this.onTick(unit);
                                }
                            }
                            const freeWaypointIndex = findIndexReverse(this.path!.slice(0, this.path!.indexOf(node)), (waypoint) => !map.terrain
                                .findObstacles(waypoint, unit)
                                .filter((obstacle) => !this.options?.ignoredBlockers?.includes(obstacle.obj)).length);
                            if (freeWaypointIndex === -1) {
                                if (this.canStopAtTile(unit, unit.tile, unit.onBridge) &&
                                    this.isCloseEnoughToDest(unit, unit.tile, this.options?.closeEnoughTiles)) {
                                    unit.moveTrait.lastMoveResult = MoveResult.CloseEnough;
                                    this.log(unit, "bail_waypoints_blocked_close_enough");
                                    return true;
                                }
                                if (!(this.options?.closeEnoughTiles === 0 ||
                                    (Math.abs(unit.tile.rx - this.targetTile.rx) <= 1 &&
                                        Math.abs(unit.tile.ry - this.targetTile.ry) <= 1))) {
                                    this.needsPathUpdate = true;
                                    this.blockedPathNodes.push(...this.path!
                                        .slice(0, this.path!.indexOf(node) + 1)
                                        .map((waypoint) => ({
                                        node: waypoint,
                                        obj: map.terrain.findObstacles(waypoint, unit)[0].obj
                                    })));
                                    unit.moveTrait.velocity.set(0, 0, 0);
                                    this.log(unit, "repath_waypoints_blocked_too_far");
                                    return false;
                                }
                            }
                            let alternatePath: PathNode[] = [];
                            if (freeWaypointIndex !== -1) {
                                const targetWaypoint = this.path![freeWaypointIndex];
                                alternatePath = map.terrain.computePath(unit.rules.speedType, unit.isInfantry(), unit.tile, unit.onBridge, targetWaypoint.tile, !!targetWaypoint.onBridge, {
                                    maxExpandedNodes: 15,
                                    bestEffort: false,
                                    excludeTiles: (testNode) => !!map.terrain
                                        .findObstacles(testNode, unit)
                                        .filter((obstacle) => !this.options?.ignoredBlockers?.includes(obstacle.obj)).length,
                                    ignoredBlockers: this.options?.ignoredBlockers
                                });
                            }
                            if (!alternatePath.length &&
                                blocker.owner === unit.owner &&
                                pathToCheck.length === 1) {
                            }
                            else if (alternatePath.length) {
                                this.path!.splice(freeWaypointIndex, this.path!.length, ...alternatePath);
                                unit.moveTrait.currentWaypoint = undefined;
                                unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                                return this.onTick(unit);
                            }
                            else {
                                const weapon = this.selectWeaponVsObstacle(unit, blocker);
                                if (weapon) {
                                    this.children.push(unit.attackTrait.createAttackTask(this.game, blocker, blocker.tile, weapon, { passive: true, holdGround: true }));
                                    unit.moveTrait.velocity.set(0, 0, 0);
                                }
                                else if (this.options?.forceWaitOnPathBlocked) {
                                    this.children.push(new WaitTicksTask(WAIT_TICKS));
                                    this.inPlanningForTicks = 0;
                                    unit.moveTrait.velocity.set(0, 0, 0);
                                    unit.moveTrait.collisionState = CollisionState.Waiting;
                                }
                                else {
                                    this.needsPathUpdate = true;
                                    this.blockedPathNodes.push({ node, obj: blocker });
                                    if (blocker.isBuilding()) {
                                        this.allObstaclesAreBlockers = true;
                                    }
                                    this.log(unit, "repath_unavoidable_blocker " + blocker.id);
                                    unit.moveTrait.velocity.set(0, 0, 0);
                                }
                                return false;
                            }
                            const blockerHasTasks = blocker.unitOrderTrait.hasTasks();
                            if (this.pushTried ||
                                blocker.isBuilding() ||
                                blocker.moveTrait.collisionState === CollisionState.Waiting ||
                                blockerHasTasks ||
                                (blocker.isAircraft() && blocker.missileSpawnTrait)) {
                                if (!this.options?.forceWaitOnPathBlocked &&
                                    (blocker.isBuilding() ||
                                        (blockerHasTasks && blocker.moveTrait.moveState === MoveState.Idle) ||
                                        this.inPlanningForTicks + WAIT_TICKS > MAX_PLANNING_TICKS)) {
                                    this.needsPathUpdate = true;
                                    this.allObstaclesAreBlockers = true;
                                    this.log(unit, "repath_blocker_busy_wait_timeout " + blocker.id);
                                    unit.moveTrait.velocity.set(0, 0, 0);
                                }
                                else {
                                    this.children.push(new WaitTicksTask(WAIT_TICKS));
                                    if (this.options?.forceWaitOnPathBlocked) {
                                        this.inPlanningForTicks = 0;
                                    }
                                    else {
                                        this.inPlanningForTicks += WAIT_TICKS;
                                    }
                                    unit.moveTrait.velocity.set(0, 0, 0);
                                    unit.moveTrait.collisionState = CollisionState.Waiting;
                                }
                                return false;
                            }
                            const pushDirection = new Vector2(blocker.tile.rx - unit.tile.rx, blocker.tile.ry - unit.tile.ry);
                            this.pushTried = true;
                            blocker.unitOrderTrait.addTask(new MoveAsideTask(this.game, pushDirection));
                            this.children.push(new WaitTicksTask(1));
                            unit.moveTrait.velocity.set(0, 0, 0);
                            unit.moveTrait.collisionState = CollisionState.Waiting;
                            this.log(unit, "push " + blocker.id);
                            return false;
                        }
                        if (blocker.isInfantry() && unit.isInfantry()) {
                            const freeSubCell = this.findFreeSubCell(unit, node);
                            if (freeSubCell !== undefined) {
                                this.relocateToSubCell(unit, freeSubCell);
                                return this.onTick(unit);
                            }
                        }
                        if (!currentVelocity) {
                            if (this.inPlanningForTicks > WAIT_TICKS) {
                                unit.moveTrait.collisionState = CollisionState.Waiting;
                            }
                            return false;
                        }
                        if (Math.abs(unit.direction - blocker.direction) === 180) {
                            unit.moveTrait.velocity.set(0, 0, 0);
                            unit.moveTrait.collisionState = CollisionState.Waiting;
                            return false;
                        }
                        if (Math.abs(unit.direction - blocker.direction) <= 45 &&
                            blockerVelocity * VELOCITY_FACTOR < currentVelocity) {
                            const nodeIndex = this.path!.indexOf(node);
                            if (nodeIndex >= 5) {
                                const backtrackIndex = findIndexReverse(this.path!.slice(0, nodeIndex - 5), (waypoint) => !map.terrain.findObstacles(waypoint, unit).length);
                                if (backtrackIndex !== -1) {
                                    const backtrackTarget = this.path![backtrackIndex];
                                    const backtrackPath = map.terrain.computePath(unit.rules.speedType, unit.isInfantry(), unit.tile, unit.onBridge, backtrackTarget.tile, !!backtrackTarget.onBridge, {
                                        maxExpandedNodes: 15,
                                        bestEffort: false,
                                        excludeTiles: (testNode) => !!map.terrain.findObstacles(testNode, unit).length ||
                                            this.path!.findIndex((waypoint) => waypoint.tile === testNode.tile &&
                                                waypoint.onBridge === testNode.onBridge) > backtrackIndex
                                    });
                                    if (backtrackPath.length) {
                                        this.path!.splice(backtrackIndex, this.path!.length, ...backtrackPath);
                                        unit.moveTrait.currentWaypoint = undefined;
                                        unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                                        return this.onTick(unit);
                                    }
                                }
                            }
                            unit.moveTrait.collisionState = CollisionState.Waiting;
                            unit.moveTrait.velocity.set(0, 0, 0);
                            return false;
                        }
                        unit.moveTrait.velocity.set(0, 0, 0);
                        unit.moveTrait.collisionState = CollisionState.Waiting;
                        return false;
                    }
                }
                if (unit.rules.speedType === SpeedType.Track && currentVelocity) {
                    const currentIndex = this.path!.indexOf(unit.moveTrait.currentWaypoint!);
                    if (currentIndex > 0) {
                        const nextNode = this.path![currentIndex - 1];
                        for (const crushable of map
                            .getGroundObjectsOnTile(nextNode.tile)
                            .filter((obj) => obj.isUnit() &&
                            obj.onBridge === !!nextNode.onBridge &&
                            obj.rules.crushable &&
                            obj.veteranTrait?.hasVeteranAbility(VeteranAbility.SCATTER) &&
                            !this.game.areFriendly(obj, unit))) {
                            if (!crushable.unitOrderTrait.hasTasks()) {
                                crushable.unitOrderTrait.addTask(new ScatterTask(this.game, undefined, undefined));
                            }
                        }
                    }
                }
                if (!unit.moveTrait.reservedPathNodes.length) {
                    unit.moveTrait.reservedPathNodes.push(...pathToCheck);
                    pathToCheck.forEach((node) => {
                        map.tileOccupation.occupySingleTile(node.tile, unit);
                    });
                }
            }
            unit.moveTrait.moveState = MoveState.Moving;
            this.inPlanningForTicks = undefined;
            this.unreachableTargets.length = 0;
            this.pushTried = false;
            if (unit.moveTrait.collisionState === CollisionState.Waiting) {
                unit.moveTrait.collisionState = CollisionState.Resolved;
            }
        }
        if (unit.moveTrait.moveState === MoveState.Moving) {
            const locomotor = unit.moveTrait.locomotor;
            const { distance, done, isTeleport } = locomotor.tick(unit, this.currentWaypointLeptons, this.destinationLeptons, (this.isCancelling() || !this.path!.length) && !this.cancelRepositionPending);
            if (isTeleport) {
                unit.traits.filter(NotifyTeleport).forEach((trait) => {
                    trait[NotifyTeleport.onBeforeTeleport](unit, this.game, true, true);
                });
            }
            if (distance.length()) {
                const oldTile = unit.tile;
                const allowOutOfBounds = locomotor.allowOutOfBounds;
                if (distance.y) {
                    const oldElevation = unit.tileElevation;
                    unit.position.moveByLeptons3(distance, allowOutOfBounds);
                    unit.moveTrait.handleElevationChange(oldElevation, this.game);
                }
                else {
                    unit.position.moveByLeptons(distance.x, distance.z, allowOutOfBounds);
                }
                if (unit.tile !== oldTile) {
                    const oldBridge = unit.onBridge
                        ? this.game.map.tileOccupation.getBridgeOnTile(oldTile)
                        : undefined;
                    const currentNode = findReverse(this.path!, (node) => node.tile === unit.tile);
                    let newBridge = currentNode
                        ? currentNode.onBridge
                        : oldBridge || unit.moveTrait.currentWaypoint!.onBridge
                            ? this.game.map.tileOccupation.getBridgeOnTile(unit.tile)
                            : undefined;
                    if (newBridge?.isDestroyed) {
                        newBridge = undefined;
                    }
                    unit.moveTrait.handleTileChange(oldTile, newBridge, false, this.game, isTeleport);
                    if (isTeleport) {
                        unit.moveTrait.lastTeleportTick = this.game.currentTick;
                        this.game.events.dispatch(new ObjectTeleportEvent(unit, true, oldTile));
                    }
                    if (unit.isDestroyed) {
                        return true;
                    }
                }
            }
            if (done) {
                unit.moveTrait.moveState = MoveState.ReachedNextWaypoint;
                return this.onTick(unit);
            }
        }
        return false;
    }
    private selectWeaponVsObstacle(unit: Unit, target: GameObject): Weapon | undefined {
        if (this.game.areFriendly(target, unit) ||
            !unit.attackTrait ||
            unit.attackTrait.isDisabled() ||
            !unit.attackTrait.isIdle()) {
            return undefined;
        }
        const weapon = unit.attackTrait.selectWeaponVersus(unit, target, this.game, false, true);
        if (!weapon ||
            weapon.name === unit.armedTrait?.deathWeapon?.name ||
            (weapon.rules.limboLaunch && weapon.warhead.rules.parasite) ||
            weapon.warhead.rules.mindControl) {
            return undefined;
        }
        return weapon;
    }
    protected findRelocationTile(preferredTile: Tile, preferredBridge: Bridge | undefined, unit: Unit): Tile | undefined {
        const map = this.game.map;
        if (unit.rules.movementZone === MovementZone.Fly) {
            const isValidTile = (tile: Tile): boolean => !map.tileOccupation
                .getGroundObjectsOnTile(tile)
                .some((obj) => (obj.isBuilding() && !obj.isDestroyed) ||
                obj.isTerrain() ||
                (obj.isOverlay() && obj.rules.isARock)) &&
                (unit.rules.locomotor !== LocomotorType.Jumpjet ||
                    map.terrain.getPassableSpeed(tile, SpeedType.Amphibious, unit.isInfantry(), !!tile.onBridgeLandType) > 0);
            const randomFinder = new RandomTileFinder(map.tiles, map.mapBounds, preferredTile, 1, this.game, isValidTile);
            let relocTile = randomFinder.getNextTile();
            if (!relocTile) {
                const radialFinder = new RadialTileFinder(map.tiles, map.mapBounds, preferredTile, unit.getFoundation(), 2, 15, isValidTile);
                relocTile = radialFinder.getNextTile();
            }
            return relocTile;
        }
        else {
            const islandMap = !this.options?.ignoredBlockers?.length &&
                map.terrain.getPassableSpeed(unit.tile, unit.rules.speedType, unit.isInfantry(), unit.onBridge)
                ? this.game.map.terrain.getIslandIdMap(unit.rules.speedType, unit.isInfantry())
                : undefined;
            const unitIslandId = islandMap?.get(unit.tile, unit.onBridge);
            const moveHelper = new MovePositionHelper(map);
            const finder = new RadialTileFinder(map.tiles, map.mapBounds, preferredTile, { width: 1, height: 1 }, 0, 5, (tile) => {
                const bridge = !preferredBridge || preferredBridge.isHighBridge()
                    ? map.tileOccupation.getBridgeOnTile(tile)
                    : undefined;
                return (!this.unreachableTargets.find((target) => target.tile === tile && target.toBridge === !!bridge) &&
                    (unit.zone === ZoneType.Air ||
                        (islandMap?.get(tile, !!bridge) === unitIslandId &&
                            !map.terrain.findObstacles({ tile, onBridge: bridge }, unit).length &&
                            moveHelper.isEligibleTile(tile as any, bridge, preferredBridge as any, preferredTile as any))) &&
                    this.canStopAtTile(unit, tile, !!bridge));
            });
            return finder.getNextTile();
        }
    }
    private findFreeSubCell(unit: Unit, node: PathNode): number | undefined {
        const groundObjects = this.game.map.getGroundObjectsOnTile(node.tile);
        const occupiedByInfantry = groundObjects
            .filter((obj) => obj.isInfantry() &&
            obj.onBridge === !!node.onBridge &&
            obj !== unit)
            .map((inf) => inf.position.desiredSubCell);
        const occupiedByTerrain = groundObjects
            .filter((obj) => obj.isTerrain())
            .map((terrain) => terrain.rules.getOccupiedSubCells(this.game.map.getTheaterType()))
            .flat();
        const allOccupied = [...occupiedByInfantry, ...occupiedByTerrain];
        return Infantry.SUB_CELLS.find((subCell) => !allOccupied.includes(subCell));
    }
    private relocateToSubCell(unit: Unit, subCell: number): void {
        unit.position.desiredSubCell = subCell;
        const newOffset = unit.position.computeSubCellOffset(subCell);
        this.targetOffset = newOffset;
        this.currentWaypointLeptons
            .set(unit.moveTrait.currentWaypoint!.tile.rx, unit.moveTrait.currentWaypoint!.tile.ry)
            .multiplyScalar(Coords.LEPTONS_PER_TILE)
            .add(this.targetOffset);
        this.updateDestination(this.path!, this.targetOffset);
        unit.moveTrait.locomotor.onWaypointUpdate?.(unit, this.currentWaypointLeptons, this.destinationLeptons);
    }
    getTargetLinesConfig(unit: Unit): TargetLinesConfig {
        if (!this.path) {
            const locomotor = new LocomotorFactory(this.game).create(unit);
            if ((this.options?.allowOutOfBoundsTarget ||
                this.game.map.mapBounds.isWithinBounds(this.targetTile)) &&
                unit.rules.movementZone !== MovementZone.Fly &&
                !(locomotor as any).ignoresTerrain &&
                unit.unitOrderTrait.getCurrentTask()?.isCancelling()) {
                if (!this.groundPathPlan) {
                    const plan = this.computeGroundPath(unit);
                    this.targetLinesConfig.pathNodes = plan.path;
                    if (plan.path.length) {
                        this.groundPathPlan = plan;
                    }
                }
            }
            else {
                unit.moveTrait.locomotor ??= locomotor;
                this.computePath(unit, unit.moveTrait.locomotor);
            }
            this.targetLinesConfig.isRecalc = false;
        }
        return this.targetLinesConfig;
    }
    private log(unit: Unit, message: string): void {
        this.logger.debug(`<${unit.id}>: ${message}`);
    }
}
