import { NotifyTick } from "@/game/trait/interface/NotifyTick";
import { NotifyUnspawn } from "@/game/trait/interface/NotifyUnspawn";
import { NotifyOwnerChange } from "@/game/trait/interface/NotifyOwnerChange";
import { ProductionQueue, QueueStatus } from "@/game/player/production/ProductionQueue";
import { InsufficientFundsEvent } from "@/game/event/InsufficientFundsEvent";
import { TechnoRules, FactoryType } from "@/game/rules/TechnoRules";
import { NotifySpawn } from "@/game/trait/interface/NotifySpawn";
import { NotifyPower } from "@/game/trait/interface/NotifyPower";
import { PowerTrait, PowerLevel } from "@/game/player/trait/PowerTrait";
import { clamp, floorTo } from "@/util/math";
import { GameSpeed } from "@/game/GameSpeed";
import { ObjectType } from "@/engine/type/ObjectType";
import { GameMath } from "@/game/math/GameMath";
export class ProductionTrait implements NotifyTick, NotifySpawn, NotifyUnspawn, NotifyOwnerChange, NotifyPower {
    private rules: any;
    private speedCheat: any;
    private availableObjectRules: Set<any>;
    private baseBuildSpeed: number;
    constructor(rules: any, speedCheat: any) {
        this.rules = rules;
        this.speedCheat = speedCheat;
        this.availableObjectRules = new Set();
        const buildSpeedTicks = 60 * rules.general.buildSpeed * GameSpeed.BASE_TICKS_PER_SECOND;
        this.baseBuildSpeed = 1 / (buildSpeedTicks / 1000);
        [
            ...rules.buildingRules.values(),
            ...rules.infantryRules.values(),
            ...rules.vehicleRules.values(),
            ...rules.aircraftRules.values(),
        ].forEach((rule) => {
            if (rule.owner.length) {
                this.availableObjectRules.add(rule);
            }
        });
    }
    [NotifyTick.onTick](gameState: any): void {
        for (const combatant of gameState.getCombatants()) {
            for (const queue of combatant.production.getAllQueues()) {
                this.tickQueue(queue, combatant, gameState);
            }
        }
    }
    [NotifySpawn.onSpawn](entity: any, gameState: any): void {
        if (entity.isBuilding() && entity.owner.production) {
            const factoryType = entity.rules.factory;
            if (factoryType) {
                if (!entity.owner.production.getPrimaryFactory(factoryType)) {
                    entity.owner.production.setPrimaryFactory(entity);
                }
                entity.owner.production.incrementFactoryCount(factoryType);
                if (factoryType === FactoryType.AircraftType) {
                    this.updateAircraftQueueMaxSize(entity.owner, gameState);
                }
            }
        }
        else if (entity.isAircraft() &&
            entity.owner.production &&
            this.rules.general.padAircraft.includes(entity.name)) {
            this.updateAircraftQueueMaxSize(entity.owner, gameState);
        }
    }
    [NotifyUnspawn.onUnspawn](entity: any, gameState: any): void {
        if (entity.isBuilding() && entity.owner.production) {
            this.ensurePrerequisites(entity.owner);
            const factoryType = entity.rules.factory;
            if (factoryType) {
                if (entity.owner.production.getPrimaryFactory(factoryType) === entity) {
                    entity.owner.production.crownPrimaryFactoryHeir(factoryType);
                }
                entity.owner.production.decrementFactoryCount(factoryType);
                if (factoryType === FactoryType.AircraftType) {
                    this.updateAircraftQueueMaxSize(entity.owner, gameState);
                }
            }
        }
        else if (entity.isAircraft() &&
            entity.owner.production &&
            this.rules.general.padAircraft.includes(entity.name)) {
            this.updateAircraftQueueMaxSize(entity.owner, gameState);
        }
    }
    [NotifyOwnerChange.onChange](entity: any, oldOwner: any, gameState: any): void {
        if (entity.isBuilding()) {
            this.ensurePrerequisites(oldOwner);
            const factoryType = entity.rules.factory;
            if (factoryType) {
                if (oldOwner.production?.getPrimaryFactory(factoryType) === entity) {
                    oldOwner.production.crownPrimaryFactoryHeir(factoryType);
                }
                if (entity.owner.production && !entity.owner.production.getPrimaryFactory(factoryType)) {
                    entity.owner.production.setPrimaryFactory(entity);
                }
                oldOwner.production?.decrementFactoryCount(factoryType);
                entity.owner.production?.incrementFactoryCount(factoryType);
                if (factoryType === FactoryType.AircraftType) {
                    this.updateAircraftQueueMaxSize(entity.owner, gameState);
                    this.updateAircraftQueueMaxSize(oldOwner, gameState);
                }
            }
        }
        else if (entity.isAircraft() &&
            this.rules.general.padAircraft.includes(entity.name)) {
            this.updateAircraftQueueMaxSize(entity.owner, gameState);
            this.updateAircraftQueueMaxSize(oldOwner, gameState);
        }
    }
    [NotifyPower.onPowerLow](player: any): void {
        if (player.production) {
            player.production.buildSpeedModifier = this.computeLowPowerBuildSpeedModifier(player.powerTrait.power, player.powerTrait.drain);
        }
    }
    [NotifyPower.onPowerRestore](player: any): void {
        if (player.production) {
            player.production.buildSpeedModifier = 1;
        }
    }
    [NotifyPower.onPowerChange](player: any): void {
        if (player.powerTrait?.level === PowerLevel.Low && player.production) {
            player.production.buildSpeedModifier = this.computeLowPowerBuildSpeedModifier(player.powerTrait.power, player.powerTrait.drain);
        }
    }
    private computeLowPowerBuildSpeedModifier(power: number, drain: number): number {
        const powerRatio = 1 - Math.min(1, power / drain);
        const generalRules = this.rules.general;
        const penaltyModifier = (0.3 * generalRules.lowPowerPenaltyModifier * powerRatio) / 0.15;
        return clamp(1 - penaltyModifier, generalRules.minLowPowerProductionSpeed, generalRules.maxLowPowerProductionSpeed);
    }
    private updateAircraftQueueMaxSize(player: any, gameState: any): void {
        if (!player.production)
            return;
        gameState.afterTick(() => {
            const helipadCapacity = [...player.buildings]
                .filter(building => building.helipadTrait)
                .reduce((total, building) => total + building.dockTrait.numberOfDocks, 0);
            const currentAircraft = player
                .getOwnedObjectsByType(ObjectType.Aircraft, true)
                .filter(aircraft => gameState.rules.general.padAircraft.includes(aircraft.name))
                .length;
            const aircraftQueue = player.production.getQueueForFactory(FactoryType.AircraftType);
            aircraftQueue.maxSize = Math.max(0, helipadCapacity - currentAircraft);
        });
    }
    private tickQueue(queue: ProductionQueue, player: any, gameState: any): void {
        if (queue.status !== QueueStatus.Active)
            return;
        let hasProgress = false;
        const currentItem = queue.getFirst();
        const factoryType = player.production.getFactoryTypeForQueueType(queue.type);
        const factoryCount = player.production.getFactoryCount(factoryType);
        const buildSpeedModifier = player.production.buildSpeedModifier;
        const multipleFactoryPenalty = 1 / GameMath.pow(this.rules.general.multipleFactory, factoryCount - 1);
        const wallSpeedModifier = currentItem.rules.wall
            ? 1 / this.rules.general.wallBuildSpeedCoefficient
            : 1;
        const effectiveBuildSpeed = this.baseBuildSpeed * buildSpeedModifier * multipleFactoryPenalty * wallSpeedModifier;
        const itemCost = currentItem.creditsEach;
        const buildTime = itemCost && !this.speedCheat.value
            ? floorTo((itemCost / effectiveBuildSpeed) * currentItem.rules.buildTimeMultiplier, 54)
            : 54;
        const finalBuildTime = Math.max(54, buildTime);
        const playerCredits = player.credits;
        const remainingCost = currentItem.creditsEach - currentItem.creditsSpent;
        const affordableAmount = Math.min(player.credits, itemCost / finalBuildTime + currentItem.creditsSpentLeftover, remainingCost);
        if (affordableAmount > 0) {
            const spendAmount = Math.floor(affordableAmount);
            currentItem.creditsSpentLeftover = affordableAmount - spendAmount;
            if (spendAmount) {
                currentItem.creditsSpent += spendAmount;
                currentItem.progress = currentItem.creditsSpent / currentItem.creditsEach;
                player.credits -= spendAmount;
                hasProgress = true;
            }
        }
        else if (!currentItem.creditsEach) {
            const progressIncrement = currentItem.progress * finalBuildTime;
            currentItem.progress = Math.min(1, (1 + progressIncrement) / finalBuildTime);
            hasProgress = true;
        }
        if (hasProgress && currentItem.progress === 1) {
            queue.status = QueueStatus.Ready;
        }
        if (playerCredits > 0 && !player.credits) {
            gameState.events.dispatch(new InsufficientFundsEvent(player));
        }
        if (hasProgress) {
            queue.notifyUpdated();
        }
    }
    private ensurePrerequisites(player: any): void {
        if (!player.production)
            return;
        for (const queue of player.production.getAllQueues()) {
            const itemsToRemove = queue.getAll().map(item => ({
                rules: item.rules,
                quantity: item.quantity,
                creditsSpent: item.creditsSpent
            }));
            for (const item of itemsToRemove) {
                if (!player.production.isAvailableForProduction(item.rules)) {
                    queue.pop(item.rules, item.quantity);
                    player.credits += item.creditsSpent;
                }
            }
        }
    }
    getAvailableObjects(): any[] {
        return [...this.availableObjectRules];
    }
}
