import { NodeHeap } from './NodeHeap';
import { SearchStatePool } from './SearchStatePool';
interface PathFinderOptions {
    bestEffort?: boolean;
    maxExpandedNodes?: number;
    heuristic?: (from: any, to: any, state?: any) => number;
    distance?: (from: any, to: any) => number;
    excludedNodes?: (data: any) => boolean;
}
interface SearchState {
    node: any;
    parent: SearchState | null;
    fScore: number;
    distanceToSource: number;
    open: number;
    closed: boolean;
    heapIndex: number;
}
interface Graph {
    getNode(id: string): any;
}
export class PathFinder {
    private readonly bestEffort: boolean | undefined;
    private readonly maxExpandedNodes: number;
    private readonly heuristic: (from: any, to: any, state?: any) => number;
    private readonly distance: (from: any, to: any) => number;
    private readonly excludedNodes?: (data: any) => boolean;
    private readonly searchStatePool: SearchStatePool;
    private readonly graph: Graph;
    constructor(graph: Graph, options: PathFinderOptions = {}) {
        // 完善模拟层逻辑：bestEffort has no default; maxExpandedNodes uses || (not ??).
        this.bestEffort = options.bestEffort;
        this.maxExpandedNodes = options.maxExpandedNodes || Number.POSITIVE_INFINITY;
        this.heuristic = options.heuristic ?? (() => 0);
        this.distance = options.distance ?? (() => 1);
        this.excludedNodes = options.excludedNodes;
        this.searchStatePool = new SearchStatePool();
        this.graph = graph;
    }
    private reconstructPath(state: SearchState): any[] {
        const path = [state.node];
        let current = state.parent;
        while (current) {
            path.push(current.node);
            current = current.parent;
        }
        return path;
    }
    find(fromId: string, toId: string): any[] {
        const fromNode = this.graph.getNode(fromId);
        if (!fromNode) {
            throw new Error(`fromId is not defined in this graph: ${fromId}`);
        }
        const toNode = this.graph.getNode(toId);
        if (!toNode) {
            throw new Error(`toId is not defined in this graph: ${toId}`);
        }
        if (fromNode === toNode) {
            return [];
        }
        this.searchStatePool.reset();
        const states = new Map<string, SearchState>();
        const openSet = new NodeHeap();
        const startState = this.searchStatePool.createNewState(fromNode);
        states.set(fromId, startState);
        startState.fScore = this.excludedNodes?.(toNode.data)
            ? Number.POSITIVE_INFINITY
            : this.heuristic(fromNode, toNode);
        if (!Number.isFinite(startState.fScore) && fromNode.neighbors.has(toNode)) {
            return [];
        }
        startState.distanceToSource = 0;
        openSet.push(startState);
        startState.open = 1;
        let current: SearchState;
        let bestState = startState;
        let expandedCount = 0;
        while (openSet.length > 0) {
            current = openSet.pop()! as unknown as SearchState;
            if (current.node === toNode) {
                return this.reconstructPath(current);
            }
            expandedCount++;
            if (expandedCount > this.maxExpandedNodes) {
                break;
            }
            current.closed = true;
            current.node.neighbors.forEach((neighbor: any) => {
                let neighborState = states.get(neighbor.id);
                if (!neighborState) {
                    neighborState = this.searchStatePool.createNewState(neighbor);
                    states.set(neighbor.id, neighborState);
                }
                if (neighborState.closed) {
                    return;
                }
                if (neighborState.open === 0) {
                    openSet.push(neighborState);
                    neighborState.open = 1;
                }
                const tentativeDistance = this.excludedNodes?.(neighbor.data)
                    ? Number.POSITIVE_INFINITY
                    : current.distanceToSource + this.distance(current.node, neighbor);
                if (tentativeDistance >= neighborState.distanceToSource) {
                    return;
                }
                neighborState.parent = current;
                neighborState.distanceToSource = tentativeDistance;
                if (this.excludedNodes?.(toNode.data)) {
                    neighborState.fScore = Number.POSITIVE_INFINITY;
                }
                else {
                    neighborState.fScore = tentativeDistance + this.heuristic(neighborState.node, toNode, neighborState);
                }
                if (neighborState.fScore - neighborState.distanceToSource < bestState.fScore - bestState.distanceToSource) {
                    bestState = neighborState;
                }
                openSet.updateItem(neighborState.heapIndex);
            });
        }
        return this.bestEffort ? this.reconstructPath(bestState) : [];
    }
}
