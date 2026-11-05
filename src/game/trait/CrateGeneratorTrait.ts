import { ObjectType } from "@/engine/type/ObjectType";
import { TerrainType } from "@/engine/type/TerrainType";
import { CratePickupEvent } from "@/game/event/CratePickupEvent";
import { RangeHelper } from "@/game/gameobject/unit/RangeHelper";
import { ZoneType } from "@/game/gameobject/unit/ZoneType";
import { OBS_COUNTRY_ID } from "@/game/gameopts/constants";
import { GameSpeed } from "@/game/GameSpeed";
import { RadialTileFinder } from "@/game/map/tileFinder/RadialTileFinder";
import { RadialBackFirstTileFinder } from "@/game/map/tileFinder/RadialBackFirstTileFinder";
import { PowerupType } from "@/game/type/PowerupType";
import { SpeedType } from "@/game/type/SpeedType";
import { NotifyTick } from "@/game/trait/interface/NotifyTick";
import { SuperWeaponType } from "@/game/type/SuperWeaponType";
import { SuperWeaponsTrait } from "@/game/trait/SuperWeaponsTrait";
import { CloakableTrait } from "@/game/gameobject/trait/CloakableTrait";
import { Warhead } from "@/game/Warhead";
import { CollisionType } from "@/game/gameobject/unit/CollisionType";
import { RandomTileFinder } from "@/game/map/tileFinder/RandomTileFinder";
import { OreSpread } from "@/game/map/OreSpread";
import { TiberiumType } from "@/engine/type/TiberiumType";
import { TiberiumTrait } from "@/game/gameobject/trait/TiberiumTrait";
import { Vector2 } from "@/game/math/Vector2";
import { Box2 } from "@/game/math/Box2";
import { SpecialWarheadType } from '@/game/SpecialWarheadType';
export const UNSUPPORTED_POWERUP_TYPES = [
    PowerupType.IonStorm,
    PowerupType.Gas,
    PowerupType.Pod,
    PowerupType.Squad,
];
interface CrateInfo {
    obj: any;
    powerup: any;
    ticksLeft: number;
}
export class CrateGeneratorTrait implements NotifyTick {
    private randomCrateSpawn: boolean;
    private crates: CrateInfo[] = [];
    private availEdgeTiles: any[] = [];
    private allTiles: any[] = [];
    private mapEdgeIsWater: boolean = false;
    private minCrates: number = 0;
    constructor(randomCrateSpawn: boolean) {
        this.randomCrateSpawn = randomCrateSpawn;
        this.crates = [];
        this.availEdgeTiles = [];
        this.allTiles = [];
    }
    init(gameState: any): void {
        const mapSize = gameState.map.tiles.getMapSize();
        const tiles = gameState.map.tiles;
        const edgeTiles: any[] = [];
        let landEdgeCount = 0;
        for (let x = 0; x < mapSize.width; ++x) {
            let firstTile: any = null;
            let lastTile: any = null;
            let hasWaterStart = false;
            let hasWaterEnd = false;
            for (let y = 0; y < mapSize.height; ++y) {
                const tile = tiles.getByMapCoords(x, y);
                if (tile && this.canPlaceCrateOnTile(gameState, tile)) {
                    const isWater = gameState.map.getTileZone(tile) === ZoneType.Water;
                    if (!firstTile) {
                        if (isWater) {
                            hasWaterStart = hasWaterEnd = true;
                        }
                        else {
                            firstTile = lastTile = tile;
                        }
                    }
                    else {
                        if (!isWater) {
                            lastTile = tile;
                        }
                        hasWaterEnd = isWater;
                    }
                }
                else if (firstTile && !tile)
                    break;
            }
            if (firstTile) {
                edgeTiles.push(firstTile);
                if (lastTile && lastTile !== firstTile) {
                    edgeTiles.push(lastTile);
                }
                if (!hasWaterStart && !hasWaterEnd) {
                    landEdgeCount++;
                }
            }
        }
        this.availEdgeTiles = edgeTiles;
        this.allTiles = tiles.getAll();
        this.mapEdgeIsWater = landEdgeCount === 0;
        this.minCrates = gameState.rules.crateRules.crateMinimum *
            gameState.gameOpts.humanPlayers.filter((player: any) => player.countryId !== OBS_COUNTRY_ID).length;
    }
    [NotifyTick.onTick](gameState: any): void {
        for (const crate of this.crates) {
            crate.ticksLeft--;
            if (crate.ticksLeft <= 0) {
                gameState.unspawnObject(crate.obj);
                crate.obj.dispose();
            }
        }
        this.crates = this.crates.filter(crate => crate.ticksLeft > 0);
        if (this.randomCrateSpawn) {
            for (let i = 0; i < this.minCrates - this.crates.length && this.spawnCrateAtRandom(this.allTiles, gameState); i++)
                ;
        }
    }
    spawnCrateAtRandom(tiles: any[], gameState: any): boolean {
        const spawnTile = this.chooseSpawnTile(tiles, gameState);
        if (spawnTile) {
            // 完善模拟层逻辑：random map crates are timed (regen lifetime).
            return !!this.spawnRandomCrateAt(spawnTile, gameState, 0, true);
        }
        return false;
    }
    spawnRandomCrateAt(tile: any, gameState: any, radius = 0, timed = false): boolean {
        if (!this.canPlaceCrateOnTile(gameState, tile) && radius > 0) {
            tile = new RadialBackFirstTileFinder(
                gameState.map.tiles,
                gameState.map.mapBounds,
                tile,
                { width: 1, height: 1 },
                1,
                radius,
                (candidate: any) => this.canPlaceCrateOnTile(gameState, candidate),
            ).getNextTile() ?? tile;
        }
        if (this.canPlaceCrateOnTile(gameState, tile)) {
            const isWater = gameState.map.getTileZone(tile, true) === ZoneType.Water;
            const powerup = this.choosePowerup(isWater, gameState.rules.powerups.powerups, gameState);
            if (powerup) {
                return !!this.spawnCrateAt(tile, powerup, gameState, radius, timed);
            }
        }
        return false;
    }
    spawnCrateAt(tile: any, powerup: any, gameState: any, radius = 0, timed = false): any {
        if (!this.canPlaceCrateOnTile(gameState, tile) && radius > 0) {
            tile = new RadialBackFirstTileFinder(
                gameState.map.tiles,
                gameState.map.mapBounds,
                tile,
                { width: 1, height: 1 },
                1,
                radius,
                (candidate: any) => this.canPlaceCrateOnTile(gameState, candidate),
            ).getNextTile() ?? tile;
        }
        if (this.canPlaceCrateOnTile(gameState, tile)) {
            const isWater = gameState.map.getTileZone(tile, true) === ZoneType.Water;
            const crateRules = gameState.rules.crateRules;
            const crateImage = isWater ? crateRules.waterCrateImg : crateRules.crateImg;
            const crateObject = gameState.createObject(ObjectType.Overlay, crateImage);
            crateObject.overlayId = gameState.rules.getOverlayId(crateImage);
            crateObject.value = 0;
            gameState.spawnObject(crateObject, tile);
            // 完善模拟层逻辑：only timed crates expire; otherwise infinite lifetime.
            const ticksLeft = timed
                ? 60 * crateRules.crateRegen * GameSpeed.BASE_TICKS_PER_SECOND *
                    (0.5 + 1.5 * gameState.generateRandom())
                : Number.POSITIVE_INFINITY;
            this.crates.push({
                obj: crateObject,
                powerup: powerup,
                ticksLeft: ticksLeft
            });
            return crateObject;
        }
        return null;
    }
    chooseSpawnTile(tiles: any[], gameState: any): any {
        let tilesToUse = tiles;
        if (gameState.generateRandom() < (this.mapEdgeIsWater ? 1 / 3 : 2 / 3) && this.availEdgeTiles.length) {
            tilesToUse = this.availEdgeTiles;
        }
        return this.chooseRandomTile(tilesToUse, gameState);
    }
    chooseRandomTile(tiles: any[], gameState: any): any {
        let selectedTile: any;
        let attempts = 0;
        do {
            selectedTile = tiles[gameState.generateRandomInt(0, tiles.length - 1)];
            attempts++;
        } while (attempts < 100 && !this.canPlaceCrateOnTile(gameState, selectedTile));
        if (attempts >= 100) {
            const emptyTiles = gameState.map.tileOccupation.getEmptyTiles();
            if (!emptyTiles.length) {
                return null;
            }
            selectedTile = emptyTiles[gameState.generateRandomInt(0, emptyTiles.length - 1)];
        }
        return selectedTile;
    }
    canPlaceCrateOnTile(gameState: any, tile: any): boolean {
        // 完善模拟层逻辑：smudges do not block crate placement.
        return gameState.map.mapBounds.isWithinBounds(tile) &&
            !gameState.map.getGroundObjectsOnTile(tile).filter((obj: any) => !obj.isSmudge()).length &&
            gameState.map.terrain.getPassableSpeed(tile, SpeedType.Amphibious, false, false) > 0 &&
            tile.terrainType !== TerrainType.Shore &&
            tile.rampType === 0;
    }
    choosePowerup(isWater: boolean, powerups: any[], gameState: any): any {
        const availablePowerups = isWater ?
            powerups.filter(p => p.waterAllowed) :
            powerups;
        if (!availablePowerups.length) {
            return null;
        }
        const totalShares = availablePowerups.reduce((sum, powerup) => sum + powerup.probShares, 0);
        const randomValue = gameState.generateRandomInt(0, totalShares);
        let currentSum = 0;
        for (const powerup of availablePowerups) {
            currentSum += powerup.probShares;
            if (randomValue < currentSum) {
                return powerup;
            }
        }
        return null;
    }
    peekInsideCrate(crateObject: any): PowerupType | undefined {
        return this.crates.find(crate => crate.obj === crateObject)?.powerup.type;
    }
    pickupCrate(unit: any, crateObject: any, gameState: any): PowerupType | undefined {
        const crateInfo = this.crates.find(crate => crate.obj === crateObject);
        if (!crateInfo) {
            return undefined;
        }
        this.crates.splice(this.crates.indexOf(crateInfo), 1);
        gameState.unspawnObject(crateInfo.obj);
        crateInfo.obj.dispose();
        const powerupType = this.grantPowerup(unit, crateInfo.powerup, crateInfo.obj.tile, gameState);
        if (powerupType !== undefined) {
            unit.owner.cratesPickedUp++;
            const powerupRule = gameState.rules.powerups.powerups.find((p: any) => p.type === powerupType);
            gameState.events.dispatch(new CratePickupEvent(powerupRule, unit.owner, unit, crateInfo.obj.tile));
        }
        if (this.randomCrateSpawn) {
            this.spawnCrateAtRandom(this.allTiles, gameState);
        }
        return powerupType;
    }
    grantPowerup(unit: any, powerup: any, tile: any, gameState: any): PowerupType | undefined {
        const player = unit.owner;
        let success = false;
        if (!player.isCombatant()) {
            return undefined;
        }
        switch (powerup.type) {
            case PowerupType.Unit:
                success = this.grantUnitPowerup(unit, player, tile, gameState);
                break;
            case PowerupType.Money:
                success = this.grantMoneyPowerup(powerup, player, gameState);
                break;
            case PowerupType.HealBase:
                success = this.grantHealBasePowerup(player, gameState);
                break;
            case PowerupType.Reveal:
                gameState.mapShroudTrait.revealMap(player, gameState);
                success = true;
                break;
            case PowerupType.Darkness:
                gameState.mapShroudTrait.resetShroud(player, gameState);
                success = true;
                break;
            case PowerupType.Veteran:
                success = this.grantVeteranPowerup(unit, powerup, tile, gameState);
                break;
            case PowerupType.Armor:
                success = this.grantArmorPowerup(unit, powerup, tile, gameState);
                break;
            case PowerupType.Firepower:
                success = this.grantFirepowerPowerup(unit, powerup, tile, gameState);
                break;
            case PowerupType.Speed:
                success = this.grantSpeedPowerup(unit, powerup, tile, gameState);
                break;
            case PowerupType.Cloak:
                success = this.grantCloakPowerup(unit, tile, gameState);
                break;
            case PowerupType.ICBM:
                success = this.grantICBMPowerup(player, gameState);
                break;
            case PowerupType.Invulnerability:
                success = this.grantInvulnerabilityPowerup(player, tile, gameState);
                break;
            case PowerupType.Explosion:
            case PowerupType.Napalm:
                success = this.grantExplosionPowerup(unit, powerup, tile, gameState);
                break;
            case PowerupType.Tiberium:
                success = this.grantTiberiumPowerup(tile, gameState);
                break;
            default:
                console.warn(`Unhandled powerup type "${PowerupType[powerup.type]}"`);
                return undefined;
        }
        if (success) {
            return powerup.type;
        }
        const moneyPowerup = gameState.rules.powerups.powerups.find((p: any) => p.type === PowerupType.Money && p.probShares > 0);
        if (moneyPowerup) {
            return this.grantPowerup(unit, moneyPowerup, tile, gameState);
        }
        return undefined;
    }
    private grantUnitPowerup(unit: any, player: any, tile: any, gameState: any): boolean {
        let unitRule: any = null;
        const hasConstructionYard = [...player.buildings].some((building: any) => building.rules.constructionYard);
        if (!hasConstructionYard && gameState.rules.crateRules.freeMCV) {
            const baseUnits = gameState.rules.general.baseUnit;
            const hasBaseUnit = player.getOwnedObjects(true).some((obj: any) => baseUnits.includes(obj.name));
            if (!hasBaseUnit) {
                const requiredCost = [
                    ...gameState.rules.ai.buildPower,
                    ...gameState.rules.ai.buildRefinery,
                ]
                    .map((name: string) => gameState.rules.getBuilding(name))
                    .filter((building: any) => building.aiBasePlanningSide === player.country.side)
                    .reduce((sum: number, building: any) => sum + building.cost, 0);
                if (player.credits >= requiredCost) {
                    const suitableMCV = baseUnits.find((unitName: string) => {
                        const rule = gameState.rules.getObject(unitName, ObjectType.Vehicle);
                        return rule.isAvailableTo(player.country) && rule.hasOwner(player.country);
                    });
                    if (!suitableMCV) {
                        throw new Error(`No suitable MCV found for player country ${player.country?.name}`);
                    }
                    unitRule = gameState.rules.getObject(suitableMCV, ObjectType.Vehicle);
                }
            }
        }
        if (!unitRule) {
            const crateUnitType = gameState.rules.crateRules.unitCrateType;
            let availableUnits: any[] = [];
            if (crateUnitType) {
                if (gameState.rules.hasObject(crateUnitType, ObjectType.Vehicle)) {
                    availableUnits = [gameState.rules.getObject(crateUnitType, ObjectType.Vehicle)];
                }
            }
            else {
                availableUnits = [...gameState.rules.vehicleRules.values()].filter((rule: any) => rule.crateGoodie &&
                    gameState.map.terrain.getPassableSpeed(tile, rule.speedType, false, false) > 0);
            }
            if (availableUnits.length) {
                unitRule = availableUnits[gameState.generateRandomInt(0, availableUnits.length - 1)];
            }
        }
        if (!unitRule) {
            return false;
        }
        const newUnit = gameState.createUnitForPlayer(unitRule, player);
        const tileFinder = new RadialTileFinder(gameState.map.tiles, gameState.map.mapBounds, tile, { width: 1, height: 1 }, 0, 3, (testTile: any) => gameState.map.terrain.getPassableSpeed(testTile, newUnit.rules.speedType, newUnit.isInfantry(), false) > 0 &&
            !gameState.map.terrain.findObstacles({ tile: testTile, onBridge: undefined }, newUnit).length);
        const spawnTile = tileFinder.getNextTile();
        if (spawnTile) {
            gameState.spawnObject(newUnit, spawnTile);
            return true;
        }
        else {
            player.removeOwnedObject(newUnit);
            newUnit.dispose();
            return false;
        }
    }
    private grantMoneyPowerup(powerup: any, player: any, gameState: any): boolean {
        if (!powerup.data) {
            throw new Error("Money powerup missing data field");
        }
        const amount = Math.floor(Number(powerup.data) * (0.55 + 2 * gameState.generateRandom() * 0.45));
        player.credits = Math.max(0, player.credits + amount);
        if (amount > 0) {
            player.creditsGained += amount;
        }
        return true;
    }
    private grantHealBasePowerup(player: any, gameState: any): boolean {
        for (const obj of player.getOwnedObjects(true)) {
            if (!obj.isDestroyed) {
                obj.healthTrait.healToFull(undefined, gameState);
            }
        }
        return true;
    }
    private grantVeteranPowerup(unit: any, powerup: any, tile: any, gameState: any): boolean {
        if (unit.veteranTrait && !unit.veteranTrait.isMaxLevel()) {
            const promotionLevel = Number(powerup.data);
            for (const targetUnit of this.getUnitsInCrateRadius(gameState, tile)) {
                targetUnit.veteranTrait?.promote(promotionLevel, gameState);
            }
            return true;
        }
        return false;
    }
    private grantArmorPowerup(unit: any, powerup: any, tile: any, gameState: any): boolean {
        if (unit.crateBonuses.armor === 1) {
            const armorBonus = Number(powerup.data);
            for (const targetUnit of this.getUnitsInCrateRadius(gameState, tile)) {
                if (targetUnit.crateBonuses.armor === 1) {
                    targetUnit.crateBonuses.armor = armorBonus;
                }
            }
            return true;
        }
        return false;
    }
    private grantFirepowerPowerup(unit: any, powerup: any, tile: any, gameState: any): boolean {
        if (unit.crateBonuses.firepower === 1) {
            const firepowerBonus = Number(powerup.data);
            for (const targetUnit of this.getUnitsInCrateRadius(gameState, tile)) {
                if (targetUnit.crateBonuses.firepower === 1) {
                    targetUnit.crateBonuses.firepower = firepowerBonus;
                }
            }
            return true;
        }
        return false;
    }
    private grantSpeedPowerup(unit: any, powerup: any, tile: any, gameState: any): boolean {
        if (unit.crateBonuses.speed === 1) {
            const speedBonus = Number(powerup.data);
            for (const targetUnit of this.getUnitsInCrateRadius(gameState, tile)) {
                if (targetUnit.crateBonuses.speed === 1) {
                    targetUnit.crateBonuses.speed = speedBonus;
                }
            }
            return true;
        }
        return false;
    }
    private grantCloakPowerup(unit: any, tile: any, gameState: any): boolean {
        if (!unit.cloakableTrait) {
            for (const targetUnit of this.getUnitsInCrateRadius(gameState, tile)) {
                if (!targetUnit.cloakableTrait) {
                    targetUnit.cloakableTrait = new CloakableTrait(targetUnit, gameState.rules.general.cloakDelay);
                    gameState.addObjectTrait(targetUnit, targetUnit.cloakableTrait);
                }
            }
            return true;
        }
        return false;
    }
    private grantICBMPowerup(player: any, gameState: any): boolean {
        const icbmRule = [...gameState.rules.superWeaponRules.values()].find((rule: any) => rule.type === SuperWeaponType.MultiMissile);
        if (icbmRule && player.superWeaponsTrait && !player.superWeaponsTrait.has(icbmRule.name)) {
            const superWeapon = gameState.createSuperWeapon(icbmRule.name, player, true);
            superWeapon.isGift = true;
            player.superWeaponsTrait.add(superWeapon);
            return true;
        }
        return false;
    }
    private grantInvulnerabilityPowerup(player: any, tile: any, gameState: any): boolean {
        const ironCurtainRule = [...gameState.rules.superWeaponRules.values()].find((rule: any) => rule.type === SuperWeaponType.IronCurtain);
        if (ironCurtainRule) {
            gameState.traits.get(SuperWeaponsTrait).activateEffect(ironCurtainRule, player, gameState, tile, undefined, true);
            return true;
        }
        return false;
    }
    private grantExplosionPowerup(unit: any, powerup: any, tile: any, gameState: any): boolean {
        const damage = Number(powerup.data);
        const warheadType = powerup.type === PowerupType.Napalm ?
            gameState.rules.combatDamage.flameDamage :
            gameState.rules.combatDamage.c4Warhead;
        const warhead = new Warhead(gameState.rules.getWarhead(warheadType));
        warhead.detonate(gameState, damage, unit.tile, unit.tileElevation, unit.position.worldPosition, unit.zone, CollisionType.None, gameState.createTarget(unit, unit.tile), { player: unit.owner, weapon: undefined } as any, SpecialWarheadType.None, undefined, 0);
        return true;
    }
    private grantTiberiumPowerup(tile: any, gameState: any): boolean {
        const tileFinder = new RandomTileFinder(gameState.map.tiles, gameState.map.mapBounds, tile, 2, gameState, (testTile: any) => TiberiumTrait.canBePlacedOn(testTile, gameState.map));
        let success = false;
        let attempts = 0;
        let targetTile: any;
        while (attempts++ < 6 && (targetTile = tileFinder.getNextTile())) {
            const overlayId = OreSpread.calculateOverlayId(TiberiumType.Ore, targetTile);
            if (overlayId === undefined) {
                throw new Error("Expected an overlayId");
            }
            const overlayObject = gameState.createObject(ObjectType.Overlay, gameState.rules.getOverlayName(overlayId));
            overlayObject.overlayId = overlayId;
            overlayObject.value = 3;
            gameState.spawnObject(overlayObject, targetTile);
            success = true;
        }
        return success;
    }
    private getUnitsInCrateRadius(gameState: any, tile: any): any[] {
        const radius = gameState.rules.crateRules.crateRadius;
        const rangeHelper = new RangeHelper(gameState.map.tileOccupation);
        return gameState.map.technosByTile
            .queryRange(new Box2().setFromCenterAndSize(new Vector2(tile.rx, tile.ry), new Vector2(radius, radius)))
            .filter((unit: any) => unit.isUnit() && rangeHelper.tileDistance(unit, tile) <= radius);
    }
}
