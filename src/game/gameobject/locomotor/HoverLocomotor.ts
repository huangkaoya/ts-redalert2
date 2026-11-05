import { Coords } from "@/game/Coords";
import { FacingUtil } from "@/game/gameobject/unit/FacingUtil";
import { GameSpeed } from "@/game/GameSpeed";
import { angleDegBetweenVec2 } from "@/game/math/geometry";
import { Vector2 } from "@/game/math/Vector2";
import { Vector3 } from "@/game/math/Vector3";
enum WaypointType {
    None = 0,
    Start = 1,
    Normal = 2,
    End = 3,
    Single = 4
}
interface HoverRules {
    acceleration: number;
    brake: number;
}
export class HoverLocomotor {
    private hoverRules: HoverRules;
    private currentSpeed: number;
    private distanceTravelled: number;
    private carryOverDistance: number;
    private currentWaypointType: WaypointType;
    private nextWaypointDir: Vector2;
    private initialPosition?: Vector2;
    private totalDistanceToTravel: number;
    private maxSpeed: number;
    private acceleration: number;
    private deceleration: number;
    constructor(hoverRules: HoverRules) {
        this.hoverRules = hoverRules;
        this.currentSpeed = 0;
        this.distanceTravelled = 0;
        this.carryOverDistance = 0;
        this.currentWaypointType = WaypointType.None;
        this.nextWaypointDir = new Vector2();
    }
    selectNextWaypoint(unit: any, waypoints: any[]): any {
        this.currentWaypointType =
            this.currentWaypointType && this.currentWaypointType !== WaypointType.End
                ? WaypointType.Normal
                : WaypointType.Start;
        this.initialPosition = unit.position.getMapPosition();
        if (this.currentWaypointType === WaypointType.Start) {
            this.currentSpeed = 0;
        }
        if (waypoints.length <= 1) {
            this.currentWaypointType =
                this.currentWaypointType === WaypointType.Start
                    ? WaypointType.Single
                    : WaypointType.End;
            const lastWaypoint = waypoints[waypoints.length - 1];
            if (lastWaypoint) {
                this.nextWaypointDir.set(lastWaypoint.tile.rx - unit.tile.rx, lastWaypoint.tile.ry - unit.tile.ry);
            }
        }
        else {
            const lastWaypoint = waypoints[waypoints.length - 1];
            const secondLastWaypoint = waypoints[waypoints.length - 2];
            this.nextWaypointDir.set(secondLastWaypoint.tile.rx - lastWaypoint.tile.rx, secondLastWaypoint.tile.ry - lastWaypoint.tile.ry);
        }
        return waypoints[waypoints.length - 1];
    }
    onNewWaypoint(unit: any, target: Vector2, waypoints: any[]): void {
        const direction = new Vector2().copy(target).sub(this.initialPosition!);
        this.distanceTravelled = 0;
        this.totalDistanceToTravel = direction.length();
        const maxSpeed = this.maxSpeed = unit.moveTrait.baseSpeed;
        const accelerationTime = 60 * this.hoverRules.acceleration * GameSpeed.BASE_TICKS_PER_SECOND;
        this.acceleration = maxSpeed / accelerationTime;
        const brakeTime = 60 * this.hoverRules.brake * GameSpeed.BASE_TICKS_PER_SECOND;
        this.deceleration = maxSpeed / brakeTime;
    }
    tick(unit: any, target: Vector2): {
        distance: Vector3;
        done: boolean;
    } {
        const currentPos = unit.position.getMapPosition();
        const direction = target.clone().sub(currentPos);
        const distance = direction.length();
        const maxSpeed = this.maxSpeed;
        if (this.currentWaypointType === WaypointType.Single) {
            this.currentSpeed = maxSpeed / 2;
        }
        else if (this.currentWaypointType === WaypointType.End) {
            const brakeDistance = this.computeBrakeDistance(this.currentSpeed, this.deceleration);
            if (this.totalDistanceToTravel - this.distanceTravelled <= brakeDistance) {
                this.currentSpeed = Math.max(1, this.currentSpeed - this.deceleration);
            }
        }
        else {
            this.currentSpeed = Math.min(this.currentSpeed + this.acceleration, maxSpeed);
        }
        const currentFacing = FacingUtil.fromMapCoords(direction);
        const targetFacing = FacingUtil.fromMapCoords(this.nextWaypointDir);
        let desiredFacing = currentFacing;
        let rotationSpeed = unit.rules.rot;
        if (this.currentWaypointType === WaypointType.Normal && currentFacing !== targetFacing) {
            const angleDiff = angleDegBetweenVec2(this.nextWaypointDir, FacingUtil.toMapCoords(unit.direction));
            const turnTime = angleDiff / rotationSpeed;
            const turnDistance = Math.max(this.currentSpeed * turnTime, this.totalDistanceToTravel);
            if (this.totalDistanceToTravel - this.distanceTravelled <= turnDistance) {
                desiredFacing = targetFacing;
                rotationSpeed =
                    angleDiff /
                    ((this.totalDistanceToTravel - this.distanceTravelled) / this.currentSpeed);
            }
        }
        const newFacing = FacingUtil.tick(unit.direction, desiredFacing, rotationSpeed).facing;
        unit.direction = newFacing;
        let moveDistance = this.currentSpeed;
        if (this.carryOverDistance) {
            moveDistance = this.carryOverDistance;
        }
        const actualDistance = Math.min(moveDistance, distance);
        const moveVector = direction.clone().setLength(actualDistance);
        const finalMoveVector = moveVector.clone();
        if (this.carryOverDistance) {
            finalMoveVector.add(Coords.vecWorldToGround(unit.moveTrait.velocity));
        }
        unit.moveTrait.velocity.set(finalMoveVector.x, 0, finalMoveVector.y);
        this.distanceTravelled += actualDistance;
        this.carryOverDistance = Math.max(0, moveDistance - distance);
        return {
            distance: new Vector3(moveVector.x, 0, moveVector.y),
            done: !moveVector.length() || !!this.carryOverDistance
        };
    }
    private computeBrakeDistance(speed: number, deceleration: number): number {
        const time = speed / deceleration;
        return Math.max(0, speed * time - (deceleration * time * time) / 2);
    }
}
