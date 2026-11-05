import { Bot } from '../../../bot/Bot';
import { BuiltInBot } from './bot/bot';
import { BotRegistry } from '../BotRegistry';
import { Countries } from './bot/logic/common/utils';
import { ObjectType } from '@/engine/type/ObjectType';
import { QueueType, QueueStatus } from '@/game/player/production/ProductionQueue';
import { OrderType } from '@/game/order/OrderType';

/**
 * BuiltInBotAdapter — wraps the real BuiltInBot.
 * Delegates all lifecycle methods to the underlying BuiltInBot instance.
 *
 * Source: https://github.com/Supalosa/supalosa-chronodivide-bot
 */
export class BuiltInBotAdapter extends Bot {
    private innerBot: BuiltInBot;
    private failSafePendingBuildingType: string | null = null;
    private lastFailSafeDeployTick: number = -9999;
    private failSafeDeployAttempts: number = 0;

    private static readonly ALLIED_COUNTRIES = [
        'Americans', 'British', 'French', 'Germans', 'Koreans', 'Alliance',
    ];

    private static readonly FAIL_SAFE_BUILD_ORDER_ALLIED = ['GAPOWR', 'GAREFN', 'GAPILE', 'GAWEAP'];
    private static readonly FAIL_SAFE_BUILD_ORDER_SOVIET = ['NAPOWR', 'NAREFN', 'NAHAND', 'NAWEAP'];

    constructor(name: string, country: string) {
        super(name, country);
        this.innerBot = new BuiltInBot(name, country as Countries);
    }

    override setContext(context: any): void {
        super.setContext(context);
        this.innerBot.setContext(context);
    }

    override setDebugMode(debug: boolean): Bot {
        super.setDebugMode(debug);
        this.innerBot.setDebugMode(debug);
        return this;
    }

    override onGameStart(event: any): void {
        console.log(`[BuiltInBotAdapter] onGameStart called for "${this.name}" country="${this.country}"`);
        try {
            this.innerBot.onGameStart(event);
            console.log(`[BuiltInBotAdapter] onGameStart completed for "${this.name}"`);
        } catch (e) {
            console.error(`[BuiltInBotAdapter] onGameStart FAILED for "${this.name}":`, e);
            throw e;
        }
    }

    override onGameTick(event: any): void {
        try {
            this.innerBot.onGameTick(event);
        } catch (e) {
            this.logger?.error?.('BuiltInBot tick error:', e);
            console.error(`[BuiltInBotAdapter] tick error for "${this.name}":`, e);
            // Keep the AI alive even if the imported bot throws.
            this.runFailSafeTick(event);
            return;
        }
        // Non-invasive safety net for "AI stands still" scenarios.
        this.runFailSafeTick(event);
    }

    override onGameEvent(event: any, gameApi?: any): void {
        try {
            this.innerBot.onGameEvent(event, gameApi);
        } catch (e) {
            this.logger?.error?.('BuiltInBot event error:', e);
        }
    }

