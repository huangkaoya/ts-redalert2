import { ConstructionWorker } from "./ConstructionWorker";
import { GameOpts, isHumanPlayerInfo } from "./gameopts/GameOpts";
import { ObjectType } from "../engine/type/ObjectType";
import { EventDispatcher } from "../util/event";
import { OreSpread } from "./map/OreSpread";
import { Infantry } from "./gameobject/Infantry";
import { AllianceStatus } from "./Alliances";
import { BoxedVar } from "../util/BoxedVar";
import { StartingUnitsGenerator } from "./StartingUnitsGenerator";
import { CardinalTileFinder } from "./map/tileFinder/CardinalTileFinder";
import { SpeedType } from "./type/SpeedType";
import { Target } from "./Target";
import { BridgeOverlayTypes } from "./map/BridgeOverlayTypes";
import { fnv32a, isBetween } from "../util/math";
import { GameEventBus } from "./GameEventBus";
import { ObjectDestroyEvent } from "./event/ObjectDestroyEvent";
import { PlayerDefeatedEvent } from "./event/PlayerDefeatedEvent";
import { GameModeType } from "./ini/GameModeType";
import { Traits } from "./Traits";
import { NotifyTick } from "./trait/interface/NotifyTick";
import { NotifyDestroy } from "./trait/interface/NotifyDestroy";
import { NotifySpawn } from "./trait/interface/NotifySpawn";
import { NotifyUnspawn } from "./trait/interface/NotifyUnspawn";
import { NotifyOwnerChange } from "./trait/interface/NotifyOwnerChange";
import { ObjectOwnerChangeEvent } from "./event/ObjectOwnerChangeEvent";
import { ObjectUnspawnEvent } from "./event/ObjectUnspawnEvent";
import { NotifyTargetDestroy } from "./trait/interface/NotifyTargetDestroy";
import { VeteranLevel } from "./gameobject/unit/VeteranLevel";
import { ObjectSpawnEvent } from "./event/ObjectSpawnEvent";
import { OreOverlayTypes } from "./map/OreOverlayTypes";
import { rectContainsPoint } from "../util/geometry";
import { Weapon } from "./Weapon";
import { GameSpeed } from "./GameSpeed";
import { DeathType } from "./gameobject/common/DeathType";
import { BridgeHeadType } from "./map/Bridges";
import { SuperWeapon } from "./SuperWeapon";
import { AllianceChangeEvent, AllianceEventType } from "./event/AllianceChangeEvent";
import { NotifyAllianceChange } from "./trait/interface/NotifyAllianceChange";
import { OBS_COUNTRY_ID } from "./gameopts/constants";
import { getZoneType } from "./gameobject/unit/ZoneType";
import { Prng } from "./Prng";
import { TriggerManager } from "./trigger/TriggerManager";
import { CountdownTimer } from "./CountdownTimer";
import { WeaponType } from "./WeaponType";
import { Warhead } from "./Warhead";
import { NotifyObjectTraitAdd } from "./trait/interface/NotifyObjectTraitAdd";
import { RadarOnOffEvent } from "./event/RadarOnOffEvent";
export enum GameStatus {
    NotStarted = 0,
    Started = 1,
    Ended = 2
}
export class Game {
    public updatableObjects = new Set<any>();
    public constructionWorkers = new Map<any, ConstructionWorker>();
    public currentTick = 0;
    public currentTime = 0;
    public countdownTimer = new CountdownTimer();
    public _onEnd = new EventDispatcher<Game, void>();
    public afterTickCallbacks: Array<() => void> = [];
    public events = new GameEventBus();
    public traits = new Traits();
    public debugText = new BoxedVar("");
    public world: any;
    public map: any;
    public rules: any;
    public art: any;
    public ai: any;
    public id: any;
    public startTimestamp: any;
    public prng: any;
    public gameOpts: any;
    public gameModeType: any;
    public playerList: any;
    public unitSelection: any;
    public alliances: any;
    public desiredSpeed: BoxedVar<number>;
    public speed: BoxedVar<number>;
    public nextObjectId: any;
    public objectFactory: any;
    public botManager: any;
    public triggers = new TriggerManager();
    public localPlayer: any;
    public mapShroudTrait: any;
    public crateGeneratorTrait: any;
    public status: GameStatus;
    public lastGameEndCheck: number | undefined;
    public sellTrait: any;
    public stalemateDetectTrait: any;
    get onEnd() {
        return this._onEnd.asEvent();
    }
    constructor(world: any, map: any, rules: any, art: any, ai: any, id: any, startTimestamp: any, gameOpts: any, gameModeType: any, playerList: any, unitSelection: any, alliances: any, nextObjectId: any, objectFactory: any, botManager: any) {
        this.world = world;
        this.map = map;
        this.rules = rules;
        this.art = art;
        this.ai = ai;
        this.id = id;
        this.startTimestamp = startTimestamp;
        this.prng = Prng.factory(id, startTimestamp);
        this.gameOpts = gameOpts;
        this.gameModeType = gameModeType;
        this.playerList = playerList;
        this.unitSelection = unitSelection;
        this.alliances = alliances;
        this.desiredSpeed = new BoxedVar(GameSpeed.computeGameSpeed(gameOpts.gameSpeed));
        this.speed = new BoxedVar(this.desiredSpeed.value);
        this.nextObjectId = nextObjectId;
        this.objectFactory = objectFactory;
        this.botManager = botManager;
    }
    addPlayer(player: any) {
        this.playerList.addPlayer(player);
        this.constructionWorkers.set(player, this.createConstructionWorker(player));
    }
    getPlayer(index: number) {
        return this.playerList.getPlayerAt(index);
    }
    getPlayerByName(name: string) {
        return this.playerList.getPlayerByName(name);
    }
    getAiPlayerName(aiPlayer: any) {
        let index: number;
        index = typeof aiPlayer === "number" ? aiPlayer : this.gameOpts.aiPlayers.indexOf(aiPlayer);
        return `@@AI${index + 1}@@`;
    }
    getPlayerNumber(player: any) {
        return this.playerList.getPlayerNumber(player);
    }
    getCombatants() {
        return this.playerList.getCombatants();
    }
    getCivilianPlayer() {
        return this.playerList.getCivilian();
    }
    getAllPlayers() {
        return this.playerList.getAll();
    }
    getNonNeutralPlayers() {
        return this.playerList.getNonNeutral();
    }
    areFriendly(obj1: any, obj2: any) {
        return obj1.owner === obj2.owner || this.alliances.areAllied(obj1.owner, obj2.owner);
    }
    getWorld() {
        return this.world;
    }
    createConstructionWorker(player: any) {
        return new ConstructionWorker(player, this.rules, this.art, this.map, this);
    }
    getConstructionWorker(player: any) {
        const worker = this.constructionWorkers.get(player);
        if (!worker) {
            throw new Error(`No construction worker found for player "${player.name}"`);
        }
        return worker;
    }
    getUnitSelection() {
        return this.unitSelection;
    }
    init(localPlayer: any) {
        this.localPlayer = localPlayer;
        this.createMapObjects();
        this.createPlayerInitialUnits();
        this.map.terrain.computeAllPassabilityGraphs();
        this.mapShroudTrait.init(this);
        this.crateGeneratorTrait.init(this);
        this.playerList.getAll().forEach((player: any) => (player.credits = this.gameOpts.credits));
        if (this.rules.mpDialogSettings.alliesAllowed) {
            this.createInitialTeams();
        }
        this.botManager.init(this);
        this.triggers.init(this);
    }
    start() {
        this.status = GameStatus.Started;
        this.currentTick = 0;
        this.currentTime = 0;
        this.botManager.onGameStart();
    }
    createInitialTeams() {
        for (let teamId = 0; teamId < this.gameOpts.maxSlots; teamId++) {
            const teamMembers = [...this.gameOpts.humanPlayers, ...this.gameOpts.aiPlayers]
                .filter((player: any) => player?.teamId === teamId && player.countryId !== OBS_COUNTRY_ID)
                .map((player: any) => isHumanPlayerInfo(player) ? player.name : this.getAiPlayerName(player));
            if (teamMembers.length > 1) {
                for (let i = 0; i < teamMembers.length - 1; i++) {
                    for (let j = i + 1; j < teamMembers.length; j++) {
                        const player1 = this.getPlayerByName(teamMembers[i]);
                        const player2 = this.getPlayerByName(teamMembers[j]);
                        const alliance = this.alliances.setAlliance(player1, player2, AllianceStatus.Formed);
                        this.onAllianceChange(alliance, player1, true);
                    }
                }
            }
        }
    }
    createMapObjects() {
        const noHarvesters = this.rules.general.harvesterUnit.every((unitName: string) => !isBetween(this.rules.getObject(unitName, ObjectType.Vehicle).techLevel, 0, this.rules.mpDialogSettings.techLevel));
        const mapObjects = this.map.getInitialMapObjects();
        this.createInitialMapTerrains(mapObjects.terrains, noHarvesters);
        this.createInitialMapOverlays(mapObjects.overlays, noHarvesters);
        this.createInitialMapSmudges(mapObjects.smudges);
        this.createInitialMapTechnos(mapObjects.technos);
    }
    createInitialMapTerrains(terrains: any[], noHarvesters: boolean) {
        for (const terrain of terrains) {
            const name = terrain.name;
            if (!this.validateMapObjectRulesAndArt(name, ObjectType.Terrain)) {
                continue;
            }
            const tile = this.map.tiles.getByMapCoords(terrain.rx, terrain.ry);
            if (!tile) {
                console.warn(`Invalid map object location (${terrain.rx},${terrain.ry})`, terrain);
                continue;
            }
            const terrainRules = this.rules.getObject(name, ObjectType.Terrain);
            if (noHarvesters && terrainRules.spawnsTiberium) {
                continue;
            }
            const terrainObj = this.createObject(ObjectType.Terrain, name);
            this.spawnObject(terrainObj, tile);
        }
    }
    createInitialMapOverlays(overlays: any[], noHarvesters: boolean) {
        const bridgeSegments = new Map<any, number>();
        const bridgeObjects = new Map<any, any>();
        const highBridgeHeadTiles = this.map.bridges.findMapHighBridgeHeadTiles();
        const highBridgeSpecs = this.map.bridges.findBridgeSpecsForHeadTiles([...highBridgeHeadTiles]);
        for (const overlay of overlays) {
            const overlayName = this.rules.getOverlayName(overlay.id);
            if (!this.validateMapObjectRulesAndArt(overlayName, ObjectType.Overlay)) {
                continue;
            }
            let overlayObj = this.createObject(ObjectType.Overlay, overlayName);
            overlayObj.overlayId = overlay.id;
            overlayObj.value = overlay.value;
            let tileX = overlay.rx;
            let tileY = overlay.ry;
            if (overlayObj.isBridge() && overlayObj.isHighBridge()) {
                overlayObj.position.tileElevation = 4;
                const matchedSpec = highBridgeSpecs.find((spec: any) => rectContainsPoint({
                    x: spec.start.rx,
                    y: spec.start.ry,
                    ...this.map.bridges.getBridgeSize(spec),
                }, {
                    x: tileX,
                    y: tileY,
                }));
                if (matchedSpec) {
                    const { type, isXBridge, isHigh } = matchedSpec;
                    if (!isHigh) {
                        console.warn(`Expected high bridge but found low bridge overlay at location (${tileX},${tileY})`);
                        overlayObj.dispose();
                        continue;
                    }
                    if (isXBridge !== overlayObj.isXBridge()) {
                        const correctedId = BridgeOverlayTypes.calculateHighBridgeOverlayId(type, isXBridge);
                        if (overlayObj.overlayId !== correctedId) {
                            overlayObj.overlayId = correctedId;
                            overlayObj.name = this.rules.getOverlayName(correctedId);
                        }
                    }
                }
                tileX += overlayObj.isXBridge() ? 0 : -1;
                tileY += overlayObj.isXBridge() ? -1 : 0;
            }
            const tile = this.map.tiles.getByMapCoords(tileX, tileY);
            if (!tile) {
                console.warn(`Invalid map object location (${tileX},${tileY})`, overlay);
                overlayObj.dispose();
                continue;
            }
            if (overlayObj.rules.tiberium) {
                const tibType = OreOverlayTypes.getOverlayTibType(overlay.id);
                if (tibType !== undefined) {
                    const newOverlayId = OreSpread.calculateOverlayId(tibType, tile);
                    if (newOverlayId !== undefined && newOverlayId !== overlay.id) {
                        overlayObj.dispose();
                        overlayObj = this.createObject(ObjectType.Overlay, this.rules.getOverlayName(newOverlayId));
                        overlayObj.overlayId = newOverlayId;
                        overlayObj.value = overlay.value;
                    }
                }
            }
            if (BridgeOverlayTypes.isLowBridge(overlay.id)) {
                if (!BridgeOverlayTypes.isBridgePlaceholder(overlay.id)) {
                    bridgeSegments.set(tile, overlay.value);
                    if (overlay.value === 1) {
                        bridgeObjects.set(tile, overlayObj);
                    }
                    else {
                        overlayObj.dispose();
                    }
                }
            }
            else {
                if (overlayObj.isTiberium()) {
                    if (this.map.getObjectsOnTile(tile).find((obj: any) => obj.isTerrain())) {
                        overlayObj.dispose();
                        continue;
                    }
                }
                if (noHarvesters && overlayObj.isTiberium()) {
                    overlayObj.dispose();
                }
                else {
                    this.spawnObject(overlayObj, tile);
                }
            }
        }
        for (const [tile, bridgeObj] of bridgeObjects) {
            const isXBridge = bridgeObj.isXBridge();
            const prevTile = this.map.tiles.getByMapCoords(tile.rx + (isXBridge ? 0 : -1), tile.ry + (isXBridge ? -1 : 0));
            const nextTile = this.map.tiles.getByMapCoords(tile.rx + (isXBridge ? 0 : 1), tile.ry + (isXBridge ? 1 : 0));
            if (prevTile && nextTile && (bridgeSegments.get(prevTile) === 0 || bridgeSegments.get(nextTile) === 2)) {
                bridgeObj.value = 0;
                this.spawnObject(bridgeObj, prevTile);
            }
            else {
                bridgeObj.dispose();
                console.warn(`Invalid bridge segment @${tile.rx},${tile.ry}. Skipping.`);
            }
        }
        const lowBridgeHeadTiles = [...bridgeObjects.keys()].filter((tile: any) => this.map.bridges.getPieceAtTile(tile)?.headType !== BridgeHeadType.None);
        const bridgeSpecs = [
            ...this.map.bridges.findBridgeSpecsForHeadTiles([...lowBridgeHeadTiles]),
            ...highBridgeSpecs,
        ];
        for (const spec of bridgeSpecs) {
            for (const piece of this.map.bridges.findBridgePieces(spec)) {
                piece.obj.bridgeTrait.bridgeSpec = spec;
            }
        }
        const allBridgeTiles = bridgeSpecs
            .map((spec: any) => this.map.bridges.findAllBridgeTiles(spec))
            .flat();
        const placeholderId = BridgeOverlayTypes.bridgePlaceholderIds[0];
        const placeholderName = this.rules.getOverlayName(placeholderId);
        for (const tile of allBridgeTiles) {
            const placeholder = this.createObject(ObjectType.Overlay, placeholderName);
            placeholder.overlayId = placeholderId;
            this.spawnObject(placeholder, tile);
        }
    }
    createInitialMapSmudges(smudges: any[]) {
        for (const smudge of smudges) {
            const name = smudge.name;
            const tile = this.map.tiles.getByMapCoords(smudge.rx, smudge.ry);
            if (!tile) {
                console.warn(`Invalid map object location (${smudge.rx},${smudge.ry})`, smudge);
                continue;
            }
            const smudgeObj = this.createObject(ObjectType.Smudge, name);
            this.spawnObject(smudgeObj, tile);
        }
    }
    createInitialMapTechnos(technos: any[]) {
        const playersByCountry = new Map(this.playerList
            .getAll()
            .filter((player: any) => !!player.country)
            .map((player: any) => [player.country.name, player]));
        const tags = this.map.getTags();
        for (const techno of technos) {
            const name = techno.name;
            if (!this.validateMapObjectRulesAndArt(name, techno.type)) {
                continue;
            }
            const tile = this.map.tiles.getByMapCoords(techno.rx, techno.ry);
            if (!tile) {
                console.warn(`Invalid map object location (${techno.rx},${techno.ry})`, techno);
                continue;
            }
            const owner = playersByCountry.get(techno.owner);
            if (!owner) {
                console.warn(`Invalid owner "${techno.owner}" for map object`, techno);
                continue;
            }
            if (!(owner as any).isNeutral) {
                continue;
            }
            const obj = this.createObject(techno.type, name);
            if (techno.tag) {
                obj.tag = tags.find((tag: any) => tag.id === techno.tag);
            }
            obj.healthTrait.health = (techno.health / 256) * 100;
            let shouldDestroy = false;
            if (!obj.healthTrait.health) {
                if (!obj.isBuilding() || !obj.rules.leaveRubble) {
                    obj.dispose();
                    continue;
                }
                shouldDestroy = true;
            }
            if (techno.isInfantry() || techno.isVehicle() || techno.isAircraft()) {
                obj.direction = ((-techno.direction / 256) * 360 + 360) % 360;
                if (techno.isInfantry()) {
                    obj.position.subCell = techno.subCell;
                }
                let onBridge = false;
                if (techno.onBridge) {
                    if (tile.onBridgeLandType === undefined) {
                        console.warn(`Cannot place unit "${techno.name}" on a bridge because no bridge was found at ${tile.rx}, ${tile.ry}`);
                    }
                    else {
                        onBridge = true;
                    }
                }
                obj.onBridge = onBridge;
                obj.zone = getZoneType(onBridge ? tile.onBridgeLandType : tile.landType);
                if (onBridge) {
                    obj.position.tileElevation += this.map.tileOccupation.getBridgeOnTile(tile)?.tileElevation ?? 0;
                }
                if (techno.veterancy) {
                    obj.veteranTrait?.setRelativeXP(techno.veterancy);
                }
            }
            else {
                obj.poweredTrait?.setTurnedOn(techno.poweredOn);
            }
            this.changeObjectOwner(obj, owner);
            this.spawnObject(obj, tile);
            if (shouldDestroy) {
                this.destroyObject(obj, undefined, true);
            }
        }
    }
    validateMapObjectRulesAndArt(name: string, type: ObjectType): boolean {
        if (!this.rules.hasObject(name, type)) {
            console.warn(`Map object '${name}' has no rules section. Skipping.`);
            return false;
        }
        if (!this.art.hasObject(name, type)) {
            console.warn(`Map object '${name}' has no art section. Skipping.`);
            return false;
        }
        return true;
    }
    createPlayerInitialUnits() {
        const countries = this.playerList.getCombatants().map((player: any) => player.country);
        const availableUnits = [...this.rules.infantryRules.values(), ...this.rules.vehicleRules.values()].filter((unit: any) => unit.allowedToStartInMultiplayer &&
            !unit.naval &&
            unit.techLevel !== -1 &&
            unit.techLevel <= this.rules.mpDialogSettings.techLevel &&
            !this.rules.general.baseUnit.includes(unit.name) &&
            countries.some((country: any) => unit.isAvailableTo(country) && unit.hasOwner(country)));
        for (const player of this.playerList.getCombatants()) {
            const startLoc = this.map.startingLocations[player.startLocation];
            const startTile = this.map.tiles.getByMapCoords(startLoc.x, startLoc.y);
            if (!startTile) {
                throw new Error(`Invalid player starting position (${startLoc.x},${startLoc.y})`);
            }
            const mcvName = this.rules.general.baseUnit.find((unitName: string) => {
                const unit = this.rules.getObject(unitName, ObjectType.Vehicle);
                return unit.isAvailableTo(player.country) && unit.hasOwner(player.country);
            });
            if (!mcvName) {
                throw new Error("No suitable MCV found for player country " + player.country?.name);
            }
            const mcvRules = this.rules.getObject(mcvName, ObjectType.Vehicle);
            const mcv = this.createUnitForPlayer(mcvRules, player);
            this.spawnObject(mcv, startTile);
            const startingUnits = StartingUnitsGenerator.generate(this.gameOpts.unitCount, [...this.rules.vehicleRules.keys()], availableUnits, player.country);
            if (this.gameModeType === GameModeType.Unholy) {
                startingUnits.push(...this.rules.general.baseUnit
                    .filter((unitName: string) => unitName !== mcvName)
                    .map((unitName: string) => ({
                    name: unitName,
                    type: ObjectType.Vehicle,
                    count: 1,
                })));
            }
            const spawnTiles: any[] = [];
            let useSpawnTiles = false;
            const tileFinder = new CardinalTileFinder(this.map.tiles, this.map.mapBounds, startTile, 4, 4, (tile: any) => !this.map
                .getGroundObjectsOnTile(tile)
                .find((obj: any) => !(obj.isSmudge() || (obj.isOverlay() && obj.isTiberium()))) &&
                this.map.terrain.getPassableSpeed(tile, SpeedType.Foot, false, false) > 0);
            const tileFinderMap = new Map<any, any>();
            let tileIndex = 0;
            for (const { name, type, count } of startingUnits) {
                let remaining = count;
                while (remaining > 0) {
                    let tile;
                    if (!useSpawnTiles) {
                        tile = tileFinder.getNextTile();
                        if (tile) {
                            spawnTiles.push(tile);
                        }
                        else {
                            useSpawnTiles = true;
                        }
                    }
                    if (useSpawnTiles && spawnTiles.length) {
                        const baseTile = spawnTiles[tileIndex];
                        let finder = tileFinderMap.get(baseTile);
                        if (!finder) {
                            finder = new CardinalTileFinder(this.map.tiles, this.map.mapBounds, baseTile, 1, 0, (tile: any) => !this.map
                                .getGroundObjectsOnTile(tile)
                                .find((obj: any) => !(obj.isSmudge() || (obj.isOverlay() && obj.isTiberium()))) &&
                                this.map.terrain.getPassableSpeed(tile, SpeedType.Foot, false, false) > 0);
                            tileFinderMap.set(baseTile, finder);
                        }
                        tileIndex = (tileIndex + 1) % spawnTiles.length;
                        tile = finder.getNextTile();
                    }
                    if (tile) {
                        const unitRules = this.rules.getObject(name, type);
                        if (type === ObjectType.Vehicle) {
                            const unit = this.createUnitForPlayer(unitRules, player);
                            this.applyInitialVeteran(unit, player);
                            this.spawnObject(unit, tile);
                            remaining--;
                        }
                        else if (type === ObjectType.Infantry) {
                            for (const subCell of Infantry.SUB_CELLS.slice(0, remaining)) {
                                const unit = this.createUnitForPlayer(unitRules, player);
                                unit.position.subCell = subCell;
                                this.applyInitialVeteran(unit, player);
                                this.spawnObject(unit, tile);
                                remaining--;
                            }
                        }
                        else {
                            throw new Error("Should not reach this line");
                        }
                    }
                    else {
                        remaining--;
                    }
                }
            }
        }
    }
    applyInitialVeteran(unit: any, player: any) {
        if (unit.veteranTrait) {
            if (this.rules.general.veteran.initialVeteran) {
                unit.veteranTrait.setVeteranLevel(VeteranLevel.Elite);
            }
            else if (player.country.hasVeteranUnit(unit.type, unit.name)) {
                unit.veteranTrait.setVeteranLevel(VeteranLevel.Veteran);
            }
        }
    }
    createObject(type: ObjectType, name: string) {
        return this.objectFactory.create(type, name, this.rules, this.art);
    }
    createUnitForPlayer(unitRules: any, player: any) {
        if (![ObjectType.Aircraft, ObjectType.Vehicle, ObjectType.Infantry].includes(unitRules.type)) {
            throw new Error(`Attempted to create an invalid unit type "${unitRules.type}"`);
        }
        const unit = this.createObject(unitRules.type, unitRules.name);
        this.changeObjectOwner(unit, player);
        unit.purchaseValue = this.sellTrait.computePurchaseValue(unit.rules, player);
        return unit;
    }
    createProjectile(projectileName: string, fromObject: any, weapon: any, target: any, isShrapnel: boolean) {
        const projectile = this.createObject(ObjectType.Projectile, projectileName);
        projectile.fromWeapon = weapon;
        projectile.fromObject = fromObject;
        projectile.fromPlayer = fromObject.owner;
        projectile.target = target;
        projectile.isShrapnel = isShrapnel;
        return projectile;
    }
    createLooseProjectile(weaponName: string, fromPlayer: any, target: any) {
        const weaponRules = this.rules.getWeapon(weaponName);
        const projectileName = weaponRules.projectile;
        const projectileRules = this.rules.getProjectile(projectileName);
        const warheadRules = this.rules.getWarhead(weaponRules.warhead);
        const weapon = {
            minRange: 0,
            projectileRules: projectileRules,
            range: Number.POSITIVE_INFINITY,
            rules: weaponRules,
            speed: Weapon.computeSpeed(weaponRules, projectileRules),
            type: WeaponType.Primary,
            warhead: new Warhead(warheadRules),
        };
        const projectile = this.createObject(ObjectType.Projectile, projectileName);
        projectile.fromWeapon = weapon;
        projectile.fromObject = undefined;
        projectile.fromPlayer = fromPlayer;
        projectile.target = target;
        return projectile;
    }
    createSuperWeapon(name: string, owner: any, isReady: boolean = false) {
        const rules = this.rules.getSuperWeapon(name);
        return new SuperWeapon(name, rules, owner, isReady);
    }
    createTarget(obj: any, tile: any) {
        return new Target(obj, tile, this.map.tileOccupation);
    }
    isValidTarget(obj: any): boolean {
        if (obj) {
            if (!obj.isSpawned || obj.isCrashing) {
                return false;
            }
            if (!(obj.rules.legalTarget || (obj.isBuilding() && obj.rules.hospital))) {
                return false;
            }
            if (obj.isBuilding() && obj.rules.invisibleInGame) {
                return false;
            }
        }
        return true;
    }
    spawnObject(obj: any, tile: any) {
        if (obj.isTechno() && obj.limboData) {
            throw new Error(`Object ${obj.name}#${obj.id} is in limbo. Use unlimboObject instead or clear limboData first`);
        }
        this.doSpawnObject(obj, tile);
    }
    unspawnObject(obj: any) {
        if (obj.isTechno() && obj.owner) {
            obj.owner.removeOwnedObject(obj);
        }
        this.doUnspawnObject(obj);
    }
    limboObject(obj: any, limboData: any) {
        obj.limboData = limboData;
        this.doUnspawnObject(obj);
    }
    unlimboObject(obj: any, tile: any, skipSelection: boolean = false) {
        const limboData = obj.limboData;
        if (!limboData) {
            throw new Error(`Object ${obj.name}#${obj.id} has no limboData attached`);
        }
        obj.limboData = undefined;
        this.doSpawnObject(obj, tile);
        const selection = this.getUnitSelection();
        if (limboData.selected && !skipSelection) {
            selection.addToSelection(obj);
        }
        if (limboData.controlGroup !== undefined) {
            selection.addUnitsToGroup(limboData.controlGroup, [obj], false);
        }
    }
    private doSpawnObject(obj: any, tile: any) {
        obj.position.tile = tile;
        if (obj.isBuilding()) {
            const center = obj.art.foundationCenter;
            const centerX = tile.rx + center.x;
            const centerY = tile.ry + center.y;
            obj.centerTile = this.map.tiles.getByMapCoords(centerX, centerY) ?? this.map.tiles.getPlaceholderTile(centerX, centerY);
        }
        this.world.spawnObject(obj);
        if (obj.cachedTraits.tick.length || obj.isProjectile() || obj.isDebris() || obj.isTechno()) {
            this.updatableObjects.add(obj);
        }
        if (obj.isTechno()) {
            this.map.technosByTile.add(obj);
        }
        if (!obj.isProjectile() && !obj.isDebris()) {
            this.map.tileOccupation.occupyTileRange(tile, obj);
        }
        if (obj.art.canHideThings) {
            this.map.tileOcclusion.addOccluder(obj);
        }
        obj.onSpawn(this);
        this.traits.filter(NotifySpawn).forEach((trait: NotifySpawn) => {
            trait[NotifySpawn.onSpawn](obj, this);
        });
        this.events.dispatch(new ObjectSpawnEvent(obj));
    }
    private doUnspawnObject(obj: any) {
        const tile = obj.tile;
        if (!obj.isProjectile() && !obj.isDebris()) {
            this.map.tileOccupation.unoccupyTileRange(tile, obj);
        }
        if (obj.art.canHideThings) {
            this.map.tileOcclusion.removeOccluder(obj);
        }
        if (obj.isTechno()) {
            this.unitSelection.cleanupUnit(obj);
            this.map.technosByTile.remove(obj);
        }
        this.world.removeObject(obj);
        this.updatableObjects.delete(obj);
        obj.onUnspawn(this);
        this.traits.filter(NotifyUnspawn).forEach((trait: NotifyUnspawn) => {
            trait[NotifyUnspawn.onUnspawn](obj, this);
        });
        this.events.dispatch(new ObjectUnspawnEvent(obj));
    }
    destroyObject(obj: any, killer?: any, silent: boolean = false, skipEvents: boolean = false) {
        if (obj.isDestroyed) {
            throw new Error(`Object with ID "${obj.id}" is already destroyed`);
        }
        if (obj.isTechno()) {
            const originalOwner = obj.mindControllableTrait?.getOriginalOwner() ?? obj.owner;
            // 完善模拟层逻辑：score when killer exists and the victim is not a
            // building owned by a non-combatant (!building || combatant).
            if (killer && (!obj.isBuilding() || originalOwner.isCombatant())) {
                killer.player.addUnitsKilled(obj.type, 1);
                if (killer.player !== originalOwner && !this.alliances.areAllied(killer.player, originalOwner)) {
                    killer.player.score += obj.rules.points;
                }
            }
            if (!originalOwner.isNeutral) {
                originalOwner.addUnitsLost(obj.type, 1);
            }
        }
        obj.isDestroyed = true;
        if (obj.healthTrait) {
            obj.healthTrait.health = 0;
        }
        obj.onDestroy(this, killer, silent);
        this.traits.filter(NotifyDestroy).forEach((trait: NotifyDestroy) => {
            trait[NotifyDestroy.onDestroy](obj, this, killer);
        });
        killer?.obj?.traits.filter(NotifyTargetDestroy).forEach((trait: NotifyTargetDestroy) => {
            trait[NotifyTargetDestroy.onDestroy](killer.obj, obj, killer.weapon, this);
        });
        this.events.dispatch(new ObjectDestroyEvent(obj, killer, skipEvents));
        if (obj.isBuilding() && obj.rules.leaveRubble && obj.deathType !== DeathType.Temporal) {
            obj.owner.removeOwnedObject(obj);
            this.unitSelection.cleanupUnit(obj);
            const tiles = this.map.tileOccupation.calculateTilesForGameObject(obj.tile, obj);
            this.map.terrain.invalidateTiles(tiles);
            if (obj.art.canHideThings) {
                this.map.tileOcclusion.removeOccluder(obj);
            }
            this.updatableObjects.delete(obj);
            obj.onUnspawn(this);
            this.traits.filter(NotifyUnspawn).forEach((trait: NotifyUnspawn) => {
                trait[NotifyUnspawn.onUnspawn](obj, this);
            });
            this.events.dispatch(new ObjectUnspawnEvent(obj));
        }
        else if (obj.isSpawned) {
            this.unspawnObject(obj);
        }
        else if (obj.isTechno() && obj.owner) {
            if (!obj.limboData) {
                throw new Error(`Object with ID "${obj.id}" should be in limbo but has no limboData`);
            }
            obj.owner.removeOwnedObject(obj);
        }
        obj.dispose();
    }
    getObjectById(id: number) {
        return this.world.getObjectById(id);
    }
    changeObjectOwner(obj: any, newOwner: any) {
        const oldOwner = obj.owner;
        if (oldOwner) {
            oldOwner.removeOwnedObject(obj);
        }
        newOwner.addOwnedObject(obj);
        if (oldOwner && oldOwner !== newOwner) {
            this.traits.filter(NotifyOwnerChange).forEach((trait: NotifyOwnerChange) => {
                trait[NotifyOwnerChange.onChange](obj, oldOwner, this);
            });
            obj.onOwnerChange(oldOwner, this);
            this.events.dispatch(new ObjectOwnerChangeEvent(obj, oldOwner));
            if (oldOwner === this.localPlayer && obj.owner !== this.localPlayer) {
                this.unitSelection.removeFromSelection([obj]);
                this.unitSelection.removeUnitsFromGroup([obj]);
            }
        }
    }
    addObjectTrait(obj: any, trait: any) {
        obj.addTrait(trait);
        this.traits.filter(NotifyObjectTraitAdd).forEach((t: NotifyObjectTraitAdd) => {
            t[NotifyObjectTraitAdd.onAdd](obj, trait, this);
        });
    }
    onAllianceChange(alliance: any, initiator: any, formed: boolean) {
        this.events.dispatch(new AllianceChangeEvent(alliance, formed ? AllianceEventType.Formed : AllianceEventType.Broken, initiator));
        this.traits.filter(NotifyAllianceChange).forEach((trait: NotifyAllianceChange) => {
            trait[NotifyAllianceChange.onChange](alliance, formed, this);
        });
    }
    update() {
        if (this.status === GameStatus.NotStarted) {
            return;
        }
        this.botManager.update(this);
        if (this.status !== GameStatus.Ended) {
            if (this.lastGameEndCheck === undefined || this.currentTime - this.lastGameEndCheck >= 1000) {
                this.checkGameEndConditions();
                this.lastGameEndCheck = this.currentTime;
            }
        }
        for (const obj of [...this.updatableObjects]) {
            if (obj.isSpawned) {
                obj.update(this);
            }
        }
        this.playerList.getCombatants().forEach((player: any) => {
            player.cheerCooldownTicks = Math.max(0, player.cheerCooldownTicks - 1);
        });
        this.traits.filter(NotifyTick).forEach((trait: NotifyTick) => {
            trait[NotifyTick.onTick](this);
        });
        if (this.localPlayer && !this.localPlayer.isObserver && !this.localPlayer.defeated) {
            const selectedUnits = this.unitSelection.getSelectedUnits();
            if (selectedUnits.length === 1) {
                const unit = selectedUnits[0];
                if (unit.isTechno() && unit.owner !== this.localPlayer) {
                    const shroud = this.mapShroudTrait.getPlayerShroud(this.localPlayer);
                    const tiles = this.map.tileOccupation.calculateTilesForGameObject(unit.tile, unit);
                    const isVisible = tiles.find((tile: any) => !shroud.isShrouded(tile, unit.tileElevation));
                    if (!isVisible) {
                        this.unitSelection.deselectAll();
                        this.unitSelection.cleanupUnit(unit);
                    }
                }
            }
        }
        for (const callback of this.afterTickCallbacks) {
            callback();
        }
        this.afterTickCallbacks.length = 0;
        this.triggers.update(this);
        this.countdownTimer.update(this);
        this.currentTick++;
        this.currentTime += 1000 / GameSpeed.BASE_TICKS_PER_SECOND;
    }
    afterTick(callback: () => void) {
        this.afterTickCallbacks.push(callback);
    }
    checkGameEndConditions() {
        this.updateDefeatedPlayers(this.playerList.getCombatants());
        const shouldEnd =
            (this.localPlayer?.defeated && !this.localPlayer.isObserver) ||
            (!this.alliances.getHostilePlayers().some((pair: any) => !pair.first.isAi || !pair.second.isAi) &&
                this.gameOpts.humanPlayers.length +
                    this.gameOpts.aiPlayers.filter((p: any) => !!p).length >
                    1);
        if (shouldEnd) {
            this.end();
        }
    }
    end() {
        if (this.status !== GameStatus.Ended) {
            this.status = GameStatus.Ended;
            this._onEnd.dispatch(this, undefined);
        }
    }
    updateDefeatedPlayers(players: any[]) {
        const isStalemate = this.stalemateDetectTrait?.isStale() && this.stalemateDetectTrait.getCountdownTicks() === 0;
        const shortGame = this.gameOpts.shortGame;
        players.forEach((player: any) => {
            let isDefeated: boolean;
            if (isStalemate) {
                isDefeated = true;
            }
            else {
                let hasAssets: boolean;
                if (shortGame) {
                    const hasSignificantBuilding = [...player.getOwnedObjectsByType(ObjectType.Building, true)].some((obj: any) => !obj.rules.insignificant);
                    hasAssets = hasSignificantBuilding || player.getOwnedObjects(true).some((obj: any) => this.rules.general.baseUnit.includes(obj.name));
                }
                else {
                    hasAssets = player.getOwnedObjects(true).some((obj: any) => !obj.rules.insignificant && !obj.limboData?.inTransport);
                }
                isDefeated = !hasAssets;
            }
            if (isDefeated) {
                player.defeated = true;
                const hasHumanConflict = this.alliances.getHostilePlayers().some((pair: any) => !pair.first.isAi || !pair.second.isAi);
                if (hasHumanConflict) {
                    player.isObserver = true;
                }
                this.removeAllPlayerAssets(player);
                this.events.dispatch(new PlayerDefeatedEvent(player));
                if (hasHumanConflict) {
                    this.mapShroudTrait.getPlayerShroud(player)?.revealAll();
                    const wasRadarDisabled = player.radarTrait.isDisabled();
                    player.radarTrait.setDisabled(false);
                    if (wasRadarDisabled) {
                        this.events.dispatch(new RadarOnOffEvent(player, true));
                    }
                }
            }
        });
    }
    removeAllPlayerAssets(player: any) {
        player.getOwnedObjects().forEach((obj: any) => {
            if (!obj.isDestroyed) {
                if (obj.isBuilding() && obj.rules.returnable && obj.rules.needsEngineer && !obj.garrisonTrait) {
                    this.changeObjectOwner(obj, this.getCivilianPlayer());
                }
                else if (!(obj.isBuilding() && obj.wallTrait)) {
                    this.destroyObject(obj, undefined, true);
                }
            }
        });
        player.getOwnedObjects(true).forEach((obj: any) => {
            if (!obj.isDestroyed) {
                if (obj.limboData?.inTransport || (obj.isBuilding() && obj.wallTrait)) {
                    this.changeObjectOwner(obj, this.getCivilianPlayer());
                }
                else {
                    this.destroyObject(obj, undefined, true);
                }
            }
        });
    }
    isAssetRedistributionEnabled(): boolean {
        return this.rules.mpDialogSettings.mustAlly && !this.rules.mpDialogSettings.allyChangeAllowed;
    }
    redistributeAllPlayerAssets(player: any): boolean {
        if (player.isObserver) {
            return false;
        }
        if (!this.isAssetRedistributionEnabled()) {
            return false;
        }
        const allies = this.alliances.getAllies(player).filter((p: any) => !p.isAi && !p.defeated);
        if (allies.length > 0) {
            const topAlly = [...allies].sort((a: any, b: any) => b.score - a.score)[0];
            for (const obj of player.getOwnedObjects(true)) {
                this.changeObjectOwner(obj, topAlly);
            }
            const creditsPerAlly = Math.floor(player.credits / allies.length);
            const remainder = player.credits % allies.length;
            for (const ally of allies) {
                ally.credits += creditsPerAlly;
            }
            allies[0].credits += remainder;
            return true;
        }
        return false;
    }
    generateRandomInt(min: number, max: number): number {
        return this.prng.generateRandomInt(min, max);
    }
    generateRandom(): number {
        return this.prng.generateRandom();
    }
    getHash(): number {
        return fnv32a([
            ...new Uint8Array(new Float64Array([this.prng.getLastRandom()]).buffer),
            this.nextObjectId.value,
            ...this.world.getAllObjects().map((obj: any) => obj.getHash()),
            ...this.playerList.getAll().map((player: any) => player.getHash()),
            this.alliances.getHash(),
            ...this.traits.getAll().map((trait: any) => trait.getHash?.() ?? 0),
        ]);
    }
    debugGetState() {
        return {
            currentTick: this.currentTick,
            lastRandom: this.prng.getLastRandom(),
            nextObjectId: this.nextObjectId.value,
            objects: this.world.getAllObjects().map((obj: any) => obj.debugGetState()),
            players: this.playerList.getAll().map((player: any) => player.debugGetState()),
            alliances: this.alliances.debugGetState(),
            traits: this.traits.getAll().reduce((acc: any, trait: any) => {
                const state = trait.debugGetState?.();
                if (state !== undefined) {
                    acc[trait.constructor.name] = state;
                }
                return acc;
            }, {}),
        };
    }
    dispose() {
        this.world.getAllObjects().forEach((obj: any) => obj.dispose());
        this.playerList.getAll().forEach((player: any) => player.dispose());
        this.constructionWorkers.forEach((worker: any) => worker.dispose());
        this.botManager.dispose();
        this.triggers.dispose();
        this.map.dispose();
        this.traits.dispose();
    }
}
