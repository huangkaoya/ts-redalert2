import { Color } from '@/util/Color';
import { ObjectType } from '@/engine/type/ObjectType';
import { Traits } from '@/game/Traits';
import { fnv32a } from '@/util/math';
import { Country } from '@/game/Country';
import type { Production } from '@/game/player/production/Production';
interface PlayerOwnedObject {
    id: string;
    name: string;
    type: ObjectType;
    owner: Player;
    buildLimit: number;
    limboData?: any;
}
export class Player {
    private _credits: number = 0;
    public readonly name: string;
    public readonly country?: Country;
    public readonly startLocation: any;
    public readonly color: Color;
    public isAi: boolean = false;
    public defeated: boolean = false;
    public resigned: boolean = false;
    public dropped: boolean = false;
    private objectsByType: Map<ObjectType, Set<PlayerOwnedObject>> = new Map();
    private objectsById: Map<string, PlayerOwnedObject> = new Map();
    public readonly traits: Traits = new Traits();
    public score: number = 0;
    private limitedUnitsBuiltByName: Map<string, number> = new Map();
    private unitsBuiltByType: Map<ObjectType, number> = new Map();
    private unitsKilledByType: Map<ObjectType, number> = new Map();
    private unitsLostByType: Map<ObjectType, number> = new Map();
    public buildingsCaptured: number = 0;
    public cratesPickedUp: number = 0;
    public creditsGained: number = 0;
    public cheerCooldownTicks: number = 0;
    public readonly isObserver: boolean;
    public readonly isNeutral: boolean;
    public aiDifficulty?: any;
    public customBotId?: string;
    public powerTrait?: any;
    public radarTrait?: any;
    public superWeaponsTrait?: any;
    public sharedDetectDisguiseTrait?: any;
    public production?: Production;
    get credits(): number {
        return this._credits;
    }
    set credits(value: number) {
        if (value < 0) {
            throw new RangeError("Can't set credits to a negative value");
        }
        this._credits = value;
    }
    constructor(name: string, country?: Country, startLocation?: any, color: Color = new Color(255, 0, 0)) {
        this.name = name;
        this.country = country;
        this.startLocation = startLocation;
        this.color = color;
        this.isObserver = !country;
        this.isNeutral = !!country && !country.isPlayable();
    }
    getOrCreateObjectsForType(type: ObjectType): Set<PlayerOwnedObject> {
        let objects = this.objectsByType.get(type);
        if (!objects) {
            objects = new Set();
            this.objectsByType.set(type, objects);
        }
        return objects;
    }
    addOwnedObject(object: PlayerOwnedObject): void {
        const objects = this.getOrCreateObjectsForType(object.type);
        objects.add(object);
        object.owner = this;
        this.objectsById.set(object.id, object);
    }
    removeOwnedObject(object: PlayerOwnedObject): void {
        const objects = this.objectsByType.get(object.type);
        if (!objects || !objects.has(object)) {
            throw new Error(`GameObject ${object.name} does not belong to player ${this.name}`);
        }
        objects.delete(object);
        this.objectsById.delete(object.id);
    }
    getOwnedObjectById(id: string): PlayerOwnedObject | undefined {
        return this.objectsById.get(id);
    }
    getOwnedObjectsByType(type: ObjectType, includeLimbo: boolean = false): PlayerOwnedObject[] {
        let objects = [...(this.objectsByType.get(type) || new Set())];
        if (!includeLimbo) {
            objects = objects.filter(obj => !obj.limboData);
        }
        return objects;
    }
    getOwnedObjects(includeLimbo: boolean = false): PlayerOwnedObject[] {
        let objects: PlayerOwnedObject[] = [];
        [...this.objectsByType.values()].forEach(set => {
            set.forEach(obj => objects.push(obj));
        });
        if (!includeLimbo) {
            objects = objects.filter(obj => !obj.limboData);
        }
        return objects;
    }
    removeAllOwnedObjects(): void {
        this.objectsByType.forEach(set => set.clear());
        this.objectsById.clear();
    }
    get buildings(): Set<PlayerOwnedObject> {
        return this.getOrCreateObjectsForType(ObjectType.Building);
    }
    addUnitsBuilt(object: PlayerOwnedObject, count: number): void {
        this.unitsBuiltByType.set(object.type, (this.unitsBuiltByType.get(object.type) ?? 0) + count);
        if (object.buildLimit < 0) {
            this.limitedUnitsBuiltByName.set(object.name, (this.limitedUnitsBuiltByName.get(object.name) ?? 0) + count);
        }
    }
    getUnitsBuilt(type?: ObjectType): number {
        if (type !== undefined) {
            return this.unitsBuiltByType.get(type) ?? 0;
        }
        return [...this.unitsBuiltByType.values()].reduce((sum, count) => sum + count, 0);
    }
    getLimitedUnitsBuilt(name: string): number {
        return this.limitedUnitsBuiltByName.get(name) ?? 0;
    }
    addUnitsKilled(type: ObjectType, count: number): void {
        this.unitsKilledByType.set(type, (this.unitsKilledByType.get(type) ?? 0) + count);
    }
    getUnitsKilled(type?: ObjectType): number {
        if (type !== undefined) {
            return this.unitsKilledByType.get(type) ?? 0;
        }
        return [...this.unitsKilledByType.values()].reduce((sum, count) => sum + count, 0);
    }
    addUnitsLost(type: ObjectType, count: number): void {
        this.unitsLostByType.set(type, (this.unitsLostByType.get(type) ?? 0) + count);
    }
    getUnitsLost(type?: ObjectType): number {
        if (type !== undefined) {
            return this.unitsLostByType.get(type) ?? 0;
        }
        return [...this.unitsLostByType.values()].reduce((sum, count) => sum + count, 0);
    }
    isCombatant(): boolean {
        return !this.isNeutral && !this.isObserver && !this.defeated;
    }
    canProduceVeteran(object: PlayerOwnedObject): boolean {
        if (!this.production || !this.country) {
            throw new Error("Non-combatants can't produce units");
        }
        const queueType = this.production.getQueueTypeForObject(object);
        const factoryType = this.production.getFactoryTypeForQueueType(queueType);
        return (this.production.hasVeteranType(factoryType) ||
            this.country.hasVeteranUnit(object.type, object.name));
    }
    getHash(): number {
        return fnv32a([
            this.credits,
            ...this.traits.getAll().map(trait => trait.getHash?.() ?? 0)
        ]);
    }
    debugGetState(): Record<string, any> {
        return {
            name: this.name,
            credits: this.credits,
            traits: this.traits.getAll().reduce((acc, trait) => {
                const state = trait.debugGetState?.();
                if (state !== undefined) {
                    acc[trait.constructor.name] = state;
                }
                return acc;
            }, {} as Record<string, any>)
        };
    }
    dispose(): void {
        this.traits.dispose();
        this.production?.dispose();
    }
}
