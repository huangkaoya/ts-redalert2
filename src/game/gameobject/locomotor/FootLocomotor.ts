import { FacingUtil } from '@/game/gameobject/unit/FacingUtil';
import { StanceType } from '@/game/gameobject/infantry/StanceType';
import { Vector2 } from '@/game/math/Vector2';
import { Vector3 } from '@/game/math/Vector3';
import { Game } from '@/game/Game';
import { GameObject } from '@/game/gameobject/GameObject';
export class FootLocomotor {
    private game: Game;
    private currentMoveDirection: Vector2;
    private distanceToWaypoint: Vector2;
    private endPauseFrames: number;
    constructor(game: Game) {
        this.game = game;
        this.currentMoveDirection = new Vector2();
        this.distanceToWaypoint = new Vector2();
        this.endPauseFrames = 0;
    }
    onNewWaypoint(obj: GameObject, target: Vector2): void {
        this.currentMoveDirection
            .copy(target)
            .sub(obj.position.getMapPosition());
        const facing = FacingUtil.fromMapCoords(this.currentMoveDirection);
        if (facing !== obj.direction) {
            obj.direction = facing;
        }
        this.endPauseFrames = 1;
    }
    onWaypointUpdate(obj: GameObject, target: Vector2): void {
        this.onNewWaypoint(obj, target);
    }
    tick(obj: GameObject, target: Vector2, currentPos: Vector2): {
        distance: Vector3;
        done: boolean;
    } {
        let speed = obj.moveTrait.baseSpeed;
        speed = Math.floor(speed);
        if (obj.stance === StanceType.Prone) {
            speed *= obj.art.crawls ? 0.5 : 2;
        }
        if (obj.isPanicked) {
            speed *= 2;
        }
        let tileSpeed = this.game.map.terrain.getPassableSpeed(obj.tile, obj.rules.speedType, obj.isInfantry(), obj.onBridge, undefined, true);
        if (tileSpeed) {
            obj.moveTrait.lastTileSpeed = tileSpeed;
        }
        else {
            tileSpeed = obj.moveTrait.lastTileSpeed || 1;
        }
        speed *= tileSpeed;
        speed = Math.floor(speed);
        this.distanceToWaypoint
            .copy(target)
            .sub(obj.position.getMapPosition());
        const moveVector = this.distanceToWaypoint.clone().setLength(speed);
        if (moveVector.length() || target.equals(currentPos)) {
            obj.moveTrait.velocity.set(moveVector.x, 0, moveVector.y);
        }
        const distance = Math.min(this.distanceToWaypoint.length(), speed);
        // 完善模拟层逻辑：`!a && 0 < this.endPauseFrames--` (post-decrement when stopped).
        const isPaused = !distance && 0 < this.endPauseFrames--;
        this.distanceToWaypoint.setLength(distance);
        return {
            distance: new Vector3(this.distanceToWaypoint.x, 0, this.distanceToWaypoint.y),
            done: !this.distanceToWaypoint.length() && !isPaused
        };
    }
}
