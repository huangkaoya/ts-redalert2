import { ObjectType } from "@/engine/type/ObjectType";
import { SideType } from "@/game/SideType";
import { SpeedType } from "@/game/type/SpeedType";
import { PipColor } from "@/game/type/PipColor";
import { LocomotorType } from "@/game/type/LocomotorType";
import { MovementZone } from "@/game/type/MovementZone";
import { ArmorType } from "@/game/type/ArmorType";
import { LandTargeting } from "@/game/type/LandTargeting";
import { NavalTargeting } from "@/game/type/NavalTargeting";
import { ObjectRules } from "@/game/rules/ObjectRules";
import { WeaponType } from "@/game/WeaponType";
import { VeteranAbility } from "@/game/gameobject/unit/VeteranAbility";
import { VhpScan } from "@/game/type/VhpScan";
import { Vector3 } from "@/game/math/Vector3";
interface House {
    name: string;
}
export enum BuildCat {
    Combat = 0,
    Tech = 1,
    Resource = 2,
    Power = 3
}
export enum FactoryType {
    None = 0,
    BuildingType = 1,
    InfantryType = 2,
    UnitType = 3,
    NavalUnitType = 4,
    AircraftType = 5
}
export class TechnoRules extends ObjectRules {
    static readonly MAX_SIGHT = 11;
    declare owner: string[];
    declare aiBasePlanningSide?: number;
    declare requiredHouses: string[];
    declare forbiddenHouses: string[];
    declare requiresStolenAlliedTech: boolean;
    declare requiresStolenSovietTech: boolean;
    declare requiresStolenThirdTech: boolean;
    declare techLevel: number;
    declare cost: number;
    declare points: number;
    declare power: number;
    declare powered: boolean;
    declare prerequisite: string[];
    declare prerequisiteOverride: string[];
    declare soylent: number;
    declare crateGoodie: boolean;
    declare buildCat: BuildCat;
    declare adjacent: number;
    declare baseNormal: boolean;
    declare buildLimit: number;
    declare airRangeBonus: number;
    declare guardRange: number;
    declare defaultToGuardArea: boolean;
    declare eligibileForAllyBuilding: boolean;
    declare numberImpassableRows: number;
    declare bridgeRepairHut: boolean;
    declare constructionYard: boolean;
    declare refinery: boolean;
    declare unitRepair: boolean;
    declare unitReload: boolean;
    declare unitSell: boolean;
    declare isBaseDefense: boolean;
    declare superWeapon?: string;
    declare chargedAnimTime: number;
    declare naval: boolean;
    declare underwater: boolean;
    declare waterBound: boolean;
    declare orePurifier: boolean;
    declare cloning: boolean;
    declare grinding: boolean;
    declare nukeSilo: boolean;
    declare repairable: boolean;
    declare clickRepairable: boolean;
    declare unsellable: boolean;
    declare returnable: boolean;
    declare gdiBarracks: boolean;
    declare nodBarracks: boolean;
    declare numberOfDocks: number;
    declare factory: FactoryType;
    declare weaponsFactory: boolean;
    declare helipad: boolean;
    declare hospital: boolean;
    declare landTargeting: LandTargeting;
    declare navalTargeting: NavalTargeting;
    declare tooBigToFitUnderBridge: boolean;
    declare canBeOccupied: boolean;
    declare maxNumberOccupants: number;
    declare leaveRubble: boolean;
    declare undeploysInto: string;
    declare deploysInto: string;
    declare deployTime: number;
    declare capturable: boolean;
    declare spyable: boolean;
    declare needsEngineer: boolean;
    declare c4: boolean;
    declare canC4: boolean;
    declare eligibleForDelayKill: boolean;
    declare produceCashStartup: number;
    declare produceCashAmount: number;
    declare produceCashDelay: number;
    declare explosion: string[];
    declare explodes: boolean;
    declare ifvMode: number;
    declare turretIndexesByIfvMode: Map<number, number>;
    declare turret: boolean;
    declare turretCount: number;
    declare turretAnim: string;
    declare turretAnimIsVoxel: boolean;
    declare turretAnimX: number;
    declare turretAnimY: number;
    declare turretAnimZAdjust: number;
    declare isChargeTurret: boolean;
    declare overpowerable: boolean;
    declare freeUnit: string;
    declare primary?: string;
    declare secondary?: string;
    declare elitePrimary?: string;
    declare eliteSecondary?: string;
    declare weaponCount: number;
    declare deathWeapon?: string;
    declare deathWeaponDamageModifier: number;
    declare occupyWeapon?: string;
    declare eliteOccupyWeapon?: string;
    declare veteranAbilities: Set<VeteranAbility>;
    declare eliteAbilities: Set<VeteranAbility>;
    declare selfHealing: boolean;
    declare wall: boolean;
    declare gate: boolean;
    declare armor: ArmorType;
    declare strength: number;
    declare immune: boolean;
    declare immuneToRadiation: boolean;
    declare immuneToPsionics: boolean;
    declare typeImmune: boolean;
    declare damageSelf: boolean;
    declare warpable: boolean;
    declare isTilter: boolean;
    declare walkRate: number;
    declare idleRate: number;
    declare noSpawnAlt: boolean;
    declare crusher: boolean;
    declare consideredAircraft: boolean;
    declare crashable: boolean;
    declare landable: boolean;
    declare airportBound: boolean;
    declare balloonHover: boolean;
    declare hoverAttack: boolean;
    declare omniFire: boolean;
    declare fighter: boolean;
    declare flightLevel?: number;
    declare locomotor: LocomotorType;
    declare speedType?: SpeedType;
    declare speed: number;
    declare movementZone: MovementZone;
    declare fearless: boolean;
    declare deployer: boolean;
    declare deployFire: boolean;
    declare deployFireWeapon: number;
    declare undeployDelay: number;
    declare fraidycat: boolean;
    declare isHuman: boolean;
    declare organic: boolean;
    declare occupier: boolean;
    declare engineer: boolean;
    declare ivan: boolean;
    declare civilian: boolean;
    declare agent: boolean;
    declare infiltrate: boolean;
    declare threatPosed: number;
    declare specialThreatValue: number;
    declare canPassiveAquire: boolean;
    declare canRetaliate: boolean;
    declare preventAttackMove: boolean;
    declare opportunityFire: boolean;
    declare distributedFire: boolean;
    declare radialFireSegments: number;
    declare attackCursorOnFriendlies: boolean;
    declare bombable: boolean;
    declare trainable: boolean;
    declare crewed: boolean;
    declare parasiteable: boolean;
    declare suppressionThreshold: number;
    declare reselectIfLimboed: boolean;
    declare rejoinTeamIfLimboed: boolean;
    declare weight: number;
    declare accelerates: boolean;
    declare accelerationFactor: number;
    declare teleporter: boolean;
    declare canDisguise: boolean;
    declare disguiseWhenStill: boolean;
    declare permaDisguise: boolean;
    declare detectDisguise: boolean;
    declare detectDisguiseRange: number;
    declare cloakable: boolean;
    declare sensors: boolean;
    declare sensorArray: boolean;
    declare sensorsSight: number;
    declare burstDelay: (number | undefined)[];
    declare vhpScan: VhpScan;
    declare pip: PipColor;
    declare passengers: number;
    declare gunner: boolean;
    declare ammo: number;
    declare initialAmmo: number;
    declare manualReload: boolean;
    declare storage: number;
    declare spawned: boolean;
    declare spawns: string;
    declare spawnsNumber: number;
    declare spawnRegenRate: number;
    declare spawnReloadRate: number;
    declare missileSpawn: boolean;
    declare size: number;
    declare sizeLimit: number;
    declare sight: number;
    declare spySat: boolean;
    declare gapGenerator: boolean;
    declare gapRadiusInCells: number;
    declare psychicDetectionRadius: number;
    declare hasRadialIndicator: boolean;
    declare harvester: boolean;
    declare unloadingClass: string;
    declare dock: string[];
    declare radar: boolean;
    declare radarInvisible: boolean;
    declare revealToAll: boolean;
    declare selectable: boolean;
    declare isSelectableCombatant: boolean;
    declare invisibleInGame: boolean;
    declare moveToShroud: boolean;
    declare leadershipRating: number;
    declare unnatural: boolean;
    declare natural: boolean;
    declare buildTimeMultiplier: number;
    declare allowedToStartInMultiplayer: boolean;
    declare rot: number;
    declare jumpjetAccel: number;
    declare jumpjetClimb: number;
    declare jumpjetCrash: number;
    declare jumpjetDeviation: number;
    declare jumpjetHeight: number;
    declare jumpjetNoWobbles: boolean;
    declare jumpjetSpeed: number;
    declare jumpjetTurnRate: number;
    declare jumpjetWobbles: number;
    declare pitchSpeed: number;
    declare pitchAngle: number;
    declare damageParticleSystems: string[];
    declare damageSmokeOffset: Vector3;
    declare minDebris: number;
    declare maxDebris: number;
    declare debrisTypes: string[];
    declare debrisAnims: string[];
    declare isLightpost: boolean;
    declare lightVisibility: number;
    declare lightIntensity: number;
    declare lightRedTint: number;
    declare lightGreenTint: number;
    declare lightBlueTint: number;
    declare ambientSound?: string;
    declare createSound?: string;
    declare deploySound?: string;
    declare undeploySound?: string;
    declare voiceSelect?: string;
    declare voiceMove?: string;
    declare voiceAttack?: string;
    declare voiceFeedback?: string;
    declare voiceSpecialAttack?: string;
    declare voiceEnter?: string;
    declare voiceCapture?: string;
    declare voiceCrashing?: string;
    declare crashingSound?: string;
    declare impactLandSound?: string;
    declare auxSound1?: string;
    declare auxSound2?: string;
    declare dieSound?: string;
    declare moveSound?: string;
    declare enterWaterSound?: string;
    declare leaveWaterSound?: string;
    declare turretRotateSound?: string;
    declare workingSound?: string;
    declare notWorkingSound?: string;
    declare chronoInSound?: string;
    declare chronoOutSound?: string;
    declare enterTransportSound?: string;
    declare leaveTransportSound?: string;
    constructor(e: any, t: any, i: any, r: any) {
        super(e, t, i, r);
    }
    parse(): void {
        super.parse();
        this.owner = this.ini.getArray("Owner");
        const aiBasePlanningValue = this.ini.getNumber("AIBasePlanningSide");
        this.aiBasePlanningSide = (-1 !== aiBasePlanningValue && void 0 !== SideType[aiBasePlanningValue]) ? aiBasePlanningValue : void 0;
        this.requiredHouses = this.ini.getArray("RequiredHouses");
        this.forbiddenHouses = this.ini.getArray("ForbiddenHouses");
        this.requiresStolenAlliedTech = this.ini.getBool("RequiresStolenAlliedTech");
        this.requiresStolenSovietTech = this.ini.getBool("RequiresStolenSovietTech");
        this.requiresStolenThirdTech = this.ini.getBool("RequiresStolenThirdTech");
        this.techLevel = this.ini.getNumber("TechLevel", -1);
        this.cost = this.ini.getNumber("Cost");
        this.points = this.ini.getNumber("Points");
        this.power = this.ini.getNumber("Power");
        this.powered = this.ini.getBool("Powered");
        this.prerequisite = this.ini.getArray("Prerequisite");
        this.prerequisiteOverride = this.ini.getArray("PrerequisiteOverride");
        this.soylent = this.ini.getNumber("Soylent");
        this.crateGoodie = this.ini.getBool("CrateGoodie");
        this.buildCat = this.ini.getEnum("BuildCat", BuildCat, BuildCat.Combat);
        this.adjacent = this.ini.getNumber("Adjacent", 1);
        this.baseNormal = this.ini.getBool("BaseNormal", true);
        this.buildLimit = this.ini.getNumber("BuildLimit", Number.POSITIVE_INFINITY);
        this.airRangeBonus = this.ini.getNumber("AirRangeBonus");
        this.guardRange = this.ini.getNumber("GuardRange");
        this.defaultToGuardArea = this.ini.getBool("DefaultToGuardArea");
        this.eligibileForAllyBuilding = this.ini.getBool("EligibileForAllyBuilding");
        this.numberImpassableRows = this.ini.getNumber("NumberImpassableRows");
        this.bridgeRepairHut = this.ini.getBool("BridgeRepairHut");
        this.constructionYard = this.ini.getBool("ConstructionYard");
        this.refinery = this.ini.getBool("Refinery");
        this.unitRepair = this.ini.getBool("UnitRepair");
        this.unitReload = this.ini.getBool("UnitReload");
        this.unitSell = this.ini.getBool("UnitSell");
        this.isBaseDefense = this.ini.getBool("IsBaseDefense");
        this.superWeapon = this.parseWeaponName(this.ini.getString("SuperWeapon"));
        this.chargedAnimTime = this.ini.getNumber("ChargedAnimTime");
        const naval = this.ini.getBool("Naval");
        this.naval = naval;
        this.underwater = this.ini.getBool("Underwater");
        this.waterBound = this.ini.getBool("WaterBound");
        this.orePurifier = this.ini.getBool("OrePurifier");
        this.cloning = this.ini.getBool("Cloning");
        this.grinding = this.ini.getBool("Grinding");
        this.nukeSilo = this.ini.getBool("NukeSilo");
        this.repairable = this.ini.getBool("Repairable", this.type === ObjectType.Building);
        this.clickRepairable = this.ini.getBool("ClickRepairable", this.type === ObjectType.Building);
        this.unsellable = this.ini.getBool("Unsellable", this.type !== ObjectType.Building && this.generalRules.unitsUnsellable);
        this.returnable = this.ini.getBool("Returnable", this.generalRules.returnStructures);
        this.gdiBarracks = this.ini.getBool("GDIBarracks");
        this.nodBarracks = this.ini.getBool("NODBarracks");
        this.numberOfDocks = this.ini.getNumber("NumberOfDocks");
        if (this.unitRepair && !this.numberOfDocks) {
            this.numberOfDocks = 1;
        }
        this.factory = this.ini.getEnum("Factory", FactoryType, FactoryType.None);
        if (this.factory === FactoryType.UnitType && naval) {
            this.factory = FactoryType.NavalUnitType;
        }
        this.weaponsFactory = this.ini.getBool("WeaponsFactory");
        this.helipad = this.ini.getBool("Helipad");
        this.hospital = this.ini.getBool("Hospital");
        this.landTargeting = this.ini.getEnumNumeric("LandTargeting", LandTargeting, LandTargeting.LandOk);
        this.navalTargeting = this.ini.getEnumNumeric("NavalTargeting", NavalTargeting, NavalTargeting.UnderwaterNever);
        this.tooBigToFitUnderBridge = this.ini.getBool("TooBigToFitUnderBridge", this.type === ObjectType.Building);
        this.canBeOccupied = this.ini.getBool("CanBeOccupied");
        this.maxNumberOccupants = this.ini.getNumber("MaxNumberOccupants");
        this.leaveRubble = this.ini.getBool("LeaveRubble");
        this.undeploysInto = this.ini.getString("UndeploysInto");
        this.deploysInto = this.ini.getString("DeploysInto");
        this.deployTime = this.ini.getNumber("DeployTime");
        this.capturable = this.ini.getBool("Capturable");
        this.spyable = this.ini.getBool("Spyable");
        this.needsEngineer = this.ini.getBool("NeedsEngineer");
        this.c4 = this.ini.getBool("C4");
        this.canC4 = this.ini.getBool("CanC4", true);
        this.eligibleForDelayKill = this.ini.getBool("EligibleForDelayKill");
        this.produceCashStartup = this.ini.getNumber("ProduceCashStartup");
        this.produceCashAmount = this.ini.getNumber("ProduceCashAmount");
        this.produceCashDelay = this.ini.getNumber("ProduceCashDelay");
        this.explosion = this.ini.getArray("Explosion");
        this.explodes = this.ini.getBool("Explodes");
        this.ifvMode = this.ini.getNumber("IFVMode");
        this.turretIndexesByIfvMode = this.parseTurretIndexes();
        this.turret = this.ini.getBool("Turret");
        this.turretCount = this.ini.getNumber("TurretCount", this.turret ? 1 : 0);
        this.turretAnim = this.ini.getString("TurretAnim");
        this.turretAnimIsVoxel = this.ini.getBool("TurretAnimIsVoxel");
        this.turretAnimX = this.ini.getNumber("TurretAnimX");
        this.turretAnimY = this.ini.getNumber("TurretAnimY");
        this.turretAnimZAdjust = this.ini.getNumber("TurretAnimZAdjust");
        this.isChargeTurret = this.ini.getBool("IsChargeTurret");
        this.overpowerable = this.ini.getBool("Overpowerable");
        this.freeUnit = this.ini.getString("FreeUnit");
        this.primary = this.parseWeaponName(this.ini.getString("Primary"));
        this.secondary = this.parseWeaponName(this.ini.getString("Secondary"));
        this.elitePrimary = this.parseWeaponName(this.ini.getString("ElitePrimary"));
        this.eliteSecondary = this.parseWeaponName(this.ini.getString("EliteSecondary"));
        this.weaponCount = this.ini.getNumber("WeaponCount");
        this.deathWeapon = this.parseWeaponName(this.ini.getString("DeathWeapon"));
        this.deathWeaponDamageModifier = this.ini.getNumber("DeathWeaponDamageModifier", 1);
        this.occupyWeapon = this.parseWeaponName(this.ini.getString("OccupyWeapon"));
        this.eliteOccupyWeapon = this.parseWeaponName(this.ini.getString("EliteOccupyWeapon"));
        this.veteranAbilities = new Set(this.ini.getEnumArray("VeteranAbilities", VeteranAbility));
        this.eliteAbilities = new Set([
            ...this.veteranAbilities,
            ...this.ini.getEnumArray("EliteAbilities", VeteranAbility)
        ]);
        this.selfHealing = this.ini.getBool("SelfHealing");
        this.wall = this.ini.getBool("Wall");
        this.gate = this.ini.getBool("Gate");
        this.armor = this.ini.getEnum("Armor", ArmorType, ArmorType.None, true);
        this.strength = Math.floor(this.ini.getNumber("Strength"));
        this.immune = this.ini.getBool("Immune");
        this.immuneToRadiation = this.ini.getBool("ImmuneToRadiation");
        this.immuneToPsionics = this.ini.getBool("ImmuneToPsionics");
        this.typeImmune = this.ini.getBool("TypeImmune");
        this.damageSelf = this.ini.getBool("DamageSelf");
        this.warpable = this.ini.getBool("Warpable", true);
        this.isTilter = this.ini.getBool("IsTilter", true);
        this.walkRate = this.ini.getNumber("WalkRate", 1);
        this.idleRate = this.ini.getNumber("IdleRate", 0);
        this.noSpawnAlt = this.ini.getBool("NoSpawnAlt");
        this.crusher = this.ini.getBool("Crusher");
        this.consideredAircraft = this.ini.getBool("ConsideredAircraft");
        this.crashable = this.ini.getBool("Crashable");
        const landable = this.ini.getBool("Landable");
        this.landable = landable;
        this.airportBound = this.ini.getBool("AirportBound");
        this.balloonHover = this.ini.getBool("BalloonHover");
        this.hoverAttack = this.ini.getBool("HoverAttack");
        this.omniFire = this.ini.getBool("OmniFire");
        this.fighter = this.ini.getBool("Fighter");
        this.flightLevel = this.ini.getNumber("FlightLevel") || void 0;
        const locomotorString = this.ini.getString("Locomotor");
        let defaultLocomotor = this.type === ObjectType.Building ? LocomotorType.Statue : LocomotorType.Chrono;
        if (locomotorString) {
            const locomotorType = (LocomotorType as any).locomotorTypesByClsId.get(locomotorString);
            if (locomotorType) {
                this.locomotor = locomotorType;
            }
            else {
                console.warn(`Object rules "${this.name}" has invalid Locomotor "${locomotorString}"`);
                this.locomotor = defaultLocomotor;
            }
        }
        else {
            this.locomotor = defaultLocomotor;
        }
        if (this.locomotor !== LocomotorType.Statue) {
            let defaultSpeed = (LocomotorType as any).defaultSpeedsByLocomotor.get(this.locomotor);
            if (void 0 === defaultSpeed) {
                if (this.type === ObjectType.Aircraft || this.consideredAircraft) {
                    defaultSpeed = SpeedType.Winged;
                }
                else if (this.type === ObjectType.Vehicle) {
                    defaultSpeed = this.crusher ? SpeedType.Track : SpeedType.Wheel;
                }
                else if (this.type === ObjectType.Infantry) {
                    defaultSpeed = SpeedType.Foot;
                }
            }
            this.speedType = this.ini.getEnum("SpeedType", SpeedType, defaultSpeed, true);
        }
        const speedMultiplier = [
            LocomotorType.Ship,
            LocomotorType.Vehicle,
            LocomotorType.Chrono
        ].includes(this.locomotor) ? 65 : 100;
        this.speed = ObjectRules.iniSpeedToLeptonsPerTick(this.ini.getNumber("Speed"), speedMultiplier);
        this.movementZone = this.ini.getEnum("MovementZone", MovementZone, MovementZone.Normal);
        this.fearless = this.ini.getBool("Fearless");
        this.deployer = this.ini.getBool("Deployer");
        this.deployFire = this.ini.getBool("DeployFire");
        this.deployFireWeapon = this.ini.getNumber("DeployFireWeapon", WeaponType.Secondary);
        this.undeployDelay = this.ini.getNumber("UndeployDelay");
        this.fraidycat = this.ini.getBool("Fraidycat", false);
        this.isHuman = !this.ini.getBool("NotHuman");
        this.organic = this.type === ObjectType.Infantry || this.ini.getBool("Organic");
        this.occupier = this.ini.getBool("Occupier");
        this.engineer = this.ini.getBool("Engineer");
        this.ivan = this.ini.getBool("Ivan");
        this.civilian = this.ini.getBool("Civilian");
        this.agent = this.ini.getBool("Agent");
        this.infiltrate = this.ini.getBool("Infiltrate");
        this.threatPosed = this.ini.getNumber("ThreatPosed");
        this.specialThreatValue = this.ini.getNumber("SpecialThreatValue");
        this.canPassiveAquire = this.ini.getBool("CanPassiveAquire", true);
        this.canRetaliate = this.ini.getBool("CanRetaliate", true);
        this.preventAttackMove = this.ini.getBool("PreventAttackMove");
        this.opportunityFire = this.ini.getBool("OpportunityFire");
        this.distributedFire = this.ini.getBool("DistributedFire");
        this.radialFireSegments = this.ini.getNumber("RadialFireSegments");
        this.attackCursorOnFriendlies = this.ini.getBool("AttackCursorOnFriendlies");
        this.bombable = this.ini.getBool("Bombable", true);
        this.trainable = this.ini.getBool("Trainable", this.type !== ObjectType.Building);
        this.crewed = this.ini.getBool("Crewed");
        this.parasiteable = this.ini.getBool("Parasiteable", this.type !== ObjectType.Building);
        this.suppressionThreshold = this.ini.getNumber("SuppressionThreshold");
        this.reselectIfLimboed = this.ini.getBool("ReselectIfLimboed");
        this.rejoinTeamIfLimboed = this.ini.getBool("RejoinTeamIfLimboed");
        this.weight = this.ini.getNumber("Weight");
        this.accelerates = this.ini.getBool("Accelerates", true);
        this.accelerationFactor = this.ini.getNumber("AccelerationFactor", 0.03);
        this.teleporter = this.ini.getBool("Teleporter");
        this.canDisguise = this.ini.getBool("CanDisguise");
        this.disguiseWhenStill = this.ini.getBool("DisguiseWhenStill");
        this.permaDisguise = this.ini.getBool("PermaDisguise");
        this.detectDisguise = this.ini.getBool("DetectDisguise");
        this.detectDisguiseRange = this.ini.getNumber("DetectDisguiseRange");
        this.cloakable = this.ini.getBool("Cloakable");
        this.sensors = this.ini.getBool("Sensors");
        this.sensorArray = this.ini.getBool("SensorArray");
        this.sensorsSight = this.ini.getNumber("SensorsSight");
        this.burstDelay = this.parseBurstDelay();
        this.vhpScan = this.ini.getEnum("VHPScan", VhpScan, VhpScan.None, true);
        this.pip = this.ini.getEnum("Pip", PipColor, PipColor.Green, true);
        this.passengers = this.ini.getNumber("Passengers");
        this.gunner = this.ini.getBool("Gunner");
        this.ammo = this.ini.getNumber("Ammo", -1);
        this.initialAmmo = this.ini.getNumber("InitialAmmo", -1);
        this.manualReload = this.ini.getBool("ManualReload", this.type === ObjectType.Aircraft);
        this.storage = this.ini.getNumber("Storage");
        this.spawned = this.ini.getBool("Spawned");
        this.spawns = this.ini.getString("Spawns");
        this.spawnsNumber = this.ini.getNumber("SpawnsNumber");
        this.spawnRegenRate = this.ini.getNumber("SpawnRegenRate");
        this.spawnReloadRate = this.ini.getNumber("SpawnReloadRate");
        this.missileSpawn = this.ini.getBool("MissileSpawn");
        this.size = this.ini.getNumber("Size", 1);
        this.sizeLimit = this.ini.getNumber("SizeLimit");
        this.sight = Math.min(TechnoRules.MAX_SIGHT, this.needsEngineer ? 6 : this.ini.getNumber("Sight", 1));
        this.spySat = this.ini.getBool("SpySat");
        this.gapGenerator = this.ini.getBool("GapGenerator");
        this.gapRadiusInCells = this.ini.getNumber("GapRadiusInCells");
        this.psychicDetectionRadius = this.ini.getNumber("PsychicDetectionRadius");
        this.hasRadialIndicator = this.ini.getBool("HasRadialIndicator");
        this.harvester = this.ini.getBool("Harvester");
        this.unloadingClass = this.ini.getString("UnloadingClass");
        this.dock = this.ini.getArray("Dock");
        this.radar = this.ini.getBool("Radar");
        this.radarInvisible = this.ini.getBool("RadarInvisible");
        this.revealToAll = this.ini.getBool("RevealToAll");
        this.selectable = !(this.type === ObjectType.Aircraft && !landable) && this.ini.getBool("Selectable", true);
        this.isSelectableCombatant = this.ini.getBool("IsSelectableCombatant");
        this.invisibleInGame = this.ini.getBool("InvisibleInGame");
        this.moveToShroud = this.ini.getBool("MoveToShroud", this.type !== ObjectType.Aircraft);
        this.leadershipRating = this.ini.getNumber("LeadershipRating", 5);
        this.unnatural = this.ini.getBool("Unnatural");
        this.natural = this.ini.getBool("Natural");
        this.buildTimeMultiplier = this.ini.getFixed("BuildTimeMultiplier", 1);
        this.allowedToStartInMultiplayer = this.ini.getBool("AllowedToStartInMultiplayer", true);
        this.rot = ObjectRules.iniRotToDegsPerTick(this.ini.getNumber("ROT", 0));
        this.jumpjetAccel = this.ini.getNumber("JumpJetAccel", 2);
        this.jumpjetClimb = this.ini.getNumber("JumpjetClimb", 5);
        this.jumpjetCrash = this.ini.getNumber("JumpjetCrash", 5);
        this.jumpjetDeviation = this.ini.getNumber("JumpjetDeviation", 40);
        this.jumpjetHeight = this.ini.getNumber("JumpjetHeight", 500);
        this.jumpjetNoWobbles = this.ini.getBool("JumpjetNoWobbles");
        this.jumpjetSpeed = this.ini.getNumber("JumpjetSpeed", 14);
        this.jumpjetTurnRate = ObjectRules.iniRotToDegsPerTick(this.ini.getNumber("JumpJetTurnRate", 4));
        this.jumpjetWobbles = this.ini.getNumber("JumpjetWobbles", 0.15);
        this.pitchSpeed = this.ini.getNumber("PitchSpeed", 0.25);
        this.pitchAngle = this.pitchSpeed >= 1 ? 0 : 20;
        this.damageParticleSystems = this.ini.getArray("DamageParticleSystems");
        const damageSmokeOffsetArray = this.ini.getNumberArray("DamageSmokeOffset", undefined, [0, 0, 0]);
        this.damageSmokeOffset = new Vector3(damageSmokeOffsetArray[0], damageSmokeOffsetArray[2] / Math.SQRT2, damageSmokeOffsetArray[1]);
        this.minDebris = this.ini.getNumber("MinDebris");
        this.maxDebris = this.ini.getNumber("MaxDebris");
        this.debrisTypes = this.ini.getArray("DebrisTypes");
        this.debrisAnims = this.ini.getArray("DebrisAnims");
        this.isLightpost = this.imageName === "GALITE";
        this.lightVisibility = this.ini.getNumber("LightVisibility", 5000);
        this.lightIntensity = this.ini.getNumber("LightIntensity");
        this.lightRedTint = this.ini.getNumber("LightRedTint", 1);
        this.lightGreenTint = this.ini.getNumber("LightGreenTint", 1);
        this.lightBlueTint = this.ini.getNumber("LightBlueTint", 1);
        this.ambientSound = this.ini.getString("AmbientSound") || undefined;
        this.createSound = this.ini.getString("CreateSound") || undefined;
        this.deploySound = this.ini.getString("DeploySound") || undefined;
        this.undeploySound = this.ini.getString("UndeploySound") || undefined;
        this.voiceSelect = this.ini.getString("VoiceSelect") || undefined;
        this.voiceMove = this.ini.getString("VoiceMove") || undefined;
        this.voiceAttack = this.ini.getString("VoiceAttack") || undefined;
        this.voiceFeedback = this.ini.getString("VoiceFeedback") || undefined;
        this.voiceSpecialAttack = this.ini.getString("VoiceSpecialAttack") || undefined;
        this.voiceEnter = this.ini.getString("VoiceEnter") || undefined;
        this.voiceCapture = this.ini.getString("VoiceCapture") || undefined;
        this.voiceCrashing = this.ini.getString("VoiceCrashing") || undefined;
        this.crashingSound = this.ini.getString("CrashingSound") || undefined;
        this.impactLandSound = this.ini.getString("ImpactLandSound") || undefined;
        this.auxSound1 = this.ini.getString("AuxSound1") || undefined;
        this.auxSound2 = this.ini.getString("AuxSound2") || undefined;
        this.dieSound = this.ini.getString("DieSound") || undefined;
        this.moveSound = this.ini.getString("MoveSound") || undefined;
        this.enterWaterSound = this.ini.getString("EnterWaterSound") || undefined;
        this.leaveWaterSound = this.ini.getString("LeaveWaterSound") || undefined;
        this.turretRotateSound = this.ini.getString("TurretRotateSound") || undefined;
        this.workingSound = this.ini.getString("WorkingSound") || undefined;
        this.notWorkingSound = this.ini.getString("NotWorkingSound") || undefined;
        this.chronoInSound = this.ini.getString("ChronoInSound") || undefined;
        this.chronoOutSound = this.ini.getString("ChronoOutSound") || undefined;
        this.enterTransportSound = this.ini.getString("EnterTransportSound") || undefined;
        this.leaveTransportSound = this.ini.getString("LeaveTransportSound") || undefined;
    }
    private parseWeaponName(weaponName: string | undefined): string | undefined {
        return weaponName && weaponName.toLowerCase() !== "none" ? weaponName : undefined;
    }
    private parseTurretIndexes(): Map<number, number> {
        const turretIndexMap = new Map<number, number>();
        if (this.ini.getBool("Gunner")) {
            this.ini.entries.forEach((value: string, key: string) => {
                const match = key.match(/^(.*)TurretWeapon$/i);
                if (match) {
                    const turretIndexKey = match[1] + "TurretIndex";
                    if (this.ini.has(turretIndexKey)) {
                        turretIndexMap.set(Number(value), this.ini.getNumber(turretIndexKey));
                    }
                }
            });
        }
        return turretIndexMap;
    }
    private parseBurstDelay(): (number | undefined)[] {
        const burstDelays: (number | undefined)[] = [];
        for (let i = 0; i < 4; i++) {
            const key = "BurstDelay" + i;
            burstDelays.push(this.ini.has(key) ? this.ini.getNumber(key) : undefined);
        }
        return burstDelays;
    }
    public hasOwner(house: House): boolean {
        return this.owner.length > 0 && this.owner.indexOf(house.name) !== -1;
    }
    public isAvailableTo(house: House): boolean {
        const hasRequiredHouse = this.requiredHouses.length === 0 ||
            this.requiredHouses.indexOf(house.name) !== -1;
        const isForbidden = this.forbiddenHouses.indexOf(house.name) !== -1;
        return hasRequiredHouse && !isForbidden;
    }
    public getWeaponAtIndex(index: number): string | undefined {
        return this.parseWeaponName(this.ini.getString("Weapon" + (index + 1)));
    }
    public getEliteWeaponAtIndex(index: number): string | undefined {
        return this.parseWeaponName(this.ini.getString("EliteWeapon" + (index + 1)));
    }
}
