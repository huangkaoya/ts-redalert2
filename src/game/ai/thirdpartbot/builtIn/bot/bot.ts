import { ApiEventType, Bot, GameApi, ApiEvent, ObjectType, FactoryType, QueueType, OrderType } from "../game-api";

import { MissionController } from "./logic/mission/missionController";
import { QueueController } from "./logic/building/queueController";
import { MatchAwareness, MatchAwarenessImpl } from "./logic/awareness";
import { Countries, formatTimeDuration } from "./logic/common/utils";
import { IncrementalGridCache } from "./logic/map/incrementalGridCache";
import { SupabotContext } from "./logic/common/context";
import { Strategy } from "./strategy/strategy";
import { DefaultStrategy } from "./strategy/defaultStrategy";
import { BaseBuildingMission } from "./logic/mission/missions/baseBuildingMission";

const DEBUG_STATE_UPDATE_INTERVAL_SECONDS = 6;

const DEBUG_MESSAGES_BUFFER_LENGTH = 20;

// Number of ticks per second at the base speed.
const NATURAL_TICK_RATE = 15;

export class BuiltInBot extends Bot {
    private tickRatio?: number;
    private queueController: QueueController;
    private tickOfLastAttackOrder: number = 0;
    private lastDeployAttemptTick: number = -9999;
    private deployAttemptCount: number = 0;

    private missionController: MissionController | null = null;
    private matchAwareness: MatchAwareness | null = null;

    // Messages to display in visualisation mode only.
    public _debugMessages: string[] = [];
    public _globalDebugText: string = "";
    public _debugGridCaches: { grid: IncrementalGridCache<any>; tag: string }[] = [];

    constructor(
        name: string,
        country: Countries,
        private tryAllyWith: string[] = [],
        private enableLogging = true,
        private strategy: Strategy = new DefaultStrategy(),
    ) {
        super(name, country);
        this.queueController = new QueueController();
    }

    override onGameStart(game: GameApi) {
        const gameRate = game.getTickRate();
        const botApm = 300;
        const botRate = botApm / 60;
        this.tickRatio = Math.ceil(gameRate / botRate);

        const myPlayer = game.getPlayerData(this.name);

        if (!myPlayer.country) {
            throw new Error(`Player ${this.name} has no country`);
        }
        this.missionController = new MissionController((message, sayInGame) => this.logBotStatus(message, sayInGame));

        // TODO: Strategy should have an onGameStart call which sets up the initial missions.
        this.missionController.addMission(
            new BaseBuildingMission(QueueType.Structures, (message, sayInGame) =>
                this.logBotStatus(message, sayInGame),
            ),
        );
        this.missionController.addMission(
            new BaseBuildingMission(QueueType.Armory, (message, sayInGame) => this.logBotStatus(message, sayInGame)),
        );

        this.matchAwareness = new MatchAwarenessImpl(
            game,
            myPlayer,
            null,
            myPlayer.startLocation,
            (message, sayInGame) => this.logBotStatus(message, sayInGame),
        );

        this._debugGridCaches = [
            { grid: this.matchAwareness.getSectorCache(), tag: "sector-cache" },
            { grid: this.matchAwareness.getBuildSpaceCache()._cache, tag: "build-cache" },
        ];

        this.matchAwareness.onGameStart(game, myPlayer);

        this.tryAllyWith
            .filter((playerName) => playerName !== this.name)
            .forEach((playerName) => this.actionsApi.toggleAlliance(playerName, true));
    }

    override onGameTick(game: GameApi) {
        if (!this.matchAwareness || !this.missionController || !this.strategy) {
            if (game.getCurrentTick() % 150 === 0) {
                console.warn(`[BuiltInBot] "${this.name}" tick skipped: awareness=${!!this.matchAwareness} missions=${!!this.missionController} strategy=${!!this.strategy}`);
            }
            return;
        }

        // Periodic heartbeat log
        if (game.getCurrentTick() % 300 === 0) {
            const myPlayer = game.getPlayerData(this.name);
            const conYards = game.getVisibleUnits(this.name, 'self', (r) => r.constructionYard);
            const allUnits = game.getVisibleUnits(this.name, 'self');
            console.log(`[BuiltInBot] "${this.name}" tick=${game.getCurrentTick()} credits=${myPlayer.credits} units=${allUnits.length} conyards=${conYards.length}`);
        }

        let threatCache = this.matchAwareness.getThreatCache();

        if ((game.getCurrentTick() / NATURAL_TICK_RATE) % DEBUG_STATE_UPDATE_INTERVAL_SECONDS === 0) {
            this.updateDebugState(game);
        }

        if (game.getCurrentTick() % this.tickRatio! === 0) {
            this.tryInitialMcvDeploy(game);

            try {
                this.matchAwareness.onAiUpdate(this.context);
                threatCache = this.matchAwareness.getThreatCache();
            } catch (err) {
                this.logger?.error?.("BuiltIn awareness update failed", err);
            }

            const fullContext: SupabotContext = {
                ...this.context,
                matchAwareness: this.matchAwareness,
            };

            // hacky resign condition
            const armyUnits = game.getVisibleUnits(this.name, "self", (r) => r.isSelectableCombatant);
            const mcvUnits = game.getVisibleUnits(
                this.name,
                "self",
                (r) => !!r.deploysInto && game.getGeneralRules().baseUnit.includes(r.name),
            );
            const productionBuildings = game.getVisibleUnits(
                this.name,
                "self",
                (r) => r.type == ObjectType.Building && r.factory != FactoryType.None,
            );
            if (armyUnits.length == 0 && productionBuildings.length == 0 && mcvUnits.length == 0) {
                this.logBotStatus(`No army or production left, quitting.`);
                this.context.player.actions.quitGame();
            }

            // Mission/strategy logic every 3 ticks.
            if (this.context.game.getCurrentTick() % 3 === 0) {
                this.missionController.onAiUpdate(fullContext);
                this.strategy = this.strategy.onAiUpdate(fullContext, this.missionController, (message, sayInGame) =>
                    this.logBotStatus(message, sayInGame),
                );
            }

            const unitTypeRequests = this.missionController.getRequestedUnitTypes();

            // Queue-controller logic.
            this.queueController.onAiUpdate(fullContext, threatCache, unitTypeRequests, (message) =>
                this.logBotStatus(message),
            );
        }
    }

