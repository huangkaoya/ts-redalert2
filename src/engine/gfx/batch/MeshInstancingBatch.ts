import * as THREE from 'three';
import { InstancedMesh } from './InstancedMesh';
export class MeshInstancingBatch {
    public maxInstances: number;
    private target?: THREE.Object3D;
    private instancedMesh?: InstancedMesh;
    private _castShadow: boolean = false;
    private _receiveShadow: boolean = false;
    private _clippingPlanes: THREE.Plane[] = [];
    private _renderOrder: number = 0;
    constructor(maxInstances: number) {
        this.maxInstances = maxInstances;
    }
    get castShadow(): boolean {
        return this._castShadow;
    }
    set castShadow(value: boolean) {
        this._castShadow = value;
        if (this.instancedMesh) {
            this.instancedMesh.castShadow = value;
        }
    }
    get receiveShadow(): boolean {
        return this._receiveShadow;
    }
    set receiveShadow(value: boolean) {
        this._receiveShadow = value;
        if (this.instancedMesh) {
            this.instancedMesh.receiveShadow = value;
        }
    }
    get clippingPlanes(): THREE.Plane[] {
        return this._clippingPlanes;
    }
    set clippingPlanes(value: THREE.Plane[]) {
        this._clippingPlanes = value;
        if (this.instancedMesh) {
            this.applyClippingPlanes(this.instancedMesh);
        }
    }
    private applyClippingPlanes(mesh: InstancedMesh): void {
        for (const material of [mesh.material as THREE.Material, mesh.customDepthMaterial, mesh.customDistanceMaterial]) {
            if (material) material.clippingPlanes = this._clippingPlanes;
        }
    }
    get renderOrder(): number {
        return this._renderOrder;
    }
    set renderOrder(value: number) {
        this._renderOrder = value;
        if (this.instancedMesh) {
            this.instancedMesh.renderOrder = value;
        }
    }
    get3DObject(): THREE.Object3D | undefined {
        return this.target;
    }
    create3DObject(): void {
        if (!this.target) {
            const object3D = new THREE.Object3D();
            object3D.matrixAutoUpdate = false;
            this.target = object3D;
            if (this.instancedMesh) {
                object3D.add(this.instancedMesh);
            }
        }
    }
    setMeshes(meshes: any[]): void {
        if (meshes.length > this.maxInstances) {
            throw new RangeError('Meshes array exceeds max number of instances');
        }
        if (meshes.length > 0) {
            const hasPalette = !!meshes[0].material.palette;
            if (!this.instancedMesh) {
                this.instancedMesh = new InstancedMesh(meshes[0].geometry, meshes[0].material, this.maxInstances, true);
                this.instancedMesh.castShadow = this._castShadow;
                this.instancedMesh.receiveShadow = this._receiveShadow;
                this.instancedMesh.renderOrder = this._renderOrder;
                this.applyClippingPlanes(this.instancedMesh);
                if (hasPalette) {
                    const geometry = this.instancedMesh.geometry as THREE.InstancedBufferGeometry;
                    geometry.setAttribute('instancePaletteOffset', new THREE.InstancedBufferAttribute(new Float32Array(this.maxInstances), 1));
                    geometry.setAttribute('instanceExtraLight', new THREE.InstancedBufferAttribute(new Float32Array(3 * this.maxInstances), 3));
                }
                if (this.target) {
                    this.target.add(this.instancedMesh);
                }
            }
            this.instancedMesh.updateFromMeshes(meshes);
        }
        else {
            if (this.instancedMesh) {
                if (this.target) {
                    this.target.remove(this.instancedMesh);
                }
                this.instancedMesh.dispose();
                this.instancedMesh = undefined;
            }
        }
    }
    update(): void {
    }
    dispose(): void {
        if (this.instancedMesh) {
            this.instancedMesh.dispose();
        }
    }
}
