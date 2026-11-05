import { ObjectType } from "@/engine/type/ObjectType";
import { Building } from "@/game/gameobject/Building";
import { Terrain } from "@/game/gameobject/Terrain";
import { Overlay } from "@/game/gameobject/Overlay";
import { Smudge } from "@/game/gameobject/Smudge";
import { Infantry } from "@/game/gameobject/Infantry";
import { Vehicle } from "@/game/gameobject/Vehicle";
import { Aircraft } from "@/game/gameobject/Aircraft";
import { ObjectArt } from "@/game/art/ObjectArt";
import { IniSection } from "@/data/IniSection";
import { UnitOrderTrait } from "@/game/gameobject/trait/UnitOrderTrait";
import { ObjectPosition } from "@/game/gameobject/ObjectPosition";
import { AttackTrait } from "@/game/gameobject/trait/AttackTrait";
import { Projectile } from "@/game/gameobject/Projectile";
import { DeployerTrait } from "@/game/gameobject/trait/DeployerTrait";
import { HealthTrait } from "@/game/gameobject/trait/HealthTrait";
import { BridgeTrait } from "@/game/gameobject/trait/BridgeTrait";
import { BridgeOverlayTypes, OverlayBridgeType } from "@/game/map/BridgeOverlayTypes";
import { OreOverlayTypes } from "@/game/map/OreOverlayTypes";
import { TiberiumTrait } from "@/game/gameobject/trait/TiberiumTrait";
import { TiberiumTreeTrait } from "@/game/gameobject/trait/TiberiumTreeTrait";
import { AutoRepairTrait } from "@/game/gameobject/trait/AutoRepairTrait";
import { VeteranTrait } from "@/game/gameobject/trait/VeteranTrait";
import { ArmedTrait } from "@/game/gameobject/trait/ArmedTrait";
import { SelfHealingTrait } from "@/game/gameobject/trait/SelfHealingTrait";
import { AmmoTrait } from "@/game/gameobject/trait/AmmoTrait";
import { DisguiseTrait } from "@/game/gameobject/trait/DisguiseTrait";
import { InvulnerableTrait } from "@/game/gameobject/trait/InvulnerableTrait";
import { WarpedOutTrait } from "@/game/gameobject/trait/WarpedOutTrait";
import { TntChargeTrait } from "@/game/gameobject/trait/TntChargeTrait";
import { MindControllableTrait } from "@/game/gameobject/trait/MindControllableTrait";
import { MindControllerTrait } from "@/game/gameobject/trait/MindControllerTrait";
import { TemporalTrait } from "@/game/gameobject/trait/TemporalTrait";
import { CloakableTrait } from "@/game/gameobject/trait/CloakableTrait";
import { AirSpawnTrait } from "@/game/gameobject/trait/AirSpawnTrait";
import { SpawnDebrisTrait } from "@/game/gameobject/trait/SpawnDebrisTrait";
import { Debris } from "@/game/gameobject/Debris";
import { DebrisRules } from "@/game/rules/DebrisRules";
import { NotifyTick } from "@/game/gameobject/trait/interface/NotifyTick";
import { SensorsTrait } from "@/game/gameobject/trait/SensorsTrait";
export class ObjectFactory {
    private tiles: any;
    private tileOccupation: any;
    private bridges: any;
    private nextObjectId: any;
    constructor(tiles: any, tileOccupation: any, bridges: any, nextObjectId: any) {
        this.tiles = tiles;
        this.tileOccupation = tileOccupation;
        this.bridges = bridges;
        this.nextObjectId = nextObjectId;
    }
    create(objectType: any, name: string, rulesIni: any, artIni: any): any {
        let rules: any;
        let art: any;
        if (objectType === ObjectType.Debris) {
            if (rulesIni.hasObject(name, ObjectType.VoxelAnim)) {
                art = artIni.getObject(name, ObjectType.VoxelAnim);
                rules = rulesIni.getObject(name, ObjectType.VoxelAnim);
            }
            else {
                art = artIni.getAnimation(name);
                rules = new DebrisRules(ObjectType.Debris, artIni.getIni().getOrCreateSection(name));
            }
        }
        else {
            if (objectType === ObjectType.Projectile) {
                rules = rulesIni.getProjectile(name);
                if (rules.inviso) {
                    art = new ObjectArt(ObjectType.Projectile, rules, new IniSection(name));
                }
                else {
                    art = artIni.getProjectile(name);
                }
            }
            else {
                rules = rulesIni.getObject(name, objectType);
                art = artIni.getObject(name, objectType);
            }
        }
        let gameObject: any;
        switch (objectType) {
            case ObjectType.Building:
                gameObject = Building.factory(name, rules, rulesIni, art, this.tiles, this.bridges);
                break;
            case ObjectType.Infantry:
                gameObject = Infantry.factory(name, rules, art, this.tileOccupation);
                break;
            case ObjectType.Vehicle:
                gameObject = Vehicle.factory(name, rules, art, rulesIni, this.tileOccupation);
                break;
            case ObjectType.Aircraft:
                gameObject = Aircraft.factory(name, rules, art, rulesIni, this.tileOccupation);
                break;
            case ObjectType.Terrain:
                gameObject = Terrain.factory(name, rules, art);
                break;
            case ObjectType.Overlay:
                gameObject = Overlay.factory(name, rules, art);
                break;
            case ObjectType.Smudge:
                gameObject = Smudge.factory(name, rules, art);
                break;
            case ObjectType.Projectile:
                gameObject = Projectile.factory(name, rules, art, this.tileOccupation);
                break;
            case ObjectType.Debris:
                gameObject = Debris.factory(name, rules, art, this.tileOccupation);
                break;
            default:
                throw new Error("Not implemented");
        }
        gameObject.id = this.nextObjectId.value++;
        gameObject.position = new ObjectPosition(this.tiles, this.tileOccupation);
        if (gameObject.isUnit()) {
            gameObject.position.subCell = 0;
        }
        else if (gameObject.isBuilding()) {
            gameObject.position.setCenterOffset(gameObject.getFoundationCenterOffset());
        }
        if (gameObject.isTechno()) {
            if (gameObject.rules.primary ||
                gameObject.rules.secondary ||
                gameObject.rules.weaponCount ||
                gameObject.rules.explodes) {
                gameObject.armedTrait = new ArmedTrait(gameObject, rulesIni);
                gameObject.traits.add(gameObject.armedTrait);
            }
            if (gameObject.rules.ammo !== -1) {
                const initialAmmo = gameObject.rules.initialAmmo;
                gameObject.ammoTrait = new AmmoTrait(gameObject.rules.ammo, initialAmmo !== -1 ? initialAmmo : undefined);
                gameObject.traits.add(gameObject.ammoTrait);
            }
            gameObject.unitOrderTrait = new UnitOrderTrait(gameObject);
            gameObject.traits.addToFront(gameObject.unitOrderTrait);
            if (gameObject.primaryWeapon || gameObject.secondaryWeapon) {
                gameObject.attackTrait = new AttackTrait(this.tiles, this.tileOccupation);
                gameObject.traits.add(gameObject.attackTrait);
            }
            if ((gameObject.isInfantry() || gameObject.isVehicle()) && gameObject.rules.deployer) {
                gameObject.deployerTrait = new DeployerTrait(gameObject);
                gameObject.traits.add(gameObject.deployerTrait);
            }
            if ((gameObject.isInfantry() || gameObject.isVehicle()) && gameObject.rules.canDisguise) {
                gameObject.disguiseTrait = new DisguiseTrait();
                gameObject.traits.add(gameObject.disguiseTrait);
            }
            if (gameObject.rules.cloakable) {
                gameObject.cloakableTrait = new CloakableTrait(gameObject, rulesIni.general.cloakDelay);
                gameObject.traits.add(gameObject.cloakableTrait);
            }
            if (gameObject.rules.sensors) {
                gameObject.sensorsTrait = new SensorsTrait();
                gameObject.traits.add(gameObject.sensorsTrait);
            }
            gameObject.autoRepairTrait = new AutoRepairTrait(!gameObject.isBuilding());
            gameObject.traits.add(gameObject.autoRepairTrait);
            if (gameObject.rules.trainable) {
                gameObject.veteranTrait = new VeteranTrait(gameObject, rulesIni.general.veteran);
                gameObject.traits.add(gameObject.veteranTrait);
            }
            if (gameObject.rules.selfHealing) {
                gameObject.traits.add(new SelfHealingTrait());
            }
            gameObject.invulnerableTrait = new InvulnerableTrait();
            gameObject.traits.add(gameObject.invulnerableTrait);
            gameObject.warpedOutTrait = new WarpedOutTrait(gameObject);
            gameObject.traits.add(gameObject.warpedOutTrait);
            gameObject.temporalTrait = new TemporalTrait(gameObject);
            gameObject.traits.add(gameObject.temporalTrait);
            if (gameObject.rules.bombable && !gameObject.art.toOverlay) {
                gameObject.tntChargeTrait = new TntChargeTrait();
                gameObject.traits.add(gameObject.tntChargeTrait);
            }
            if (!gameObject.rules.immuneToPsionics && !gameObject.isBuilding()) {
                gameObject.mindControllableTrait = new MindControllableTrait(gameObject);
                gameObject.traits.add(gameObject.mindControllableTrait);
            }
            const weapons = [gameObject.primaryWeapon, gameObject.secondaryWeapon];
            if (weapons.some(weapon => weapon?.warhead.rules.mindControl)) {
                gameObject.mindControllerTrait = new MindControllerTrait(gameObject);
                gameObject.traits.add(gameObject.mindControllerTrait);
            }
            if (gameObject.rules.spawns) {
                gameObject.airSpawnTrait = new AirSpawnTrait();
                gameObject.traits.add(gameObject.airSpawnTrait);
            }
            if (gameObject.rules.maxDebris) {
                gameObject.traits.add(new SpawnDebrisTrait());
            }
        }
        if (gameObject.isTechno() || gameObject.isOverlay() || gameObject.isTerrain()) {
            const isBridgeOverlay = gameObject.isOverlay() &&
                BridgeOverlayTypes.isBridge(rulesIni.getOverlayId(gameObject.name));
            let strength = gameObject.rules.strength;
            if (!strength && gameObject.isTerrain()) {
                strength = rulesIni.general.treeStrength;
            }
            if (isBridgeOverlay) {
                strength = rulesIni.combatDamage.bridgeStrength;
            }
            if (strength || gameObject.isTechno()) {
                gameObject.healthTrait = new HealthTrait(strength, gameObject, rulesIni.audioVisual.conditionYellow, rulesIni.audioVisual.conditionRed);
                gameObject.traits.add(gameObject.healthTrait);
            }
            if (gameObject.isOverlay() && isBridgeOverlay) {
                gameObject.bridgeTrait = new BridgeTrait(this.bridges);
                gameObject.traits.add(gameObject.bridgeTrait);
                if (BridgeOverlayTypes.getOverlayBridgeType(rulesIni.getOverlayId(gameObject.name)) === OverlayBridgeType.Concrete) {
                    gameObject.traits.add(new SpawnDebrisTrait());
                }
            }
        }
        if (gameObject.isOverlay()) {
            const tibType = OreOverlayTypes.getOverlayTibType(rulesIni.getOverlayId(gameObject.name));
            if (tibType !== undefined) {
                gameObject.traits.add(new TiberiumTrait(gameObject, rulesIni.getTiberium(tibType)));
            }
        }
        if (gameObject.isTerrain() && gameObject.rules.spawnsTiberium) {
            gameObject.traits.add(new TiberiumTreeTrait(gameObject.rules));
        }
        gameObject.cachedTraits.tick.push(...gameObject.traits.filter(NotifyTick));
        return gameObject;
    }
}
