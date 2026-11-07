import { ShpFile } from "@/data/ShpFile";
import { Coords } from "@/game/Coords";
import { WithPosition } from "@/engine/renderable/WithPosition";
import { DebugUtils } from "@/engine/gfx/DebugUtils";
import { MapSpriteTranslation } from "@/engine/renderable/MapSpriteTranslation";
import { ShpRenderable } from "@/engine/renderable/ShpRenderable";
import * as MathUtils from "@/util/math";
import { BridgeOverlayTypes, OverlayBridgeType } from "@/game/map/BridgeOverlayTypes";
import { ObjectType } from "@/engine/type/ObjectType";
import { DeathType } from "@/game/gameobject/common/DeathType";
import { BoxIntersectObject3D } from "@/engine/renderable/entity/BoxIntersectObject3D";
import { MathUtils as EngineMathUtils } from "@/engine/gfx/MathUtils";
import { MapSurface, MAGIC_OFFSET } from "@/engine/renderable/entity/map/MapSurface";
import { wallTypes } from "@/game/map/wallTypes";
import * as THREE from "three";
interface GameObject {
    id: string;
    name: string;
    rules: any;
    art: any;
    tile: any;
    overlayId: number;
    value: number;
    healthTrait?: {
        health: number;
    };
    wallTrait?: any;
    isDestroyed?: boolean;
    deathType?: DeathType;
    isHighBridge(): boolean;
    isBridge(): boolean;
    isTiberium(): boolean;
    isBridgePlaceholder(): boolean;
    isLowBridge(): boolean;
    isXBridge(): boolean;
    getFoundation(): {
        width: number;
        height: number;
    };
    getUiName(): string;
}
interface Rules {
    audioVisual: {
        conditionYellow: number;
        bridgeExplosions: string[];
    };
    getOverlay(name: string): any;
    getOverlayName(id: number): string;
}
interface Art {
    getObject(name: string, type: ObjectType): any;
}
interface ObjectArt {
    lightingType: any;
    hasShadow: boolean;
    flat: boolean;
    getDrawOffset(): THREE.Vector3;
}
interface ImageFinder {
    findByObjectArt(art: ObjectArt): any;
}
interface Palette {
}
interface Camera {
}
interface Lighting {
    compute(lightingType: any, tile: any, offset: number): THREE.Vector3;
}
interface DebugFrame {
    value: boolean;
}
interface MapOverlayLayer {
    shouldBeBatched(gameObject: GameObject): boolean;
    addObject(gameObject: GameObject): void;
    removeObject(gameObject: GameObject): void;
    hasObject(gameObject: GameObject): boolean;
    setObjectFrame(gameObject: GameObject, frame: number): void;
    getObjectFrameCount(gameObject: GameObject): number;
}
interface TransientAnimCreator {
    createTransientAnim(animName: string, callback: (anim: any) => void): void;
}
export class Overlay {
    private gameObject: GameObject;
    private rules: Rules;
    private art: Art;
    private imageFinder: ImageFinder;
    private palette: Palette;
    private camera: Camera;
    private lighting: Lighting;
    private debugFrame: DebugFrame;
    private bridgeImageCache: Map<OverlayBridgeType, ShpFile>;
    private mapOverlayLayer: MapOverlayLayer;
    private useSpriteBatching: boolean;
    private isInvisible: boolean = false;
    private objectRules: any;
    private objectArt: ObjectArt;
    private label: string;
    private withPosition: WithPosition;
    private extraLight: THREE.Vector3;
    private target?: THREE.Object3D;
    private lastOverlayHash?: number;
    private mainRenderable?: ShpRenderable;
    private intersectTarget?: THREE.Object3D;
    constructor(gameObject: GameObject, rules: Rules, art: Art, imageFinder: ImageFinder, palette: Palette, camera: Camera, lighting: Lighting, debugFrame: DebugFrame, bridgeImageCache: Map<OverlayBridgeType, ShpFile>, mapOverlayLayer: MapOverlayLayer, useSpriteBatching: boolean) {
        this.gameObject = gameObject;
        this.rules = rules;
        this.art = art;
        this.imageFinder = imageFinder;
        this.palette = palette;
        this.camera = camera;
        this.lighting = lighting;
        this.debugFrame = debugFrame;
        this.bridgeImageCache = bridgeImageCache;
        this.mapOverlayLayer = mapOverlayLayer;
        this.useSpriteBatching = useSpriteBatching;
        this.objectRules = gameObject.rules;
        this.objectArt = gameObject.art;
        this.label = "overlay_" + this.objectRules.name;
        this.init();
    }
    private init(): void {
        this.withPosition = new WithPosition();
        this.extraLight = new THREE.Vector3();
        this.updateLighting();
    }
    private updateLighting(): void {
        const lightingType = this.objectArt.lightingType;
        this.extraLight
            .copy(this.lighting.compute(lightingType, this.gameObject.tile, this.gameObject.isHighBridge() ? 4 : 0))
            .addScalar(-1);
    }
    get3DObject(): THREE.Object3D | undefined {
        return this.target;
    }
    create3DObject(): void {
        let object3D = this.get3DObject();
        if (!object3D) {
            object3D = new THREE.Object3D();
            object3D.name = this.label;
            object3D.userData.id = this.gameObject.id;
            this.target = object3D;
            object3D.matrixAutoUpdate = false;
            this.withPosition.matrixUpdate = true;
            this.withPosition.applyTo(this);
            this.createObjects(object3D);
        }
    }
    update(deltaTime: number): void {
        if (this.isInvisible)
            return;
        const isDamaged = !!(this.gameObject.healthTrait &&
            this.gameObject.healthTrait.health <=
                100 * this.rules.audioVisual.conditionYellow);
        const overlayHash = 1e5 * this.gameObject.overlayId +
            10 * this.gameObject.value +
            Number(isDamaged);
        if (overlayHash !== this.lastOverlayHash) {
            this.lastOverlayHash = overlayHash;
            const frame = this.computeFrame(isDamaged);
            if (this.mainRenderable) {
                if (frame < this.mainRenderable.frameCount) {
                    this.mainRenderable.setFrame(frame);
                }
            }
            else {
                this.mapOverlayLayer.setObjectFrame(this.gameObject, frame);
            }
        }
    }
    private computeFrame(isDamaged: boolean): number {
        const gameObject = this.gameObject;
        let value = gameObject.value;
        if (gameObject.isBridge()) {
            if (value === 0) {
                value = MathUtils.getRandomInt(0, 3);
            }
        }
        else if (gameObject.wallTrait && isDamaged) {
            const frameCount = this.mainRenderable
                ? this.mainRenderable.frameCount
                : this.mapOverlayLayer.getObjectFrameCount(this.gameObject);
            const wallTypeOffset = frameCount < wallTypes.length ? 1 : wallTypes.length;
            value += wallTypeOffset;
        }
        return value;
    }
    setPosition(position: THREE.Vector3): void {
        this.withPosition.setPosition(position.x, position.y, position.z);
    }
    getPosition(): THREE.Vector3 {
        return this.withPosition.getPosition();
    }
    getIntersectTarget(): THREE.Object3D | undefined {
        return this.intersectTarget;
    }
    getUiName(): string {
        return this.gameObject.getUiName();
    }
    private createObjects(parent: THREE.Object3D): void {
        const foundation = this.gameObject.getFoundation();
        if (this.debugFrame.value) {
            const wireframe = this.createWireframe(foundation, 1);
            parent.add(wireframe);
        }
        if (this.objectRules.isRubble || this.gameObject.isBridgePlaceholder()) {
            this.isInvisible = true;
            return;
        }
        const needsIntersection = this.gameObject.isBridge() ||
            this.gameObject.isTiberium() ||
            this.gameObject.rules.wall;
        if (this.mapOverlayLayer?.shouldBeBatched(this.gameObject)) {
            this.mapOverlayLayer.addObject(this.gameObject);
            if (needsIntersection) {
                const intersectBox = new BoxIntersectObject3D(new THREE.Vector3(1, 0, 1).multiplyScalar(Coords.LEPTONS_PER_TILE));
                intersectBox.position.add(new THREE.Vector3(foundation.width / 2, 0, foundation.height / 2).multiplyScalar(Coords.LEPTONS_PER_TILE));
                intersectBox.matrixAutoUpdate = false;
                intersectBox.updateMatrix();
                parent.add(intersectBox);
                this.intersectTarget = intersectBox;
            }
        }
        else {
            const container = new THREE.Object3D();
            container.matrixAutoUpdate = false;
            const spriteTranslation = new MapSpriteTranslation(foundation.width, foundation.height);
            const { spriteOffset, anchorPointWorld } = spriteTranslation.compute();
            const drawOffset = spriteOffset.clone().add(this.objectArt.getDrawOffset());
            let imageSource: ShpFile;
            if (this.gameObject.isLowBridge()) {
                const bridgeType = BridgeOverlayTypes.getOverlayBridgeType(this.gameObject.overlayId);
                let cachedImage = this.bridgeImageCache.get(bridgeType);
                if (!cachedImage) {
                    cachedImage = this.buildVirtualBridgeFile(bridgeType);
                    this.bridgeImageCache.set(bridgeType, cachedImage);
                }
                imageSource = cachedImage;
            }
            else {
                imageSource = this.imageFinder.findByObjectArt(this.objectArt);
            }
            const mainRenderable = this.mainRenderable = this.createMainObject(imageSource, drawOffset as any);
            mainRenderable.create3DObject();
            container.add(mainRenderable.get3DObject());
            if (needsIntersection && mainRenderable) {
                this.intersectTarget = mainRenderable.getShapeMesh();
            }
            const tileSize = Coords.getWorldTileSize();
            container.position.x = anchorPointWorld.x;
            container.position.z = anchorPointWorld.y;
            const isXBridge = this.gameObject.isXBridge();
            if (this.gameObject.isBridge()) {
                container.position.x += tileSize / 2;
                container.position.z += tileSize / 2;
                container.position.x += isXBridge ? 0 : tileSize;
                container.position.z += isXBridge ? tileSize : 0;
            }
            if (this.gameObject.isHighBridge()) {
                container.position.x -= +Coords.ISO_WORLD_SCALE;
                container.position.z -= +Coords.ISO_WORLD_SCALE;
                container.position.x += tileSize + (isXBridge ? 0.5 * tileSize : 0);
                container.position.z += tileSize + (isXBridge ? 0.5 * tileSize : 0);
                const shadowMesh = mainRenderable.getShadowMesh();
                if (shadowMesh) {
                    EngineMathUtils.translateTowardsCamera(shadowMesh, this.camera as any, (MAGIC_OFFSET + 0.05) * Coords.ISO_WORLD_SCALE);
                    shadowMesh.updateMatrix();
                }
            }
            if (this.gameObject.isBridge()) {
                const renderOrder = this.gameObject.isHighBridge() ? 1 : -1;
                const shapeMesh = mainRenderable.getShapeMesh();
                if (shapeMesh) {
                    (shapeMesh as THREE.Mesh).renderOrder = renderOrder;
                    const mat = (shapeMesh as THREE.Mesh).material as THREE.Material;
                    mat.depthTest = false;
                    mat.depthWrite = false;
                }
                const shadowMesh = mainRenderable.getShadowMesh();
                if (shadowMesh) {
                    (shadowMesh as THREE.Mesh).renderOrder = renderOrder;
                    const smat = (shadowMesh as THREE.Mesh).material as THREE.Material;
                    smat.depthTest = false;
                    smat.depthWrite = false;
                }
            }
            else if (this.gameObject.rules.crate) {
                // Match the overlay batch layer's draw settings when a crate
                // is rendered individually, so water sprites are not hidden
                // by the map surface at the same elevation.
                for (const spriteMesh of [mainRenderable.getShapeMesh(), mainRenderable.getShadowMesh()]) {
                    if (!spriteMesh) {
                        continue;
                    }
                    spriteMesh.renderOrder = -1;
                    const material = (spriteMesh as THREE.Mesh).material as THREE.Material;
                    material.depthTest = false;
                    material.depthWrite = false;
                }
            }
            container.updateMatrix();
            parent.add(container);
        }
    }
    private buildVirtualBridgeFile(bridgeType: OverlayBridgeType): ShpFile {
        const minId = bridgeType === OverlayBridgeType.Concrete
            ? BridgeOverlayTypes.minLowBridgeConcreteId
            : BridgeOverlayTypes.minLowBridgeWoodId;
        const maxId = bridgeType === OverlayBridgeType.Concrete
            ? BridgeOverlayTypes.maxLowBridgeConcreteId
            : BridgeOverlayTypes.maxLowBridgeWoodId;
        const shpFile = new ShpFile();
        shpFile.filename = "agg_" + this.gameObject.name + ".shp";
        for (let id = minId; id <= maxId; id++) {
            const overlay = this.rules.getOverlay(this.rules.getOverlayName(id));
            const objectArt = this.art.getObject(overlay.name, ObjectType.Overlay);
            const imageFile = this.imageFinder.findByObjectArt(objectArt);
            if (!shpFile.width) {
                shpFile.width = imageFile.width;
                shpFile.height = imageFile.height;
            }
            shpFile.addImage(imageFile.getImage(1));
        }
        return shpFile;
    }
    private createBridgeShadowSurface(): THREE.Mesh {
        const foundation = this.gameObject.getFoundation();
        const width = foundation.width * Coords.getWorldTileSize();
        const height = foundation.height * Coords.getWorldTileSize();
        const geometry = new THREE.PlaneGeometry(width, height);
        geometry.applyMatrix4(new THREE.Matrix4()
            .makeTranslation(width / 2, MAGIC_OFFSET, height / 2)
            .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2)));
        const material = new THREE.ShadowMaterial();
        material.transparent = true;
        material.opacity = 0.5;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.receiveShadow = true;
        mesh.renderOrder = 5;
        return mesh;
    }
    private createWireframe(foundation: {
        width: number;
        height: number;
    }, thickness: number): THREE.Object3D {
        const wireframe = DebugUtils.createWireframe(foundation, thickness);
        const isBridge = this.gameObject.isBridge();
        wireframe.position.y += isBridge ? Coords.tileHeightToWorld(-1) : 0;
        return wireframe;
    }
    private createMainObject(imageSource: any, drawOffset: THREE.Vector3): ShpRenderable {
        const isWall = this.objectRules.wall;
        const heightOffset = this.gameObject.isHighBridge() ? 4 : 0;
        const hasShadow = this.objectArt.hasShadow && !this.gameObject.isLowBridge() && !this.gameObject.isHighBridge();
        const renderable = ShpRenderable.factory(imageSource, this.palette, this.camera, drawOffset, hasShadow, heightOffset, isWall);
        renderable.setBatched(this.useSpriteBatching);
        if (this.useSpriteBatching) {
            renderable.setBatchPalettes([this.palette]);
        }
        renderable.setFlat(this.objectArt.flat);
        renderable.setExtraLight(this.extraLight);
        return renderable;
    }
    onRemove(transientAnimCreator: TransientAnimCreator): void {
        if (this.mapOverlayLayer?.hasObject(this.gameObject)) {
            this.mapOverlayLayer.removeObject(this.gameObject);
        }
        if (this.gameObject.isDestroyed &&
            (this.gameObject.deathType === DeathType.Demolish || this.gameObject.isHighBridge())) {
            const foundation = this.gameObject.getFoundation();
            const explosions = this.rules.audioVisual.bridgeExplosions;
            for (let x = 0; x < foundation.width; x++) {
                for (let y = 0; y < foundation.height; y++) {
                    const explosionType = explosions[MathUtils.getRandomInt(0, explosions.length - 1)];
                    transientAnimCreator.createTransientAnim(explosionType, (anim) => {
                        anim.setPosition(Coords.tile3dToWorld(x, y, 0).add(this.withPosition.getPosition()));
                    });
                }
            }
        }
    }
    dispose(): void {
        this.mainRenderable?.dispose();
    }
}
