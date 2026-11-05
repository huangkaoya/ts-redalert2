import { ObjectCrashingEvent } from "@/game/event/ObjectCrashingEvent";
import { LocomotorType } from "@/game/type/LocomotorType";
import { NotifyTick } from "@/game/gameobject/trait/interface/NotifyTick";
import { JumpjetLocomotor } from "@/game/gameobject/locomotor/JumpjetLocomotor";
import { WingedLocomotor } from "@/game/gameobject/locomotor/WingedLocomotor";
import { NotifyCrash } from "@/game/gameobject/trait/interface/NotifyCrash";
export class CrashableTrait {
    private gameObject: any;
    private crashingEvtSent: boolean;
    private crashState: any;
    private attackerInfo: any;
    constructor(gameObject: any) {
        this.gameObject = gameObject;
        this.crashingEvtSent = false;
        this.crashState = {};
    }
    [NotifyTick.onTick](target: any, context: any): void {
        if (target.isCrashing) {
            // 完善模拟层逻辑：crashingEvtSent || (set + notify + dispatch), then ALWAYS run crash motion.
            // Prior mistranslation used !crashingEvtSent || (...) which short-circuited the side effects forever.
            if (!this.crashingEvtSent) {
                this.crashingEvtSent = true;
                target.traits
                    .filter(NotifyCrash)
                    .forEach((trait: any) => trait[NotifyCrash.onCrash](target, context));
                context.events.dispatch(new ObjectCrashingEvent(target));
            }
            if (target.rules.locomotor !== LocomotorType.Jumpjet &&
                target.rules.locomotor !== LocomotorType.Aircraft) {
                throw new Error("Crashing logic not implemented for locomotor " +
                    LocomotorType[target.rules.locomotor]);
            }
            let movement;
            if (target.rules.locomotor === LocomotorType.Jumpjet) {
                movement = JumpjetLocomotor.tickCrash(target, context, this.crashState);
            }
            else {
                if (target.rules.locomotor !== LocomotorType.Aircraft) {
                    throw new Error(`Unhandled locomotor type "${target.rules.locomotor}"`);
                }
                if (!target.isAircraft()) {
                    throw new Error(`Obj "${target.name}#${target.id} is not an aircraft`);
                }
                movement = WingedLocomotor.tickCrash(target, context, this.crashState);
            }
            let shouldDestroy = false;
            const newPosition = movement.clone().add(target.position.worldPosition);
            if (context.map.isWithinHardBounds(newPosition)) {
                const oldTile = target.tile;
                const oldElevation = target.tileElevation;
                target.position.moveByLeptons3(movement);
                if (target.tile !== oldTile) {
                    target.moveTrait.handleTileChange(oldTile, undefined, false, context);
                }
                const bridge = target.tile.onBridgeLandType
                    ? context.map.tileOccupation.getBridgeOnTile(target.tile)
                    : undefined;
                const bridgeElevation = bridge?.tileElevation ?? 0;
                target.position.tileElevation = Math.max(target.position.tileElevation, bridgeElevation);
                if (target.position.tileElevation === bridgeElevation) {
                    target.zone = context.map.getTileZone(target.tile);
                    target.onBridge = !!bridge;
                    shouldDestroy = true;
                }
                if (target.tileElevation !== oldElevation) {
                    target.moveTrait.handleElevationChange(oldElevation, context);
                }
            }
            else {
                shouldDestroy = true;
            }
            if (shouldDestroy) {
                context.destroyObject(target, this.attackerInfo);
            }
        }
    }
    crash(attacker: any): void {
        this.attackerInfo = attacker;
        this.gameObject.isCrashing = true;
        this.gameObject.cachedTraits.tick.length = 0;
        this.gameObject.cachedTraits.tick = [this];
    }
    dispose(): void {
        this.gameObject = undefined;
    }
}
