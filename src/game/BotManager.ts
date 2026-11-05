import { CompositeDisposable } from '../util/disposable/CompositeDisposable';
import { AppLogger } from '@/util/logger';
import { ActionQueue } from './action/ActionQueue';
import { ActionsApi } from './api/ActionsApi';
import { EventsApi } from './api/EventsApi';
import { GameApi } from './api/GameApi';
import { LoggerApi } from './api/LoggerApi';
import { ProductionApi } from './api/ProductionApi';
import { PlayerApi } from './api/PlayerApi';
import { BotContext } from './bot/BotContext';

export class BotManager {
    private actionFactory: any;
    private actionQueue: ActionQueue;
    private botFactory: any;
    private botDebugIndex: any;
    private actionLogger: any;
    private bots: Map<any, any>;
    private disposables: CompositeDisposable;
    private gameApi?: GameApi;

    static factory(actionFactory: any, botFactory: any, botDebugIndex: any, actionLogger: any): BotManager {
        return new this(actionFactory, new ActionQueue(), botFactory, botDebugIndex, actionLogger);
    }

    constructor(
        actionFactory: any,
        actionQueue: ActionQueue,
        botFactory: any,
        botDebugIndex: any,
        actionLogger: any,
    ) {
        this.actionFactory = actionFactory;
        this.actionQueue = actionQueue;
        this.botFactory = botFactory;
        this.botDebugIndex = botDebugIndex;
        this.actionLogger = actionLogger;
        this.bots = new Map();
        this.disposables = new CompositeDisposable();
    }

    init(game: any): void {
        this.gameApi = new GameApi(game, true);
        const eventsApi = new EventsApi(game.events);
        for (const combatant of game.getCombatants().filter((c: any) => c.isAi)) {
            this.bots.set(combatant, this.botFactory.create(combatant));
        }
        this.updateDebugBotIndex(this.botDebugIndex.value, game);
        const debugIndexHandler = (index: number) => this.updateDebugBotIndex(index, game);
        this.botDebugIndex.onChange.subscribe(debugIndexHandler);
        this.disposables.add(() => this.botDebugIndex.onChange.unsubscribe(debugIndexHandler));
        eventsApi.subscribe((event: any) =>
            this.bots.forEach((bot) => bot.onGameEvent(event, this.gameApi)),
        );
        this.disposables.add(eventsApi);
        for (const bot of this.bots.values()) {
            const playerApi = new PlayerApi(
                bot.name,
                this.gameApi!,
                new ActionsApi(game, this.actionFactory, this.actionQueue, bot),
                new ProductionApi(game.getPlayerByName(bot.name).production),
            );
            const loggerApi = new LoggerApi(AppLogger.get(bot.name) as any, this.gameApi);
            bot.setGameApi(this.gameApi);
            bot.setActionsApi(playerApi.actions);
            bot.setProductionApi(playerApi.production);
            bot.setLogger(loggerApi);
            bot.setContext?.(new BotContext(this.gameApi, playerApi, loggerApi));
            bot.onGameInit?.(this.gameApi);
        }
    }

    onGameStart(): void {
        if (!this.gameApi) {
            throw new Error('Bot manager is not initialized');
        }
        for (const bot of this.bots.values()) {
            bot.onGameStart(this.gameApi);
        }
    }

    update(gameState: any): void {
        for (const action of this.actionQueue.dequeueAll()) {
            (action as any).process();
            const actionLog = action.print();
            if (actionLog) {
                this.actionLogger.debug(`(${action.player.name})@${gameState.currentTick}: ${actionLog}`);
            }
        }
        for (const combatant of gameState.getCombatants().filter((c: any) => c.isAi)) {
            this.bots.get(combatant).onGameTick(this.gameApi);
        }
    }

    private updateDebugBotIndex(index: number, game: any): void {
        const debugBotName = index > 0 ? game.getAiPlayerName(index) : undefined;
        for (const bot of this.bots.values()) {
            bot.setDebugMode(bot.name === debugBotName);
        }
    }

    dispose(): void {
        this.gameApi = undefined;
        this.bots.clear();
        this.disposables.dispose();
    }
}
