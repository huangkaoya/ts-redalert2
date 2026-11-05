import { Order } from "@/game/order/Order";
import { OrderType } from "@/game/order/OrderType";
import { PointerType } from "@/engine/type/PointerType";
import { AttackTask } from "@/game/gameobject/task/AttackTask";
import { RangeHelper } from "@/game/gameobject/unit/RangeHelper";
import { OrderFeedbackType } from "@/game/order/OrderFeedbackType";
import { LosHelper } from "@/game/gameobject/unit/LosHelper";
import { ArmorType } from "@/game/type/ArmorType";
import { PlantC4Task } from "@/game/gameobject/task/PlantC4Task";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { MovementZone } from "@/game/type/MovementZone";
import { LocomotorType } from "@/game/type/LocomotorType";
interface AttackOrderOptions {
    forceAttack?: boolean;
    noIvanBomb?: boolean;
}
export class AttackOrder extends Order {
    protected game: any;
    protected isC4: boolean = false;
    protected forceAttack: boolean;
    protected ivanBombAllowed: boolean;
    public targetOptional: boolean = false;
    public feedbackType: OrderFeedbackType = OrderFeedbackType.None;
    protected rangeHelper: RangeHelper;
    protected losHelper: LosHelper;
    public terminal: boolean = false;
    constructor(game: any, options: AttackOrderOptions = {}) {
        const { forceAttack = false, noIvanBomb = false } = options;
        super(forceAttack ? OrderType.ForceAttack : OrderType.Attack);
        this.game = game;
        this.forceAttack = forceAttack;
        this.ivanBombAllowed = !noIvanBomb || forceAttack;
        this.rangeHelper = new RangeHelper(this.game.map.tileOccupation);
        this.losHelper = new LosHelper(this.game.map.tiles, game.map.tileOccupation);
    }
    getPointerType(isMini: boolean, units: any[]): PointerType {
        if (!this.isAllowed()) {
            return isMini ? PointerType.NoActionMini : PointerType.NoAction;
        }
        if (this.isC4) {
            return PointerType.C4;
        }
        const weapon = this.sourceObject.attackTrait?.selectWeaponVersus(this.sourceObject, this.target, this.game, this.forceAttack);
        if (weapon?.rules.sabotageCursor) {
            return PointerType.C4;
        }
        if (this.ivanBombAllowed &&
            this.sourceObject.rules.ivan &&
            weapon?.warhead.rules.ivanBomb) {
            return PointerType.Dynamite;
        }
        if (weapon?.warhead.rules.bombDisarm) {
            return PointerType.DefuseBomb;
        }
        if (weapon && weapon.rules.damage < 0) {
            return PointerType.RepairMove;
        }
        const allUnitsInRange = units.every((unit) => {
            if (!unit.attackTrait)
                return true;
            const unitWeapon = unit.attackTrait.selectWeaponVersus(unit, this.target, this.game, this.forceAttack);
            if (!unitWeapon)
                return true;
            return (this.rangeHelper.isInWeaponRange(unit, this.target.obj || this.target.tile, unitWeapon, this.game.rules) &&
                this.losHelper.hasLineOfSight(unit, this.target.obj || this.target.tile, unitWeapon));
        });
        if (isMini) {
            return PointerType.AttackMini;
        }
        return allUnitsInRange ? PointerType.AttackRange : PointerType.AttackNoRange;
    }
    isValid(): boolean {
        if (!this.sourceObject.attackTrait)
            return false;
        if (this.forceAttack &&
            this.game.mapShroudTrait
                .getPlayerShroud(this.sourceObject.owner)
                ?.isShrouded(this.target.tile, this.target.obj?.tileElevation) &&
            !this.sourceObject.isBuilding()) {
            return false;
        }
        const targetObj = this.target.obj;
        const terrainObj = this.game.map
            .getGroundObjectsOnTile(this.target.tile)
            .find((obj: any) => obj.isTerrain());
        this.terminal = !targetObj && !terrainObj;
        if (this.sourceObject.c4 &&
            targetObj?.isBuilding() &&
            targetObj.c4ChargeTrait &&
            (this.forceAttack ||
                !this.game.areFriendly(targetObj, this.sourceObject) ||
                targetObj.cabHutTrait)) {
            this.isC4 = true;
            this.feedbackType = OrderFeedbackType.SpecialAttack;
            return true;
        }
        this.isC4 = false;
        this.feedbackType = OrderFeedbackType.Attack;
        if (!this.game.isValidTarget(targetObj))
            return false;
        if (!targetObj && terrainObj?.rules.immune)
            return false;
        if (!targetObj &&
            this.target.tile === this.sourceObject.tile &&
            !(this.sourceObject.isUnit() && this.sourceObject.zone === ZoneType.Air)) {
            return false;
        }
        if (targetObj === this.sourceObject)
            return false;
        const weapon = this.sourceObject.attackTrait.selectWeaponVersus(this.sourceObject, this.target, this.game, this.forceAttack);
        if (!weapon)
            return false;
        if (!this.ivanBombAllowed && weapon.warhead.rules.ivanBomb)
            return false;
        if (targetObj?.isBuilding() &&
            targetObj.cabHutTrait &&
            !weapon.warhead.rules.ivanBomb &&
            !weapon.warhead.rules.bombDisarm) {
            return false;
        }
        const canMoveOrInRange =
            (this.sourceObject.isUnit() &&
                this.sourceObject.moveTrait &&
                !this.sourceObject.moveTrait.isDisabled()) ||
            this.rangeHelper.isInWeaponRange(
                this.sourceObject,
                targetObj || this.target.tile,
                weapon,
                this.game.rules,
            );
        if (!canMoveOrInRange) {
            return false;
        }
        if (
            this.sourceObject.airSpawnTrait &&
            weapon.rules.spawner &&
            !this.game.map.isWithinBounds(this.getSpawnerTargetTile())
        ) {
            return false;
        }
        if (this.forceAttack) {
            return true;
        }
        if (targetObj?.isBuilding() && targetObj.hospitalTrait) {
            return false;
        }
        if (!targetObj || !targetObj.healthTrait) {
            return false;
        }
        if (targetObj.isDestroyed || targetObj.isCrashing) {
            return false;
        }
        return (
            (targetObj.isOverlay() &&
                (weapon.warhead.rules.wall ||
                    (weapon.warhead.rules.wood && targetObj.rules.armor === ArmorType.Wood))) ||
            targetObj.isTechno()
        );
    }
    isAllowed(): boolean {
        return !this.sourceObject.attackTrait.isDisabled();
    }
    getSpawnerTargetTile(): any {
        const obj = this.target.obj;
        return obj?.isBuilding() && !this.game.map.isWithinBounds(obj.centerTile)
            ? this.game.map.tileOccupation
                  .calculateTilesForGameObject(obj.tile, obj)
                  .find((tile: any) => this.game.map.isWithinBounds(tile)) ?? this.target.tile
            : this.target.tile;
    }

