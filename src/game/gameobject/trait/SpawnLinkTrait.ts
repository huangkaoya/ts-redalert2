import { AttackTask } from '@/game/gameobject/task/AttackTask';
import { MoveTask } from '@/game/gameobject/task/move/MoveTask';
import { RangeHelper } from '@/game/gameobject/unit/RangeHelper';
import { AttackTrait, AttackState } from '@/game/gameobject/trait/AttackTrait';
import { NotifyTick } from '@/game/gameobject/trait/interface/NotifyTick';
import { GameObject } from '@/game/gameobject/GameObject';
import { World } from '@/game/World';
export class SpawnLinkTrait {
    private parent?: GameObject;
    setParent(parent: GameObject): void {
        this.parent = parent;
    }
    getParent(): GameObject | undefined {
        return this.parent;
    }
    [NotifyTick.onTick](gameObject: GameObject, world: World): void {
        if (!this.parent || !gameObject.attackTrait || !gameObject.primaryWeapon) {
            return;
        }
        const parentTarget = this.parent.attackTrait?.currentTarget;
        const currentTask = gameObject.unitOrderTrait.getCurrentTask();
        const rangeHelper = new RangeHelper(world.map.tileOccupation);
        const spawnerWeapon = this.parent.armedTrait?.getWeapons().find(w => w.rules.spawner);
        const shouldAttack = gameObject.ammo &&
            !(parentTarget && gameObject.attackTrait.currentTarget
                ? parentTarget.equals(gameObject.attackTrait.currentTarget)
                : parentTarget === gameObject.attackTrait.currentTarget ||
                    (!parentTarget &&
                        this.parent.isUnit() &&
                        (this.parent.unitOrderTrait.getCurrentTask() instanceof MoveTask ||
                            this.parent.unitOrderTrait.getCurrentTask() instanceof AttackTask))) &&
            (!parentTarget ||
                (spawnerWeapon &&
                    rangeHelper.isInWeaponRange(this.parent, parentTarget.obj ?? parentTarget.tile, spawnerWeapon, world.rules)));
        if (shouldAttack) {
            if (parentTarget &&
                gameObject.primaryWeapon.targeting.canTarget(parentTarget.obj, parentTarget.tile, world, true, false)) {
                if (!currentTask || currentTask instanceof MoveTask) {
                    gameObject.unitOrderTrait.cancelAllTasks();
                    gameObject.unitOrderTrait.addTask(gameObject.attackTrait.createAttackTask(world, parentTarget.obj, parentTarget.tile, gameObject.primaryWeapon, { force: true }));
                }
                else if (gameObject.attackTrait.attackState !== AttackState.Idle) {
                    currentTask.requestTargetUpdate(parentTarget);
                }
            }
            else {
                // 完善模拟层逻辑：t ? (t instanceof MoveTask || t.cancel()) : tryMoveToParent
                // Existing MoveTask is left alone; non-Move is cancelled; no task → move to parent.
                if (currentTask) {
                    if (!(currentTask instanceof MoveTask)) {
                        currentTask.cancel();
                    }
                }
                else {
                    this.tryMoveToParent(gameObject, this.parent, world);
                }
            }
        }
        else {
            this.tryMoveToParent(gameObject, this.parent, world);
        }
    }
    private tryMoveToParent(gameObject: GameObject, parent: GameObject, world: World): void {
        if (gameObject.tile !== parent.tile) {
            const currentTask = gameObject.unitOrderTrait.getCurrentTask();
            // 完善模拟层逻辑：only update existing MoveTask or add when idle; never interrupt other tasks.
            if (currentTask) {
                if (currentTask instanceof MoveTask) {
                    currentTask.updateTarget(parent.tile, !!parent.isUnit() && parent.onBridge);
                }
            }
            else {
                gameObject.unitOrderTrait.addTask(new MoveTask(world as any, parent.tile, !!parent.isUnit() && parent.onBridge, {
                    closeEnoughTiles: 0,
                    strictCloseEnough: true
                }));
            }
        }
    }
}
