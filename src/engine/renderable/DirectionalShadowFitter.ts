import * as THREE from 'three';

/** Fit the light's projection to visible receivers. Casters along the light rays
 * remain inside this projection even when they are outside the main camera. */
export class DirectionalShadowFitter {
    private nearPoint = new THREE.Vector3();
    private farPoint = new THREE.Vector3();
    private point = new THREE.Vector3();
    private cameraMatrix = new THREE.Matrix4();
    private projectionMatrix = new THREE.Matrix4();
    private dirty = true;
    private minHeight = 0;
    private maxHeight = 0;
    private lastResolution = 0;
    private lastWidth = 0;
    private lastHeight = 0;

    constructor(private paddingPixels = 128, private sizeStep = 1) { }

    invalidate(): void {
        this.dirty = true;
    }

    setReceiverHeights(min: number, max: number): void {
        if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
            throw new Error('Invalid shadow receiver heights');
        }
        this.minHeight = min;
        this.maxHeight = max;
        this.dirty = true;
    }

    fit(camera: THREE.OrthographicCamera, light: THREE.DirectionalLight,
        viewport: { width: number; height: number }): boolean {
        if (viewport.width <= 0 || viewport.height <= 0) return false;
        const resolution = light.shadow.mapSize.x;
        if (!this.dirty && this.lastResolution === resolution &&
            this.lastWidth === viewport.width && this.lastHeight === viewport.height &&
            this.cameraMatrix.equals(camera.matrixWorld) &&
            this.projectionMatrix.equals(camera.projectionMatrix)) return true;

        light.shadow.updateMatrices(light);
        const shadowCamera = light.shadow.camera;
        const xEdge = 1 + 2 * this.paddingPixels / viewport.width;
        const yEdge = 1 + 2 * this.paddingPixels / viewport.height;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const x of [-xEdge, xEdge]) {
            for (const y of [-yEdge, yEdge]) {
                this.nearPoint.set(x, y, -1).unproject(camera);
                this.farPoint.set(x, y, 1).unproject(camera).sub(this.nearPoint);
                // A camera looking along the ground has no finite ground footprint.
                if (Math.abs(this.farPoint.y) < this.farPoint.length() * 0.001) return false;
                for (const height of [this.minHeight, this.maxHeight]) {
                    const distance = (height - this.nearPoint.y) / this.farPoint.y;
                    this.point.copy(this.farPoint).multiplyScalar(distance).add(this.nearPoint);
                    this.point.applyMatrix4(shadowCamera.matrixWorldInverse);
                    minX = Math.min(minX, this.point.x);
                    maxX = Math.max(maxX, this.point.x);
                    minY = Math.min(minY, this.point.y);
                    maxY = Math.max(maxY, this.point.y);
                }
            }
        }
        if (![minX, minY, maxX, maxY].every(Number.isFinite) || resolution < 4) return false;
        // Reserve filter/snap border texels and keep extents stable under panning.
        const step = this.sizeStep;
        const width = Math.max(step, Math.ceil((maxX - minX) * resolution / (resolution - 4) / step) * step);
        const height = Math.max(step, Math.ceil((maxY - minY) * resolution / (resolution - 4) / step) * step);
        const texelX = width / resolution, texelY = height / resolution;
        const centerX = Math.round((minX + maxX) / 2 / texelX) * texelX;
        const centerY = Math.round((minY + maxY) / 2 / texelY) * texelY;
        shadowCamera.left = centerX - width / 2;
        shadowCamera.right = centerX + width / 2;
        shadowCamera.bottom = centerY - height / 2;
        shadowCamera.top = centerY + height / 2;
        shadowCamera.updateProjectionMatrix();
        this.cameraMatrix.copy(camera.matrixWorld);
        this.projectionMatrix.copy(camera.projectionMatrix);
        this.lastResolution = resolution;
        this.lastWidth = viewport.width;
        this.lastHeight = viewport.height;
        this.dirty = false;
        return true;
    }
}
