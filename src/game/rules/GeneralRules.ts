import { RadarRules } from './general/RadarRules';
import { RepairRules } from './general/RepairRules';
import { VeteranRules } from './general/VeteranRules';
import { CrewRules } from './general/CrewRules';
import { PrismRules } from './general/PrismRules';
import { ThreatRules } from './general/ThreatRules';
import { ParadropRules } from './general/ParadropRules';
import { LightningStormRules } from './general/LightningStormRules';
import { V3RocketRules } from './general/V3RocketRules';
import { DMislRules } from './general/DMislRules';
import { HoverRules } from './general/HoverRules';
import { clamp } from '@/util/math';
export enum PrereqCategory {
    Power = 0,
    Factory = 1,
    Barracks = 2,
    Radar = 3,
    Tech = 4,
    Proc = 5
}
interface IniReader {
    getNumber(key: string, defaultValue?: number): number;
    getString(key: string): string;
    getArray(key: string): string[];
    getFixed(key: string, defaultValue?: number): number;
    getBool(key: string, defaultValue?: boolean): boolean;
    has(key: string): boolean;
}
interface MissileRules {
    type: string;
}
const prereqCategoryMap = new Map<PrereqCategory, string>([
    [PrereqCategory.Power, 'PrerequisitePower'],
    [PrereqCategory.Factory, 'PrerequisiteFactory'],
    [PrereqCategory.Barracks, 'PrerequisiteBarracks'],
    [PrereqCategory.Radar, 'PrerequisiteRadar'],
    [PrereqCategory.Tech, 'PrerequisiteTech'],
    [PrereqCategory.Proc, 'PrerequisiteProc']
]);
export class GeneralRules {
    public prereqCategories = new Map<PrereqCategory, string[]>();
    public aircraftFogReveal!: number;
    public flightLevel!: number;
    public alliedDisguise!: string;
    public thirdDisguise!: string;
    public sovietDisguise!: string;
    public defaultMirageDisguises!: string[];
    public cloakDelay!: number;
    public infantryBlinkDisguiseTime!: number;
    public baseUnit!: string[];
    public buildSpeed!: number;
    public buildupTime!: number;
    public wallBuildSpeedCoefficient!: number;
    public multipleFactory!: number;
    public maximumQueuedObjects!: number;
    public lowPowerPenaltyModifier!: number;
    public minLowPowerProductionSpeed!: number;
    public maxLowPowerProductionSpeed!: number;
    public chronoDelay!: number;
    public chronoDistanceFactor!: number;
    public chronoHarvTooFarDistance!: number;
    public chronoMinimumDelay!: number;
    public chronoRangeMinimum!: number;
    public chronoTrigger!: boolean;
    public bridgeVoxelMax!: number;
    public cliffBackImpassability!: number;
    public closeEnough!: number;
    public maxWaypointPathLength!: number;
    public engineer!: string;
    public engineerCaptureLevel!: number;
    public engineerCaptureDelay!: number;
    public engineerDamage!: number;
    public engineerAlwaysCaptureTech!: boolean;
    public engineerTechSecureTime!: number;
    public technician!: string;
    public harvesterTooFarDistance!: number;
    public harvesterUnit!: string[];
    public guardAreaTargetingDelay!: number;
    public normalTargetingDelay!: number;
    public revealTriggerRadius!: number;
    public padAircraft!: string[];
    public parachuteMaxFallRate!: number;
    public dropPodWeapon!: string;
    public refundPercent!: number;
    public returnStructures!: boolean;
    public unitsUnsellable!: boolean;
    public purifierBonus!: number;
    public maximumCheerRate!: number;
    public spyMoneyStealPercent!: number;
    public spyPowerBlackout!: number;
    public shipSinkingWeight!: number;
    public treeStrength!: number;
    public crew!: CrewRules;
    public dMisl!: DMislRules;
    public hover!: HoverRules;
    public lightningStorm!: LightningStormRules;
    public paradrop!: ParadropRules;
    public prism!: PrismRules;
    public radar!: RadarRules;
    public repair!: RepairRules;
    public threat!: ThreatRules;
    public v3Rocket!: V3RocketRules;
    public veteran!: VeteranRules;
    public readIni(ini: IniReader): void {
        this.aircraftFogReveal = ini.getNumber('AircraftFogReveal');
        this.alliedDisguise = ini.getString('AlliedDisguise');
        this.baseUnit = ini.getArray('BaseUnit');
        this.bridgeVoxelMax = ini.getNumber('BridgeVoxelMax');
        this.buildSpeed = ini.getFixed('BuildSpeed');
        this.buildupTime = ini.getNumber('BuildupTime');
        this.chronoDelay = ini.getNumber('ChronoDelay');
        this.chronoDistanceFactor = ini.getNumber('ChronoDistanceFactor', 32);
        this.chronoHarvTooFarDistance = ini.getNumber('ChronoHarvTooFarDistance');
        this.chronoMinimumDelay = ini.getNumber('ChronoMinimumDelay');
        this.chronoRangeMinimum = ini.getNumber('ChronoRangeMinimum');
        this.chronoTrigger = ini.getBool('ChronoTrigger', true);
        this.cliffBackImpassability = ini.getNumber('CliffBackImpassability', 2);
        this.cloakDelay = ini.getNumber('CloakDelay');
        this.closeEnough = ini.getNumber('CloseEnough');
        this.crew = new CrewRules().readIni(ini);
        this.defaultMirageDisguises = ini.getArray('DefaultMirageDisguises');
        this.dMisl = new DMislRules().readIni(ini);
        this.dropPodWeapon = ini.getString('DropPodWeapon');
        this.engineer = ini.getString('Engineer');
        this.engineerCaptureLevel = ini.getFixed('EngineerCaptureLevel', 0.25);
        this.engineerCaptureDelay = ini.getNumber('EngineerCaptureDelay', 12);
        this.engineerDamage = ini.getFixed('EngineerDamage', 0.437);
        this.engineerAlwaysCaptureTech = ini.getBool('EngineerAlwaysCaptureTech', true);
        this.engineerTechSecureTime = ini.getNumber('EngineerTechSecureTime', 4);
        this.flightLevel = ini.getNumber('FlightLevel');
        this.guardAreaTargetingDelay = ini.getNumber('GuardAreaTargetingDelay');
        this.harvesterTooFarDistance = ini.getNumber('HarvesterTooFarDistance');
        this.harvesterUnit = ini.getArray('HarvesterUnit');
        this.hover = new HoverRules().readIni(ini);
        this.infantryBlinkDisguiseTime = ini.getNumber('InfantryBlinkDisguiseTime');
        this.lightningStorm = new LightningStormRules().readIni(ini);
        this.lowPowerPenaltyModifier = ini.getNumber('LowPowerPenaltyModifier', 1);
        this.minLowPowerProductionSpeed = ini.getFixed('MinLowPowerProductionSpeed', 0.5);
        this.maxLowPowerProductionSpeed = ini.getFixed('MaxLowPowerProductionSpeed', 1);
        this.maximumCheerRate = ini.getNumber('MaximumCheerRate');
        this.maximumQueuedObjects = ini.getNumber('MaximumQueuedObjects');
        this.maxWaypointPathLength = ini.getNumber('MaxWaypointPathLength');
        this.multipleFactory = ini.getFixed('MultipleFactory', 1);
        this.normalTargetingDelay = ini.getNumber('NormalTargetingDelay');
        this.padAircraft = ini.getArray('PadAircraft');
        this.parachuteMaxFallRate = ini.getNumber('ParachuteMaxFallRate');
        this.paradrop = new ParadropRules().readIni(ini);
        this.prism = new PrismRules().readIni(ini);
        this.purifierBonus = ini.getNumber('PurifierBonus');
        this.radar = new RadarRules().readIni(ini);
        this.refundPercent = clamp(ini.getNumber('RefundPercent'), 0, 1);
        this.repair = new RepairRules().readIni(ini);
        this.returnStructures = ini.getBool('ReturnStructures');
        this.revealTriggerRadius = Math.min(10, ini.getNumber('RevealTriggerRadius'));
        this.shipSinkingWeight = ini.getNumber('ShipSinkingWeight');
        this.sovietDisguise = ini.getString('SovietDisguise');
        this.thirdDisguise = ini.getString('ThirdDisguise');
        this.spyMoneyStealPercent = ini.getNumber('SpyMoneyStealPercent');
        this.spyPowerBlackout = ini.getNumber('SpyPowerBlackout');
        this.technician = ini.getString('Technician');
        this.threat = new ThreatRules().readIni(ini);
        this.treeStrength = ini.getNumber('TreeStrength');
        this.unitsUnsellable = ini.getBool('UnitsUnsellable');
        this.v3Rocket = new V3RocketRules().readIni(ini);
        this.veteran = new VeteranRules().readIni(ini);
        this.wallBuildSpeedCoefficient = ini.getFixed('WallBuildSpeedCoefficient');
        this.readPrereqCategories(ini);
    }
    private readPrereqCategories(ini: IniReader): void {
        for (const [category, key] of prereqCategoryMap) {
            if (!ini.has(key)) {
                throw new Error(`Missing prerequisite category ${key} in [General] section`);
            }
            this.prereqCategories.set(category, ini.getArray(key));
        }
    }
    public getMissileRules(type: string): MissileRules {
        switch (type) {
            case this.v3Rocket.type:
                return this.v3Rocket;
            case this.dMisl.type:
                return this.dMisl;
            default:
                throw new Error(`Unsupported missile type "${type}"`);
        }
    }
}
