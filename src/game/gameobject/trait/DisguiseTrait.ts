import { ObjectType } from "@/engine/type/ObjectType";
import { ObjectDisguiseChangeEvent } from "@/game/event/ObjectDisguiseChangeEvent";
import { SideType } from "@/game/SideType";
import { AttackTrait, AttackState } from "@/game/gameobject/trait/AttackTrait";
import { NotifyDamage } from "@/game/gameobject/trait/interface/NotifyDamage";
import { NotifySpawn } from "@/game/gameobject/trait/interface/NotifySpawn";
import { NotifyTick } from "@/game/gameobject/trait/interface/NotifyTick";
import { MoveTrait, MoveState } from "@/game/gameobject/trait/MoveTrait";
export class DisguiseTrait {
    private isActive: boolean;
    private cooldownTicks: number;
    private disguisedAs?: {
        rules: any;
        owner: any;
    };
    constructor() {
        this.isActive = false;
        this.cooldownTicks = 0;
    }
    isDisguised(): boolean {
        return this.isActive;
    }
    getDisguise(): {
        rules: any;
        owner: any;
    } | undefined {
        return this.isActive ? this.disguisedAs : undefined;
    }
    hasTerrainDisguise(): boolean {
        return this.getDisguise()?.rules.type === ObjectType.Terrain;
    }
    disguiseAs(target: any, gameObject: any, context: any): void {
        this.disguisedAs = { rules: target.rules, owner: target.owner };
        this.isActive = true;
        context.events.dispatch(new ObjectDisguiseChangeEvent(gameObject));
    }
    revealDisguise(gameObject: any, context: any): void {
        this.cooldownTicks = context.rules.general.infantryBlinkDisguiseTime;
        this.isActive = false;
        context.events.dispatch(new ObjectDisguiseChangeEvent(gameObject));
    }
    [NotifySpawn.onSpawn](gameObject: any, context: any): void {
        if (!this.disguisedAs &&
            gameObject.rules.permaDisguise &&
            gameObject.isInfantry() &&
            gameObject.owner.country) {
            const defaultDisguise = this.getDefaultInfantryDisguise(gameObject.owner.country.side, context.rules.general);
            if (defaultDisguise) {
                const infantryRules = context.rules.getObject(defaultDisguise, ObjectType.Infantry);
                this.disguisedAs = { rules: infantryRules, owner: gameObject.owner };
                this.isActive = true;
            }
        }
    }
    getDefaultInfantryDisguise(side: SideType, generalRules: any): string | undefined {
        switch (side) {
            case SideType.GDI:
                return generalRules.alliedDisguise;
            case SideType.Nod:
                return generalRules.sovietDisguise;
            case SideType.ThirdSide:
                return generalRules.thirdDisguise;
            default:
                return undefined;
        }
    }
    [NotifyTick.onTick](gameObject: any, context: any): void {
        if (!gameObject.rules.permaDisguise) {
            if (gameObject.attackTrait?.attackState === AttackState.JustFired ||
                gameObject.moveTrait.moveState !== MoveState.Idle) {
                this.revealDisguise(gameObject, context);
            }
            else if (this.cooldownTicks > 0) {
                this.cooldownTicks--;
            }
            else if (!this.isActive && gameObject.rules.disguiseWhenStill) {
                this.isActive = true;
                this.disguisedAs = {
                    rules: this.selectRandomMirageDisguise(context),
                    owner: undefined
                };
                context.events.dispatch(new ObjectDisguiseChangeEvent(gameObject));
            }
        }
    }
    [NotifyDamage.onDamage](gameObject: any, context: any): void {
        this.revealDisguise(gameObject, context);
    }
    selectRandomMirageDisguise(context: any): any {
        const disguises = context.rules.general.defaultMirageDisguises;
        if (!disguises.length) {
            throw new Error("No default mirage disguises are defined");
        }
        const randomDisguise = disguises[context.generateRandomInt(0, disguises.length - 1)];
        return context.rules.getObject(randomDisguise, ObjectType.Terrain);
    }
}
