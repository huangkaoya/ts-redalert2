import { DeathType } from '../common/DeathType';
import { ZoneType } from '../unit/ZoneType';
import { Vehicle } from '../Vehicle';
import { NotifyAttack } from './interface/NotifyAttack';
import { NotifyDestroy } from './interface/NotifyDestroy';
import { NotifyHeal } from './interface/NotifyHeal';
import { NotifyDamage } from './interface/NotifyDamage';
import { NotifyTeleport } from './interface/NotifyTeleport';
import { NotifyTick } from './interface/NotifyTick';
import { WaitMinutesTask } from '../task/system/WaitMinutesTask';
import { GameSpeed } from '../../GameSpeed';
import { RadialTileFinder } from '../../map/tileFinder/RadialTileFinder';
import { AttackTask } from '../task/AttackTask';
const getRockingTicks = (): number => (Vehicle as any).ROCKING_TICKS + 2;
export class ParasiteableTrait implements NotifyTick, NotifyHeal, NotifyDamage, NotifyAttack, NotifyDestroy, NotifyTeleport {
    private gameObject: any;
    private beingBoarded: boolean = false;
    private parasite?: any;
    private parasiteWeapon?: any;
    private damageTickCooldown: number = 0;
    private lastAttacker?: any;
    private lastExternalBaseDamage?: number;
    private lastExternalDamageTick?: number;
    constructor(gameObject: any) {
        this.gameObject = gameObject;
    }
    infest(parasite: any, weapon: any): void {
        this.beingBoarded = false;
        this.parasite = parasite;
        this.parasiteWeapon = weapon;
        this.damageTickCooldown = parasite.rules.organic ? getRockingTicks() : 0;
        this.lastAttacker = undefined;
        this.lastExternalBaseDamage = undefined;
        this.lastExternalDamageTick = undefined;
        if (weapon.warhead.rules.paralyzes) {
            this.gameObject.moveTrait.setDisabled(true);
        }
    }
    isInfested(): boolean {
        return (!(!this.parasite || this.parasite.isDestroyed)) || this.beingBoarded;
    }
    isParalyzed(): boolean {
        return !!this.parasiteWeapon?.warhead.rules.paralyzes;
    }
    uninfest(): void {
        if (this.parasite) {
            if (this.parasiteWeapon.warhead.rules.paralyzes) {
                this.gameObject.moveTrait.setDisabled(false);
            }
            this.parasite = undefined;
            this.parasiteWeapon = undefined;
        }
    }
    getParasite(): any {
        return this.parasite;
    }
    [NotifyTick.onTick](target: any, gameState: any): void {
        if (!this.parasite)
            return;
        if (this.parasite.isDestroyed) {
            this.uninfest();
            return;
        }
        if (this.damageTickCooldown > 0) {
            this.damageTickCooldown--;
            return;
        }
        const weapon = this.parasiteWeapon;
        this.damageTickCooldown = this.parasite.rules.organic
            ? getRockingTicks()
            : weapon.getCooldownTicks();
        let damage = weapon.rules.damage;
        if (this.parasite.veteranTrait) {
            damage *= this.parasite.veteranTrait.getVeteranDamageMultiplier();
        }
        let computedDamage = weapon.warhead.computeDamage(damage, target, gameState);
        if (this.canBeCulled(target, this.parasite, weapon, gameState)) {
            computedDamage = target.healthTrait.getHitPoints();
        }
        weapon.warhead.inflictDamage(computedDamage, target, {
            player: this.parasite.owner,
            obj: this.parasite,
            weapon: weapon,
        }, gameState);
        if (target.isCrashing) {
            this.parasiteWeapon.expireCooldown();
            this.evictOrDestroyParasite(target, gameState);
        }
        else if (!target.isDestroyed &&
            target.isVehicle() &&
            target.zone !== ZoneType.Air &&
            weapon.warhead.rules.rocker) {
            target.applyRocking(90 * (gameState.generateRandom() >= 0.5 ? 1 : -1), 1);
        }
    }
    private canBeCulled(target: any, parasite: any, weapon: any, gameState: any): boolean {
        if (!weapon.warhead.rules.culling)
            return false;
        const audioVisual = gameState.rules.audioVisual;
        const threshold = parasite.veteranTrait?.isElite()
            ? audioVisual.conditionYellow
            : audioVisual.conditionRed;
        return target.healthTrait.health <= 100 * threshold;
    }
    [NotifyHeal.onHeal](target: any, gameState: any, amount: number, healer: any): void {
        if (!this.parasite ||
            this.parasite.isDestroyed ||
            healer === target ||
            (target.isAircraft() && healer?.rules.unitReload)) {
            return;
        }
        if (!this.parasite.rules.organic || healer?.rules.unitRepair) {
            this.parasite.deathType = DeathType.None;
            gameState.destroyObject(this.parasite, healer ? { player: healer.owner, obj: healer } : undefined);
            this.uninfest();
        }
        else {
            const parasite = this.parasite;
            this.evictOrDestroyParasite(target, gameState);
            this.stunParasite(parasite, gameState);
        }
    }
    [NotifyDamage.onDamage](target: any, gameState: any, damage: number, attacker: any): void {
        if (attacker?.obj !== this.parasite) {
            this.lastAttacker = attacker;
            this.lastExternalBaseDamage = attacker?.weapon?.rules.damage ?? damage;
            this.lastExternalDamageTick = gameState.currentTick;
        }
    }
    [NotifyAttack.onAttack](target: any, attacker: any, gameState: any): void {
        if (!this.parasite ||
            this.parasite.isDestroyed ||
            !attacker?.weapon?.warhead.rules.sonic) {
            return;
        }
        const parasite = this.parasite;
        this.evictOrDestroyParasite(target, gameState);
        this.stunParasite(parasite, gameState);
        const warhead = attacker.weapon.warhead;
        if (warhead.canDamage(parasite, parasite.tile, parasite.zone)) {
            const damage = warhead.computeDamage(attacker.weapon.rules.damage, parasite, gameState);
            warhead.inflictDamage(damage, parasite, attacker, gameState);
        }
        const currentTask = attacker.obj?.unitOrderTrait.getCurrentTask();
        if (currentTask instanceof AttackTask &&
            currentTask.getWeapon().warhead.rules.sonic) {
            currentTask.cancel();
        }
    }
    [NotifyDestroy.onDestroy](target: any, gameState: any, destroyer: any, forced: boolean): void {
        if (!this.parasite || this.parasite.isDestroyed)
            return;
        if (forced || this.shouldSupressParasite(gameState, this.parasite)) {
            this.parasite.deathType = DeathType.None;
            gameState.destroyObject(this.parasite, destroyer, forced);
            this.uninfest();
        }
        else {
            this.parasiteWeapon.expireCooldown();
            this.evictOrDestroyParasite(target, gameState);
        }
    }
    private shouldSupressParasite(gameState: any, parasite: any): boolean {
        return !parasite.invulnerableTrait.isActive() &&
            !!this.lastExternalBaseDamage &&
            this.lastExternalBaseDamage > parasite.rules.suppressionThreshold &&
            gameState.currentTick - this.lastExternalDamageTick! <
                2 * (this.lastExternalBaseDamage - parasite.rules.suppressionThreshold);
    }
    [NotifyTeleport.onBeforeTeleport](target: any, gameState: any, fromTile: any, toTile: any): void {
        if (!fromTile || !toTile || !this.parasite || this.parasite.isDestroyed)
            return;
        if (this.shouldSupressParasite(gameState, this.parasite)) {
            this.parasite.deathType = DeathType.None;
            gameState.destroyObject(this.parasite, this.lastAttacker);
            this.uninfest();
        }
        else {
            this.parasiteWeapon.expireCooldown();
            const parasite = this.parasite;
            this.evictOrDestroyParasite(target, gameState, true);
            if (!parasite.isDestroyed) {
                this.stunParasite(parasite, gameState);
            }
        }
    }
    private stunParasite(parasite: any, gameState: any): void {
        parasite.unitOrderTrait.addTaskToFront(new WaitMinutesTask(10 / 60).setCancellable(false));
        if (parasite.isVehicle() && parasite.submergibleTrait) {
            parasite.submergibleTrait.emerge(parasite, gameState);
            parasite.cloakableTrait?.uncloak(gameState);
            parasite.submergibleTrait.setCooldown(10 * GameSpeed.BASE_TICKS_PER_SECOND);
        }
    }
    private evictOrDestroyParasite(host: any, gameState: any, teleporting: boolean = false): void {
        if (!this.parasite || this.parasite.isDestroyed)
            return;
        const canEvict = gameState.map.terrain.getPassableSpeed(host.tile, this.parasite.rules.speedType, this.parasite.isInfantry(), host.onBridge) || gameState.map.getObjectsOnTile(host.tile).find((obj: any) => obj.isBuilding());
        if (canEvict) {
            let targetTile = host.tile;
            let onBridge = host.onBridge;
            if ((!teleporting && !host.isDestroyed) || this.parasite.rules.organic) {
                const tileFinder = new RadialTileFinder(gameState.map.tiles, gameState.map.mapBounds, targetTile, { width: 1, height: 1 }, 1, 1, (tile: any) => gameState.map.terrain.getPassableSpeed(tile, this.parasite.rules.speedType, this.parasite.isInfantry(), onBridge) > 0 &&
                    !gameState.map.terrain.findObstacles({ tile, onBridge }, this.parasite).length);
                const foundTile = tileFinder.getNextTile();
                if (!foundTile) {
                    this.parasite.deathType = DeathType.None;
                    gameState.destroyObject(this.parasite, {
                        player: host.owner,
                        obj: host,
                    });
                    this.uninfest();
                    return;
                }
                targetTile = foundTile;
            }
            this.parasite.onBridge = onBridge;
            this.parasite.position.subCell = this.parasite.isInfantry()
                ? host.position.subCell
                : 0;
            this.parasite.zone = gameState.map.getTileZone(targetTile, !onBridge);
            this.parasite.position.tileElevation = onBridge
                ? gameState.map.tileOccupation.getBridgeOnTile(targetTile).tileElevation
                : 0;
            this.parasite.resetGuardModeToIdle();
            gameState.unlimboObject(this.parasite, targetTile, true);
        }
        else {
            this.parasite.deathType = DeathType.None;
            gameState.destroyObject(this.parasite, {
                player: host.owner,
                obj: host,
            });
        }
        this.uninfest();
    }
    destroyParasite(destroyer: any, gameState: any): void {
        if (this.parasite) {
            this.parasite.deathType = DeathType.None;
            gameState.destroyObject(this.parasite, destroyer);
            this.uninfest();
        }
    }
    dispose(): void {
        this.gameObject = undefined;
    }
}
