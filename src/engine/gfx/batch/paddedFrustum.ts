import * as THREE from 'three';

/** Expand each viewport edge by internal rendering pixels without changing depth. */
export function updatePaddedFrustum(camera: THREE.Camera,
    viewport: { width: number; height: number }, padding: number,
    frustum: THREE.Frustum, matrix: THREE.Matrix4): boolean {
    if (viewport.width <= 0 || viewport.height <= 0) return false;
    matrix.copy(camera.projectionMatrix);
    const scaleX = viewport.width / (viewport.width + 2 * padding);
    const scaleY = viewport.height / (viewport.height + 2 * padding);
    for (const i of [0, 4, 8, 12]) matrix.elements[i] *= scaleX;
    for (const i of [1, 5, 9, 13]) matrix.elements[i] *= scaleY;
    matrix.multiply(camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix, camera.coordinateSystem, camera.reversedDepth);
    return true;
}
