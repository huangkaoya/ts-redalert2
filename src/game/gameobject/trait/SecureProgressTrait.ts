import { GameSpeed } from '@/game/GameSpeed';
import { clamp, fnv32a } from '@/util/math';
import { BuildingCaptureEvent } from '@/game/event/BuildingCaptureEvent';
import { NotifyTick } from '@/game/gameobject/trait/interface/NotifyTick';
import { NotifyOwnerChange } from '@/game/gameobject/trait/interface/NotifyOwnerChange';
import { Timer } from '@/game/gameobject/unit/Timer';

export class SecureProgressTrait {
    timer: Timer;
    secureTicks: number;
    securingPlayer: any;

    constructor(minutes = 0) {
        this.timer = new Timer();
        this.secureTicks = Math.max(
            0,
            Math.round(60 * minutes * GameSpeed.BASE_TICKS_PER_SECOND),
        );
    }

    isActive(): boolean {
        return !!this.securingPlayer && this.timer.isActive();
    }

    getSecuringPlayer(): any {
        return this.securingPlayer;
    }

    getProgress(): number {
        return this.isActive()
            ? clamp(1 - this.timer.getTicksLeft() / this.timer.getInitialTicks(), 0, 1)
            : 0;
    }

    isActiveFrom(player: any): boolean {
        return this.isActive() && this.securingPlayer === player;
    }

    start(object: any, player: any): boolean {
        if (
            !object.owner.isNeutral ||
            object.isDestroyed ||
            this.isActiveFrom(player) ||
            this.secureTicks <= 0
        ) {
            return false;
        }
        this.securingPlayer = player;
        this.timer.setActiveFor(this.secureTicks);
        return true;
    }

    reset(): void {
        this.securingPlayer = undefined;
        this.timer.reset();
    }

    [NotifyTick.onTick](object: any, game: any): void {
        if (!this.isActive()) {
            return;
        }
        if (!object.owner.isNeutral || object.isDestroyed || this.securingPlayer?.defeated) {
            this.reset();
            return;
        }
        if (this.timer.tick(game.currentTick)) {
            const player = this.securingPlayer;
            this.reset();
            player.buildingsCaptured++;
            game.changeObjectOwner(object, player);
            game.events.dispatch(new BuildingCaptureEvent(object));
        }
    }

    [NotifyOwnerChange.onChange](): void {
        this.reset();
    }

    getHash(): number {
        return fnv32a([
            this.isActive() ? 1 : 0,
            this.timer.getTicksLeft(),
            this.timer.getInitialTicks(),
            this.securingPlayer?.color.asHex() ?? 0,
        ]);
    }

    debugGetState(): {
        active: boolean;
        securingPlayer: string | undefined;
        ticksLeft: number;
        totalTicks: number;
    } {
        return {
            active: this.isActive(),
            securingPlayer: this.securingPlayer?.name,
            ticksLeft: this.timer.getTicksLeft(),
            totalTicks: this.timer.getInitialTicks(),
        };
    }
}
