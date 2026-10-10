import * as THREE from 'three';
import { Renderer } from '../../engine/gfx/Renderer';
import { BatchedMesh } from '../../engine/gfx/batch/BatchedMesh';
import { MeshBatchManager } from '../../engine/gfx/batch/MeshBatchManager';
import { RenderableContainer } from '../../engine/gfx/RenderableContainer';
import { PalettePhongMaterial } from '../../engine/gfx/material/PalettePhongMaterial';
import { PaletteBasicMaterial } from '../../engine/gfx/material/PaletteBasicMaterial';

// Open /src/test/rendering/browser.html through the dev server; no game assets required.
const width = 640, height = 480;
const result = { complete: false, supportsInstancing: false, errors: [] as string[], runs: [] as any[] };
(window as any).__renderingRegression = result;
const originalError = console.error;
console.error = (...args) => { result.errors.push(args.map(String).join(' ')); originalError(...args); };
const engine = new Renderer(width, height);
engine.init(document.querySelector('#render') as HTMLElement);
const renderer = (engine as any).renderer as THREE.WebGLRenderer;
renderer.setPixelRatio(1);
renderer.setClearColor(0x20252a);
result.supportsInstancing = engine.supportsInstancing();
const gl = renderer.getContext();
const paletteData = new Uint8Array(256 * 2 * 4);
for (let i = 0; i < 512; i++) paletteData.set(i < 256 ? [210, 60, 30, 255] : [40, 180, 230, 255], i * 4);
const palette = new THREE.DataTexture(paletteData, 256, 2);
palette.needsUpdate = true;
const geometry = new THREE.BoxGeometry(5, 6, 4);
const color = new Float32Array(geometry.attributes.position.count * 3);
for (let i = 0; i < color.length; i += 3) color[i] = 1 / 255;
geometry.setAttribute('color', new THREE.BufferAttribute(color, 3));
const pixels = () => {
    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return data;
};
function difference(a: Uint8Array, b: Uint8Array) {
    let changed = 0, maxError = 0;
    for (let i = 0; i < a.length; i += 4) {
        const error = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
        if (error > 3) changed++;
        maxError = Math.max(maxError, error);
    }
    return { changed, maxError };
}
function fixture(instanced: boolean, kind: 'phong' | 'basic' | 'plain', shadow: 'off' | 'directional' | 'point') {
    const scene = new THREE.Scene();
    scene.position.set(2.3, 0, 1.7);
    const camera = new THREE.OrthographicCamera(-35, 35, 26.25, -26.25, 1, 1000);
    // Keep transparent objects separate in screen space: instance draw order is
    // not equivalent to sorting overlapping double-sided transparent meshes.
    camera.position.set(0, 60, 120); camera.lookAt(0, 0, 0);
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 14)];
    const material = kind === 'plain' ? new THREE.MeshPhongMaterial({ color: 0x22aaff, transparent: true }) :
        new (kind === 'phong' ? PalettePhongMaterial : PaletteBasicMaterial)({ palette, paletteCount: 2, vertexColors: true, transparent: true });
    material.clippingPlanes = planes; material.clipShadows = true;
    const sourceRoot = new THREE.Group();
    scene.add(sourceRoot);
    const originals: THREE.Material[] = [];
    for (let i = 0; i < 9; i++) {
        const offset = i % 2, opacity = [0.25, 0.6, 1][i % 3];
        let mesh: THREE.Mesh;
        if (instanced) {
            const batched = new BatchedMesh(geometry, material);
            batched.setPaletteIndex(offset); batched.setOpacity(opacity);
            batched.setExtraLight(new THREE.Vector3(0.1, 0.05, 0));
            batched.setClippingPlanes(planes); mesh = batched;
        } else {
            const clone = material.clone(); clone.opacity = opacity;
            if (kind !== 'plain') {
                (clone as PalettePhongMaterial).paletteOffset = offset;
                (clone as PalettePhongMaterial).extraLight.set(0.1, 0.05, 0);
            }
            originals.push(clone); mesh = new THREE.Mesh(geometry, clone);
        }
        mesh.position.set((i % 3 - 1) * 20, 3, (Math.floor(i / 3) - 1) * 20);
        mesh.rotation.y = i * 0.31;
        mesh.scale.set(1, 1 + i * 0.05, 1.2);
        mesh.castShadow = mesh.receiveShadow = true;
        sourceRoot.add(mesh);
    }
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x9a9a9a });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), groundMaterial);
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const light = shadow === 'point' ? new THREE.PointLight(0xffffff, 14000, 500, 2) : new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(-12, 35, 20); light.castShadow = shadow !== 'off';
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 1; light.shadow.camera.far = 500;
    if (light instanceof THREE.DirectionalLight) {
        Object.assign(light.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60 });
        light.shadow.camera.updateProjectionMatrix();
    }
    scene.add(light);
    const manager = new MeshBatchManager(new RenderableContainer(sourceRoot));
    manager.create3DObject(); scene.add(manager.get3DObject()!);
    scene.updateMatrixWorld(true); manager.updateMeshes();
    return { scene, camera, manager, light, dispose() {
        manager.dispose(); material.dispose(); originals.forEach(m => m.dispose());
        ground.geometry.dispose(); groundMaterial.dispose(); light.shadow.map?.dispose();
        renderer.renderLists.dispose();
    } };
}
try {
    for (const kind of ['phong', 'basic', 'plain'] as const) {
        for (const shadow of ['off', 'directional', 'point'] as const) {
            const images: Uint8Array[] = [], calls: number[] = [], shadowPixels: number[] = [];
            for (const instanced of [false, true]) {
                const f = fixture(instanced, kind, shadow);
                renderer.clear(); renderer.render(f.scene, f.camera);
                images.push(pixels()); calls.push(renderer.info.render.calls);
                if (shadow !== 'off') {
                    f.light.castShadow = false;
                    renderer.clear(); renderer.render(f.scene, f.camera);
                    shadowPixels.push(difference(images[images.length - 1], pixels()).changed);
                }
                f.dispose();
            }
            result.runs.push({ kind, shadow, calls, shadowPixels, ...difference(images[0], images[1]) });
        }
    }
    result.complete = true;
    if (!result.supportsInstancing || result.errors.length || result.runs.some(run =>
        run.changed > 50 || (run.shadow !== 'off' && run.shadowPixels.some((count: number) => count < 100))) ||
        gl.getError() !== gl.NO_ERROR) {
        throw new Error('Rendering regression failed; inspect the recorded pixel differences and errors.');
    }
} catch (error) { result.errors.push(String(error)); }
document.querySelector('#result')!.textContent = JSON.stringify(result, null, 2);
