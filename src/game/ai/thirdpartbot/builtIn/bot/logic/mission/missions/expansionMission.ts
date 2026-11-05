import {
    ActionsApi,
    BotContext,
    Box2,
    GameApi,
    GameMath,
    GameObjectData,
    ObjectType,
    OrderType,
    PlayerData,
    Rectangle,
    Tile,
    UnitData,
    Vector2,
} from "../../../../game-api";
import {
    Mission,
    MissionAction,
    disbandMission,
    noop,
    requestSpecificUnits,
    requestUnits,
    requestUnitsWithSamePriority,
} from "../mission";
import { MatchAwareness } from "../../awareness";
import { MissionController } from "../missionController";
import { DebugLogger, isTechnoRulesObject, maxBy, minBy, toPathNode, toVector2 } from "../../common/utils";
import { ActionBatcher } from "../actionBatcher";
import { getCachedTechnoRules } from "../../common/rulesCache";
import { canBuildOnTile } from "../../common/tileUtils";
import { MissionContext, SupabotContext } from "../../common/context";

const ORDER_COOLDOWN_TICKS = 60;

const mcvTypes = ["AMCV", "SMCV"];

const CONYARD_SCAN_DISTANCE = 15; // distance to check a conyard is already in place
const CONYARD_DEPLOY_SCAN_DISTANCE = 10; // distance to check for a deployable location
const CONYARD_DEPLOY_DISTANCE = 5;

/**
 * A mission that tries to create an MCV (if it doesn't exist) and deploy it somewhere it can be deployed.
 */
export class ExpansionMission extends Mission {
    private destination: Vector2 | null = null;
    private lastOrderAt: number | null = null;

    private lastOrderDeploy = false;
    private deployAttempts = 0;
    private static readonly MAX_DEPLOY_ATTEMPTS = 8;

    constructor(
        uniqueName: string,
        private priority: number,
        private selectedMcvId: number | null,
        private candidates: Vector2[],
        logger: DebugLogger,
    ) {
        super(uniqueName, logger);
        if (candidates.length === 1) {
            this.destination = candidates[0];
        } else if (candidates.length === 0) {
            throw new Error("ExpansionMission requires at least one candidate location");
        }
    }

    public _onAiUpdate(context: MissionContext): MissionAction {
        const { game, matchAwareness, actionBatcher } = context;
        const actionsApi = context.player.actions;
        const playerData = context.game.getPlayerData(context.player.name);
        const mcvs = this.getUnitsOfTypes(game, ...mcvTypes);
        if (mcvs.length === 0) {
            // Perhaps we deployed already (or the unit was destroyed), end the mission.
            if (this.lastOrderAt !== null) {
                return disbandMission();
            }
            // We need an mcv!
            if (this.selectedMcvId && !!game.getUnitData(this.selectedMcvId)) {
                return requestSpecificUnits([this.selectedMcvId], this.priority);
            }
            return requestUnitsWithSamePriority(mcvTypes, this.priority);
        }

        // use the highest-hp MCV
        const selectedMcvUnit = maxBy(mcvs, (mcv) => mcv.hitPoints)!;
        this.selectedMcvId = selectedMcvUnit?.id ?? null;

        if (this.destination) {
            return this.moveMcvToDestination(
                game,
                actionsApi,
                playerData,
                matchAwareness,
                actionBatcher,
                selectedMcvUnit,
            );
        } else {
            const reachableCandidates = this.candidates
                .map((candidate) => game.mapApi.getTile(candidate.x, candidate.y))
                .filter((t): t is Tile => !!t)
                .filter((t) => {
                    try {
                        // 完善模拟层逻辑：MapApi.findPath(speedType, isFoot, start, end, options).
                        // MCV is a vehicle, so isFoot is always false.
                        const path = game.mapApi.findPath(
                            selectedMcvUnit.rules.speedType!,
                            false,
                            toPathNode(selectedMcvUnit.tile, !!selectedMcvUnit.onBridge),
                            toPathNode(t, false),
                            { bestEffort: true, maxExpandedNodes: 1500 },
                        );
                        return path.length > 0;
                    } catch (_err) {
                        return false;
                    }
                });
            const closestReachableCandidate = minBy(reachableCandidates, (candidate) => {
                return toVector2(selectedMcvUnit.tile).distanceTo(toVector2(candidate));
            });
            if (!closestReachableCandidate) {
                // can't reach any candidates yet, return to start location
                this.destination = playerData.startLocation;
            } else {
                this.destination = toVector2(closestReachableCandidate);
            }
            return noop();
        }
    }

