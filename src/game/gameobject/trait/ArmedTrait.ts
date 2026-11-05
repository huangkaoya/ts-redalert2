import { Weapon } from "@/game/Weapon";
import { WeaponType } from "@/game/WeaponType";
import { NotifyTick } from "@/game/gameobject/trait/interface/NotifyTick";
import { NotifyDestroy } from "@/game/gameobject/trait/interface/NotifyDestroy";
import { VeteranLevel } from "@/game/gameobject/unit/VeteranLevel";
import { isNotNullOrUndefined } from "@/util/typeGuard";
interface GameObject {
    veteranLevel: VeteranLevel;
    rules: GameObjectRules;
    art: GameObjectArt;
    name: string;
    explodes: boolean;
    crashableTrait?: any;
    isCrashing?: boolean;
    tile: any;
    transportTrait?: {
        units: GameObject[];
    };
    isVehicle(): boolean;
}
interface GameObjectRules {
    weaponCount?: number;
    elitePrimary?: string;
    primary?: string;
    eliteSecondary?: string;
    secondary?: string;
    deathWeapon?: string;
    combatDamage: {
        deathWeapon?: string;
    };
    guardRange: number;
    deployFire?: boolean;
    deployFireWeapon?: WeaponType;
    getEliteWeaponAtIndex(index: number): string | undefined;
    getWeaponAtIndex(index: number): string | undefined;
}
interface GameObjectArt {
    elitePrimaryFireFlh?: any;
    primaryFireFlh?: any;
    eliteSecondaryFireFlh?: any;
    secondaryFireFlh?: any;
    getSpecialWeaponFlh(index: number): any;
}
interface DestroyContext {
    weapon?: {
        warhead: {
            rules: {
                temporal: boolean;
            };
        };
        rules: {
            suicide: boolean;
        };
    };
    obj?: GameObject;
}
interface Target {
    createTarget(obj: GameObject, tile: any): any;
}
export class ArmedTrait implements NotifyTick, NotifyDestroy {
    private gameObject: GameObject;
    private rules: GameObjectRules;
    private specialWeaponIndex: number = 0;
    private guardWeaponRangeOverride?: number;
    public primaryWeapon?: Weapon;
    public secondaryWeapon?: Weapon;
    public deathWeapon?: Weapon;
    constructor(gameObject: GameObject, rules: GameObjectRules) {
        this.gameObject = gameObject;
        this.rules = rules;
        this.specialWeaponIndex = 0;
        const isElite = gameObject.veteranLevel === VeteranLevel.Elite;
        if (gameObject.rules.weaponCount) {
            this.selectSpecialWeapon(0, isElite);
            this.guardWeaponRangeOverride = this.primaryWeapon?.range;
        }
        else {
            this.selectStandardWeapons(isElite);
        }
    }
    private selectStandardWeapons(isElite: boolean = false): void {
        const gameObject = this.gameObject;
        const primaryWeaponName = (isElite && gameObject.rules.elitePrimary) || gameObject.rules.primary;
        if (primaryWeaponName) {
            const fireFlh = isElite ? gameObject.art.elitePrimaryFireFlh : gameObject.art.primaryFireFlh;
            this.primaryWeapon = Weapon.factory(primaryWeaponName, WeaponType.Primary, gameObject as any, this.rules as any, fireFlh);
        }
        else {
            this.primaryWeapon = undefined;
        }
        const secondaryWeaponName = (isElite && gameObject.rules.eliteSecondary) || gameObject.rules.secondary;
        if (secondaryWeaponName) {
            const fireFlh = isElite ? gameObject.art.eliteSecondaryFireFlh : gameObject.art.secondaryFireFlh;
            this.secondaryWeapon = Weapon.factory(secondaryWeaponName, WeaponType.Secondary, gameObject as any, this.rules as any, fireFlh);
        }
        else {
            this.secondaryWeapon = undefined;
        }
        if (gameObject.explodes || gameObject.crashableTrait) {
            const deathWeaponName = gameObject.rules.deathWeapon ||
                (gameObject.crashableTrait && this.secondaryWeapon?.rules.name) ||
                this.primaryWeapon?.rules.name ||
                this.rules.combatDamage.deathWeapon;
            this.deathWeapon = Weapon.factory(deathWeaponName, WeaponType.DeathWeapon, gameObject as any, this.rules as any);
        }
    }
    private selectSpecialWeapon(index: number, isElite: boolean = false): void {
        const gameObject = this.gameObject;
        const weaponCount = gameObject.rules.weaponCount;
        if (weaponCount < 1) {
            throw new Error(`Object "${gameObject.name}" doesn't support special weapons`);
        }
        if (weaponCount - 1 < index) {
            throw new RangeError(`Weapon index ${index} out of bounds (max ${weaponCount}) for object ${gameObject.name}`);
        }
        const weaponName = (isElite && gameObject.rules.getEliteWeaponAtIndex(index)) ||
            gameObject.rules.getWeaponAtIndex(index);
        if (!weaponName) {
            throw new Error(`Missing weapon at index ${index} for object "${gameObject.name}"`);
        }
        const fireFlh = gameObject.art.getSpecialWeaponFlh(index);
        this.primaryWeapon = Weapon.factory(weaponName, WeaponType.Primary, gameObject as any, this.rules as any, fireFlh);
        this.secondaryWeapon = undefined;
        this.specialWeaponIndex = index;
        this.deathWeapon = (this.primaryWeapon.rules as any).suicide
            ? Weapon.factory(gameObject.rules.deathWeapon || this.primaryWeapon.name, WeaponType.DeathWeapon, gameObject as any, this.rules as any)
            : undefined;
    }
    public toggleEliteWeapons(isElite: boolean): void {
        if (this.gameObject.rules.weaponCount) {
            this.selectSpecialWeapon(this.specialWeaponIndex, isElite);
        }
        else {
            this.selectStandardWeapons(isElite);
        }
    }
    public getSpecialWeaponIndex(): number {
        return this.specialWeaponIndex;
    }
    public computeGuardScanRange(weapon?: Weapon): number {
        const maxWeaponRange = this.guardWeaponRangeOverride ??
            [this.primaryWeapon, this.secondaryWeapon]
                .filter(w => w === weapon || (w?.rules as any).neverUse)
                .reduce((max, w) => Math.max(max, w!.range), 0);
        const guardRange = Math.max(maxWeaponRange, this.gameObject.rules.guardRange);
        return Math.min(15, 2 * guardRange - 1);
    }
    public getDeployFireWeapon(): Weapon | undefined {
        if (this.gameObject.rules.deployFire) {
            return this.gameObject.rules.deployFireWeapon === WeaponType.Primary
                ? this.primaryWeapon
                : this.secondaryWeapon;
        }
        return undefined;
    }
    public isEquippedWithWeapon(weapon: Weapon): boolean {
        return [this.primaryWeapon, this.secondaryWeapon].includes(weapon);
    }
    public getWeapons(): Weapon[] {
        return [this.primaryWeapon, this.secondaryWeapon].filter(isNotNullOrUndefined);
    }
    [NotifyTick.onTick](): void {
        this.primaryWeapon && this.primaryWeapon.tick();
        this.secondaryWeapon && this.secondaryWeapon.tick();
    }
    [NotifyDestroy.onDestroy](gameObject: GameObject, target: Target, context?: DestroyContext): void {
        if (!this.deathWeapon)
            return;
        if (context?.weapon?.warhead.rules.temporal)
            return;
        if (gameObject.crashableTrait && !gameObject.isCrashing)
            return;
        if (context?.obj?.isVehicle() &&
            context.weapon?.rules.suicide &&
            context.obj.transportTrait?.units.find(unit => unit === gameObject))
            return;
        this.deathWeapon.fire(target.createTarget(gameObject, gameObject.tile), target as any);
    }
    public dispose(): void {
        this.gameObject = undefined!;
        this.primaryWeapon = undefined;
        this.secondaryWeapon = undefined;
        this.deathWeapon = undefined;
    }
}
