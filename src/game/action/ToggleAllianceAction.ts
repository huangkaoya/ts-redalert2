import { Action } from './Action';
import { Alliances, AllianceStatus } from '../Alliances';
import { AllianceChangeEvent, AllianceEventType } from '../event/AllianceChangeEvent';
import { NotifyAllianceChange } from '../trait/interface/NotifyAllianceChange';
import { ActionType } from './ActionType';
import { Game } from '../Game';
import { Player } from '@/game/Player';
export class ToggleAllianceAction extends Action {
    private game: Game;
    private toPlayer: Player;
    private toggle: boolean;
    constructor(game: Game) {
        super(ActionType.ToggleAlliance);
        this.game = game;
    }
    static decodePayload(data: Uint8Array): { playerId: number; toggle: boolean } {
        return {
            playerId: data[0],
            toggle: Boolean(data[1]),
        };
    }
    static encodePayload(payload: { playerId: number; toggle: boolean }): Uint8Array {
        return new Uint8Array([payload.playerId, Number(payload.toggle)]);
    }
    unserialize(data: Uint8Array): void {
        const payload = ToggleAllianceAction.decodePayload(data);
        this.toPlayer = this.game.getPlayer(payload.playerId);
        this.toggle = payload.toggle;
    }
    serialize(): Uint8Array {
        return ToggleAllianceAction.encodePayload({
            playerId: this.game.getPlayerNumber(this.toPlayer),
            toggle: this.toggle,
        });
    }
    print(): string {
        return `Toggle alliance ${this.toggle ? "on" : "off"} with ${this.toPlayer.name}`;
    }
    process(): void {
        const mpSettings = this.game.rules.mpDialogSettings;
        if (!mpSettings.alliesAllowed || !mpSettings.allyChangeAllowed) {
            return;
        }
        const player = this.player;
        const targetPlayer = this.toPlayer;
        const toggle = this.toggle;
        const alliances = this.game.alliances;
        if (player.defeated || !alliances.canRequestAlliance(targetPlayer)) {
            return;
        }
        const alliance = alliances.findByPlayers(player, targetPlayer);
        if (alliance) {
            if (alliance.status === AllianceStatus.Formed) {
                if (!toggle) {
                    alliances.breakAlliance(player, targetPlayer);
                    this.game.onAllianceChange(alliance, player, false);
                }
            }
            else if (alliance.status === AllianceStatus.Requested) {
                if (alliance.players.first === targetPlayer) {
                    if (toggle && alliances.canFormAlliance(player, targetPlayer)) {
                        alliances.acceptRequest(targetPlayer, player);
                        this.game.onAllianceChange(alliance, player, true);
                        const remainingCombatants = this.game.getCombatants()
                            .filter(p => p !== player && !alliances.areAllied(player, p));
                        if (remainingCombatants.length === 1) {
                            const remainingAlliance = alliances.findByPlayers(remainingCombatants[0], player);
                            if (remainingAlliance) {
                                alliances.cancelRequest(remainingAlliance.players.first, remainingAlliance.players.second);
                            }
                        }
                        const targetRemainingCombatants = this.game.getCombatants()
                            .filter(p => p !== targetPlayer && !alliances.areAllied(targetPlayer, p));
                        if (targetRemainingCombatants.length === 1) {
                            const targetRemainingAlliance = alliances.findByPlayers(targetRemainingCombatants[0], targetPlayer);
                            if (targetRemainingAlliance) {
                                alliances.cancelRequest(targetRemainingAlliance.players.first, targetRemainingAlliance.players.second);
                            }
                        }
                    }
                }
                else if (!toggle) {
                    alliances.cancelRequest(player, targetPlayer);
                    this.game.events.dispatch(new AllianceChangeEvent(alliance, AllianceEventType.Broken, player));
                    this.game.traits
                        .filter(NotifyAllianceChange)
                        .forEach(trait => {
                        trait[NotifyAllianceChange.onChange](alliance, false, this.game);
                    });
                }
            }
        }
        else if (toggle && alliances.canFormAlliance(player, targetPlayer)) {
            const newAlliance = alliances.request(player, targetPlayer);
            if (newAlliance) {
                this.game.events.dispatch(new AllianceChangeEvent(newAlliance, AllianceEventType.Requested, player));
            }
        }
    }
}