    public moveMcvToDestination(
        gameApi: GameApi,
        actionsApi: ActionsApi,
        playerData: PlayerData,
        matchAwareness: MatchAwareness,
        actionBatcher: ActionBatcher,
        mcv: UnitData,
    ) {
        if (!this.destination) {
            return noop();
        }
        // if there's a conyard near the destination, we're done.
        const conYards = gameApi
            .getUnitsInArea(
                new Box2(
                    this.destination.clone().subScalar(CONYARD_SCAN_DISTANCE),
                    this.destination.clone().addScalar(CONYARD_SCAN_DISTANCE),
                ),
            )
            .map((id) => getCachedTechnoRules(gameApi, id))
            .filter((r) => r?.constructionYard);
        if (conYards.length > 0) {
            return disbandMission();
        }
        const isClose = toVector2(mcv.tile).distanceTo(this.destination) <= CONYARD_DEPLOY_DISTANCE;
        const canOrder = !this.lastOrderAt || gameApi.getCurrentTick() > this.lastOrderAt + ORDER_COOLDOWN_TICKS;
        if (!canOrder) {
            return noop();
        }
        if (isClose) {
            this.deployAttempts++;
            // If too many failed attempts at this location, find a new deployable spot
            if (this.deployAttempts > ExpansionMission.MAX_DEPLOY_ATTEMPTS) {
                const deployableLocations = findDeployableLocations(
                    playerData.name,
                    gameApi,
                    {
                        x: mcv.tile.rx - CONYARD_DEPLOY_SCAN_DISTANCE,
                        y: mcv.tile.ry - CONYARD_DEPLOY_SCAN_DISTANCE,
                        width: CONYARD_DEPLOY_SCAN_DISTANCE * 2,
                        height: CONYARD_DEPLOY_SCAN_DISTANCE * 2,
                    },
                    mcv.rules.deploysInto,
                );
                const bestLocation = minBy(deployableLocations, (d) => toVector2(mcv.tile).distanceToSquared(d));
                if (bestLocation) {
                    // Update destination to the new deployable location
                    this.destination = bestLocation.clone();
                    this.deployAttempts = 0;
                    this.lastOrderDeploy = false;
                    actionsApi.orderUnits([mcv.id], OrderType.Move, bestLocation.x, bestLocation.y);
                } else {
                    // No deployable location found at all, scatter and retry
                    actionsApi.orderUnits([mcv.id], OrderType.Scatter);
                    this.deployAttempts = 0;
                }
                this.lastOrderAt = gameApi.getCurrentTick();
                return noop();
            }

            if (!this.lastOrderDeploy) {
                actionsApi.orderUnits([mcv.id], OrderType.DeploySelected);
                this.lastOrderDeploy = true;
            } else {
                // Deploy failed, find a nearby clear spot and move there
                const deployableLocations = findDeployableLocations(
                    playerData.name,
                    gameApi,
                    {
                        x: mcv.tile.rx - CONYARD_DEPLOY_SCAN_DISTANCE,
                        y: mcv.tile.ry - CONYARD_DEPLOY_SCAN_DISTANCE,
                        width: CONYARD_DEPLOY_SCAN_DISTANCE * 2,
                        height: CONYARD_DEPLOY_SCAN_DISTANCE * 2,
                    },
                    mcv.rules.deploysInto,
                );
                const bestLocation = minBy(deployableLocations, (d) => toVector2(mcv.tile).distanceToSquared(d));

                if (bestLocation) {
                    // Update destination so next cycle we move toward this new spot
                    this.destination = bestLocation.clone();
                    actionsApi.orderUnits([mcv.id], OrderType.Move, bestLocation.x, bestLocation.y);
                } else {
                    actionsApi.orderUnits([mcv.id], OrderType.Scatter);
                }
                this.lastOrderDeploy = false;
            }
            this.lastOrderAt = gameApi.getCurrentTick();
        } else if (!isClose) {
            // find a 4x4 area near the destination that is clear.
            const rx = this.destination.x;
            const ry = this.destination.y;
            actionsApi.orderUnits([mcv.id], OrderType.Move, rx, ry);
            this.lastOrderAt = gameApi.getCurrentTick();
        }
        return noop();
    }

    public getGlobalDebugText(): string | undefined {
        return `Expand with MCV ${this.selectedMcvId}`;
    }

    public getPriority() {
        return this.priority;
    }
}

