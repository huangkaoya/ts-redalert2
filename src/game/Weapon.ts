import { Warhead } from "@/game/Warhead";
import { FlhCoords } from "@/game/art/FlhCoords";
import { WeaponFireEvent } from "@/game/event/WeaponFireEvent";
import * as geometry from "@/game/math/geometry";
import { ObjectRules } from "@/game/rules/ObjectRules";
import { Coords } from "@/game/Coords";
import { ObjectType } from "@/engine/type/ObjectType";
import { WeaponTargeting } from "@/game/WeaponTargeting";
import { WeaponType } from "@/game/WeaponType";
import { Vector2 } from "@/game/math/Vector2";
import { Vector3 } from "@/game/math/Vector3";
import { ShroudType } from "@/game/map/MapShroud";
interface GameMap {
    isWithinHardBounds(position: any): boolean;
}
interface GameEngine {
    map: GameMap;
    events: {
        dispatch(event: WeaponFireEvent): void;
    };
    createProjectile(name: string, gameObject: GameObject, weapon: Weapon, target: Target, flag: boolean): GameObject;
    spawnObject(obj: GameObject, tile: any): void;
    unlimboObject(obj: GameObject, tile: any): void;
    limboObject(obj: GameObject, options: {
        selected: boolean;
        controlGroup: number;
    }): void;
    getUnitSelection(): {
        isSelected(obj: GameObject): boolean;
        getOrCreateSelectionModel(obj: GameObject): {
            getControlGroupNumber(): number;
        };
    };
    generateRandomInt(min: number, max: number): number;
    mapShroudTrait: {
        getPlayerShroud(owner: any): {
            getShroudType(tile: any, elevation: number): number;
            revealTemporarily(obj: GameObject): void;
        } | null;
    };
}
interface GameObject {
    rules: any;
    position: {
        getMapPosition(): any;
        moveToLeptons(position: any): void;
        moveByLeptons(x: number, y: number): void;
        moveByLeptons3(vector: Vector3): void;
        tileElevation: number;
        tile: any;
        worldPosition: Vector3;
    };
    direction: number;
    art: {
        turretOffset: number;
    };
    tile: any;
    tileElevation: number;
    owner: {
        removeOwnedObject(obj: GameObject): void;
    };
    baseDamageMultiplier?: number;
    isBuilding(): boolean;
    isUnit(): boolean;
    isAircraft(): boolean;
    isInfantry(): boolean;
    isVehicle(): boolean;
    isTechno(): boolean;
    dispose(): void;
    overpoweredTrait?: any;
    primaryWeapon?: Weapon;
    garrisonTrait?: {
        isOccupied(): boolean;
        units: {
            length: number;
        };
    };
    veteranTrait?: {
        getVeteranRofMultiplier(): number;
    };
    ammoTrait?: {
        ammo: number;
    };
    airSpawnTrait?: {
        prepareLaunch(gameObject: GameObject, target: Target, engine: GameEngine): GameObject | null;
        availableSpawns: number;
    };
    turretTrait?: {
        facing: number;
    };
    cloakableTrait?: {
        uncloak(engine: GameEngine): void;
    };
    parasiteableTrait?: {
        beingBoarded: boolean;
    };
    crateBonuses: {
        firepower: number;
    };
    getFoundationCenterOffset(): {
        x: number;
        y: number;
    };
}
interface Target {
    obj?: GameObject;
}
interface WeaponRules {
    name: string;
    warhead: string;
    projectile: string;
    spawner?: boolean;
    minimumRange: number;
    range: number;
    rof: number;
    burst: number;
    iniSpeed: number;
    limboLaunch?: boolean;
    revealOnFire?: boolean;
    decloakToFire?: boolean;
}
interface ProjectileRules {
    name: string;
    arcing?: boolean;
    rot?: boolean;
    inviso?: boolean;
    iniRot: number;
}
interface WarheadRules {
    parasite?: boolean;
}
interface RulesEngine {
    getWeapon(name: string): WeaponRules;
    getWarhead(name: string): any;
    getProjectile(name: string): ProjectileRules;
    getObject(type: string, objectType: ObjectType): GameObject;
    general: {
        v3Rocket: {
            type: string;
        };
        dMisl: {
            type: string;
        };
    };
    combatDamage: {
        v3Warhead: string;
        dMislWarhead: string;
    };
}
const ARCING_PROJECTILE_SPEED = 50;
const AIRCRAFT_BURST_COUNT_HIGH_ROT = 5;
const AIRCRAFT_BURST_COUNT_MEDIUM = 2;
const AIRCRAFT_BURST_COUNT_LOW = 1;
export class Weapon {
    static readonly NUKE_PAYLOAD_NAME = "NukePayload";
    public readonly type: WeaponType;
    public readonly gameObject: GameObject;
    public readonly rules: WeaponRules;
    public readonly warhead: Warhead;
    public readonly projectileRules: ProjectileRules;
    public readonly flh: FlhCoords;
    public readonly targeting: WeaponTargeting;
    private cooldownTicks: number = 0;
    private burstsLeft: number = 0;
    private burstIndex: number = 0;
    private useBurstDelay: boolean = false;
    private lateralMuzzleMult: number = 1;
    private distributedFireAngle: number;
    static factory(weaponName: string, weaponType: WeaponType, gameObject: GameObject, rulesEngine: RulesEngine, flh?: FlhCoords): Weapon {
        const weaponRules = rulesEngine.getWeapon(weaponName);
        let warheadName = weaponRules.warhead;
        if (warheadName === Warhead.SPECIAL_WARHEAD_NAME) {
            warheadName = this.findSpecialWarheadName(weaponRules, gameObject, rulesEngine);
        }
        const warhead = new Warhead(rulesEngine.getWarhead(warheadName));
        const projectileRules = rulesEngine.getProjectile(weaponRules.projectile);
        const targeting = new WeaponTargeting(weaponType, projectileRules as any, weaponRules as any, warhead.rules, gameObject as any, rulesEngine.general as any);
        return new this(weaponType, gameObject, weaponRules, warhead, projectileRules, flh || new FlhCoords(), targeting);
    }
    static findSpecialWarheadName(weaponRules: WeaponRules, gameObject: GameObject, rulesEngine: RulesEngine): string {
        if (!weaponRules.spawner) {
            throw new Error(`Weapon "${weaponRules.name}" can't use "Special" warhead without Spawner=yes`);
        }
        let warheadName: string;
        if ((gameObject as any).rules.spawns === rulesEngine.general.v3Rocket.type) {
            warheadName = rulesEngine.combatDamage.v3Warhead;
        }
        else if ((gameObject as any).rules.spawns === rulesEngine.general.dMisl.type) {
            warheadName = rulesEngine.combatDamage.dMislWarhead;
        }
        else {
            if (!(gameObject as any).rules.spawns) {
                throw new Error(`Can't use "Special" warhead on unit type "${(gameObject as any).rules.name || (gameObject as any).name}" without "Spawns"`);
            }
            const spawnedUnitRules: any = rulesEngine.getObject((gameObject as any).rules.spawns, ObjectType.Aircraft);
            if (!spawnedUnitRules.primary) {
                throw new Error(`Spawned unit "${spawnedUnitRules.name}" doesn't have a primary weapon`);
            }
            warheadName = rulesEngine.getWeapon(spawnedUnitRules.primary).warhead;
        }
        return warheadName;
    }
    static computeSpeed(weaponRules: WeaponRules, projectileRules: ProjectileRules): number {
        if (projectileRules.arcing) {
            return 0.75 * ObjectRules.iniSpeedToLeptonsPerTick(ARCING_PROJECTILE_SPEED, 100);
        }
        if (!projectileRules.rot ||
            projectileRules.inviso ||
            (weaponRules as any).isLaser ||
            (weaponRules as any).isElectricBolt) {
            return Number.POSITIVE_INFINITY;
        }
        return (weaponRules as any).speed;
    }
    constructor(type: WeaponType, gameObject: GameObject, rules: WeaponRules, warhead: Warhead, projectileRules: ProjectileRules, flh: FlhCoords, targeting: WeaponTargeting) {
        this.type = type;
        this.gameObject = gameObject;
        this.rules = rules;
        this.warhead = warhead;
        this.projectileRules = projectileRules;
        this.flh = flh;
        this.targeting = targeting;
        this.distributedFireAngle =
            gameObject.rules.distributedFire && gameObject.rules.radialFireSegments ? -90 : 0;
    }
    get name(): string {
        return this.rules.name;
    }
    get minRange(): number {
        return this.rules.minimumRange;
    }
    get range(): number {
        if (this.gameObject.isBuilding() &&
            !this.gameObject.overpoweredTrait &&
            this.type === WeaponType.Secondary &&
            this.gameObject.primaryWeapon) {
            return Math.min(this.gameObject.primaryWeapon.rules.range, this.rules.range);
        }
        return this.rules.range;
    }
    get speed(): number {
        return Weapon.computeSpeed(this.rules, this.projectileRules);
    }
    get rof(): number {
        let rateOfFire = this.rules.rof;
        if (this.gameObject.isBuilding() &&
            this.gameObject.garrisonTrait?.isOccupied()) {
            rateOfFire /= this.gameObject.garrisonTrait.units.length;
        }
        if (this.gameObject.veteranTrait) {
            rateOfFire *= this.gameObject.veteranTrait.getVeteranRofMultiplier();
        }
        return Math.floor(rateOfFire);
    }
    getCooldownTicks(): number {
        return this.cooldownTicks;
    }
    expireCooldown(): void {
        this.cooldownTicks = 0;
    }
    resetCooldown(): void {
        this.cooldownTicks = this.rof;
    }
    hasBurstsLeft(): boolean {
        return this.burstsLeft > 0;
    }
    resetBursts(): void {
        this.burstsLeft = 0;
        this.burstIndex = 0;
        this.resetCooldown();
        if (this.gameObject.ammoTrait && this.gameObject.ammoTrait.ammo > 0) {
            this.gameObject.ammoTrait.ammo--;
        }
    }
    tick(): void {
        if (this.cooldownTicks > 0) {
            this.cooldownTicks--;
        }
    }
    getBurstsFired(): number {
        return this.burstIndex;
    }
    fire(target: Target, engine: GameEngine, damageMultiplier: number = 1): void {
        const gameObject = this.gameObject;
        let spawnedProjectile: GameObject | null = null;
        let availableSpawns = 0;
        if (gameObject.airSpawnTrait && this.rules.spawner) {
            spawnedProjectile = gameObject.airSpawnTrait.prepareLaunch(gameObject, target, engine);
            availableSpawns = gameObject.airSpawnTrait.availableSpawns;
            if (!spawnedProjectile) {
                return;
            }
        }
        if (this.burstsLeft > 0) {
            this.burstsLeft--;
            this.burstIndex++;
            this.lateralMuzzleMult *= -1;
        }
        else {
            this.useBurstDelay = false;
            this.burstIndex = 0;
            if (spawnedProjectile) {
                this.burstsLeft = availableSpawns;
            }
            else if (gameObject.isAircraft()) {
                this.burstsLeft =
                    this.projectileRules.iniRot <= 1
                        ? AIRCRAFT_BURST_COUNT_HIGH_ROT - 1
                        : gameObject.rules.fighter
                            ? AIRCRAFT_BURST_COUNT_LOW - 1
                            : AIRCRAFT_BURST_COUNT_MEDIUM - 1;
            }
            else {
                this.burstsLeft = this.rules.burst - 1;
                this.useBurstDelay = true;
            }
            this.lateralMuzzleMult = 1;
        }
        if (this.burstsLeft > 0) {
            if (spawnedProjectile && availableSpawns > 0) {
                this.cooldownTicks = this.rules.iniSpeed;
            }
            else if (gameObject.isAircraft()) {
                this.cooldownTicks = this.rules.rof;
            }
            else {
                this.cooldownTicks =
                    this.useBurstDelay && gameObject.rules.burstDelay[this.burstIndex] !== undefined
                        ? gameObject.rules.burstDelay[this.burstIndex]
                        : engine.generateRandomInt(3, 5);
            }
        }
        else {
            this.resetBursts();
        }
        if (this.rules.limboLaunch) {
            const unitSelection = engine.getUnitSelection();
            engine.limboObject(gameObject, {
                selected: unitSelection.isSelected(gameObject),
                controlGroup: unitSelection.getOrCreateSelectionModel(gameObject).getControlGroupNumber(),
            });
            if ((this.warhead.rules as any).parasite &&
                (target.obj?.isVehicle() || target.obj?.isAircraft()) &&
                target.obj.parasiteableTrait) {
                target.obj.parasiteableTrait.beingBoarded = true;
            }
        }
        const projectile = spawnedProjectile ??
            engine.createProjectile(this.projectileRules.name, gameObject, this, target, false);
        if (!projectile.isAircraft()) {
            projectile.baseDamageMultiplier =
                damageMultiplier *
                    (gameObject.isUnit() ? gameObject.crateBonuses.firepower : 1);
        }
        const firingFlh = this.flh.clone();
        firingFlh.lateral *= this.lateralMuzzleMult;
        const gameObjectPosition = gameObject.position.getMapPosition();
        if (!engine.map.isWithinHardBounds(gameObjectPosition)) {
            if (spawnedProjectile) {
                spawnedProjectile.owner.removeOwnedObject(spawnedProjectile);
                spawnedProjectile.dispose();
            }
            return;
        }
        projectile.position.moveToLeptons(gameObjectPosition);
        projectile.position.tileElevation = gameObject.position.tileElevation;
        let muzzleOffset = new Vector2(firingFlh.lateral, firingFlh.forward);
        const muzzleFacing = this.getMuzzleFacing() + this.distributedFireAngle;
        muzzleOffset = geometry.rotateVec2(muzzleOffset, muzzleFacing);
        let turretOffset = new Vector2(0, gameObject.art.turretOffset);
        turretOffset = geometry.rotateVec2(turretOffset, gameObject.direction);
        muzzleOffset.add(turretOffset);
        if (gameObject.rules.radialFireSegments && gameObject.rules.distributedFire) {
            const segmentAngle = Math.floor(180 / gameObject.rules.radialFireSegments);
            this.distributedFireAngle =
                ((this.distributedFireAngle + segmentAngle + 90) % 180) - 90;
        }
        projectile.direction = muzzleFacing;
        if (gameObject.isBuilding() && gameObject.rules.turretAnim) {
            const turretAnimOffset = Coords.screenDistanceToWorld(gameObject.rules.turretAnimX, gameObject.rules.turretAnimY);
            const foundationOffset = gameObject.getFoundationCenterOffset();
            projectile.position.moveByLeptons(-foundationOffset.x + turretAnimOffset.x, -foundationOffset.y + turretAnimOffset.y);
        }
        const position3D = new Vector3(muzzleOffset.x, firingFlh.vertical, -muzzleOffset.y);
        const worldPosition = position3D.clone().add(projectile.position.worldPosition);
        if (engine.map.isWithinHardBounds(worldPosition)) {
            projectile.position.moveByLeptons3(position3D);
        }
        if (projectile.tileElevation < 0) {
            projectile.position.tileElevation = 0;
        }
        if (projectile.isAircraft()) {
            engine.unlimboObject(projectile, projectile.position.tile);
        }
        else {
            engine.spawnObject(projectile, projectile.position.tile);
        }
        if (this.rules.revealOnFire && target.obj?.isTechno()) {
            const playerShroud = engine.mapShroudTrait.getPlayerShroud(target.obj.owner);
            if (playerShroud) {
                const shroudType = playerShroud.getShroudType(gameObject.tile, gameObject.tileElevation);
                if (shroudType === ShroudType.Unexplored || shroudType === ShroudType.TemporaryReveal) {
                    playerShroud.revealTemporarily(gameObject);
                }
            }
        }
        if (this.rules.decloakToFire) {
            gameObject.cloakableTrait?.uncloak(engine);
        }
        engine.events.dispatch(new WeaponFireEvent(this, gameObject));
    }
    getMuzzleFacing(): number {
        const gameObject = this.gameObject;
        if (!gameObject.isInfantry() &&
            !gameObject.isAircraft() &&
            (gameObject.isBuilding() || gameObject.isVehicle()) &&
            gameObject.turretTrait) {
            return gameObject.turretTrait.facing;
        }
        return gameObject.direction;
    }
}
