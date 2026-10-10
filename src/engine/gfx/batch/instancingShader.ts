import * as THREE from 'three';

/** Use the same instance transform in the color and both shadow passes. */
export function installInstancingShader(material: THREE.Material, palette = false): void {
    const beforeCompile = material.onBeforeCompile;
    const cacheKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
        beforeCompile.call(material, shader, renderer);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
attribute vec4 instanceMatrix0;
attribute vec4 instanceMatrix1;
attribute vec4 instanceMatrix2;
attribute vec4 instanceMatrix3;
attribute float instanceOpacity;
varying float vInstanceOpacity;
mat4 getInstanceTransform() {
    return mat4(instanceMatrix0, instanceMatrix1, instanceMatrix2, instanceMatrix3);
}`)
            .replace('void main() {', `void main() {
    vInstanceOpacity = instanceOpacity;`)
            .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
    // As with Three.js instancing, rotation and nonuniform scale are supported;
    // shear transforms are not used by voxel builders.
    mat3 instanceNormal = mat3(getInstanceTransform());
    objectNormal /= vec3(dot(instanceNormal[0], instanceNormal[0]),
                        dot(instanceNormal[1], instanceNormal[1]),
                        dot(instanceNormal[2], instanceNormal[2]));
    objectNormal = instanceNormal * objectNormal;
    #ifdef USE_TANGENT
        objectTangent = instanceNormal * objectTangent;
    #endif`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
    transformed = (getInstanceTransform() * vec4(transformed, 1.0)).xyz;`);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
            '#include <common>\nvarying float vInstanceOpacity;');
        // Palette shaders already apply instanceOpacity when resolving the color.
        if (!palette) {
            shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>',
                'diffuseColor.a *= vInstanceOpacity;\n#include <alphatest_fragment>');
        }
    };
    material.customProgramCacheKey = () => `${cacheKey}|instance-transform-opacity-v1|${Number(palette)}`;
}