    private runFailSafeTick(gameApi: any): void {
        if (!this.productionApi || !this.actionsApi || !gameApi) {
            if (gameApi?.getCurrentTick?.() % 150 === 0) {
                console.warn(`[BuiltInBotAdapter] "${this.name}" failsafe skipped: productionApi=${!!this.productionApi} actionsApi=${!!this.actionsApi} gameApi=${!!gameApi}`);
            }
            return;
        }

        // Keep fallback low-frequency to reduce interference with normal logic.
        if (gameApi.getCurrentTick() % 15 !== 0) {
            return;
        }

        const conYards = gameApi.getVisibleUnits(this.name, 'self', (r: any) => r.constructionYard);
        if (conYards.length === 0) {
            if (gameApi.getCurrentTick() < this.lastFailSafeDeployTick + 30) {
                return;
            }
            const mcvs = gameApi.getVisibleUnits(
                this.name,
                'self',
                (r: any) => !!r.deploysInto && gameApi.getGeneralRules().baseUnit.includes(r.name),
            );
            if (mcvs.length > 0) {
                this.failSafeDeployAttempts++;
                if (this.failSafeDeployAttempts > 5) {
                    // Deploy keeps failing — find a clear spot nearby and move there
                    const mcvData = gameApi.getUnitData(mcvs[0]);
                    if (mcvData?.tile && mcvData.rules?.deploysInto) {
                        const cx = mcvData.tile.rx;
                        const cy = mcvData.tile.ry;
                        let found = false;
                        for (let radius = 2; radius <= 10 && !found; radius++) {
                            for (let dx = -radius; dx <= radius && !found; dx++) {
                                for (let dy = -radius; dy <= radius && !found; dy++) {
                                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
                                    const tx = cx + dx;
                                    const ty = cy + dy;
                                    try {
                                        if (gameApi.canPlaceBuilding(this.name, mcvData.rules.deploysInto, { rx: tx, ry: ty })) {
                                            this.actionsApi.orderUnits([mcvs[0]], OrderType.Move, tx, ty);
                                            this.failSafeDeployAttempts = 0;
                                            found = true;
                                        }
                                    } catch (_e) { /* skip */ }
                                }
                            }
                        }
                        if (!found) {
                            // No valid spot, scatter and reset
                            this.actionsApi.orderUnits([mcvs[0]], OrderType.Scatter);
                            this.failSafeDeployAttempts = 0;
                        }
                    }
                } else {
                    this.actionsApi.orderUnits([mcvs[0]], OrderType.DeploySelected);
                }
                this.lastFailSafeDeployTick = gameApi.getCurrentTick();
            }
            return;
        }
        // Conyard exists, reset deploy attempts
        this.failSafeDeployAttempts = 0;

        const queueData = this.productionApi.getQueueData(QueueType.Structures);

        if (queueData.status === QueueStatus.OnHold) {
            this.actionsApi.resumeProduction(QueueType.Structures);
        }

        if (queueData.status === QueueStatus.Ready && queueData.items.length > 0) {
            const readyType = queueData.items[0]?.rules?.name || this.failSafePendingBuildingType;
            if (readyType) {
                this.tryPlaceBuildingNearConyard(gameApi, readyType);
            }
            return;
        }

        const queueHasItems = Array.isArray(queueData.items) && queueData.items.length > 0;
        if (
            queueHasItems &&
            queueData.status !== QueueStatus.Idle &&
            queueData.status !== QueueStatus.OnHold
        ) {
            return;
        }

        const available = this.productionApi
            .getAvailableObjects(QueueType.Structures)
            .map((o: any) => o.name);
        if (available.length === 0) {
            return;
        }

        const buildOrder = this.isAlliedCountry(this.country)
            ? BuiltInBotAdapter.FAIL_SAFE_BUILD_ORDER_ALLIED
            : BuiltInBotAdapter.FAIL_SAFE_BUILD_ORDER_SOVIET;

        const ownedBuildingNames = new Set(
            gameApi
                .getVisibleUnits(this.name, 'self', (r: any) => r.type === ObjectType.Building)
                .map((id: any) => gameApi.getGameObjectData(id)?.name)
                .filter((n: any) => !!n),
        );

        let nextBuild = buildOrder.find((name) => {
            if (!available.includes(name)) {
                return false;
            }
            // Allow building extra power if needed.
            if (name.endsWith('POWR')) {
                return true;
            }
            return !ownedBuildingNames.has(name);
        });

        // If predefined order is unavailable for this ruleset/mod, build any available structure to avoid deadlock.
        if (!nextBuild) {
            nextBuild = available[0];
        }

        if (nextBuild) {
            try {
                this.actionsApi.queueForProduction(QueueType.Structures, nextBuild, ObjectType.Building, 1);
                this.failSafePendingBuildingType = nextBuild;
            } catch (err) {
                this.logger?.error?.('BuiltIn fail-safe queueForProduction failed', nextBuild, err);
            }
        }
    }

    private tryPlaceBuildingNearConyard(gameApi: any, buildingType: string): void {
        const conYards = gameApi.getVisibleUnits(this.name, 'self', (r: any) => r.constructionYard);
        if (conYards.length === 0) {
            return;
        }

        const conYardData = gameApi.getUnitData(conYards[0]);
        if (!conYardData?.tile) {
            return;
        }

        const cx = conYardData.tile.rx;
        const cy = conYardData.tile.ry;

        for (let radius = 3; radius <= 15; radius++) {
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) {
                        continue;
                    }
                    const tx = cx + dx;
                    const ty = cy + dy;
                    try {
                        if (gameApi.canPlaceBuilding(this.name, buildingType, { rx: tx, ry: ty })) {
                            this.actionsApi.placeBuilding(buildingType, tx, ty);
                            this.failSafePendingBuildingType = null;
                            return;
                        }
                    } catch (_e) {
                        // Keep scanning nearby tiles.
                    }
                }
            }
        }

        this.logger?.info?.(`BuiltIn fail-safe could not place ${buildingType} near conyard`);
    }

    private isAlliedCountry(countryName: string): boolean {
        const c = (countryName || '').toLowerCase();
        return BuiltInBotAdapter.ALLIED_COUNTRIES.some((name) => name.toLowerCase() === c);
    }
}

/**
 * Register BuiltInBot as a built-in third-party bot.
 */
export function registerBuiltInBot(): void {
    BotRegistry.getInstance().register({
        id: 'builtIn-bot',
        displayName: 'AI-普通 (BuiltIn)',
        version: '0.6.1',
        author: 'BuiltIn',
        description: 'Normal difficulty AI. Full strategy system with missions, threat analysis, and build prioritization.',
        factory: (name: string, country: string) => {
            const bot = new BuiltInBotAdapter(name, country);
            return {
                id: 'builtIn-bot',
                displayName: 'AI-普通 (BuiltIn)',
                version: '0.6.1',
                author: 'BuiltIn',
                description: 'Normal difficulty AI',
                onGameStart: (gameApi: any) => bot.onGameStart(gameApi),
                onGameTick: (gameApi: any) => bot.onGameTick(gameApi),
                onGameEvent: (event: any, _data: any) => bot.onGameEvent(event),
            };
        },
        builtIn: true,
    });
}
