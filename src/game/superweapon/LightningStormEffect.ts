import { Coords } from "@/game/Coords";
import { LightningStormCloudEvent } from "@/game/event/LightningStormCloudEvent";
import { LightningStormManifestEvent } from "@/game/event/LightningStormManifestEvent";
import { CollisionType } from "@/game/gameobject/unit/CollisionType";
import { RangeHelper } from "@/game/gameobject/unit/RangeHelper";
import { GameSpeed } from "@/game/GameSpeed";
import { RandomTileFinder } from "@/game/map/tileFinder/RandomTileFinder";
import { Warhead } from "@/game/Warhead";
import { SuperWeaponEffect, TileCoord } from "@/game/superweapon/SuperWeaponEffect";
import { Game } from "@/game/Game";
import { Vector3 } from "@/game/math/Vector3";
import { SpecialWarheadType } from '@/game/SpecialWarheadType';
enum LightningStormState {
    Approaching,
    Manifesting
}
interface Cloud {
    tile: TileCoord;
    durationTicks: number;
    ticksLeft: number;
}
export class LightningStormEffect extends SuperWeaponEffect {
    private state: LightningStormState = LightningStormState.Approaching;
    private clouds: Cloud[] = [];
    private manifestStartTimer: number = 0;
    private manifestEndTimer: number = 0;
    private nextDirectHitTimer: number = 0;
    private nextRandomHitTimer: number = 0;
    onStart(game: Game): void {
        const lightningStorm = game.rules.general.lightningStorm;
        this.manifestStartTimer = lightningStorm.deferment;
        this.manifestEndTimer = lightningStorm.duration;
        this.nextDirectHitTimer = 0;
        this.nextRandomHitTimer = 0;
    }
    onTick(game: Game): boolean {
        if (this.state === LightningStormState.Approaching) {
            if (this.manifestStartTimer > 0) {
                this.manifestStartTimer--;
            }
            else {
                this.state = LightningStormState.Manifesting;
                game.events.dispatch(new LightningStormManifestEvent(this.tile));
            }
        }
        if (this.state === LightningStormState.Manifesting) {
            const lightningStorm = game.rules.general.lightningStorm;
            if (this.manifestEndTimer > 0) {
                this.manifestEndTimer--;
                if (this.nextDirectHitTimer > 0) {
                    this.nextDirectHitTimer--;
                }
                if (this.nextDirectHitTimer <= 0) {
                    this.nextDirectHitTimer = lightningStorm.hitDelay;
                    this.spawnCloudAt(this.tile, game);
                }
                if (this.nextRandomHitTimer > 0) {
                    this.nextRandomHitTimer--;
                }
                if (this.nextRandomHitTimer <= 0) {
                    this.nextRandomHitTimer = lightningStorm.scatterDelay;
                    const radius = Math.floor(lightningStorm.cellSpread / 2);
                    const separation = lightningStorm.separation;
                    const rangeHelper = new RangeHelper(game.map.tileOccupation);
                    const tileFinder = new RandomTileFinder(game.map.tiles, game.map.mapBounds, this.tile, radius, game, (tile) => !this.clouds.some(cloud => rangeHelper.tileDistance(tile, cloud.tile) < separation), false);
                    const randomTile = tileFinder.getNextTile();
                    if (randomTile) {
                        this.spawnCloudAt(randomTile, game);
                    }
                }
            }
            for (const cloud of this.clouds.slice()) {
                if (cloud.ticksLeft > 0) {
                    cloud.ticksLeft--;
                    if (cloud.ticksLeft === Math.floor(cloud.durationTicks / 2)) {
                        const warheadName = lightningStorm.warhead;
                        const warhead = new Warhead(game.rules.getWarhead(warheadName));
                        const tile = cloud.tile;
                        const bridge = game.map.tileOccupation.getBridgeOnTile(tile);
                        const elevation = bridge?.tileElevation ?? 0;
                        const zone = game.map.getTileZone(tile);
                        warhead.detonate(game as any, lightningStorm.damage, tile, elevation, Coords.tile3dToWorld(tile.rx + 0.5, tile.ry + 0.5, tile.z + elevation), zone, bridge ? CollisionType.OnBridge : CollisionType.None, game.createTarget(bridge, tile), { player: this.owner, weapon: undefined } as any, SpecialWarheadType.LightningStrike);
                    }
                }
                else {
                    this.clouds.splice(this.clouds.indexOf(cloud), 1);
                }
            }
            if (!this.clouds.length && this.manifestEndTimer <= 0) {
                return true;
            }
        }
        return false;
    }
    private spawnCloudAt(tile: TileCoord, game: Game): void {
        const clouds = game.rules.audioVisual.weatherConClouds;
        const cloudIndex = game.generateRandomInt(0, clouds.length - 1);
        const animation = game.art.getAnimation(clouds[cloudIndex]);
        const rate = animation.art.getNumber("Rate", 60 * GameSpeed.BASE_TICKS_PER_SECOND) / 60;
        const durationTicks = Math.floor((GameSpeed.BASE_TICKS_PER_SECOND / rate) * 60);
        this.clouds.push({
            tile,
            durationTicks,
            ticksLeft: durationTicks
        });
        const elevation = (game.map.tileOccupation.getBridgeOnTile(tile)?.tileElevation ?? 0) +
            Coords.worldToTileHeight(game.rules.general.flightLevel);
        const position = Coords.tile3dToWorld(tile.rx + 0.5, tile.ry + 0.5, tile.z + elevation);
        game.events.dispatch(new LightningStormCloudEvent(position));
    }
}