    process(): any[] {
        if (this.isC4) {
            return [new PlantC4Task(this.game, this.target.obj)];
        }
        const weapon = this.sourceObject.attackTrait.selectWeaponVersus(this.sourceObject, this.target, this.game, this.forceAttack);
        return [
            new AttackTask(this.game, this.target, weapon, {
                force: this.forceAttack,
            }),
        ];
    }
    onAdd(tasks: any[], isQueued: boolean): boolean {
        const unit = this.sourceObject;
        if (!isQueued && unit.isUnit() && this.isValid() && this.isAllowed()) {
            if (unit.rules.movementZone === MovementZone.Fly) {
                const existingTask = tasks.find(
                    (task) =>
                        (task.constructor === MoveTask || task.constructor === AttackTask) &&
                        !task.isCancelling(),
                );
                let taskToCancel: any;
                if (existingTask) {
                    let weapon: any;
                    if (
                        unit.moveTrait.currentWaypoint?.tile === this.target.tile ||
                        unit.isAircraft() ||
                        existingTask.constructor === AttackTask ||
                        ((weapon = this.sourceObject.attackTrait.selectWeaponVersus(
                            this.sourceObject,
                            this.target,
                            this.game,
                            this.forceAttack,
                        )).projectileRules.vertical &&
                            existingTask.constructor === MoveTask &&
                            this.rangeHelper.isInWeaponRange(
                                this.sourceObject,
                                this.target.obj || this.target.tile,
                                weapon,
                                this.game.rules,
                            ))
                    ) {
                        taskToCancel = existingTask;
                    }
                }
                if (taskToCancel?.forceCancel(unit)) {
                    // 完善模拟层逻辑：splice(index) drops the cancelled task and everything after it.
                    tasks.splice(tasks.indexOf(taskToCancel));
                }
            }
            else {
                if (tasks.length &&
                    unit.isUnit() &&
                    (unit.rules.locomotor === LocomotorType.Vehicle ||
                        unit.rules.locomotor === LocomotorType.Ship)) {
                    unit.moveTrait.speedPenalty = 0.5;
                }
                const existingAttackTask = tasks.find((task) => task.constructor === AttackTask && !task.isCancelling());
                if (existingAttackTask?.getWeapon().warhead.rules.temporal) {
                    existingAttackTask.setForceAttack(this.forceAttack);
                    existingAttackTask.requestTargetUpdate(this.target);
                    return false;
                }
            }
        }
        return true;
    }
}