function findDeployableLocations(playerName: string, gameApi: GameApi, rectangle: Rectangle, rules: string) {
    const tiles = gameApi.map.getTilesInRect(rectangle);
    const { foundation, foundationCenter } = gameApi.getBuildingPlacementData(rules);

    if (foundation.width !== foundation.height) {
        throw new Error("only implemented for square foundations");
    }

    const grid: number[][] = new Array(rectangle.width).fill(() => 0).map(() => new Array(rectangle.height).fill(0));

    // fill tiles that are not buildable
    for (const tile of tiles) {
        const gridX = tile.rx - rectangle.x;
        const gridY = tile.ry - rectangle.y;
        if (canBuildOnTile(tile, gameApi)) {
            grid[gridX][gridY] = 1;
        }
    }

    // we have to start from the bottom-right and calculate backwards
    for (let x = rectangle.width - 2; x >= 0; --x) {
        for (let y = rectangle.height - 2; y >= 0; --y) {
            if (grid[x][y] === 0) {
                continue;
            }
            const right = x < rectangle.width - 1 ? grid[x + 1][y] : 0;
            const bottom = y < rectangle.height - 1 ? grid[y][y + 1] : 0;
            grid[x][y] = Math.min(right + 1, bottom + 1);
        }
    }

    const locations: Vector2[] = [];

    for (const tile of tiles) {
        const gridX = tile.rx - rectangle.x;
        const gridY = tile.ry - rectangle.y;
        if (grid[gridX][gridY] >= foundation.width && grid[gridX][gridY] >= foundation.height) {
            locations.push(toVector2(tile).add(foundationCenter));
        }
    }

    return locations;
}

export class PackConyardMission extends Mission {
    constructor(
        uniqueName: string,
        private conyardId: number,
        logger: DebugLogger,
    ) {
        super(uniqueName, logger);
    }

    public _onAiUpdate(context: MissionContext): MissionAction {
        const { game } = context;
        const actionsApi = context.player.actions;
        const conyardOrMcv = game.getGameObjectData(this.conyardId);
        if (!conyardOrMcv) {
            // maybe it died, or unpacked already
            return disbandMission();
        }
        actionsApi.orderUnits([this.conyardId], OrderType.Move, conyardOrMcv.tile.rx, conyardOrMcv.tile.ry);
        return noop();
    }

    public getGlobalDebugText(): string | undefined {
        return `Pack conyard ${this.conyardId}`;
    }

    public getPriority() {
        return 10000;
    }
}

const CONYARD_PACK_COOLDOWN = 15 * 60 * 6; // 6 mins
const DO_NOT_EXPAND_BEFORE_TICKS = 15 * 60 * 6; // 6 minutes

export class ExpansionMissionFactory {
    constructor(private lastConyardPackAt = Number.MIN_VALUE) {}
    getName(): string {
        return "ExpansionMissionFactory";
    }

    maybeCreateMissions(context: SupabotContext, missionController: MissionController, logger: DebugLogger): void {
        const { game, player, matchAwareness } = context;
        const playerData = game.getPlayerData(player.name);
        const mcvs = game.getVisibleUnits(player.name, "self", (r) => game.getGeneralRules().baseUnit.includes(r.name));
        const expandToCandidates = matchAwareness.getNextExpansionCandidates();

        // This is used for deploying the initial MCV.
        if (game.getCurrentTick() < DO_NOT_EXPAND_BEFORE_TICKS) {
            mcvs.forEach((mcv) => {
                missionController.addMission(
                    new ExpansionMission("initial-deploy-mcv-" + mcv, 100, mcv, [playerData.startLocation], logger),
                );
            });
        } else if (expandToCandidates.length > 0) {
            mcvs.forEach((mcv) => {
                missionController.addMission(
                    new ExpansionMission("expansion-mcv-" + mcv, 100, mcv, expandToCandidates, logger),
                );
            });
        }

        const threatCache = matchAwareness.getThreatCache();
        if (!expandToCandidates[0] || !threatCache) {
            return;
        }

        if (
            game.getCurrentTick() < DO_NOT_EXPAND_BEFORE_TICKS ||
            game.getCurrentTick() < this.lastConyardPackAt + CONYARD_PACK_COOLDOWN
        ) {
            return;
        }
        // TODO: do not pack up if currently producing something from the conyard

        // if we have a war factory and at least 1 refinery, try expand
        const conYards = game.getVisibleUnits(player.name, "self", (r) => r.constructionYard);
        const warFactories = game.getVisibleUnits(player.name, "self", (r) => r.weaponsFactory);
        const isSafeToExpand = threatCache.totalAvailableAntiGroundFirepower > threatCache.totalOffensiveLandThreat;
        const refineries = game.getVisibleUnits(player.name, "self", (r) => r.refinery);
        if (conYards.length === 0 || warFactories.length === 0 || refineries.length === 0 || !isSafeToExpand) {
            return;
        }
        const selectedConyard = game.getGameObjectData(conYards[0])!;
        const refineryNearconyard = game
            .getUnitsInArea(
                new Box2(toVector2(selectedConyard.tile).subScalar(10), toVector2(selectedConyard.tile).addScalar(14)),
            )
            .map((id) => game.getGameObjectData(id))
            .filter(isTechnoRulesObject)
            .filter((obj) => obj.rules.refinery);
        if (refineryNearconyard.length > 0) {
            missionController.addMission(
                new PackConyardMission("pack-up-" + selectedConyard.id, selectedConyard.id, logger),
            );
            logger("Time to pack the conyard and expand", false);
            this.lastConyardPackAt = game.getCurrentTick();
        } else {
            logger("Not time to pack up, no refinery yet");
        }
    }
}
