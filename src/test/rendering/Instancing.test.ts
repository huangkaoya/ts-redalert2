import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Renderer } from '../../engine/gfx/Renderer';
import { BatchedMesh, BatchMode } from '../../engine/gfx/batch/BatchedMesh';
import { MeshInstancingBatch } from '../../engine/gfx/batch/MeshInstancingBatch';
import { MeshBatchManager } from '../../engine/gfx/batch/MeshBatchManager';
import { RenderableContainer } from '../../engine/gfx/RenderableContainer';
import { updatePaddedFrustum } from '../../engine/gfx/batch/paddedFrustum';
import { WorldScene } from '../../engine/renderable/WorldScene';
import { ShadowQuality } from '../../engine/renderable/entity/unit/ShadowQuality';
import { BoxedVar } from '../../util/BoxedVar';

test('detects native WebGL2 instancing without requesting a WebGL1 extension', () => {
    const renderer = new Renderer(800, 600);
    assert.throws(() => renderer.supportsInstancing(), /not yet initialized/);
    (renderer as any).renderer = {
        getContext: () => ({ drawElementsInstanced() {}, vertexAttribDivisor() {} }),
        extensions: { get() { throw new Error('Must not request ANGLE_instanced_arrays'); } }
    };
    assert.equal(renderer.supportsInstancing(), true);
    (renderer as any).renderer.getContext = () => ({});
    assert.equal(renderer.supportsInstancing(), false);
});

test('preserves world transforms under different parents, opacity and initial shadow state', () => {
    const scene = new THREE.Scene();
    const sourceParent = new THREE.Group();
    sourceParent.position.set(-8, 4, 12);
    const batchParent = new THREE.Group();
    batchParent.position.set(20, -5, 10);
    scene.add(sourceParent, batchParent);
    const material = new THREE.MeshPhongMaterial();
    const geometry = new THREE.BoxGeometry();
    const source = new BatchedMesh(geometry, material);
    source.position.set(3, 6, 9);
    source.rotation.y = 0.7;
    source.scale.set(2, 3, 4);
    source.setOpacity(0.25);
    sourceParent.add(source);
    scene.updateMatrixWorld(true);
    const batch = new MeshInstancingBatch(4);
    batch.castShadow = batch.receiveShadow = true;
    const planes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -1)];
    batch.clippingPlanes = planes;
    batch.create3DObject();
    batchParent.add(batch.get3DObject()!);
    batch.setMeshes([source]);
    const instanced = batch.get3DObject()!.children[0] as THREE.Mesh;
    const attributes = instanced.geometry.attributes;
    const values = [0, 1, 2, 3].flatMap(i => Array.from(attributes['instanceMatrix' + i].array).slice(0, 4));
    const renderedWorld = new THREE.Matrix4().multiplyMatrices(instanced.matrixWorld, new THREE.Matrix4().fromArray(values));
    source.matrixWorld.elements.forEach((value, i) => assert.ok(Math.abs(renderedWorld.elements[i] - value) < 0.00001));
    assert.equal(attributes.instanceOpacity.getX(0), 0.25);
    assert.equal(instanced.castShadow, true);
    assert.equal(instanced.receiveShadow, true);
    assert.equal((instanced.material as THREE.Material).clippingPlanes, planes);
    assert.equal(instanced.customDepthMaterial!.clippingPlanes, planes);
    assert.equal(instanced.customDistanceMaterial!.clippingPlanes, planes);
    let disposed = 0;
    for (const mat of [instanced.material as THREE.Material, instanced.customDepthMaterial!, instanced.customDistanceMaterial!]) {
        mat.addEventListener('dispose', () => disposed++);
    }
    batch.setMeshes([]);
    assert.equal(disposed, 3);
    assert.equal(batch.get3DObject()!.children.length, 0);
    geometry.dispose(); material.dispose();
});

