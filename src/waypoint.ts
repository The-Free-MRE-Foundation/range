import { Actor, AssetContainer, ButtonBehavior, ButtonEventData, ColliderType, CollisionLayer, Context, DegreesToRadians, Quaternion, ScaledTransformLike, User, Vector3 } from "@microsoft/mixed-reality-extension-sdk";
import { translate } from "./utils";

export interface WayPointOptions {
    name: string,
    resourceId: string,
    dimensions: { width: number, height: number, depth: number },
    transform?: Partial<ScaledTransformLike>,
    edit?: boolean,
}

export class WayPoint {
    public anchor: Actor;
    private preview: Actor;

    private _edit: boolean = false;
    get edit() {
        return this._edit;
    }
    set edit(e: boolean) {
        this._edit = e;
        this.anchor.grabbable = this._edit;
        this.anchor.appearance.enabled = this._edit;
        const material = this.assets.materials.find(m => m.name === (this._edit ? 'debug' : 'invis'));
        this.anchor.appearance.material = material;

        this.preview.appearance.enabled = this._edit ? true : false;
    }

    get options() {
        return this._options;
    }

    constructor(private context: Context, private assets: AssetContainer, private _options: WayPointOptions) {
        this._edit = this.options.edit ? true : false;
        const local = translate(this._options.transform ? this._options.transform : {}).toJSON();
        const dim = this._options.dimensions;
        const name = `${dim.width},${dim.height},${dim.depth}`;
        let mesh = this.assets.meshes.find(m => m.name === name);
        if (!mesh) {
            mesh = this.assets.createBoxMesh(name, dim.width, dim.height, dim.depth);
        }
        const material = this.assets.materials.find(m => m.name === (this.edit ? 'debug' : 'invis'));
        this.anchor = Actor.Create(this.context, {
            actor: {
                grabbable: true && this.edit ? true : false,
                appearance: {
                    meshId: mesh.id,
                    materialId: material.id,
                },
                transform: {
                    local
                },
                collider: {
                    geometry: { shape: ColliderType.Auto },
                    layer: CollisionLayer.Hologram
                },
                subscriptions: ['transform']
            }
        });

        this.preview = Actor.CreateFromLibrary(this.context, {
            resourceId: this._options.resourceId,
            actor: {
                parentId: this.anchor.id,
                appearance: {
                    enabled: this.edit ? true : false,
                }
            }
        });
    }

    public addButtonBehavior(handler: (user: User, _: ButtonEventData, wayPoint: WayPoint) => void) {
        this.anchor.setBehavior(ButtonBehavior).onClick((user: User, _: ButtonEventData) => {
            handler(user, _, this);
        });
    }

    public addGrabEndBehavior(handler: () => void) {
        this.anchor.onGrab('end', () => {
            handler();
        });
    }

    public remove() {
        this.anchor.destroy();
    }
}

export interface WayPointEdgeOptions {
    resourceId: string,
    length: number,
    edit?: boolean
}

export class WayPointEdge {
    private model: Actor;

    private _edit: boolean = false;
    get edit() {
        return this._edit;
    }
    set edit(e: boolean) {
        this._edit = e;
        this.model.appearance.enabled = this._edit;
    }

    constructor(private context: Context, private assets: AssetContainer, private options: WayPointEdgeOptions, private source: WayPoint, private target: WayPoint) {
        this._edit = this.options.edit ? true : false;
        this.model = Actor.CreateFromLibrary(this.context, {
            resourceId: this.options.resourceId,
            actor: {
                appearance: {
                    enabled: this.edit ? true : false,
                }
            }
        });
    }

    public remove() {
        this.model.destroy();
    }

    public transform() {
        const sp = this.source.anchor.transform.app.position;
        const tp = this.target.anchor.transform.app.position;
        const dif = tp.subtract(sp);
        // position
        const position = Vector3.Center(sp, tp);
        // scale
        const scale = dif.length() / this.options.length * 0.85;
        // rotation
        const ref = new Vector3(0, 1, 0);
        const cross = Vector3.Cross(ref, dif);
        const dot = Vector3.Dot(ref, dif);
        const w = Math.sqrt(ref.length() ** 2 * dif.length() ** 2) + dot;
        const rotation = new Quaternion(cross.x, cross.y, cross.z, w);

        this.model.transform.local.position.copyFrom(position);
        this.model.transform.local.rotation.copyFrom(rotation);
        this.model.transform.local.scale.y = scale;
    }
}

export interface WayPointGraphOptions {
    node: WayPointOptions,
    edge: WayPointEdgeOptions
}

export interface WayPointGraphNode {
    wayPoint: WayPoint,
    adjacency: { [id: number]: WayPointEdge }
}

export type WaypointGraphData = {
    wayPoint: WayPointOptions,
    adjacency: number[]
}[];

export class WayPointGraph {
    private nodes: Map<number, WayPointGraphNode>;
    private id: number = 0;

    public wayPointIds: Map<WayPoint, number>;

    private handler: (user: User, _: ButtonEventData, wayPoint: WayPoint) => void;

