import { StanceType } from "@/game/gameobject/infantry/StanceType";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { LandTargeting } from "@/game/type/LandTargeting";
import { LandType } from "@/game/type/LandType";
import { NavalTargeting } from "@/game/type/NavalTargeting";
import { SpeedType } from "@/game/type/SpeedType";
import { WeaponType } from "@/game/WeaponType";
interface GameObject {
    name: string;
    owner: any;
    rules: {
        attackCursorOnFriendlies?: boolean;
        ivan?: boolean;
        natural?: boolean;
        unnatural?: boolean;
        spawned?: boolean;
        organic?: boolean;
        naval?: boolean;
        speedType?: SpeedType;
        navalTargeting: NavalTargeting;
        landTargeting: LandTargeting;
    };
    zone?: ZoneType;
    stance?: StanceType;
    tileElevation?: number;
    healthTrait?: {
        health: number;
    };
    overpoweredTrait?: any;
    cloakableTrait?: {
        isCloaked(): boolean;
    };
    tntChargeTrait?: {
        hasCharge(): boolean;
    };
    parasiteableTrait?: {
        isInfested(): boolean;
    };
    mindControllableTrait?: any;
    warpedOutTrait?: {
        isInvulnerable(): boolean;
    };
    submergibleTrait?: {
        isSubmerged(): boolean;
    };
    isUnit(): boolean;
    isInfantry(): boolean;
    isVehicle(): boolean;
    isAircraft(): boolean;
    isBuilding(): boolean;
    isTechno(): boolean;
}
interface ProjectileRules {
    isAntiGround: boolean;
    isAntiAir: boolean;
}
interface WeaponRules {
    damage: number;
    limboLaunch?: boolean;
}
interface WarheadRules {
    electricAssault?: boolean;
    bombDisarm?: boolean;
    mindControl?: boolean;
    parasite?: boolean;
    temporal?: boolean;
    ivanBomb?: boolean;
}
interface GeneralRules {
    prism: {
        type: string;
    };
}
interface GameContext {
    landType: LandType;
}
interface AllianceSystem {
    areFriendly(unit1: GameObject, unit2: GameObject): boolean;
    alliances: {
        haveSharedIntel(owner1: any, owner2: any): boolean;
    };
}
type TargetCheckFunction = (target?: GameObject, context?: GameContext, alliances?: AllianceSystem, forcefire?: boolean, shift?: boolean) => boolean;
export class WeaponTargeting {
    private targetChecks: TargetCheckFunction[] = [];
    constructor(private weaponType: WeaponType, private projectileRules: ProjectileRules, private weaponRules: WeaponRules, private warheadRules: WarheadRules, private gameObject: GameObject, private generalRules: GeneralRules) {
        this.initConditions();
    }
    private initConditions(): void {
        if (!this.projectileRules.isAntiGround) {
            this.targetChecks.push((target) => !!target);
        }
        const prismType = this.generalRules.prism.type;
        if (this.gameObject.name === prismType && this.weaponType === WeaponType.Secondary) {
            this.targetChecks.push((target, context, alliances, forcefire, shift) => !(!shift || !target?.isBuilding() || target.name !== prismType || target.owner !== this.gameObject.owner));
        }
        else if (this.warheadRules.electricAssault) {
            this.targetChecks.push((target, context, alliances, forcefire, shift) => !((!forcefire && !shift) || !target?.isBuilding() || !target.overpoweredTrait || target.owner !== this.gameObject.owner));
        }
        else if (this.weaponRules.damage < 0) {
            this.targetChecks.push((target, context, alliances) => !!(target !== this.gameObject &&
                target?.isUnit() &&
                alliances!.areFriendly(target, this.gameObject) &&
                target.healthTrait.health < 100 &&
                this.gameObject.isAircraft() === target.isAircraft()));
        }
        else {
            if (this.gameObject.rules.attackCursorOnFriendlies || this.warheadRules.bombDisarm) {
                this.targetChecks.push((target, context, alliances, forcefire, shift) => !shift && !!(!this.warheadRules.bombDisarm ||
                    (target?.isTechno() && target.tntChargeTrait?.hasCharge())));
            }
            else {
                this.targetChecks.push((target, context, alliances, forcefire) => !((!forcefire || this.warheadRules.mindControl) &&
                    target?.isTechno() &&
                    alliances!.areFriendly(target, this.gameObject)));
            }
            this.targetChecks.push((target, context, alliances) => !(target?.isTechno() &&
                target.cloakableTrait?.isCloaked() &&
                !alliances!.alliances.haveSharedIntel(this.gameObject.owner, target.owner)));
            if (this.weaponRules.limboLaunch) {
                this.targetChecks.push((target, context, alliances, forcefire, shift) => !(shift && target &&
                    (target.isVehicle() || target.isAircraft()) &&
                    target.parasiteableTrait?.isInfested()));
            }
            if (this.warheadRules.ivanBomb) {
                this.targetChecks.push((target) => !(!target?.isTechno() || !target.tntChargeTrait || target.tntChargeTrait.hasCharge()));
            }
            if (this.warheadRules.parasite) {
                this.targetChecks.push((target, context, alliances, forcefire) => !!((!target && forcefire) ||
                    target?.isInfantry() ||
                    ((target?.isVehicle() || target?.isAircraft()) && target.parasiteableTrait)));
            }
            if (this.warheadRules.mindControl) {
                this.targetChecks.push((target) => !(!target?.isTechno() || !target.mindControllableTrait));
            }
            if (!this.warheadRules.temporal) {
                this.targetChecks.push((target, context, alliances, forcefire, shift) => !(shift && target?.isTechno() && target.warpedOutTrait.isInvulnerable()));
            }
            if (this.gameObject.rules.natural) {
                this.targetChecks.push((target) => !target?.isTechno() || !target.rules.unnatural);
            }
        }
        this.targetChecks.push((target, context) => this.canTargetZone(target, context));
    }
    public canTarget(target?: GameObject, context?: GameContext, alliances?: AllianceSystem, forcefire?: boolean, shift?: boolean): boolean {
        return this.targetChecks.every(check => check(target, context, alliances, forcefire, shift));
    }
    private canTargetZone(target?: GameObject, context?: GameContext): boolean {
        let zone: ZoneType;
        if (target?.isUnit()) {
            if (target?.isInfantry() &&
                target.stance === StanceType.Paradrop &&
                target.tileElevation > 2) {
                return this.projectileRules.isAntiAir &&
                    (this.projectileRules.isAntiGround || this.weaponType === WeaponType.Secondary);
            }
            if (target.zone === ZoneType.Air) {
                return this.projectileRules.isAntiAir;
            }
            if (this.weaponType === WeaponType.Secondary &&
                this.projectileRules.isAntiAir &&
                !this.projectileRules.isAntiGround) {
                return false;
            }
            zone = target.zone;
        }
        else {
            zone = context.landType === LandType.Water ? ZoneType.Water : ZoneType.Ground;
        }
        return zone === ZoneType.Water
            ? this.canTargetNaval(this.gameObject.rules.navalTargeting, this.gameObject, target, this.weaponType)
            : this.canTargetLand(this.gameObject.rules.landTargeting, this.weaponType);
    }
    private canTargetLand(landTargeting: LandTargeting, weaponType: WeaponType): boolean {
        switch (landTargeting) {
            case LandTargeting.LandOk:
                return true;
            case LandTargeting.LandNotOk:
                return false;
            case LandTargeting.LandSecondary:
                return weaponType === WeaponType.Secondary;
            default:
                throw new Error(`Unhandled LandTargeting value "${landTargeting}"`);
        }
    }
    private canTargetNaval(navalTargeting: NavalTargeting, shooter: GameObject, target?: GameObject, weaponType?: WeaponType): boolean {
        switch (navalTargeting) {
            case NavalTargeting.UnderwaterNever:
                return !target || !(target.isVehicle() && target.submergibleTrait?.isSubmerged());
            case NavalTargeting.UnderwaterSecondary:
                return target && target.isVehicle() && target.submergibleTrait && !shooter.rules.spawned
                    ? weaponType === WeaponType.Secondary
                    : weaponType === WeaponType.Primary;
            case NavalTargeting.UnderwaterOnly:
                return !!(target && target.isVehicle() && target.submergibleTrait);
            case NavalTargeting.OrganicSecondary:
                return target?.isTechno() && target.rules.organic
                    ? weaponType === WeaponType.Secondary
                    : weaponType === WeaponType.Primary;
            case NavalTargeting.SealSpecial:
                return target?.isTechno() &&
                    target.rules.naval &&
                    !target.rules.organic &&
                    (target.isBuilding() || target.rules.speedType === SpeedType.Float)
                    ? weaponType === WeaponType.Secondary
                    : weaponType === WeaponType.Primary;
            case NavalTargeting.NavalAll:
                return true;
            case NavalTargeting.NavalNone:
                return false;
            default:
                throw new Error(`Unhandled NavalTargeting value "${navalTargeting}"`);
        }
    }
}
