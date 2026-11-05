import { QueueType, ProductionQueue } from './ProductionQueue';
import { BuildCat, FactoryType } from '../../rules/TechnoRules';
import { ObjectType } from '@/engine/type/ObjectType';
import { EventDispatcher } from '@/util/event';
import { PrereqCategory } from '@/game/rules/GeneralRules';
import { SideType } from '@/game/SideType';
const PREREQ_MAP = new Map()
    .set("POWER", PrereqCategory.Power)
    .set("FACTORY", PrereqCategory.Factory)
    .set("BARRACKS", PrereqCategory.Barracks)
    .set("RADAR", PrereqCategory.Radar)
    .set("TECH", PrereqCategory.Tech)
    .set("PROC", PrereqCategory.Proc);
export class Production {
    private player: any;
    private maxTechLevel: number;
    private gameOpts: any;
    private rules: any;
    private allAvailableObjects: any[];
    private buildSpeedModifier: number;
    private queues: Map<QueueType, ProductionQueue>;
    private _onQueueUpdate: EventDispatcher<any>;
    private primaryFactories: Map<any, any>;
    private factoryCounts: Map<any, number>;
    private veteranTypes: Set<any>;
    private stolenTech: Set<SideType>;
    static factory(player: any, rules: any, gameOpts: any, availableObjects: any[]): Production {
        const production = new Production(player, rules.mpDialogSettings.techLevel, gameOpts, rules, availableObjects);
        const maxQueueSize = rules.general.maximumQueuedObjects + 1;
        production.addQueue(QueueType.Structures, new ProductionQueue(QueueType.Structures, 1, 1));
        production.addQueue(QueueType.Armory, new ProductionQueue(QueueType.Armory, 1, 1));
        production.addQueue(QueueType.Infantry, new ProductionQueue(QueueType.Infantry, maxQueueSize, maxQueueSize));
        production.addQueue(QueueType.Vehicles, new ProductionQueue(QueueType.Vehicles, maxQueueSize, maxQueueSize));
        production.addQueue(QueueType.Ships, new ProductionQueue(QueueType.Ships, maxQueueSize, maxQueueSize));
        production.addQueue(QueueType.Aircrafts, new ProductionQueue(QueueType.Aircrafts, 0, maxQueueSize));
        return production;
    }
    constructor(player: any, techLevel: number, gameOpts: any, rules: any, availableObjects: any[]) {
        this.player = player;
        this.maxTechLevel = techLevel;
        this.gameOpts = gameOpts;
        this.rules = rules;
        this.allAvailableObjects = availableObjects;
        this.buildSpeedModifier = 1;
        this.queues = new Map();
        this._onQueueUpdate = new EventDispatcher();
        this.primaryFactories = new Map();
        this.factoryCounts = new Map();
        this.veteranTypes = new Set();
        this.stolenTech = new Set();
    }
    get onQueueUpdate() {
        return this._onQueueUpdate.asEvent();
    }
    addQueue(type: QueueType, queue: ProductionQueue) {
        this.queues.set(type, queue);
        queue.onUpdate.subscribe(() => this._onQueueUpdate.dispatch(this, queue));
    }
    getQueue(type: QueueType): ProductionQueue {
        const queue = this.queues.get(type);
        if (!queue) {
            throw new Error("No queue found with type " + QueueType[type]);
        }
        return queue;
    }
    getAllQueues(): ProductionQueue[] {
        return [...this.queues.values()];
    }
    getQueueTypeForObject(object: any): QueueType {
        if (object.type === ObjectType.Building) {
            return object.buildCat === BuildCat.Combat
                ? QueueType.Armory
                : QueueType.Structures;
        }
        if (object.type === ObjectType.Infantry) {
            return QueueType.Infantry;
        }
        if (object.type === ObjectType.Vehicle) {
            return object.naval ? QueueType.Ships : QueueType.Vehicles;
        }
        if (object.type === ObjectType.Aircraft) {
            return QueueType.Aircrafts;
        }
        throw new Error("Unsupported object type " + ObjectType[object.type]);
    }
    getQueueForObject(object: any): ProductionQueue {
        return this.getQueue(this.getQueueTypeForObject(object));
    }
    getQueueTypeForFactory(type: FactoryType): QueueType {
        if (type === FactoryType.InfantryType)
            return QueueType.Infantry;
        if (type === FactoryType.UnitType)
            return QueueType.Vehicles;
        if (type === FactoryType.AircraftType)
            return QueueType.Aircrafts;
        if (type === FactoryType.NavalUnitType)
            return QueueType.Ships;
        throw new Error("Unsupported factory type " + FactoryType[type]);
    }
    getFactoryTypeForQueueType(type: QueueType): FactoryType {
        if (type === QueueType.Structures || type === QueueType.Armory) {
            return FactoryType.BuildingType;
        }
        if (type === QueueType.Infantry)
            return FactoryType.InfantryType;
        if (type === QueueType.Vehicles)
            return FactoryType.UnitType;
        if (type === QueueType.Aircrafts)
            return FactoryType.AircraftType;
        if (type === QueueType.Ships)
            return FactoryType.NavalUnitType;
        throw new Error("Unsupported queue type " + QueueType[type]);
    }
    getQueueForFactory(type: FactoryType): ProductionQueue {
        return this.getQueue(this.getQueueTypeForFactory(type));
    }
    isAvailableForProduction(object: any): boolean {
        return (
            object.techLevel !== -1 &&
            object.techLevel <= this.maxTechLevel &&
            !(object.buildLimit === 0 && !this.player.isAi) &&
            !(object.superWeapon &&
                this.rules.getSuperWeapon(object.superWeapon).disableableFromShell &&
                !this.gameOpts.superWeapons) &&
            this.hasFactoryFor(object) &&
            this.meetsPrerequisites(object)
        );
    }
    getAvailableObjects(): any[] {
        return this.allAvailableObjects.filter(obj => this.isAvailableForProduction(obj));
    }
    hasFactoryFor(object: any): boolean {
        if (object.owner.length) {
            const factoryType = this.getFactoryTypeFor(object);
            return !!Array.from(this.player.buildings).find((building: any) => building.factoryTrait?.type === factoryType &&
                (factoryType !== FactoryType.UnitType || building.rules.naval === object.naval) &&
                !!building.rules.owner.find((owner: string) => object.owner.includes(owner)));
        }
        return true;
    }
    meetsStolenTech(object: any): boolean {
        return object.requiresStolenAlliedTech
            ? this.stolenTech.has(SideType.GDI)
            : object.requiresStolenSovietTech
              ? this.stolenTech.has(SideType.Nod)
              : !object.requiresStolenThirdTech || this.stolenTech.has(SideType.ThirdSide);
    }
    getFactoryTypeFor(object: any): FactoryType {
        if (object.type === ObjectType.Building)
            return FactoryType.BuildingType;
        if (object.type === ObjectType.Infantry)
            return FactoryType.InfantryType;
        if (object.type === ObjectType.Aircraft)
            return FactoryType.AircraftType;
        return object.naval ? FactoryType.NavalUnitType : FactoryType.UnitType;
    }
    meetsPrerequisites(object: any): boolean {
        const buildingNames = Array.from(this.player.buildings).map((b: any) => b.name);
        for (const override of object.prerequisiteOverride) {
            if (buildingNames.includes(override.toUpperCase())) {
                return true;
            }
        }
        if (!object.isAvailableTo(this.player.country)) {
            return false;
        }
        for (const prereq of object.prerequisite) {
            const upperPrereq = prereq.toUpperCase();
            if (PREREQ_MAP.has(upperPrereq)) {
                const category = PREREQ_MAP.get(upperPrereq);
                if (category === undefined) {
                    throw new Error("Unknown prereqName " + upperPrereq);
                }
                const prereqBuildings = this.rules.general.prereqCategories.get(category);
                if (prereqBuildings === undefined) {
                    throw new Error(`Missing prerequisite category ${category} in rules`);
                }
                let hasPrereq = false;
                for (const building of prereqBuildings) {
                    if (buildingNames.indexOf(building) !== -1) {
                        hasPrereq = true;
                        break;
                    }
                }
                if (!hasPrereq) {
                    return false;
                }
            } else if (buildingNames.indexOf(upperPrereq) === -1) {
                return false;
            }
        }
        return !!this.meetsStolenTech(object);
    }
    getPrimaryFactory(type: FactoryType): any {
        return this.primaryFactories.get(type);
    }
    setPrimaryFactory(building: any) {
        if (building.rules.factory) {
            this.primaryFactories.set(building.rules.factory, building);
        }
    }
    isPrimaryFactory(building: any): boolean {
        return this.getPrimaryFactory(building.rules.factory) === building;
    }
    incrementFactoryCount(type: FactoryType) {
        this.factoryCounts.set(type, (this.factoryCounts.get(type) ?? 0) + 1);
    }
    decrementFactoryCount(type: FactoryType) {
        if (!this.factoryCounts.get(type)) {
            throw new Error(`Can't decrement factory count ${FactoryType[type]}. Already 0`);
        }
        this.factoryCounts.set(type, this.factoryCounts.get(type)! - 1);
    }
    getFactoryCount(type: FactoryType): number {
        return this.factoryCounts.get(type) ?? 0;
    }
    crownPrimaryFactoryHeir(type: FactoryType) {
        const heir = Array.from(this.player.buildings).find((building: any) => building.rules.factory === type);
        if (heir) {
            this.primaryFactories.set(type, heir);
        }
        else {
            this.primaryFactories.delete(type);
        }
    }
    hasAnyFactory(): boolean {
        return this.primaryFactories.size > 0;
    }
    addVeteranType(type: any) {
        this.veteranTypes.add(type);
    }
    hasVeteranType(type: any): boolean {
        return this.veteranTypes.has(type);
    }
    addStolenTech(type: SideType) {
        this.stolenTech.add(type);
    }
    dispose() {
        this.queues.clear();
        this.player = undefined;
    }
}
