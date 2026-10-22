import * as THREE from 'three';
import { BatchedMesh, BatchMode } from './BatchedMesh';
import { MeshInstancingBatch } from './MeshInstancingBatch';
import { RenderableContainer } from '../RenderableContainer';
import { MeshMergingBatch } from './MeshMergingBatch';
interface MeshBatch {
    castShadow: boolean;
    receiveShadow: boolean;
    renderOrder: number;
    clippingPlanes: THREE.Plane[];
    setMeshes(meshes: BatchedMesh[]): void;
    dispose(): void;
}
export class MeshBatchManager extends RenderableContainer {
    private renderableContainer: RenderableContainer;
    private batches: Map<string, MeshBatch[]> = new Map();
    private viewFrustum?: THREE.Frustum;
    private shadowFrustum?: THREE.Frustum;
    constructor(renderableContainer: RenderableContainer) {
        super();
        this.renderableContainer = renderableContainer;
    }
    setCullingFrustums(view?: THREE.Frustum, shadow?: THREE.Frustum): void {
        this.viewFrustum = view;
        this.shadowFrustum = shadow;
    }
    create3DObject(): void {
        let container = this.get3DObject();
        if (!container) {
            container = new THREE.Object3D();
            container.name = "mesh_batch_manager";
            container.matrixAutoUpdate = false;
            this.set3DObject(container);
        }
        super.create3DObject();
    }
    updateMeshes(): void {
        const container = this.renderableContainer.get3DObject();
        if (!container)
            return;
        const meshes = this.collectMeshes(container);
        const groupedMeshes = this.groupMeshesByBatchKey(meshes);
        const usedBatchCounts = this.fillBatches(groupedMeshes);
        this.cleanUnusedBatches(usedBatchCounts);
    }
    private collectMeshes(container: THREE.Object3D): BatchedMesh[] {
        const meshes: BatchedMesh[] = [];
        container.traverseVisible((object) => {
            if ((object as any).isBatchedMesh) {
                const mesh = object as BatchedMesh;
                // Merged meshes keep their existing path. Retain offscreen casters
                // in the light's volume so their visible shadows are not removed.
                if (mesh.batchMode !== BatchMode.Instancing || !mesh.frustumCulled ||
                    !this.viewFrustum || this.viewFrustum.intersectsObject(mesh) ||
                    (mesh.castShadow && this.shadowFrustum?.intersectsObject(mesh))) {
                    meshes.push(mesh);
                }
            }
        });
        return meshes;
    }
    private fillBatches(groupedMeshes: Map<string, BatchedMesh[]>): Map<string, number> {
        const usedBatchCounts = new Map<string, number>([...this.batches.keys()].map(key => [key, 0]));
        for (const [batchKey, meshes] of groupedMeshes) {
            let batchArray = this.batches.get(batchKey);
            let batchIndex = 0;
            while (meshes.length > 0) {
                const isInstancing = meshes[0].batchMode === BatchMode.Instancing;
                const maxInstances = isInstancing ? 1024 : 128;
                const batchMeshes = meshes.splice(0, maxInstances);
                let batch = batchArray?.[batchIndex];
                if (!batch) {
                    if (!batchArray) {
                        batchArray = [];
                        this.batches.set(batchKey, batchArray);
                    }
                    batch = new (isInstancing ? MeshInstancingBatch : MeshMergingBatch)(maxInstances);
                    batch.castShadow = batchMeshes[0].castShadow;
                    batch.receiveShadow = batchMeshes[0].receiveShadow;
                    batch.renderOrder = batchMeshes[0].renderOrder;
                    batch.clippingPlanes = batchMeshes[0].getClippingPlanes();
                    batchArray.push(batch);
                    this.add(batch as any);
                    this.processRenderQueue();
                }
                batch.setMeshes(batchMeshes);
                batchIndex++;
            }
            usedBatchCounts.set(batchKey, batchIndex);
        }
        return usedBatchCounts;
    }
    private cleanUnusedBatches(usedBatchCounts: Map<string, number>): void {
        for (const [batchKey, usedCount] of usedBatchCounts) {
            const batchArray = this.batches.get(batchKey);
            if (batchArray) {
                const unusedBatches = batchArray.splice(usedCount);
                for (const batch of unusedBatches) {
                    this.remove(batch as any);
                    batch.dispose();
                }
                if (batchArray.length === 0) {
                    this.batches.delete(batchKey);
                }
            }
        }
    }
    private groupMeshesByBatchKey(meshes: BatchedMesh[]): Map<string, BatchedMesh[]> {
        const groups = new Map<string, BatchedMesh[]>();
        for (let i = 0, length = meshes.length; i < length; i++) {
            const mesh = meshes[i];
            const batchKey = this.getBatchKey(mesh);
            let group = groups.get(batchKey);
            if (!group) {
                group = [];
                groups.set(batchKey, group);
            }
            group.push(mesh);
        }
        return groups;
    }
    private getBatchKey(mesh: BatchedMesh): string {
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        return (mesh.batchMode +
            "_" +
            (mesh.batchMode === BatchMode.Instancing
                ? mesh.geometry.uuid
                : mesh.geometry.attributes.position.count) +
            "_" +
            material.uuid +
            "_" +
            Number(mesh.castShadow) +
            "_" +
            mesh.renderOrder +
            "_" +
            Number(mesh.receiveShadow) +
            "_" +
            mesh.getClippingPlanesHash());
    }
    dispose(): void {
        this.batches.forEach(batchArray => batchArray.forEach(batch => batch.dispose()));
    }
}
