import { VeteranLevel } from '@/game/gameobject/unit/VeteranLevel';
import { NotifyTargetDestroy } from '@/game/trait/interface/NotifyTargetDestroy';
import { UnitPromoteEvent } from '@/game/event/UnitPromoteEvent';
import { VeteranAbility } from '@/game/gameobject/unit/VeteranAbility';
import { SelfHealingTrait } from './SelfHealingTrait';
import { CloakableTrait } from './CloakableTrait';
import { ArmedTrait } from './ArmedTrait';
import { SensorsTrait } from './SensorsTrait';
interface GameObject {
    rules: {
        cost: number;
        veteranAbilities: Set<VeteranAbility>;
        eliteAbilities: Set<VeteranAbility>;
        dontScore?: boolean;
        insignificant?: boolean;
        organic?: boolean;
    };
    traits: { find(type: any): any; add(trait: any): void; getAll(): any[] };
    armedTrait?: ArmedTrait;
    cloakableTrait?: CloakableTrait;
    sensorsTrait?: SensorsTrait;
    suppressionTrait?: any;
    unitOrderTrait: any;
    explodes?: boolean;
    radarInvisible?: boolean;
    c4?: boolean;
    defaultToGuardArea?: boolean;
    crusher?: boolean;
    isDestroyed?: boolean;
    isCrashing?: boolean;
    veteranLevel: VeteranLevel;
    isTechno(): boolean;
    isInfantry(): boolean;
    resetGuardModeToIdle(): void;
}
interface VeteranRules {
    veteranRatio: number;
    veteranCap: VeteranLevel;
    veteranSpeed: number;
    veteranArmor: number;
    veteranCombat: number;
    veteranROF: number;
    veteranSight: number;
}
interface GameManager {
    rules: {
        general: {
            cloakDelay: number;
        };
    };
    events: {
        dispatch(event: UnitPromoteEvent): void;
    };
    areFriendly(obj1: GameObject, obj2: GameObject): boolean;
    addObjectTrait(obj: GameObject, trait: any): void;
}
interface Weapon {
    warhead: {
        rules: {
            temporal?: boolean;
            parasite?: boolean;
        };
    };
}
export class VeteranTrait implements NotifyTargetDestroy {
    private gameObject: GameObject;
    private veteranRules: VeteranRules;
    private veteranLevel: VeteranLevel;
    private xp: number;
    private promotionThresh: number;
    constructor(gameObject: GameObject, veteranRules: VeteranRules) {
        this.gameObject = gameObject;
        this.veteranRules = veteranRules;
        this.veteranLevel = VeteranLevel.None;
        this.xp = 0;
        this.promotionThresh = gameObject.rules.cost * veteranRules.veteranRatio + 1;
    }
    [NotifyTargetDestroy.onDestroy](source: GameObject, target: GameObject, weapon?: Weapon, gameManager?: GameManager): void {
        if (source.isDestroyed && !source.isCrashing)
            return;
        if (!target.isTechno())
            return;
        if (target.rules.dontScore || target.rules.insignificant)
            return;
        // 完善模拟层逻辑：XP when (temporal/parasite kill) OR not friendly — not the inverse.
        const isTemporalOrParasiteKill = !!(weapon && (weapon.warhead.rules.temporal ||
            (weapon.warhead.rules.parasite && source.rules.organic)));
        if (isTemporalOrParasiteKill || !gameManager.areFriendly(source, target)) {
            if (this.veteranLevel >= this.veteranRules.veteranCap)
                return;
            const xpGain = target.rules.cost * (target.veteranLevel + 1);
            if (this.gainXP(xpGain) && gameManager) {
                this.handlePromotion(source, gameManager);
            }
        }
    }
    setRelativeXP(percentage: number): void {
        this.gainXP(Math.floor(percentage * this.promotionThresh));
    }
    gainXP(amount: number): boolean {
        this.xp += amount;
        if (this.xp >= this.promotionThresh) {
            const newLevel = Math.min(this.veteranLevel + Math.floor(this.xp / this.promotionThresh), this.veteranRules.veteranCap);
            const levelIncrease = newLevel - this.veteranLevel;
            if (levelIncrease > 0) {
                this.xp -= levelIncrease * this.promotionThresh;
                this.setVeteranLevel(newLevel);
                return true;
            }
        }
        return false;
    }
    promote(levels: number, gameManager: GameManager): void {
        const newLevel = Math.min(this.veteranLevel + levels, this.veteranRules.veteranCap);
        if (newLevel > this.veteranLevel) {
            this.setVeteranLevel(newLevel);
            this.handlePromotion(this.gameObject, gameManager);
        }
    }
    isMaxLevel(): boolean {
        return this.veteranLevel === this.veteranRules.veteranCap;
    }
    isElite(): boolean {
        return this.veteranLevel === VeteranLevel.Elite;
    }
    private setVeteranLevel(level: VeteranLevel): void {
        this.veteranLevel = level;
        if (this.veteranLevel === VeteranLevel.Elite) {
            this.gameObject.armedTrait?.toggleEliteWeapons(true);
        }
    }
    private handlePromotion(gameObject: GameObject, gameManager: GameManager): void {
        if (this.hasVeteranAbility(VeteranAbility.SELF_HEAL)) {
            if (!gameObject.traits.find(SelfHealingTrait)) {
                gameManager.addObjectTrait(gameObject, new SelfHealingTrait());
            }
        }
        if (this.hasVeteranAbility(VeteranAbility.CLOAK)) {
            if (!gameObject.cloakableTrait) {
                gameObject.cloakableTrait = new CloakableTrait(gameObject, gameManager.rules.general.cloakDelay);
                gameManager.addObjectTrait(gameObject, gameObject.cloakableTrait);
            }
        }
        if (this.hasVeteranAbility(VeteranAbility.EXPLODES)) {
            if (!gameObject.explodes) {
                gameObject.explodes = true;
                if (!gameObject.armedTrait) {
                    gameObject.armedTrait = new ArmedTrait(gameObject as any, gameManager.rules as any);
                    gameManager.addObjectTrait(gameObject, gameObject.armedTrait);
                }
            }
        }
        if (this.hasVeteranAbility(VeteranAbility.RADAR_INVISIBLE)) {
            if (!gameObject.radarInvisible) {
                gameObject.radarInvisible = true;
            }
        }
        if (this.hasVeteranAbility(VeteranAbility.SENSORS)) {
            if (!gameObject.sensorsTrait) {
                gameObject.sensorsTrait = new SensorsTrait();
                gameManager.addObjectTrait(gameObject, gameObject.sensorsTrait);
            }
        }
        if (gameObject.isInfantry() && this.hasVeteranAbility(VeteranAbility.FEARLESS)) {
            gameObject.suppressionTrait?.disable();
        }
        if (this.hasVeteranAbility(VeteranAbility.C4)) {
            if (!gameObject.c4) {
                gameObject.c4 = true;
            }
        }
        if (this.hasVeteranAbility(VeteranAbility.GUARD_AREA)) {
            if (!gameObject.defaultToGuardArea) {
                gameObject.defaultToGuardArea = true;
                if (gameObject.unitOrderTrait.isIdle()) {
                    gameObject.resetGuardModeToIdle();
                }
            }
        }
        if (this.hasVeteranAbility(VeteranAbility.CRUSHER)) {
            if (!gameObject.crusher) {
                gameObject.crusher = true;
            }
        }
        gameManager.events.dispatch(new UnitPromoteEvent(gameObject));
    }
    getVeteranSightMultiplier(): number {
        return this.getVeteranAbilityMultiplier(VeteranAbility.SIGHT);
    }
    getVeteranSpeedMultiplier(): number {
        return this.getVeteranAbilityMultiplier(VeteranAbility.FASTER);
    }
    getVeteranArmorMultiplier(): number {
        return this.getVeteranAbilityMultiplier(VeteranAbility.STRONGER);
    }
    getVeteranDamageMultiplier(): number {
        return this.getVeteranAbilityMultiplier(VeteranAbility.FIREPOWER);
    }
    getVeteranRofMultiplier(): number {
        return this.getVeteranAbilityMultiplier(VeteranAbility.ROF);
    }
    hasVeteranAbility(ability: VeteranAbility): boolean {
        return ((this.veteranLevel === VeteranLevel.Veteran &&
            this.gameObject.rules.veteranAbilities.has(ability)) ||
            (this.veteranLevel >= VeteranLevel.Elite &&
                this.gameObject.rules.eliteAbilities.has(ability)));
    }
    private getVeteranAbilityMultiplier(ability: VeteranAbility): number {
        let multiplier = 1;
        if ((this.veteranLevel === VeteranLevel.Veteran &&
            this.gameObject.rules.veteranAbilities.has(ability)) ||
            (this.veteranLevel >= VeteranLevel.Elite &&
                this.gameObject.rules.eliteAbilities.has(ability))) {
            multiplier = this.getVeteranRulesMultiplier(ability);
        }
        return multiplier;
    }
    private getVeteranRulesMultiplier(ability: VeteranAbility): number {
        switch (ability) {
            case VeteranAbility.FASTER:
                return this.veteranRules.veteranSpeed;
            case VeteranAbility.STRONGER:
                return this.veteranRules.veteranArmor;
            case VeteranAbility.FIREPOWER:
                return this.veteranRules.veteranCombat;
            case VeteranAbility.ROF:
                return this.veteranRules.veteranROF;
            case VeteranAbility.SIGHT:
                return this.veteranRules.veteranSight;
            default:
                throw new Error(`Unhandled VeteranAbility: ${ability}`);
        }
    }
    dispose(): void {
        this.gameObject = undefined as any;
    }
}
