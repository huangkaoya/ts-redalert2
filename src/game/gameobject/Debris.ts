import { GameObject } from './GameObject';
import { ObjectType } from '@/engine/type/ObjectType';
import { ZoneType } from './unit/ZoneType';
import { Warhead } from '../Warhead';
import { SpecialWarheadType } from '@/game/SpecialWarheadType';
import { FacingUtil } from './unit/FacingUtil';
import { AnimTerrainEffect } from './common/AnimTerrainEffect';
import { CollisionHelper } from './unit/CollisionHelper';
import { CollisionType } from './unit/CollisionType';
import { Vector3 } from '../math/Vector3';
import { lerp } from '@/util/math';
export class Debris extends GameObject {
    private age: number = 0;
    private direction: number = 0;
    private rotationAxis: Vector3 = new Vector3();
    private angularVelocity: number = 0;
    private zone: ZoneType = ZoneType.Air;
    private velocity: Vector3 = new Vector3();
    private collisionHelper: CollisionHelper;
    private xySpeed: number = 0;
    private zSpeed: number = 0;
    private explodeAnim?: string;
    static factory(rules: any, position: any, tile: any, collisionRules: any): Debris {
        return new this(rules, position, tile, collisionRules);
    }
    constructor(rules: any, position: any, tile: any, collisionRules: any) {
        super(ObjectType.Debris, rules, position, tile);
        this.collisionHelper = new CollisionHelper(collisionRules);
    }
    onSpawn(gameEngine: any): void {
        super.onSpawn(gameEngine);
        this.direction = gameEngine.generateRandomInt(0, 359);
        this.xySpeed = lerp(0, this.rules.maxXYVel, gameEngine.generateRandom());
        this.zSpeed = lerp(this.rules.minZVel, this.rules.maxZVel || 1.5 * this.rules.minZVel, gameEngine.generateRandom());
        this.rotationAxis
            .set(gameEngine.generateRandom(), gameEngine.generateRandom(), gameEngine.generateRandom())
            .normalize();
        this.angularVelocity = lerp(this.rules.minAngularVelocity, this.rules.maxAngularVelocity, gameEngine.generateRandom());
    }
    update(gameContext: any): void {
        super.update(gameContext);
        this.age++;
        if (this.rules.duration && this.age > this.rules.duration) {
            this.velocity.set(0, 0, 0);
            this.detonate(gameContext);
            return;
        }
        this.zSpeed--;
        const xyMovement = FacingUtil.toMapCoords(this.direction).setLength(this.xySpeed);
        const movementVector = new Vector3(xyMovement.x, this.zSpeed, xyMovement.y);
        const previousPosition = this.position.clone();
        const nextWorldPosition = movementVector.clone().add(this.position.worldPosition);
        if (!gameContext.map.isWithinHardBounds(nextWorldPosition)) {
            gameContext.unspawnObject(this);
            return;
        }
        this.position.moveByLeptons3(movementVector);
        let shouldDetonate = false;
        const { type: collisionType, target: collisionTarget } = this.collisionHelper.checkCollisions(this.position, previousPosition, {
            cliffs: true,
            ground: true,
            shore: false,
            walls: true,
            units: false,
        });
        if (collisionType) {
            const isGroundCollision = [
                CollisionType.Ground,
                CollisionType.OnBridge
            ].includes(collisionType);
            const canBounce = isGroundCollision &&
                this.rules.elasticity > 0 &&
                gameContext.map.getTileZone(this.tile) !== ZoneType.Water;
            if (!canBounce || Math.abs(this.zSpeed) < 1) {
                shouldDetonate = true;
            }
            else {
                this.zSpeed = -this.zSpeed * this.rules.elasticity;
                this.velocity.y = -this.velocity.y * this.rules.elasticity;
                this.rotationAxis.negate();
            }
        }
        if (shouldDetonate) {
            this.velocity.set(0, 0, 0);
            if (collisionTarget && collisionType === CollisionType.Wall) {
                const targetWorldPosition = collisionTarget.position.worldPosition;
                this.position.moveByLeptons3(targetWorldPosition.clone().sub(this.position.worldPosition));
            }
            this.detonate(gameContext, collisionType);
        }
        else {
            this.velocity.copy(movementVector);
        }
    }
    private detonate(gameContext: any, collisionType: CollisionType = CollisionType.None): void {
        const warhead = this.rules.warhead ?
            gameContext.rules.getWarhead(this.rules.warhead) : undefined;
        this.zone = this.collisionHelper.computeDetonationZone(this.tile, this.tileElevation, collisionType);
        let animationName: string | undefined;
        if (this.zone === ZoneType.Water) {
            const splashList = gameContext.rules.combatDamage.splashList;
            animationName = splashList[0];
        }
        else if (this.rules.expireAnim && gameContext.rules.animationNames.has(this.rules.expireAnim)) {
            animationName = this.rules.expireAnim;
        }
        this.explodeAnim = animationName;
        const terrainEffect = new AnimTerrainEffect();
        if (animationName) {
            terrainEffect.spawnSmudges(animationName, this.tile, gameContext);
        }
        gameContext.destroyObject(this);
        if (warhead) {
            const warheadInstance = new Warhead(warhead);
            warheadInstance.detonate(gameContext, this.rules.damage, this.tile, this.tileElevation, this.position.worldPosition, this.zone, collisionType, gameContext.createTarget(undefined, this.tile), undefined, SpecialWarheadType.None, undefined, this.rules.damageRadius || undefined, true);
        }
    }
}
