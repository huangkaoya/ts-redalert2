import { ObjectType } from '@/engine/type/ObjectType';
import { ZoneType } from '@/game/gameobject/unit/ZoneType';
import { StanceType } from '@/game/gameobject/infantry/StanceType';
import { InfDeathType } from '@/game/gameobject/infantry/InfDeathType';
import { MoveTrait } from '@/game/gameobject/trait/MoveTrait';
import { SuppressionTrait } from '@/game/gameobject/trait/SuppressionTrait';
import { Techno } from '@/game/gameobject/Techno';
import { IdleActionTrait } from '@/game/gameobject/trait/IdleActionTrait';
import { CrashableTrait } from '@/game/gameobject/trait/CrashableTrait';
import { AgentTrait } from '@/game/gameobject/trait/AgentTrait';
import { CastProgressTrait } from '@/game/gameobject/trait/CastProgressTrait';
import { CrateBonuses } from '@/game/gameobject/unit/CrateBonuses';
export class Infantry extends Techno {
    static SUB_CELLS = [2, 4, 3];
    direction: number;
    onBridge: boolean;
    zone: ZoneType;
    private _stance: StanceType;
    isFiring: boolean;
    isPanicked: boolean;
    infDeathType: InfDeathType;
    crateBonuses: CrateBonuses;
    moveTrait: MoveTrait;
    crashableTrait?: CrashableTrait;
    suppressionTrait?: SuppressionTrait;
    agentTrait?: AgentTrait;
    castProgressTrait?: CastProgressTrait;
    idleActionTrait: IdleActionTrait;
    get isMoving(): boolean {
        return this.moveTrait.isMoving();
    }
    static factory(id: string, rules: any, owner: any, general: any): Infantry {
        const infantry = new this(id, rules, owner);
        infantry.moveTrait = new MoveTrait(infantry as any, general);
        infantry.traits.add(infantry.moveTrait);
        if (infantry.rules.crashable) {
            infantry.crashableTrait = new CrashableTrait(infantry);
            infantry.traits.add(infantry.crashableTrait);
        }
        if (!infantry.rules.fearless) {
            infantry.suppressionTrait = new SuppressionTrait();
            infantry.traits.add(infantry.suppressionTrait);
        }
        if (infantry.rules.agent) {
            infantry.agentTrait = new AgentTrait();
            infantry.traits.add(infantry.agentTrait);
        }
        if (infantry.rules.engineer) {
            infantry.castProgressTrait = new CastProgressTrait();
            infantry.traits.add(infantry.castProgressTrait);
        }
        infantry.idleActionTrait = new IdleActionTrait();
        infantry.traits.add(infantry.idleActionTrait);
        return infantry;
    }
    constructor(id: string, rules: any, owner: any) {
        super(ObjectType.Infantry as any, id, rules, owner);
        this.direction = 0;
        this.onBridge = false;
        this.zone = ZoneType.Ground;
        this._stance = StanceType.None;
        this.isFiring = false;
        this.isPanicked = false;
        this.infDeathType = InfDeathType.Gunfire;
        this.crateBonuses = new CrateBonuses();
    }
    get stance(): StanceType {
        return this._stance === StanceType.None &&
            this.suppressionTrait?.isSuppressed()
            ? StanceType.Prone
            : this._stance;
    }
    set stance(value: StanceType) {
        this._stance = value;
        this.moveTrait.setDisabled([StanceType.Deployed, StanceType.Cheer].includes(value));
        this.attackTrait?.setDisabled([StanceType.Paradrop, StanceType.Cheer].includes(value));
    }
    isUnit(): boolean {
        return true;
    }
    isInfantry(): boolean {
        return true;
    }
}