test('culls distant instances, keeps padded edges and offscreen shadow casters', () => {
    const camera = new THREE.OrthographicCamera(-316, 316, 368, -368, 0.1, 1000);
    camera.position.z = 100;
    camera.updateMatrixWorld();
    const view = new THREE.Frustum();
    const matrix = new THREE.Matrix4();
    assert.equal(updatePaddedFrustum(camera, { width: 632, height: 736 }, 128, view, matrix), true);
    const shadowCamera = camera.clone();
    shadowCamera.left = -600; shadowCamera.right = 600;
    shadowCamera.updateProjectionMatrix(); shadowCamera.updateMatrixWorld();
    const shadow = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse));
    const geometry = new THREE.SphereGeometry(1);
    const material = new THREE.MeshBasicMaterial();
    const root = new THREE.Group();
    function mesh(x: number, mode = BatchMode.Instancing) {
        const object = new BatchedMesh(geometry, material, mode);
        object.position.x = x; root.add(object);
        return object;
    }
    const edge = mesh(420), outside = mesh(460), caster = mesh(550), distantCaster = mesh(650);
    caster.castShadow = distantCaster.castShadow = true;
    const merging = mesh(10000, BatchMode.Merging), uncullable = mesh(10000);
    uncullable.frustumCulled = false;
    const hidden = mesh(0); hidden.visible = false;
    root.updateMatrixWorld(true);
    const manager = new MeshBatchManager(new RenderableContainer(root));
    manager.setCullingFrustums(view, shadow);
    const retained = (manager as any).collectMeshes(root) as BatchedMesh[];
    assert.deepEqual(retained, [edge, caster, merging, uncullable]);
    assert.ok(!retained.includes(outside) && !retained.includes(distantCaster));
    manager.setCullingFrustums(view);
    assert.ok(!(manager as any).collectMeshes(root).includes(caster));
    geometry.dispose(); material.dispose();
});

test('padding expands an off-center viewport and zero padding matches Three.js', () => {
    const camera = new THREE.OrthographicCamera(10, 642, 756, 20, 0.1, 1000);
    camera.position.z = 100; camera.updateMatrixWorld();
    const frustum = new THREE.Frustum(), matrix = new THREE.Matrix4();
    const object = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial());
    object.position.set(-20, 388, 0); object.updateMatrixWorld();
    updatePaddedFrustum(camera, { width: 632, height: 736 }, 0, frustum, matrix);
    assert.equal(frustum.intersectsObject(object), false);
    updatePaddedFrustum(camera, { width: 632, height: 736 }, 64, frustum, matrix);
    assert.equal(frustum.intersectsObject(object), true);
    const original = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    updatePaddedFrustum(camera, { width: 632, height: 736 }, 0, frustum, matrix);
    assert.deepEqual(frustum.planes, original.planes);
    assert.equal(updatePaddedFrustum(camera, { width: 0, height: 736 }, 128, frustum, matrix), false);
    object.geometry.dispose(); (object.material as THREE.Material).dispose();
});

test('resizes and releases shadow targets when switching quality or disposing the world', () => {
    const quality = new BoxedVar(ShadowQuality.High);
    const world = WorldScene.factory({ x: 0, y: 0, width: 856, height: 688 }, new BoxedVar(false), quality);
    world.setShadowReceiverHeights(0, 4000);
    world.create3DObject();
    const light = (world as any).directionalLight as THREE.DirectionalLight;
    assert.equal(light.shadow.mapSize.x, 4096);
    let released = 0;
    function allocate() {
        light.shadow.map = new THREE.WebGLRenderTarget(1, 1);
        light.shadow.map.addEventListener('dispose', () => released++);
    }
    for (const [next, resolution] of [[ShadowQuality.Medium, 2048], [ShadowQuality.Low, 1024], [ShadowQuality.Off, 1024], [ShadowQuality.High, 4096]] as const) {
        if (quality.value !== ShadowQuality.Off) allocate();
        quality.value = next;
        assert.equal(light.shadow.map, null);
        assert.equal(light.shadow.mapSize.x, resolution);
        assert.equal(light.castShadow, next !== ShadowQuality.Off);
    }
    assert.equal(released, 3);
    allocate(); world.dispose();
    assert.equal(released, 4);
    assert.equal(light.shadow.map, null);
});
