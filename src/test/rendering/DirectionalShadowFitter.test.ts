import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DirectionalShadowFitter } from '../../engine/renderable/DirectionalShadowFitter.ts';

function setup() {
    const camera = new THREE.OrthographicCamera(-2400, 2400, 1900, -1900, 0, 140000);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(-Math.PI / 6, Math.PI / 4, 0);
    camera.position.set(12000, 50000, 18000);
    camera.updateMatrixWorld();
    const light = new THREE.DirectionalLight();
    light.position.set(-87.012, 204.338, 195.409);
    light.updateMatrixWorld();
    light.target.updateMatrixWorld();
    light.shadow.camera.near = -400000;
    light.shadow.camera.far = 400000;
    light.shadow.mapSize.set(2048, 2048);
    const fitter = new DirectionalShadowFitter(128, 256);
    fitter.setReceiverHeights(0, 4000);
    return { camera, light, fitter, viewport: { width: 856, height: 688 } };
}

test('covers visible terrain, ramps and offscreen casters along the light rays', () => {
    const { camera, light, fitter, viewport } = setup();
    for (const zoom of [0.5, 1, 2, 4]) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        assert.equal(fitter.fit(camera, light, viewport), true);
        light.shadow.updateMatrices(light);
        const toLight = light.position.clone().sub(light.target.position).normalize();
        for (const x of [-1 - 256 / viewport.width, 0, 1 + 256 / viewport.width]) {
            for (const y of [-1 - 256 / viewport.height, 0, 1 + 256 / viewport.height]) {
                for (const height of [0, 1500, 4000]) {
                    const origin = new THREE.Vector3(x, y, -1).unproject(camera);
                    const direction = new THREE.Vector3(x, y, 1).unproject(camera).sub(origin);
                    const receiver = origin.addScaledVector(direction, (height - origin.y) / direction.y);
                    for (const casterDistance of [0, 8000, 60000]) {
                        const projected = receiver.clone().addScaledVector(toLight, casterDistance).project(light.shadow.camera);
                        assert.ok(Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1,
                            `Clipped shadow at zoom ${zoom}, height ${height}, caster distance ${casterDistance}`);
                    }
                }
            }
        }
    }
});

test('stabilizes sub-texel movement and recomputes after viewport or quality changes', () => {
    const { camera, light, fitter, viewport } = setup();
    fitter.fit(camera, light, viewport);
    const before = light.shadow.camera.projectionMatrix.clone();
    camera.position.x += 0.000001;
    camera.updateMatrixWorld();
    fitter.fit(camera, light, viewport);
    assert.ok(before.equals(light.shadow.camera.projectionMatrix));
    camera.position.x += 1000;
    camera.updateMatrixWorld();
    fitter.fit(camera, light, viewport);
    assert.ok(!before.equals(light.shadow.camera.projectionMatrix));
    const moved = light.shadow.camera.projectionMatrix.clone();
    fitter.fit(camera, light, { width: 428, height: 344 });
    assert.ok(!moved.equals(light.shadow.camera.projectionMatrix));
    const resized = light.shadow.camera.projectionMatrix.clone();
    light.shadow.mapSize.set(1024, 1024);
    fitter.fit(camera, light, viewport);
    assert.ok(!resized.equals(light.shadow.camera.projectionMatrix));
});

test('rejects invalid heights and a ground-parallel camera without corrupting the projection', () => {
    const { camera, light, fitter, viewport } = setup();
    assert.throws(() => fitter.setReceiverHeights(10, 0));
    assert.throws(() => fitter.setReceiverHeights(0, Infinity));
    fitter.fit(camera, light, viewport);
    const before = light.shadow.camera.projectionMatrix.clone();
    camera.rotation.set(0, 0, 0);
    camera.updateMatrixWorld();
    assert.equal(fitter.fit(camera, light, viewport), false);
    assert.ok(before.equals(light.shadow.camera.projectionMatrix));
});