    private tryInitialMcvDeploy(game: GameApi): void {
        const hasConyard = game.getVisibleUnits(this.name, "self", (r) => r.constructionYard).length > 0;
        if (hasConyard) {
            this.deployAttemptCount = 0;
            return;
        }

        if (game.getCurrentTick() < this.lastDeployAttemptTick + 30) {
            return;
        }

        const mcvUnits = game.getVisibleUnits(
            this.name,
            "self",
            (r) => !!r.deploysInto && game.getGeneralRules().baseUnit.includes(r.name),
        );

        if (mcvUnits.length === 0) {
            return;
        }

        this.deployAttemptCount++;

        if (this.deployAttemptCount > 5) {
            // Deploy keeps failing — current position is blocked, find a clear spot
            const mcvData = game.getUnitData(mcvUnits[0]);
            if (mcvData?.tile && mcvData.rules?.deploysInto) {
                const cx = mcvData.tile.rx;
                const cy = mcvData.tile.ry;
                for (let radius = 2; radius <= 10; radius++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        for (let dy = -radius; dy <= radius; dy++) {
                            if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                            try {
                                if (game.canPlaceBuilding(this.name, mcvData.rules.deploysInto, { rx: cx + dx, ry: cy + dy })) {
                                    this.actionsApi.orderUnits([mcvUnits[0]], OrderType.Move, cx + dx, cy + dy);
                                    this.deployAttemptCount = 0;
                                    this.lastDeployAttemptTick = game.getCurrentTick();
                                    return;
                                }
                            } catch (_e) { /* skip */ }
                        }
                    }
                }
            }
            // Nothing found, scatter
            this.actionsApi.orderUnits([mcvUnits[0]], OrderType.Scatter);
            this.deployAttemptCount = 0;
        } else {
            this.actionsApi.orderUnits([mcvUnits[0]], OrderType.DeploySelected);
        }
        this.lastDeployAttemptTick = game.getCurrentTick();
    }

    private getHumanTimestamp(game: GameApi) {
        return formatTimeDuration(game.getCurrentTick() / NATURAL_TICK_RATE);
    }

    private logBotStatus(message: string, sayInGame: boolean = false) {
        if (!this.enableLogging) {
            return;
        }
        this.logger.info(message);
        const timestamp = this.getHumanTimestamp(this.gameApi);
        if (sayInGame) {
            this.actionsApi.sayAll(`${timestamp}: ${message}`);
        }
        this.pushDebugMessage(`${timestamp}: ${message}`);
    }

    private updateDebugState(game: GameApi) {
        if (!this.getDebugMode() || !this.missionController) {
            return;
        }
        // Update the global debug text.
        const myPlayer = game.getPlayerData(this.name);
        const harvesters = game.getVisibleUnits(this.name, "self", (r) => r.harvester).length;

        let globalDebugText = `Cash: ${myPlayer.credits} | Harvesters: ${harvesters}\n`;
        globalDebugText += this.queueController.getGlobalDebugText(this.gameApi, this.productionApi);
        globalDebugText += this.missionController.getGlobalDebugText(this.gameApi);
        globalDebugText += this.matchAwareness?.getGlobalDebugText();

        this.missionController.updateDebugText(this.actionsApi);

        // Tag enemy units with IDs
        game.getVisibleUnits(this.name, "enemy").forEach((unitId) => {
            this.actionsApi.setUnitDebugText(unitId, unitId.toString());
        });

        this.actionsApi.setGlobalDebugText(globalDebugText);
        this._globalDebugText = globalDebugText;
    }

    override onGameEvent(ev: ApiEvent, _gameApi?: GameApi) {
        switch (ev.type) {
            case ApiEventType.ObjectDestroy: {
                // Add to the stalemate detection.
                if (ev.attackerInfo?.playerName == this.name) {
                    this.tickOfLastAttackOrder += (this.gameApi.getCurrentTick() - this.tickOfLastAttackOrder) / 2;
                }
                break;
            }
            default:
                break;
        }
    }

    protected pushDebugMessage(message: string) {
        if (this._debugMessages.length + 1 > DEBUG_MESSAGES_BUFFER_LENGTH) {
            this._debugMessages.shift();
        }
        this._debugMessages.push(message);
    }
}
