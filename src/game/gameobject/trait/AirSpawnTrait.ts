import { Coords } from "@/game/Coords";
import { ObjectType } from "@/engine/type/ObjectType";
import { Warhead } from "@/game/Warhead";
import { CollisionType } from "@/game/gameobject/unit/CollisionType";
import { MoveTask } from "@/game/gameobject/task/move/MoveTask";
import { CallbackTask } from "@/game/gameobject/task/system/CallbackTask";
import { TaskGroup } from "@/game/gameobject/task/system/TaskGroup";
import { FacingUtil } from "@/game/gameobject/unit/FacingUtil";
import { NotifyDestroy } from "@/game/gameobject/trait/interface/NotifyDestroy";
import { NotifyOwnerChange } from "@/game/gameobject/trait/interface/NotifyOwnerChange";
import { NotifySpawn } from "@/game/gameobject/trait/interface/NotifySpawn";
import { NotifyTeleport } from "@/game/gameobject/trait/interface/NotifyTeleport";
import { NotifyTick } from "@/game/gameobject/trait/interface/NotifyTick";
import { NotifyUnspawn } from "@/game/gameobject/trait/interface/NotifyUnspawn";
import { NotifyWarpChange } from "@/game/gameobject/trait/interface/NotifyWarpChange";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { SpecialWarheadType } from '@/game/SpecialWarheadType';
interface MissileLaunch {
    missile: any;
    targetTile: any;
    targetBridge: any;
    targetWorldPos: any;
    target: any;
    warhead: Warhead;
    damage: number;
    pauseFrames?: number;
}
export class AirSpawnTrait implements NotifyDestroy, NotifyOwnerChange, NotifySpawn, NotifyTeleport, NotifyTick, NotifyUnspawn, NotifyWarpChange {
    private spawns: any[] = [];
    private storage: any[] = [];
    private missileLaunches: MissileLaunch[] = [];
    private nextRegenTicks: number[] = [];
    private nextReloadTicks?: number;
    get availableSpawns(): number {
        return this.storage.length;
    }
    debugSetStorage(unit: any, count: number): void {
        this.storage.length = count;
        this.storage.fill(unit, 0, count);
    }
    isLaunchingMissiles(): boolean {
        return this.missileLaunches.length > 0;
    }
    [NotifySpawn.onSpawn](gameObject: any, world: any): void {
        const aircraftType = world.rules.getObject(gameObject.rules.spawns, ObjectType.Aircraft);
        for (let i = 0; i < gameObject.rules.spawnsNumber; i++) {
            this.pushNewSpawn(aircraftType, world, gameObject);
        }
    }
    [NotifyUnspawn.onUnspawn](gameObject: any, world: any): void {
        this.destroySpawns(gameObject, world, undefined, undefined);
    }
    [NotifyDestroy.onDestroy](gameObject: any, world: any, damageSource: any, warhead: any): void {
        this.destroySpawns(gameObject, world, damageSource, warhead);
    }
    private pushNewSpawn(aircraftType: any, world: any, parent: any): void {
        const spawn = world.createUnitForPlayer(aircraftType, parent.owner);
        spawn.limboData = { selected: false, controlGroup: undefined };
        if (aircraftType.missileSpawn) {
            spawn.pitch = 90 * world.rules.general.getMissileRules(aircraftType.name).pitchInitial;
        }
        this.spawns.push(spawn);
        this.storage.push(spawn);
    }
    private destroySpawns(gameObject: any, world: any, damageSource?: any, warhead?: any): void {
        for (const spawn of this.spawns) {
            if (!spawn.isDestroyed) {
                if (spawn.isSpawned && !spawn.rules.missileSpawn && spawn.crashableTrait) {
                    spawn.crashableTrait.crash(damageSource);
                }
                else {
                    if (!spawn.isSpawned) {
                        if (spawn.armedTrait) {
                            spawn.armedTrait.deathWeapon = undefined;
                        }
                        spawn.position.tileElevation = gameObject.position.tileElevation;
                        spawn.zone = gameObject.isUnit() ? gameObject.zone : ZoneType.Ground;
                        spawn.onBridge = !!gameObject.isUnit() && gameObject.onBridge;
                        spawn.position.tile = gameObject.tile;
                    }
                    world.destroyObject(spawn, damageSource, warhead);
                }
            }
        }
        this.spawns.length = 0;
        this.storage.length = 0;
        this.missileLaunches.length = 0;
    }
    [NotifyTick.onTick](gameObject: any, world: any): void {
        this.spawns = this.spawns.filter(spawn => !spawn.isDestroyed);
        this.missileLaunches = this.missileLaunches.filter(launch => !launch.missile.isDestroyed);
        if (this.spawns.length < gameObject.rules.spawnsNumber) {
            const missingCount = gameObject.rules.spawnsNumber - this.spawns.length;
            const aircraftType = world.rules.getObject(gameObject.rules.spawns, ObjectType.Aircraft);
            for (let i = 0; i < missingCount; i++) {
                if (aircraftType.missileSpawn && i > 0 && this.nextRegenTicks[i] === undefined) {
                    this.nextRegenTicks[i] = this.nextRegenTicks[0];
                }
                else {
                    this.nextRegenTicks[i] ??= gameObject.rules.spawnRegenRate;
                    if (this.nextRegenTicks[i] > 0) {
                        this.nextRegenTicks[i]--;
                    }
                }
                if (this.nextRegenTicks[i] <= 0) {
                    this.pushNewSpawn(aircraftType, world, gameObject);
                }
            }
            this.nextRegenTicks = this.nextRegenTicks.filter(ticks => ticks > 0);
        }
        if (this.storage.length > 0) {
            this.nextReloadTicks ??= gameObject.rules.spawnReloadRate;
            if (this.nextReloadTicks > 0) {
                this.nextReloadTicks--;
            }
            if (this.nextReloadTicks <= 0) {
                for (const spawn of this.storage) {
                    if (spawn.ammoTrait && spawn.ammoTrait.ammo < spawn.ammoTrait.maxAmmo) {
                        spawn.ammoTrait.ammo++;
                    }
                }
                this.nextReloadTicks = gameObject.rules.spawnReloadRate;
            }
        }
        else {
            this.nextReloadTicks = undefined;
        }
        for (const launch of this.missileLaunches.slice()) {
            const missileRules = world.rules.general.getMissileRules(launch.missile.name);
            launch.pauseFrames ??= missileRules.pauseFrames;
            if (launch.pauseFrames > 0) {
                launch.pauseFrames--;
            }
            if (launch.pauseFrames <= 0) {
                const finalPitch = 90 * missileRules.pitchFinal;
                const pitchIncrement = (90 * (missileRules.pitchFinal - missileRules.pitchInitial)) / missileRules.tiltFrames;
                const missile = launch.missile;
                if (missile.pitch < finalPitch) {
                    missile.pitch = Math.min(finalPitch, missile.pitch + pitchIncrement);
                }
                else {
                    missile.unitOrderTrait.addTask(new TaskGroup(new MoveTask(world, launch.targetTile, !!launch.targetBridge), new CallbackTask(() => {
                        if (!missile.isDestroyed) {
                            world.unspawnObject(missile);
                            missile.dispose();
                            const offset = Coords.vecGroundToWorld(FacingUtil.toMapCoords(missile.direction).multiplyScalar(1));
                            const detonationPos = launch.targetWorldPos.clone().add(offset);
                            const targetZone = world.map.getTileZone(launch.targetTile);
                            launch.warhead.detonate(world, launch.damage, launch.targetTile, launch.targetBridge?.tileElevation ?? 0, detonationPos, targetZone, launch.targetBridge ? CollisionType.OnBridge : CollisionType.None, launch.target, { player: missile.owner, obj: gameObject, weapon: undefined } as any, SpecialWarheadType.None);
                        }
                    })).setCancellable(false));
                    const missileIndex = this.spawns.indexOf(missile);
                    if (missileIndex === -1) {
                        throw new Error("Missile not found in spawns list");
                    }
                    this.spawns.splice(missileIndex, 1);
                    this.missileLaunches.splice(this.missileLaunches.indexOf(launch), 1);
                }
            }
        }
    }
    [NotifyOwnerChange.onChange](gameObject: any, oldOwner: any, world: any): void {
        for (const spawn of this.spawns) {
            if (!spawn.isDestroyed) {
                world.changeObjectOwner(spawn, gameObject.owner);
            }
        }
    }
    [NotifyWarpChange.onChange](gameObject: any, world: any, isWarping: boolean): void {
        if (isWarping) {
            this.removeMissileLaunches(world);
        }
    }
    [NotifyTeleport.onBeforeTeleport](gameObject: any, world: any, targetTile: any, keepSpawns: boolean): void {
        if (!keepSpawns) {
            this.removeMissileLaunches(world);
        }
    }
    private removeMissileLaunches(world: any): void {
        if (this.missileLaunches.length > 0) {
            for (const launch of this.missileLaunches) {
                world.unspawnObject(launch.missile);
                launch.missile.dispose();
                const missileIndex = this.spawns.indexOf(launch.missile);
                if (missileIndex === -1) {
                    throw new Error("Missile not found in spawns list");
                }
                this.spawns.splice(missileIndex, 1);
            }
            this.missileLaunches.length = 0;
        }
    }
    prepareLaunch(launcher: any, target: any, world: any): any {
        if (this.storage.length > 0) {
            const spawn = this.storage[0];
            if (!spawn.ammo)
                return;
            this.storage.shift();
            if (spawn.missileSpawnTrait) {
                let warheadType: string;
                let damage: number;
                const isElite = launcher.veteranTrait?.isElite();
                const rules = world.rules;
                if (launcher.rules.spawns === rules.general.v3Rocket.type) {
                    warheadType = isElite ? rules.combatDamage.v3EliteWarhead : rules.combatDamage.v3Warhead;
                    damage = isElite ? rules.general.v3Rocket.eliteDamage : rules.general.v3Rocket.damage;
                }
                else if (launcher.rules.spawns === rules.general.dMisl.type) {
                    warheadType = isElite ? rules.combatDamage.dMislEliteWarhead : rules.combatDamage.dMislWarhead;
                    damage = isElite ? rules.general.dMisl.eliteDamage : rules.general.dMisl.damage;
                }
                else {
                    throw new Error(`Unhandled missile type "${launcher.rules.spawns}"`);
                }
                const warhead = new Warhead(world.rules.getWarhead(warheadType));
                spawn.missileSpawnTrait.setDamage(damage).setWarhead(warhead).setLauncher(launcher);
                this.missileLaunches.push({
                    missile: spawn,
                    targetTile: this.getMissileMoveTargetTile(target, world),
                    targetBridge: target.getBridge(),
                    targetWorldPos: target.getWorldCoords().clone(),
                    target: target,
                    warhead: warhead,
                    damage: damage,
                    pauseFrames: undefined
                });
            }
            else {
                if (!spawn.spawnLinkTrait) {
                    throw new Error(`Aircraft "${spawn.name}" must have Spawned=yes to be launchable`);
                }
                spawn.spawnLinkTrait.setParent(launcher);
            }
            return spawn;
        }
    }

    getMissileMoveTargetTile(target: any, world: any): any {
        return target.obj?.isUnit()
            ? target.obj.tile
            : target.obj?.isBuilding() && !world.map.isWithinBounds(target.tile)
              ? world.map.tileOccupation
                    .calculateTilesForGameObject(target.obj.tile, target.obj)
                    .find((tile: any) => world.map.isWithinBounds(tile)) ?? target.tile
              : target.tile;
    }

    storeAircraft(aircraft: any, world: any): void {
        if (!this.spawns.includes(aircraft)) {
            throw new Error(`Object "${aircraft.name}#${aircraft.id}" not found in list of linked spawns`);
        }
        if (aircraft.limboData) {
            throw new Error(`Object "${aircraft.name}#${aircraft.id}" is already in limbo`);
        }
        world.limboObject(aircraft, { selected: false, controlGroup: undefined });
        this.storage.push(aircraft);
    }
}
