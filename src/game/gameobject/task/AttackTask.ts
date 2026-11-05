import { Task } from "@/game/gameobject/task/system/Task";
import { RangeHelper } from "@/game/gameobject/unit/RangeHelper";
import { WaitMinutesTask } from "@/game/gameobject/task/system/WaitMinutesTask";
import { WeaponType } from "@/game/WeaponType";
import { MoveInWeaponRangeTask } from "@/game/gameobject/task/move/MoveInWeaponRangeTask";
import { FacingUtil } from "@/game/gameobject/unit/FacingUtil";
import { TurnTask } from "@/game/gameobject/task/TurnTask";
import { WaitTicksTask } from "@/game/gameobject/task/system/WaitTicksTask";
import { AttackState, AttackTrait } from "@/game/gameobject/trait/AttackTrait";
import { GameObject } from "@/game/gameobject/GameObject";
import { LosHelper } from "@/game/gameobject/unit/LosHelper";
import { MoveResult } from "@/game/gameobject/trait/MoveTrait";
import { GameSpeed } from "@/game/GameSpeed";
import { Coords } from "@/game/Coords";
import { ObjectType } from "@/engine/type/ObjectType";
import { RadialTileFinder } from "@/game/map/tileFinder/RadialTileFinder";
import { MovePositionHelper } from "@/game/gameobject/unit/MovePositionHelper";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { MovementZone } from "@/game/type/MovementZone";
import { TaskStatus } from "@/game/gameobject/task/system/TaskStatus";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { Vector3 } from "@/game/math/Vector3";
import { Vector2 } from "@/game/math/Vector2";
const MAX_MOVE_ATTEMPTS = 3;
const FACING_TOLERANCE = 11.25;
const FACING_TOLERANCE_PROJECTILE = 4 * FACING_TOLERANCE;
interface AttackOptions {
    force?: boolean;
    passive?: boolean;
    holdGround?: boolean;
    leashTiles?: number;
    disallowTurning?: boolean;
}
interface TargetLinesConfig {
    target?: GameObject;
    pathNodes: Array<{
        tile: any;
        onBridge?: any;
    }>;
    isAttack?: boolean;
}
interface Position {
    tile: any;
    onBridge?: any;
}
export class AttackTask extends Task {
    public game: any;
    private target: any;
    private weapon: any;
    public options: AttackOptions;
    private moveExecuted: boolean = false;
    private moveAttempts: number = 0;
    private rangeCheckCooldown: number = 0;
    private lastInRangeTargetPosition: Vector3 = new Vector3();
    private lastInRangeSelfPosition: Vector3 = new Vector3();
    private initialIndirectTarget: boolean = false;
    private forceDropTarget: boolean = false;
    private rangeHelper: RangeHelper;
    private losHelper: LosHelper;
    private targetLinesConfig: TargetLinesConfig;
    private needsTargetUpdate?: any;
    private lastValidTargetPosition?: Position;
    private initialTargetOwner?: any;
    private initialSelfPosition?: Position;
    private lastTargetTpCheck?: number;
    private lastSelfTileBeforeMove?: any;
    private lastSelfMoveTargetTile?: any;
    constructor(game: any, target: any, weapon: any, options: AttackOptions = {}) {
        super();
        this.game = game;
        this.target = target;
        this.weapon = weapon;
        this.options = options;
        this.rangeHelper = new RangeHelper(game.map.tileOccupation);
        this.losHelper = new LosHelper(game.map.tiles, game.map.tileOccupation);
        this.targetLinesConfig = { pathNodes: [] };
        this.updateTargetLines(this.target, true);
    }
    duplicate(): AttackTask {
        return new AttackTask(this.game, this.target, this.weapon, this.options);
    }
    getWeapon(): any {
        return this.weapon;
    }
    setWeapon(weapon: any): void {
        this.weapon = weapon;
    }
    setForceAttack(force: boolean): void {
        this.options.force = force;
    }
    requestTargetUpdate(target: any): void {
        if (!this.target.equals(target)) {
            this.needsTargetUpdate = target;
        }
    }
    public onTargetChange(obj: any): void {
        const attackTrait = obj.attackTrait;
        const target = this.target;
        attackTrait.currentTarget = target;
        this.lastValidTargetPosition = target.obj
            ? { tile: target.tile, onBridge: target.getBridge() }
            : undefined;
        this.initialTargetOwner = target.obj?.isTechno()
            ? target.obj.owner
            : undefined;
        this.initialIndirectTarget =
            !target.obj &&
                this.game.map.tileOccupation
                    .getObjectsOnTile(target.tile)
                    .some((e: any) => (e.isOverlay() && !e.isBridgePlaceholder()) ||
                    e.isTerrain());
        this.updateTargetLines(target, true);
    }
    private updateTargetLines(target: any, isAttack: boolean): void {
        this.targetLinesConfig.target = target.obj;
        this.targetLinesConfig.pathNodes = target.obj
            ? []
            : [{ tile: target.tile, onBridge: target.getBridge() }];
        this.targetLinesConfig.isAttack = isAttack;
    }
    onStart(obj: any): void {
        if (!obj.attackTrait) {
            throw new Error(`Object ${obj.name} has no attack trait`);
        }
        if (obj.ammo === 0) {
            this.cancel();
            return;
        }
        const tileOccupation = this.game.map.tileOccupation;
        obj.attackTrait.attackState = AttackState.CheckRange;
        this.onTargetChange(obj);
        this.initialSelfPosition = {
            tile: obj.tile,
            onBridge: obj.isUnit() && obj.onBridge
                ? tileOccupation.getBridgeOnTile(obj.tile)
                : undefined,
        };
        if (this.weapon.rules.limboLaunch && obj.isUnit() && !this.target.obj) {
            this.forceDropTarget = true;
            const { reachable, fallback } = this.findReachableMeleePosition(this.target.tile, !!this.target.getBridge(), { width: 1, height: 1 }, obj);
            if (!reachable && fallback) {
                this.lastValidTargetPosition = fallback;
                this.updateTargetLines(this.game.createTarget(fallback.onBridge, fallback.tile), false);
            }
        }
        if (this.weapon.rules.limboLaunch &&
            this.target.obj?.isTechno() &&
            obj.isUnit() &&
            !this.rangeHelper.isInWeaponRange(obj, this.target.obj, this.weapon, this.game.rules)) {
            const { reachable, fallback } = this.findReachableMeleePosition(this.target.obj.tile, this.target.obj.isUnit() && this.target.obj.onBridge, this.target.obj.getFoundation(), obj);
            if (!reachable) {
                if ((obj.unitOrderTrait.waypointPath?.waypoints?.length ?? 0) > 1) {
                    this.cancel();
                }
                else {
                    this.forceDropTarget = true;
                    if (fallback) {
                        this.lastValidTargetPosition = fallback;
                        this.updateTargetLines(this.game.createTarget(fallback.onBridge, fallback.tile), false);
                    }
                }
            }
        }
        if (this.rangeHelper.isInWeaponRange(obj, this.target.obj ?? this.target.tile, this.weapon, this.game.rules) &&
            obj.isUnit() &&
            obj.rules.movementZone === MovementZone.Fly &&
            obj.zone !== ZoneType.Air &&
            (obj.rules.hoverAttack || obj.isAircraft())) {
            this.children.push(new MoveTask(this.game, obj.tile, false).setCancellable(false));
        }
    }
    private findReachableMeleePosition(targetTile: any, onBridge: boolean, foundation: any, obj: any): {
        reachable: any;
        fallback?: Position;
    } {
        const map = this.game.map;
        const tileOccupation = map.tileOccupation;
        const targetBridge = onBridge ? tileOccupation.getBridgeOnTile(targetTile) : undefined;
        const movePositionHelper = new MovePositionHelper(map);
        const isFlying = obj.rules.movementZone === MovementZone.Fly;
        const isPassable = (tile: any, bridge?: any): boolean => isFlying ||
            (map.terrain.getPassableSpeed(tile, obj.rules.speedType, obj.isInfantry(), !!bridge) > 0 &&
                movePositionHelper.isEligibleTile(tile, bridge, targetBridge, targetTile) &&
                !map.terrain.findObstacles({ tile, onBridge: bridge }, obj).length);
        let fallback: Position | undefined;
        const tileFinder = new RadialTileFinder(map.tiles, map.mapBounds, targetTile, foundation, 1, Math.ceil(this.weapon.rules.range), (tile: any) => {
            let found = false;
            if (isPassable(tile, undefined)) {
                fallback = fallback ?? { tile, onBridge: undefined };
                found = true;
            }
            if (tile.onBridgeLandType !== undefined) {
                const bridge = tileOccupation.getBridgeOnTile(tile);
                if (isPassable(tile, bridge)) {
                    fallback = fallback ?? { tile, onBridge: bridge };
                    found = true;
                }
            }
            return (!!found &&
                this.rangeHelper.isInWeaponRange(obj, targetTile, this.weapon, this.game.rules, tile));
        });
        return { reachable: tileFinder.getNextTile(), fallback };
    }
    onEnd(obj: any): void {
        if (obj.isVehicle() && obj.turretTrait) {
            obj.turretTrait.desiredFacing = obj.direction;
        }
        obj.attackTrait.attackState = AttackState.Idle;
        obj.attackTrait.currentTarget = undefined;
        const prismType = this.game.rules.general.prism.type;
        if (obj.isBuilding() &&
            obj.name === prismType &&
            this.weapon.type !== WeaponType.Secondary) {
            this.countSupportBeamsAndFireDownTowers(obj, prismType);
        }
        if (this.weapon.rules.limboLaunch) {
            obj.attackTrait.expirePassiveScanCooldown();
        }
        if (obj.isInfantry() || obj.isVehicle()) {
            obj.isFiring = false;
        }
        if (this.weapon.hasBurstsLeft()) {
            this.weapon.resetBursts();
        }
    }
    forceCancel(obj: any): boolean {
        if (obj.rules.movementZone !== MovementZone.Fly) {
            return false;
        }
        if (!this.cancellable || this.children.some((task) => !task.cancellable)) {
            return false;
        }
        if (this.status === TaskStatus.Running ||
            this.status === TaskStatus.Cancelling) {
            const moveTasks = this.children.filter((task) => task instanceof MoveTask);
            if (moveTasks.some((task) => !(task as MoveTask).forceCancel(obj))) {
                return false;
            }
            this.onEnd(obj);
            if (obj.isInfantry() || obj.isVehicle()) {
                obj.isFiring = false;
            }
        }
        this.status = TaskStatus.Cancelled;
        return true;
    }
    onTick(obj: any): boolean {
        const attackTrait = obj.attackTrait;
        if ((obj.isInfantry() || obj.isVehicle()) && attackTrait.attackState !== AttackState.Firing) {
            obj.isFiring = false;
        }
        let targetObj = this.target.obj;
        const moveTask = this.children.find((task) => task instanceof MoveInWeaponRangeTask) as MoveInWeaponRangeTask | undefined;
        // 完善模拟层逻辑：keep-alive: when launching missiles, do not cancel move / end task.
        if (this.isCancelling() && attackTrait.attackState !== AttackState.FireUp) {
            if (obj.airSpawnTrait?.isLaunchingMissiles()) {
                return false;
            }
            moveTask?.cancel();
            return true;
        }
        let justFiredUp = false;
        if (attackTrait.attackState === AttackState.FireUp) {
            if (attackTrait.isDisabled()) {
                return true;
            }
            attackTrait.attackState = AttackState.Firing;
            justFiredUp = true;
        }
        if (attackTrait.attackState === AttackState.Firing) {
            if (this.initialIndirectTarget &&
                !this.game.map
                    .getObjectsOnTile(this.target.tile)
                    .find((e: any) => (e.isOverlay() && !e.isBridgePlaceholder()) ||
                    e.isTerrain())) {
                this.cancel();
                return this.onTick(obj);
            }
            if (justFiredUp) {
                const targetOrTile = this.target.obj || this.target.tile;
                if (!this.game.isValidTarget(this.target.obj) ||
                    this.shouldDropTarget(this.target.obj) ||
                    !this.weapon.targeting.canTarget(this.target.obj, this.target.tile, this.game, !!this.options.force, !!this.options.passive) ||
                    !this.rangeHelper.isInWeaponRange(obj, targetOrTile, this.weapon, this.game.rules) ||
                    !this.losHelper.hasLineOfSight(obj, targetOrTile, this.weapon)) {
                    attackTrait.attackState = AttackState.CheckRange;
                    return this.onTick(obj);
                }
            }
            if (this.weapon.rules.limboLaunch) {
                if ((targetObj?.isVehicle() || targetObj?.isAircraft()) &&
                    targetObj.parasiteableTrait?.isInfested()) {
                    return true;
                }
                if (obj.rules.movementZone !== MovementZone.Fly &&
                    targetObj?.isUnit() &&
                    targetObj.zone === ZoneType.Air) {
                    return true;
                }
            }
            if (this.target.tile.onBridgeLandType &&
                obj.tile.onBridgeLandType &&
                obj.isUnit() &&
                (this.game.map.tileOccupation
                    .getBridgeOnTile(this.target.tile)
                    ?.isHighBridge() ||
                    this.game.map.tileOccupation
                        .getBridgeOnTile(obj.tile)
                        ?.isHighBridge())) {
                const targetOnBridge = targetObj
                    ? targetObj.isUnit() && (targetObj.zone === ZoneType.Air || targetObj.onBridge)
                    : this.target.isBridge();
                const selfOnBridge = obj.zone === ZoneType.Air || obj.onBridge;
                if (targetOnBridge !== selfOnBridge) {
                    return true;
                }
            }
            let damageMultiplier = 1;
            const prismType = this.game.rules.general.prism.type;
            if (obj.isBuilding() &&
                obj.name === prismType &&
                this.weapon.type !== WeaponType.Secondary) {
                const supportCount = this.countSupportBeamsAndFireDownTowers(obj, prismType);
                damageMultiplier = 1 + supportCount * this.game.rules.general.prism.supportModifier;
            }
            if (this.weapon.rules.spawner &&
                (obj.isVehicle() || obj.isAircraft()) &&
                obj.parasiteableTrait?.isParalyzed()) {
                return true;
            }
            if (obj.ammo === 0) {
                if (obj.isAircraft() && (obj.rules.fighter || obj.rules.spawned)) {
                    moveTask?.cancel();
                }
                return true;
            }
            let forcedMove = false;
            if (this.weapon.rules.limboLaunch) {
                let limboMoveTask: MoveTask | undefined = moveTask;
                if (!limboMoveTask) {
                    const currentTask = obj.unitOrderTrait.getCurrentTask();
                    if (currentTask && currentTask !== this && attackTrait.getOpportunityFireTask() === this) {
                        if (!(currentTask instanceof MoveTask)) {
                            currentTask.cancel();
                            return false;
                        }
                        limboMoveTask = currentTask as MoveTask;
                    }
                }
                if (limboMoveTask) {
                    if (!limboMoveTask.forceCancel(obj)) {
                        return false;
                    }
                    obj.moveTrait.lastTargetOffset = undefined;
                    obj.moveTrait.lastVelocity = undefined;
                }
                // 完善模拟层逻辑：limboLaunch always finishes the attack after fire,
                // even when there was no move child to force-cancel.
                forcedMove = true;
            }
            this.weapon.fire(this.target, this.game, damageMultiplier);
            if (forcedMove) {
                return true;
            }
            if (this.weapon.rules.fireOnce) {
                return true;
            }
            if (this.options.passive && obj.rules.distributedFire) {
                return true;
            }
            attackTrait.attackState = AttackState.JustFired;
            return false;
        }
        if (attackTrait.attackState === AttackState.JustFired) {
            attackTrait.attackState = AttackState.PrepareToFire;
            return this.onTick(obj);
        }
        if (this.needsTargetUpdate) {
            this.target = this.needsTargetUpdate;
            targetObj = this.target.obj;
            this.needsTargetUpdate = undefined;
            this.onTargetChange(obj);
            if (!targetObj) {
                moveTask?.retarget(this.target.tile, !!this.target.getBridge());
            }
        }
        if (targetObj?.isTechno() && targetObj.replacedBy) {
            const newTarget = this.game.createTarget(targetObj.replacedBy, targetObj.replacedBy.tile);
            this.target = newTarget;
            targetObj = targetObj.replacedBy;
            this.onTargetChange(obj);
        }
        let isValidTarget = this.game.isValidTarget(targetObj) && !this.shouldDropTarget(targetObj);
        if (isValidTarget) {
            let canTarget = this.weapon.targeting.canTarget(targetObj, this.target.tile, this.game, !!this.options.force, !!this.options.passive);
            if (!canTarget || !obj.armedTrait.isEquippedWithWeapon(this.weapon)) {
                const newWeapon = attackTrait.selectWeaponVersus(obj, this.target, this.game, this.options.force, this.options.passive);
                if (newWeapon) {
                    this.setWeapon(newWeapon);
                    if (attackTrait.attackState !== AttackState.CheckRange) {
                        attackTrait.attackState = AttackState.CheckRange;
                        return this.onTick(obj);
                    }
                    canTarget = true;
                }
                else {
                    canTarget = false;
                }
            }
            isValidTarget = canTarget;
        }
        if (isValidTarget) {
            const lastCheck = this.lastTargetTpCheck;
            if (targetObj?.isUnit() && lastCheck && targetObj.moveTrait.lastTeleportTick >= lastCheck) {
                isValidTarget = false;
                this.rangeCheckCooldown = 0;
            }
            else {
                this.lastTargetTpCheck = this.game.currentTick;
            }
        }
        if (isValidTarget && targetObj) {
            this.lastValidTargetPosition = {
                tile: targetObj.tile,
                onBridge: this.target.getBridge(),
            };
        }
        if (!isValidTarget) {
            this.targetLinesConfig.isAttack = false;
        }
        if (attackTrait.attackState === AttackState.CheckRange) {
            if (this.rangeCheckCooldown > 0) {
                this.rangeCheckCooldown--;
                return false;
            }
            const effectiveTarget = this.target.obj
                ? isValidTarget
                    ? this.target.obj
                    : this.lastValidTargetPosition!.tile
                : this.target.tile;
            const targetTile = this.target.obj
                ? isValidTarget
                    ? this.getRangeCheckTile(this.target.obj)
                    : this.lastValidTargetPosition!.tile
                : this.target.tile;
            const needsMove = !this.rangeHelper.isInWeaponRange(obj, effectiveTarget, this.weapon, this.game.rules) ||
                !this.losHelper.hasLineOfSight(obj, effectiveTarget, this.weapon) ||
                (obj.isUnit() &&
                    obj.rules.balloonHover &&
                    !obj.rules.hoverAttack &&
                    !moveTask &&
                    obj.tile !== targetTile &&
                    !this.options.holdGround) ||
                (obj.isAircraft() &&
                    this.weapon.projectileRules.iniRot <= 1 &&
                    !moveTask);
            if (needsMove) {
                if (obj.isUnit() && !this.options.holdGround && this.game.map.isWithinBounds(targetTile)) {
                    if (moveTask) {
                        if (moveTask.target !== this.target.obj || isValidTarget) {
                            if (isValidTarget &&
                                this.target.obj &&
                                this.rangeHelper.tileDistance(this.target.obj, this.lastSelfMoveTargetTile) > this.weapon.range) {
                                moveTask.retarget(this.target.obj, !!this.target.getBridge());
                                this.lastSelfTileBeforeMove = obj.tile;
                                this.lastSelfMoveTargetTile = this.target.obj?.tile ?? this.target.tile;
                            }
                            else {
                                if (this.options.leashTiles !== undefined &&
                                    this.rangeHelper.tileDistance(this.initialSelfPosition!.tile, obj.tile) > this.options.leashTiles) {
                                    moveTask.cancel();
                                    return true;
                                }
                                const targetSpeed = effectiveTarget instanceof GameObject && effectiveTarget.isUnit()
                                    ? effectiveTarget.moveTrait.baseSpeed
                                    : 0;
                                const ticksToWait = Math.ceil((this.rangeHelper.tileDistance(obj, effectiveTarget) -
                                    (this.weapon.range + 1)) /
                                    ((obj.moveTrait.baseSpeed + targetSpeed) /
                                        Coords.LEPTONS_PER_TILE));
                                if (ticksToWait > 0) {
                                    this.rangeCheckCooldown = Math.min(GameSpeed.BASE_TICKS_PER_SECOND, ticksToWait);
                                }
                            }
                        }
                        else {
                            let fallbackTarget;
                            if (this.options.leashTiles !== undefined) {
                                fallbackTarget = this.game.createTarget(this.initialSelfPosition!.onBridge, this.initialSelfPosition!.tile);
                            }
                            else {
                                fallbackTarget = this.game.createTarget(this.lastValidTargetPosition!.onBridge, this.lastValidTargetPosition!.tile);
                            }
                            attackTrait.currentTarget = fallbackTarget;
                            moveTask.retarget(fallbackTarget.tile, fallbackTarget.isBridge());
                            this.updateTargetLines(fallbackTarget, false);
                        }
                        return false;
                    }
                    if (!obj.moveTrait || obj.moveTrait.isDisabled()) {
                        return true;
                    }
                    if (this.isCancelling()) {
                        return true;
                    }
                    if (obj.tile === this.lastSelfTileBeforeMove ||
                        (this.moveExecuted && obj.moveTrait.lastMoveResult === MoveResult.Fail)) {
                        this.moveAttempts++;
                    }
                    else {
                        this.moveAttempts = 0;
                    }
                    if (this.weapon.rules.limboLaunch &&
                        obj.defaultToGuardArea &&
                        targetObj &&
                        this.moveExecuted &&
                        obj.moveTrait.lastMoveResult === MoveResult.Fail &&
                        this.rangeHelper.isInRange(obj, targetObj, 0, obj.armedTrait.computeGuardScanRange(this.weapon), true)) {
                        return true;
                    }
                    if (this.moveAttempts > MAX_MOVE_ATTEMPTS) {
                        return true;
                    }
                    if (this.moveAttempts > 0) {
                        this.children.push(new WaitMinutesTask(1 / 60));
                    }
                    const moveTarget = effectiveTarget;
                    const moveBridge = targetObj && !isValidTarget
                        ? this.lastValidTargetPosition!.onBridge
                        : this.target.getBridge();
                    const newMoveTask = new MoveInWeaponRangeTask(this.game, moveTarget, !!moveBridge, this.weapon);
                    newMoveTask.blocking = false;
                    this.children.push(newMoveTask);
                    this.moveExecuted = true;
                    this.lastSelfTileBeforeMove = obj.tile;
                    this.lastSelfMoveTargetTile =
                        moveTarget instanceof GameObject ? moveTarget.tile : moveTarget;
                    return this.onTick(obj);
                }
                return true;
            }
            this.moveExecuted = false;
            this.moveAttempts = 0;
            if (moveTask) {
                // 完善模拟层逻辑：n && (A || B || C || D || n.cancel())
                // A/B/C/D true ⇒ keep moving; all false ⇒ cancel move to stand and fire.
                const keepMoveTask =
                    (obj.rules.balloonHover && !obj.rules.hoverAttack) ||
                    obj.rules.fighter ||
                    obj.rules.spawned ||
                    (obj.rules.movementZone === MovementZone.Fly &&
                        !this.rangeHelper.isInRange2(
                            obj,
                            this.target.obj ?? this.target.tile,
                            this.weapon.minRange,
                            this.weapon.range - 1,
                        ));
                if (!keepMoveTask) {
                    moveTask.cancel();
                }
            }
            if (moveTask && (obj.isInfantry() || this.weapon.rules.spawner)) {
                return false;
            }
            if (moveTask?.children.some((task) => !task.cancellable) &&
                this.weapon.rules.limboLaunch) {
                return false;
            }
            if (moveTask &&
                moveTask.shouldAirStrafe(obj) &&
                this.target.obj?.isUnit() &&
                this.target.obj.moveTrait.isMoving() &&
                this.weapon.range > 1 &&
                !this.rangeHelper.isInRange2(obj, this.target.obj, this.weapon.minRange, this.weapon.range - 1)) {
                return false;
            }
            attackTrait.attackState = AttackState.PrepareToFire;
        }
        if (attackTrait.attackState !== AttackState.PrepareToFire) {
            return false;
        }
        if (!isValidTarget || attackTrait.isDisabled()) {
            moveTask?.cancel();
            return true;
        }
        const targetWorldCoords = this.target.getWorldCoords();
        const selfWorldPosition = obj.position.worldPosition;
        if (!(this.lastInRangeTargetPosition.length() &&
            this.lastInRangeTargetPosition.equals(targetWorldCoords) &&
            this.lastInRangeSelfPosition.length() &&
            this.lastInRangeSelfPosition.equals(selfWorldPosition))) {
            this.lastInRangeTargetPosition.copy(targetWorldCoords);
            this.lastInRangeSelfPosition.copy(selfWorldPosition);
            attackTrait.attackState = AttackState.CheckRange;
            return this.onTick(obj);
        }
        if (!(this.weapon.rules.omniFire ||
            (obj.rules.omniFire && obj.rules.fighter))) {
            const direction = new Vector3().copy(targetWorldCoords).sub(selfWorldPosition);
            const desiredFacing = FacingUtil.fromMapCoords(new Vector2(direction.x, direction.z));
            const facingTolerance = this.weapon.projectileRules.rot ? FACING_TOLERANCE_PROJECTILE : FACING_TOLERANCE;
            if ((obj.isVehicle() || obj.isBuilding()) && obj.turretTrait) {
                obj.turretTrait.desiredFacing = desiredFacing;
                if (Math.abs(desiredFacing - obj.turretTrait.facing) >= facingTolerance) {
                    return false;
                }
            }
            else if (Math.abs(desiredFacing - obj.direction) >= facingTolerance) {
                if (obj.isAircraft()) {
                    obj.direction = FacingUtil.tick(obj.direction, desiredFacing, obj.rules.rot).facing;
                    return false;
                }
                if (moveTask) {
                    return false;
                }
                if (this.options.disallowTurning) {
                    return true;
                }
                if (obj.isVehicle()) {
                    this.children.push(new TurnTask(desiredFacing));
                    return false;
                }
                obj.direction = desiredFacing;
            }
        }
        if (!this.losHelper.hasLineOfSight(obj, this.target.obj || this.target.tile, this.weapon)) {
            attackTrait.attackState = AttackState.CheckRange;
            return this.onTick(obj);
        }
        if (attackTrait.isOnCooldown(obj)) {
            return false;
        }
        if (this.weapon.warhead.rules.temporal &&
            obj.temporalTrait.getTarget() === this.target.obj) {
            return false;
        }
        if (this.weapon.rules.suicide &&
            this.weapon.type !== WeaponType.DeathWeapon) {
            this.game.destroyObject(obj, {
                player: obj.owner,
                obj: obj,
                weapon: this.weapon,
            });
            return true;
        }
        const prismType = this.game.rules.general.prism.type;
        if (obj.isBuilding() &&
            obj.name === prismType &&
            this.weapon.type !== WeaponType.Secondary) {
            this.fireUpPrismSupportTowers(obj, prismType);
        }
        if (obj.isInfantry() || obj.isVehicle()) {
            obj.isFiring = true;
        }
        if (obj.art.fireUp) {
            if (!(obj.isInfantry() && obj.suppressionTrait?.isSuppressed())) {
                this.children.push(new WaitTicksTask(obj.art.fireUp).setCancellable(false));
            }
            attackTrait.attackState = AttackState.FireUp;
            return false;
        }
        attackTrait.attackState = AttackState.Firing;
        return this.onTick(obj);
    }
    private shouldDropTarget(target: any): boolean {
        return (this.forceDropTarget ||
            (target?.isTechno() &&
                ((this.weapon.rules.limboLaunch &&
                    (((target.isVehicle() || target.isAircraft()) &&
                        target.parasiteableTrait?.isInfested()) ||
                        target.invulnerableTrait.isActive())) ||
                    (target.warpedOutTrait.isInvulnerable() &&
                        !this.weapon.warhead.rules.temporal) ||
                    this.initialTargetOwner !== target.owner)));
    }
    private fireUpPrismSupportTowers(obj: any, prismType: string): void {
        const supportTowers = obj.owner
            .getOwnedObjectsByType(ObjectType.Building)
            .filter((building: any) => building.name === prismType &&
            building.secondaryWeapon &&
            !building.unitOrderTrait.hasTasks() &&
            building.attackTrait &&
            !building.attackTrait.isDisabled() &&
            !building.attackTrait.isOnCooldown(building))
            .filter((building: any) => this.rangeHelper.isInWeaponRange(building, obj, building.secondaryWeapon, this.game.rules))
            .slice(0, this.game.rules.general.prism.supportMax);
        for (const tower of supportTowers) {
            tower.unitOrderTrait.addTask(tower.attackTrait.createAttackTask(this.game, obj, obj.centerTile, tower.secondaryWeapon, { passive: true }));
        }
    }
    private countSupportBeamsAndFireDownTowers(obj: any, prismType: string): number {
        const supportingTowers = obj.owner
            .getOwnedObjectsByType(ObjectType.Building)
            .filter((building: any) => building.name === prismType && building.attackTrait?.currentTarget?.obj === obj);
        for (const tower of supportingTowers) {
            tower.unitOrderTrait.getCurrentTask()?.cancel();
        }
        return Math.min(this.game.rules.general.prism.supportMax, supportingTowers.length);
    }
    getRangeCheckTile(obj: any): any {
        return obj.isBuilding()
            ? this.game.map.isWithinBounds(obj.centerTile)
                ? obj.centerTile
                : this.getInBoundsFoundationTile(obj) ?? obj.tile
            : obj.tile;
    }

    getInBoundsFoundationTile(obj: any): any {
        return this.game.map.tileOccupation
            .calculateTilesForGameObject(obj.tile, obj)
            .find((tile: any) => this.game.map.isWithinBounds(tile));
    }

    getTargetLinesConfig(): TargetLinesConfig {
        return this.targetLinesConfig;
    }
}
