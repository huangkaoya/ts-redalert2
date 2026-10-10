import * as THREE from 'three';
import { installInstancingShader } from './instancingShader';
export class InstancedMesh extends THREE.Mesh {
    public maxInstances: number;
    public uniformScale: boolean;
    public useInstanceColor: boolean;
    private instanceMatrixAttributes: THREE.InstancedBufferAttribute[];
    private inverseWorldMatrix = new THREE.Matrix4();
    private localInstanceMatrix = new THREE.Matrix4();
    constructor(geometry: THREE.BufferGeometry, material: THREE.Material, maxInstances: number, uniformScale: boolean, useInstanceColor: boolean = false) {
        const instancedGeometry = new THREE.InstancedBufferGeometry();
        (instancedGeometry as any).copy(geometry);
        super(instancedGeometry);
        this.maxInstances = maxInstances;
        this.uniformScale = uniformScale;
        this.useInstanceColor = useInstanceColor;
        this.initAttributes(this.geometry as THREE.InstancedBufferGeometry);
        this.material = this.decorateMaterial(material.clone(), !!(material as any).palette);
        this.frustumCulled = false;
        this.customDepthMaterial = this.decorateMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
        this.customDistanceMaterial = this.decorateMaterial(new THREE.MeshDistanceMaterial());
    }
    private initAttributes(geometry: THREE.InstancedBufferGeometry): void {
        const attributes: Array<{
            name: string;
            data: Float32Array | Uint8Array;
            itemSize: number;
            normalized: boolean;
        }> = [];
        for (let i = 0; i < 4; i++) {
            attributes.push({
                name: "instanceMatrix" + i,
                data: new Float32Array(4 * this.maxInstances),
                itemSize: 4,
                normalized: true,
            });
        }
        if (this.useInstanceColor) {
            attributes.push({
                name: "instanceColor",
                data: new Uint8Array(3 * this.maxInstances),
                itemSize: 3,
                normalized: true,
            });
        }
        attributes.push({
            name: "instanceOpacity",
            data: new Float32Array(this.maxInstances).fill(1),
            itemSize: 1,
            normalized: true,
        });
        for (const { name, data, itemSize, normalized } of attributes) {
            const attribute = new THREE.InstancedBufferAttribute(data, itemSize, normalized, 1);
            attribute.setUsage(THREE.DynamicDrawUsage);
            geometry.setAttribute(name, attribute);
        }
        this.instanceMatrixAttributes = new Array(4)
            .fill(0)
            .map((_, i) => geometry.getAttribute("instanceMatrix" + i) as THREE.InstancedBufferAttribute);
    }
    private decorateMaterial(material: THREE.Material, palette = false): THREE.Material {
        const mat = material as any;
        if (!mat.defines) {
            mat.defines = {};
        }
        mat.defines.INSTANCE_TRANSFORM = "";
        if (this.uniformScale) {
            mat.defines.INSTANCE_UNIFORM = "";
        }
        else {
            delete mat.defines.INSTANCE_UNIFORM;
        }
        if (this.useInstanceColor) {
            mat.defines.INSTANCE_COLOR = "";
        }
        else {
            delete mat.defines.INSTANCE_COLOR;
        }
        mat.defines.INSTANCE_OPACITY = "";
        installInstancingShader(material, palette);
        return material;
    }
    public setRenderCount(count: number): void {
        if (count > this.maxInstances) {
            throw new RangeError("Exceeded maximum number of instances");
        }
        (this.geometry as THREE.InstancedBufferGeometry).instanceCount = count;
    }
    public setMatrixAt(index: number, matrix: THREE.Matrix4): void {
        for (let row = 0; row < 4; row++) {
            let offset = 4 * row;
            this.instanceMatrixAttributes[row].setXYZW(index, matrix.elements[offset++], matrix.elements[offset++], matrix.elements[offset++], matrix.elements[offset]);
        }
    }
    public updateFromMeshes(meshes: any[]): void {
        if (meshes.length === 0)
            return;
        const hasPalette = !!meshes[0].material.palette;
        const attributes = (this.geometry as THREE.InstancedBufferGeometry).attributes;
        const opacityAttr = attributes.instanceOpacity as THREE.InstancedBufferAttribute;
        const paletteOffsetAttr = attributes.instancePaletteOffset as THREE.InstancedBufferAttribute;
        const extraLightAttr = attributes.instanceExtraLight as THREE.InstancedBufferAttribute;
        // Source matrices are in world space; the batch can have a transformed parent.
        this.updateWorldMatrix(true, false);
        this.inverseWorldMatrix.copy(this.matrixWorld).invert();
        for (let i = 0, len = meshes.length; i < len; i++) {
            const mesh = meshes[i];
            this.localInstanceMatrix.multiplyMatrices(this.inverseWorldMatrix, mesh.matrixWorld);
            this.setMatrixAt(i, this.localInstanceMatrix);
            const opacity = mesh.getOpacity();
            if (opacityAttr.getX(i) !== opacity) {
                opacityAttr.setX(i, opacity);
                opacityAttr.needsUpdate = true;
            }
            if (hasPalette) {
                const paletteIndex = mesh.getPaletteIndex();
                if (paletteOffsetAttr.getX(i) !== paletteIndex) {
                    paletteOffsetAttr.setX(i, paletteIndex);
                    paletteOffsetAttr.needsUpdate = true;
                }
                const extraLight = mesh.getExtraLight();
                const x = Math.fround(extraLight.x);
                const y = Math.fround(extraLight.y);
                const z = Math.fround(extraLight.z);
                if (x !== extraLightAttr.getX(i) || y !== extraLightAttr.getY(i) || z !== extraLightAttr.getZ(i)) {
                    extraLightAttr.setXYZ(i, x, y, z);
                    extraLightAttr.needsUpdate = true;
                }
            }
        }
        this.setRenderCount(meshes.length);
        for (const attr of this.instanceMatrixAttributes) {
            attr.needsUpdate = true;
        }
    }
    public dispose(): void {
        this.geometry.dispose();
        (this.material as THREE.Material).dispose();
        this.customDepthMaterial?.dispose();
        this.customDistanceMaterial?.dispose();
    }
}
