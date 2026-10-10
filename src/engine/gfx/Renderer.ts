import * as THREE from 'three';
import Stats from 'stats.js';
import { EventDispatcher } from '../../util/event';
import { RendererError } from './RendererError';
export class Renderer {
    private width: number;
    private height: number;
    private renderer!: THREE.WebGLRenderer;
    private scenes: Set<any> = new Set();
    private isContextLost: boolean = false;
    private stats?: Stats;
    private _onFrame = new EventDispatcher<string, number>();
    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }
    get onFrame() {
        return this._onFrame.asEvent();
    }
    getCanvas(): HTMLCanvasElement {
        return this.renderer.domElement;
    }
    getStats(): Stats | undefined {
        return this.stats;
    }
    supportsInstancing(): boolean {
        if (!this.renderer) {
            throw new Error('Renderer not yet initialized');
        }
        const context = this.renderer.getContext();
        // Instancing is core in WebGL2; the WebGL1 extension may be absent.
        return 'drawElementsInstanced' in context && 'vertexAttribDivisor' in context &&
            typeof context.drawElementsInstanced === 'function' &&
            typeof context.vertexAttribDivisor === 'function';
    }
    initStats(container: HTMLElement): void {
        if (!this.stats) {
            this.stats = new Stats();
            this.stats.showPanel(0);
            this.stats.dom.style.top = 'auto';
            this.stats.dom.style.bottom = '0px';
            this.stats.dom.classList.add('stats-layer');
            container.appendChild(this.stats.dom);
        }
    }
    destroyStats(): void {
        if (this.stats) {
            if (this.stats.dom.parentNode) {
                this.stats.dom.parentNode.removeChild(this.stats.dom);
            }
            this.stats = undefined;
        }
    }
    init(container: HTMLElement): void {
        const renderer = this.createGlRenderer();
        container.appendChild(renderer.domElement);
        renderer.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
        });
        renderer.domElement.addEventListener('mousedown', (event) => {
            event.preventDefault();
        });
        renderer.domElement.addEventListener('wheel', (event) => {
            event.stopPropagation();
        }, { passive: true });
        renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
        renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
        this.renderer = renderer;
    }
    createGlRenderer(canvas?: HTMLCanvasElement): THREE.WebGLRenderer {
        let renderer: THREE.WebGLRenderer;
        try {
            renderer = new THREE.WebGLRenderer({
                canvas: canvas,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance',
            });
        }
        catch (error) {
            throw new RendererError('Failed to initialize WebGL renderer');
        }
        renderer.setSize(this.width, this.height);
        renderer.autoClear = false;
        renderer.autoClearDepth = false;
        renderer.shadowMap.enabled = true;
        renderer.localClippingEnabled = true;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.outputColorSpace = (THREE as any).SRGBColorSpace ?? THREE.LinearSRGBColorSpace;
        return renderer;
    }
    setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        if (this.renderer) {
            this.renderer.setSize(width, height);
        }
    }
    addScene(scene: any): void {
        this.scenes.add(scene);
        scene.create3DObject();
    }
    removeScene(scene: any): void {
        this.scenes.delete(scene);
    }
    getScenes(): any[] {
        return [...this.scenes];
    }
    update(deltaTime: number, ...args: any[]): void {
        this.scenes.forEach((scene) => {
            scene.update(deltaTime, ...args);
        });
        this._onFrame.dispatch('frame', deltaTime);
    }
    render(): void {
        if (this.isContextLost)
            return;
        this.renderer.clear();
        this.scenes.forEach((scene) => {
            this.renderer.clearDepth();
            const viewportY = this.height - scene.viewport.y - scene.viewport.height;
            this.renderer.setViewport(scene.viewport.x, viewportY, scene.viewport.width, scene.viewport.height);
            this.renderer.render(scene.scene, scene.camera);
        });
    }
    flush(): void {
        this.renderer.renderLists.dispose();
    }
    dispose(): void {
        this.renderer.domElement.remove();
        this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
        this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
        this.renderer.dispose();
        this.destroyStats();
    }
    private handleContextLost = (event: Event): void => {
        event.preventDefault();
        this.isContextLost = true;
    };
    private handleContextRestored = (): void => {
        const canvas = this.renderer.domElement;
        this.renderer.dispose();
        this.renderer = this.createGlRenderer(canvas);
        this.isContextLost = false;
    };
}
