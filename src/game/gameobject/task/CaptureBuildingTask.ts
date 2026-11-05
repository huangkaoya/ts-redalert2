import { BuildStatus } from '@/game/gameobject/Building';
import { BuildingCaptureEvent } from '@/game/event/BuildingCaptureEvent';
import { Warhead } from '@/game/Warhead';
import { CollisionType } from '@/game/gameobject/unit/CollisionType';
import { ZoneType } from '@/game/gameobject/unit/ZoneType';
import { EnterBuildingTask } from '@/game/gameobject/task/EnterBuildingTask';
import { SpecialWarheadType } from '@/game/SpecialWarheadType';

export class CaptureBuildingTask extends EnterBuildingTask {
    static getCaptureDelaySeconds(game: any, target: any): number {
        return !(
            game.gameOpts.multiEngineer ||
            game.gameOpts.instantCapture ||
            target.owner.isNeutral ||
            target.rules.needsEngineer
        )
            ? game.rules.general.engineerCaptureDelay
            : 0;
    }

    constructor(game: any, target: any) {
        super(game, target, CaptureBuildingTask.getCaptureDelaySeconds(game, target));
    }

    isAllowed(unit: any): boolean {
        return (
            unit.rules.engineer &&
            this.target.rules.capturable &&
            !this.target.isDestroyed &&
            this.target.buildStatus !== BuildStatus.BuildDown &&
            !this.target.secureProgressTrait?.isActiveFrom(unit.owner) &&
            !this.game.areFriendly(unit, this.target)
        );
    }

    onEnter(unit: any): void {
        this.game.unspawnObject(unit);
        if (this.game.gameOpts.multiEngineer) {
            const generalRules = this.game.rules.general;
            if (
                (!this.target.rules.needsEngineer || !generalRules.engineerAlwaysCaptureTech) &&
                this.target.healthTrait.health > 100 * generalRules.engineerCaptureLevel
            ) {
                let damage = Math.floor(generalRules.engineerDamage * this.target.healthTrait.maxHitPoints);
                const minHealth = Math.floor(
                    (1 - Math.floor(1 / generalRules.engineerDamage) * generalRules.engineerDamage) *
                        this.target.healthTrait.maxHitPoints,
                );
                damage = Math.min(damage, this.target.healthTrait.getHitPoints() - minHealth);
                if (damage > 0) {
                    const warheadId = this.game.rules.combatDamage.c4Warhead;
                    const warhead = new Warhead(this.game.rules.getWarhead(warheadId));
                    warhead.detonate(
                        this.game,
                        damage,
                        this.target.tile,
                        0,
                        this.target.position.worldPosition,
                        ZoneType.Ground,
                        CollisionType.None,
                        this.game.createTarget(this.target, this.target.tile),
                        { player: unit.owner, obj: unit, weapon: undefined } as any,
                        SpecialWarheadType.None,
                        undefined,
                        0,
                    );
                    return;
                }
            }
        }
        if (
            this.game.gameOpts.delayedOils &&
            this.target.owner.isNeutral &&
            this.target.secureProgressTrait?.start(this.target, unit.owner)
        ) {
            return;
        }
        unit.owner.buildingsCaptured++;
        this.game.changeObjectOwner(this.target, unit.owner);
        this.game.events.dispatch(new BuildingCaptureEvent(this.target));
    }
}
