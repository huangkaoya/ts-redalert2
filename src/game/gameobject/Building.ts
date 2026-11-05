import { ObjectType } from "@/engine/type/ObjectType";
import { GarrisonTrait } from "@/game/gameobject/trait/GarrisonTrait";
import { TurretTrait } from "@/game/gameobject/trait/TurretTrait";
import { TechnoRules, FactoryType } from "@/game/rules/TechnoRules";
import { PoweredTrait } from "@/game/gameobject/trait/PoweredTrait";
import { FactoryTrait } from "@/game/gameobject/trait/FactoryTrait";
import { DockTrait } from "@/game/gameobject/trait/DockTrait";
import { FreeUnitTrait } from "@/game/gameobject/trait/FreeUnitTrait";
import { Techno } from "@/game/gameobject/Techno";
import { CrewedTrait } from "@/game/gameobject/trait/CrewedTrait";
import { CabHutTrait } from "@/game/gameobject/trait/CabHutTrait";
import { OilDerrickTrait } from "@/game/gameobject/trait/OilDerrickTrait";
import { WallTrait } from "@/game/gameobject/trait/WallTrait";
import { Coords } from "@/game/Coords";
import { OverpoweredTrait } from "@/game/gameobject/trait/OverpoweredTrait";
import { UnitRepairTrait } from "@/game/gameobject/trait/UnitRepairTrait";
import { RallyTrait } from "@/game/gameobject/trait/RallyTrait";
import { C4ChargeTrait } from "@/game/gameobject/trait/C4ChargeTrait";
import { HelipadTrait } from "@/game/gameobject/trait/HelipadTrait";
import { UnitReloadTrait } from "@/game/gameobject/trait/UnitReloadTrait";
import { WaitForBuildUpTask } from "@/game/gameobject/task/WaitForBuildUpTask";
import { SuperWeaponTrait } from "@/game/gameobject/trait/SuperWeaponTrait";
import { GapGeneratorTrait } from "@/game/gameobject/trait/GapGeneratorTrait";
import { PsychicDetectorTrait } from "@/game/gameobject/trait/PsychicDetectorTrait";
import { HospitalTrait } from "@/game/gameobject/trait/HospitalTrait";
import { Vector2 } from "@/game/math/Vector2";
import { DelayedKillTrait } from "@/game/gameobject/trait/DelayedKillTrait";
import { BuildStatusChangeEvent } from "@/game/event/BuildStatusChangeEvent";
import { NotifyBuildStatus } from "@/game/gameobject/trait/interface/NotifyBuildStatus";
import { SecureProgressTrait } from "@/game/gameobject/trait/SecureProgressTrait";
export enum BuildStatus {
    BuildUp = 0,
    Ready = 1,
    BuildDown = 2
}
export class Building extends Techno {
    public showWeaponRange: boolean = false;
    public direction: number = 0;
    private _buildStatus: BuildStatus;
    public lastBuildStatus: BuildStatus;
    public garrisonTrait?: GarrisonTrait;
    public secureProgressTrait?: SecureProgressTrait;
    public c4ChargeTrait?: C4ChargeTrait;
    public delayedKillTrait?: DelayedKillTrait;
    public cabHutTrait?: CabHutTrait;
    public crewedTrait?: CrewedTrait;
    public turretTrait?: TurretTrait;
    public overpoweredTrait?: OverpoweredTrait;
    public poweredTrait?: PoweredTrait;
    public factoryTrait?: FactoryTrait;
    public superWeaponTrait?: SuperWeaponTrait;
    public dockTrait?: DockTrait;
    public helipadTrait?: HelipadTrait;
    public unitRepairTrait?: UnitRepairTrait;
    public unitReloadTrait?: UnitReloadTrait;
    public hospitalTrait?: HospitalTrait;
    public rallyTrait?: RallyTrait;
    public wallTrait?: WallTrait;
    public gapGeneratorTrait?: GapGeneratorTrait;
    public psychicDetectorTrait?: PsychicDetectorTrait;
    static factory(owner: any, rules: TechnoRules, gameRules: any, art: any, world: any, coords: any): Building {
        const building = new this(owner, rules, art);
        if (rules.canBeOccupied) {
            building.garrisonTrait = new GarrisonTrait(building, gameRules.audioVisual.conditionRed, rules.maxNumberOccupants);
            building.traits.add(building.garrisonTrait);
        }
        if (
            rules.capturable &&
            rules.needsEngineer &&
            (rules.produceCashStartup > 0 || rules.produceCashAmount > 0)
        ) {
            building.secureProgressTrait = new SecureProgressTrait(
                gameRules.general.engineerTechSecureTime,
            );
            building.traits.add(building.secureProgressTrait);
        }
        if (rules.canC4 && !rules.wall) {
            building.c4ChargeTrait = new C4ChargeTrait();
            building.traits.add(building.c4ChargeTrait);
        }
        if (rules.eligibleForDelayKill) {
            building.delayedKillTrait = new DelayedKillTrait();
            building.traits.add(building.delayedKillTrait);
        }
        if (rules.bridgeRepairHut) {
            building.cabHutTrait = new CabHutTrait(building, coords);
            building.traits.add(building.cabHutTrait);
        }
        if (rules.crewed) {
            building.crewedTrait = new CrewedTrait();
            building.traits.add(building.crewedTrait);
        }
        if (rules.turret) {
            building.turretTrait = new TurretTrait();
            building.traits.add(building.turretTrait);
        }
        if (rules.overpowerable) {
            building.overpoweredTrait = new OverpoweredTrait(building);
            building.traits.add(building.overpoweredTrait);
        }
        if ((rules.powered && rules.power !== 0) || rules.needsEngineer) {
            building.poweredTrait = new PoweredTrait(building);
            building.traits.add(building.poweredTrait);
        }
        if (rules.factory || rules.cloning) {
            building.factoryTrait = new FactoryTrait(rules.cloning ? FactoryType.InfantryType : rules.factory, rules.cloning);
            building.traits.add(building.factoryTrait);
        }
        if (rules.superWeapon) {
            building.superWeaponTrait = new SuperWeaponTrait(rules.superWeapon);
            building.traits.add(building.superWeaponTrait);
        }
        if (rules.numberOfDocks) {
            building.dockTrait = new DockTrait(building as any, world, rules.numberOfDocks, art.dockingOffsets);
            building.traits.add(building.dockTrait);
            if (rules.helipad) {
                building.helipadTrait = new HelipadTrait();
                building.traits.add(building.helipadTrait);
            }
            if (rules.unitRepair || rules.unitReload) {
                building.unitRepairTrait = new UnitRepairTrait();
                building.traits.add(building.unitRepairTrait);
            }
            if (rules.unitReload) {
                building.unitReloadTrait = new UnitReloadTrait();
                building.traits.add(building.unitReloadTrait);
            }
        }
        if (rules.hospital) {
            building.hospitalTrait = new HospitalTrait();
            building.traits.add(building.hospitalTrait);
        }
        if (rules.factory || rules.cloning || rules.numberOfDocks) {
            building.rallyTrait = new RallyTrait();
            building.traits.add(building.rallyTrait);
        }
        if (rules.freeUnit) {
            building.traits.add(new FreeUnitTrait());
        }
        if (rules.produceCashStartup) {
            building.traits.add(new OilDerrickTrait());
        }
        if (rules.wall) {
            building.wallTrait = new WallTrait();
            building.traits.add(building.wallTrait);
        }
        if (rules.gapGenerator) {
            building.gapGeneratorTrait = new GapGeneratorTrait(rules.gapRadiusInCells);
            building.traits.add(building.gapGeneratorTrait);
        }
        if (rules.psychicDetectionRadius) {
            building.psychicDetectorTrait = new PsychicDetectorTrait(rules.psychicDetectionRadius);
            building.traits.add(building.psychicDetectorTrait);
        }
        return building;
    }
    constructor(owner: any, rules: TechnoRules, art: any) {
        super(ObjectType.Building as any, owner, rules, art);
        this._buildStatus = BuildStatus.BuildUp;
        this.lastBuildStatus = this.buildStatus;
    }
    isBuilding(): boolean {
        return true;
    }
    get buildStatus(): BuildStatus {
        return this._buildStatus;
    }
    getFoundation(): any {
        return this.art.foundation;
    }
    getFoundationCenterOffset(): Vector2 {
        const foundation = this.getFoundation();
        return new Vector2((foundation.width / 2) * Coords.LEPTONS_PER_TILE, (foundation.height / 2) * Coords.LEPTONS_PER_TILE);
    }
    update(context: any): void {
        if (this.buildStatus === BuildStatus.BuildUp &&
            !this.unitOrderTrait.hasTasks()) {
            this.unitOrderTrait.addTask(new WaitForBuildUpTask(context.rules.general.buildupTime, context));
        }
        this.attackTrait?.setDisabled(this.buildStatus !== BuildStatus.Ready ||
            (!!this.poweredTrait && !this.poweredTrait.isPoweredOn()));
        super.update(context);
    }
    setBuildStatus(status: BuildStatus, context: any): void {
        this._buildStatus = status;
        const oldStatus = this.lastBuildStatus;
        if (this.buildStatus !== oldStatus) {
            this.lastBuildStatus = this.buildStatus;
            this.traits.filter(NotifyBuildStatus).forEach((trait: any) => {
                trait[NotifyBuildStatus.onStatusChange](oldStatus, this, context);
            });
            context.events.dispatch(new BuildStatusChangeEvent(this, this.buildStatus));
        }
    }
}
