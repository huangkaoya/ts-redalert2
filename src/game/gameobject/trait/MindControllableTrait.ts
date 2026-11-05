import { NotifyUnspawn } from './interface/NotifyUnspawn';
import { GameObject } from '@/game/gameobject/GameObject';
import { World } from '@/game/World';
export class MindControllableTrait {
    private gameObject: GameObject;
    private controller?: GameObject;
    private prevOwner?: any;
    constructor(gameObject: GameObject) {
        this.gameObject = gameObject;
    }
    getOriginalOwner(): any {
        return this.prevOwner;
    }
    isActive(): boolean {
        return !!this.controller;
    }
    getController(): GameObject | undefined {
        return this.controller;
    }
    controlBy(controller: GameObject, world: World): void {
        if (this.controller) {
            throw new Error(`Object "${this.gameObject?.name}" is already mind controlled by "${controller.name}"`);
        }
        this.controller = controller;
        this.prevOwner = this.gameObject.owner;
        world.changeObjectOwner(this.gameObject, controller.owner);
    }
    restore(world: World): void {
        if (this.prevOwner) {
            // 完善模拟层逻辑：defeated original owner restores to civilian instead.
            let owner = this.prevOwner;
            if (this.prevOwner.defeated) {
                owner = world.getCivilianPlayer();
            }
            world.changeObjectOwner(this.gameObject, owner);
            this.prevOwner = undefined;
            this.controller = undefined;
        }
    }
    [NotifyUnspawn.onUnspawn](gameObject: GameObject, world: World): void {
        if (this.controller) {
            this.controller.mindControllerTrait.cleanTarget(gameObject);
            if (!gameObject.isDestroyed && gameObject.limboData) {
                this.restore(world);
            }
        }
    }
    dispose(): void {
        this.gameObject = undefined as any;
    }
}