    get wayPoints() { return [...this.nodes.values()].map(n => n.wayPoint); }

    private _edit: boolean = false;
    get edit() {
        return this._edit;
    }
    set edit(e: boolean) {
        this._edit = e;
        this.nodes.forEach(n => {
            n.wayPoint.edit = this._edit;
            Object.values(n.adjacency).forEach(e => {
                e.edit = this._edit;
            });
        });
    }

    constructor(private context: Context, private assets: AssetContainer, private options: WayPointGraphOptions) {
        this.nodes = new Map<number, WayPointGraphNode>();
        this.wayPointIds = new Map<WayPoint, number>();
    }

    public addNode(wayPointOptions?: WayPointOptions) {
        const options = wayPointOptions ? wayPointOptions : this.options.node;
        const wayPoint = new WayPoint(this.context, this.assets, options);
        wayPoint.addButtonBehavior(this.handler);
        wayPoint.addGrabEndBehavior(() => {
            const nodeId = this.wayPointIds.get(wayPoint);
            const node = this.nodes.get(nodeId);
            // indegrees
            this.nodes.forEach((n, _) => {
                if (n.adjacency[nodeId] !== undefined) {
                    n.adjacency[nodeId].transform();
                }
            });
            // outdegrees
            Object.keys(node.adjacency).forEach(k => {
                node.adjacency[parseInt(k)].transform();
            });
        });
        this.nodes.set(this.id, {
            wayPoint,
            adjacency: {}
        });
        this.wayPointIds.set(wayPoint, this.id);
        this.id++;
    }

    public removeNode(nodeId: number) {
        if (!this.nodes.has(nodeId)) { return; }
        // remove indegrees
        this.nodes.forEach((p, pid) => {
            if (p.adjacency[nodeId] !== undefined) {
                this.removeEdge(pid, nodeId);
                delete p.adjacency[nodeId];
            }
        });

        const node = this.nodes.get(nodeId);
        // remove outdegress
        Object.keys(node.adjacency).forEach(k => {
            this.removeEdge(nodeId, parseInt(k))
        });
        // remove node
        const wayPoint = this.nodes.get(nodeId).wayPoint;
        this.wayPointIds.delete(wayPoint);
        wayPoint.remove();
        this.nodes.delete(nodeId);
    }

    public async addEdge(sourceId: number, targetId: number, edit?: boolean) {
        if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) { return; }
        const source = this.nodes.get(sourceId);
        const target = this.nodes.get(targetId);
        const edge = new WayPointEdge(this.context, this.assets, { ...this.options.edge, edit }, source.wayPoint, target.wayPoint);
        source.adjacency[targetId] = edge;
        await source.wayPoint.anchor.created();
        await target.wayPoint.anchor.created();
        edge.transform();
    }

    public removeEdge(sourceId: number, targetId: number) {
        if (!this.nodes.has(sourceId)) { return; }
        const source = this.nodes.get(sourceId);
        const edge = source.adjacency[targetId];
        if (edge) {
            edge.remove();
            delete source.adjacency[targetId];
        }
    }

    public adjacency(wayPoint: WayPoint) {
        const node = this.nodes.get(this.wayPointIds.get(wayPoint));
        return Object.keys(node.adjacency).map(nid => this.nodes.get(parseInt(nid)));
    }

    public clear() {
        this.nodes.forEach((node, nodeId) => {
            Object.keys(node.adjacency).forEach(k => {
                this.removeEdge(nodeId, parseInt(k))
            });
            node.wayPoint.remove();
        });
        this.nodes = new Map<number, WayPointGraphNode>();
        this.wayPointIds = new Map<WayPoint, number>();
        this.id = 0;
    }

    public addWayPointButtonBehavior(handler: (user: User, _: ButtonEventData, wayPoint: WayPoint) => void) {
        this.handler = handler;
    }

    public import(data: WaypointGraphData) {
        const newIds = new Map<number, number>();
        data.forEach((d, id) => {
            newIds.set(id, this.id);
            this.addNode({
                ...this.options.node, ...d
            });
        });

        data.forEach((d, id) => {
            const sid = newIds.get(id);
            d.adjacency.forEach(a => {
                const tid = newIds.get(a);
                this.addEdge(sid, tid);
            })
        });
    }

    public toJSON() {
        const newIds = new Map<number, number>();
        [...this.nodes.keys()].sort().forEach((id, i) => {
            newIds.set(id, i);
        });
        return [...this.nodes.keys()].sort().map(id => {
            const node = this.nodes.get(id);
            const pos = node.wayPoint.anchor.transform.app.position;
            const rot = node.wayPoint.anchor.transform.app.rotation.toEulerAngles();
            const transform = {
                position: { x: pos.x, y: pos.y, z: pos.z },
                rotation: { x: rot.x / DegreesToRadians, y: rot.y / DegreesToRadians, z: rot.z / DegreesToRadians }
            };
            const adjacency = Object.keys(node.adjacency).map(id => newIds.get(parseInt(id)));

            return {
                waypointOptions: {
                    ...node.wayPoint.options,
                    transform,
                },
                adjacency
            }
        });
    }
}