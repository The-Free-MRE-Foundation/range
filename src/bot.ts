import { Actor, ActorPath, Animation, AnimationData, AnimationDataLike, AnimationEaseCurves, AnimationWrapMode, AssetContainer, Context, DegreesToRadians, GroupMask, Quaternion, ScaledTransformLike } from "@microsoft/mixed-reality-extension-sdk";
import { HitBox, HitBoxOptions, HitBoxShape } from "./hitbox";
import { Async, translate } from "./utils";
import { WayPoint, WayPointGraph } from "./waypoint";

interface BotAnimation {
    duration: number, // seconds
    data: AnimationDataLike
}

const botAnimations: { [name: string]: BotAnimation } = {
    'death': {
        duration: 1,
        data: {
            tracks: [
                {
                    target: ActorPath("bot").transform.local.rotation,
                    easing: AnimationEaseCurves.Linear,
                    keyframes: [
                        {
                            time: 0,
                            value: Quaternion.FromEulerAngles(0, 0, 0)
                        },
                        {
                            time: 0.3,
                            value: Quaternion.FromEulerAngles(90 * DegreesToRadians, 0, 0)
                        }
                    ]
                }
            ]
        }
    },
    'spawn': {
        duration: 1,
        data: {
            tracks: [
                {
                    target: ActorPath("bot").transform.local.rotation,
                    easing: AnimationEaseCurves.Linear,
                    keyframes: [
                        {
                            time: 0,
                            value: Quaternion.FromEulerAngles(90 * DegreesToRadians, 0, 0)
                        },
                        {
                            time: 0.3,
                            value: Quaternion.FromEulerAngles(0, 0, 0)
                        }
                    ]
                }
            ]
        }
    },
    'missed': {
        duration: 1,
        data: {
            tracks: [
                {
                    target: ActorPath("bot").transform.local.scale,
                    easing: AnimationEaseCurves.Linear,
                    // keyframes: [...Array(10 + 1).keys()].map(i => ({
                    //     time: i * 1 / 10,
                    //     value: Quaternion.FromEulerAngles((90 - i * 90) * DegreesToRadians / 10, (i * 3 * 360) * DegreesToRadians / 10, 0)
                    // }))
                    keyframes: [
                        {
                            time: 0,
                            value: { x: 1, y: 1, z: 1 }
                        },
                        {
                            time: 0.4,
                            value: { x: 0.001, y: 0.001, z: 0.001 }
                        }
                    ]
                }
            ]
        }
    }
}

export const defaultBotHitBoxes: HitBoxOptions[] = [
    {
        attachPoint: 'head',
        blood: {
            resourceId: 'artifact:2135523391157829869',
        },
        trigger: {
            dimensions: {
                width: 0.3, height: 0.3, depth: 0.3,
            },
            shape: HitBoxShape.SPHERE,
            transform: {
                position: { x: 0, y: 1.1, z: 0 },
            },
        },
        rigidbody: {
            dimensions: {
                width: 0.2, height: 0.2, depth: 0.2,
            },
            shape: HitBoxShape.SPHERE,
        },
        damage: 200
    },
    {
        attachPoint: 'chest-center',
        blood: {
            resourceId: 'artifact:2135523391157829869',
        },
        trigger: {
            dimensions: {
                width: 0.2, height: 0.2, depth: 0.2,
            },
            shape: HitBoxShape.BOX,
            transform: {
                position: { x: 0, y: 0.485, z: 0 },
            },
        },
        rigidbody: {
            dimensions: {
                width: 0.1, height: 0.1, depth: 0.1,
            },
            shape: HitBoxShape.BOX,
        },
        damage: 80
    },
    {
        attachPoint: 'chest-left',
        blood: {
            resourceId: 'artifact:2135523391157829869',
        },
        trigger: {
            dimensions: {
                width: 0.2, height: 0.2, depth: 0.2,
            },
            shape: HitBoxShape.BOX,
            transform: {
                position: { x: -0.182, y: 0.485, z: 0 },
            },
        },
        rigidbody: {
            dimensions: {
                width: 0.1, height: 0.1, depth: 0.1,
            },
            shape: HitBoxShape.BOX,
        },
        damage: 80
    },
    {
        attachPoint: 'chest-right',
        blood: {
            resourceId: 'artifact:2135523391157829869',
        },
        trigger: {
            dimensions: {
                width: 0.2, height: 0.2, depth: 0.2,
            },
            shape: HitBoxShape.BOX,
            transform: {
                position: { x: 0.182, y: 0.485, z: 0 },
            },
        },
        rigidbody: {
            dimensions: {
                width: 0.1, height: 0.1, depth: 0.1,
            },
            shape: HitBoxShape.BOX,
        },
        damage: 80
    },
    {
        attachPoint: 'chest-top',
        blood: {
            resourceId: 'artifact:2135523391157829869',
        },
        trigger: {
            dimensions: {
                width: 0.3, height: 0.1, depth: 0.1,
            },
            shape: HitBoxShape.BOX,
            transform: {
                position: { x: 0, y: 0.241, z: 0 },
            },
        },
        rigidbody: {
            dimensions: {
                width: 0.2, height: 0.08, depth: 0.08,
            },
            shape: HitBoxShape.BOX,
        },
        damage: 80
    },
    {
        attachPoint: 'chest-bottom',
        blood: {
            resourceId: 'artifact:2135523391157829869',
        },
        trigger: {
            dimensions: {
                width: 0.3, height: 0.1, depth: 0.1,
            },
            shape: HitBoxShape.BOX,
            transform: {
                position: { x: 0, y: 0.729, z: 0 },
            },
        },
        rigidbody: {
            dimensions: {
                width: 0.2, height: 0.08, depth: 0.08,
            },
            shape: HitBoxShape.BOX,
        },
        damage: 80
    },
];

export interface BotOptions {
    spawn: WayPoint,
    model: {
        hidden?: string,
        resourceId: string,
        transform?: Partial<ScaledTransformLike>,
    },
    hp?: number,
    ttl?: number,
    hitboxes: HitBoxOptions[],
}

export class Bot extends Async {
    private anchor: Actor;
    private model: Actor;
    private hidden: Actor;
    private hitboxes: HitBox[];

    // logic
    private isDead: boolean = false;
    get dead() {
        return this.isDead;
    }

    private isMissed: boolean = false;
    private _hp: number;
    private _ttl: number;
    private timeout: NodeJS.Timeout;

    // waypoint
    public waypoint: WayPoint;

    get ttl() { return this._ttl; }
    set ttl(n: number) {
        this._ttl = Math.max(n, 0);
        if (this._ttl <= 0) {
            this.miss();
        }
    }
    get hp() { return this._hp; }
    set hp(n: number) {
        this._hp = Math.max(n, 0);
        if (this._hp <= 0) {
            this.death();
        }
    }

    // callbacks
    public onDeath: () => void;
    public onMiss: () => void;
    public onTarget: () => void;

    constructor(private context: Context, private assets: AssetContainer, private options: BotOptions) {
        super();
        this.init();
    }

    private async init() {
        this.waypoint = this.options.spawn;
        this.createAnchor();
        this.createModel();
        await this.animate('spawn');
        this.createHitBoxes();

        this.hp = this.options.hp ? this.options.hp : 100;
        this.ttl = this.options.ttl;
        if (this.ttl !== undefined && this.ttl > 0) {
            this.startTimer();
        }

        this.notifyCreated(true);
    }

    private createAnchor() {
        const local = this.options.spawn.anchor.transform.local.toJSON();
        this.anchor = Actor.Create(this.context, {
            actor: {
                transform: {
                    local
                }
            }
        });
    }

    private createModel() {
        const local = translate(this.options.model.transform ? this.options.model.transform : {});
        this.model = Actor.CreateFromLibrary(this.context, {
            resourceId: this.options.model.resourceId,
            actor: {
                parentId: this.anchor.id,
                appearance: { 
                    enabled: this.options.model.hidden ? new GroupMask(this.context, ['default']) : true,
                },
                transform: {
                    local
                }
            }
        });

        if (!this.options.model.hidden) return;
        this.hidden = Actor.CreateFromLibrary(this.context, {
            resourceId: this.options.model.hidden,
            actor: {
                parentId: this.anchor.id,
                appearance: { 
                    enabled: new GroupMask(this.context, ['hidden']),
                },
                transform: {
                    local
                }
            }
        });
    }

    private async animate(name: string) {
        const animDataLike: AnimationDataLike = botAnimations[name].data;
        let animData: AnimationData = this.assets.animationData.find(a => a.name == name);
        if (!animData) {
            animData = this.assets.createAnimationData(name, animDataLike);
        }
        animData.bind({ bot: this.model }, {
            isPlaying: true,
            wrapMode: AnimationWrapMode.Once
        });
        if (this.hidden) {
            animData.bind({ bot: this.hidden }, {
                isPlaying: true,
                wrapMode: AnimationWrapMode.Once
            });
        }
        await new Promise(r => setTimeout(r, botAnimations[name].duration * 1000));
    }

    private createHitBoxes() {
        this.hitboxes = this.options.hitboxes.map(h => {
            const hitbox = new HitBox(this.context, this.assets, h, this.anchor);
            hitbox.onHit = (damage: number) => {
                this.hp -= damage;
            }
            return hitbox;
        });
    }

    private startTimer() {
        this.timeout = setTimeout(() => {
            this.miss();
            clearTimeout(this.timeout);
        }, this.ttl * 1000);
    }

    private async death() {
        if (this.isDead || this.isMissed) { return; }
        this.isDead = true;
        this.hitboxes.forEach(h => h.remove());
        await this.animate('death');
        if (this.onDeath) this.onDeath();

        this.remove();
    }

    private async miss() {
        if (this.isDead || this.isMissed) { return; }
        this.isMissed = true;
        this.hitboxes.forEach(h => h.remove());
        await this.animate('missed');
        if (this.onMiss) this.onMiss();

        this.remove();
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }

    public async traverse(wayPointGraph: WayPointGraph) {
        while (true) {
            if (this.isDead) { return; }
            const adjs = wayPointGraph.adjacency(this.waypoint);
            if (adjs.length == 0) { return; }

            const nextWayPoint = adjs[Math.floor(Math.random() * adjs.length)].wayPoint;
            const from = this.waypoint.anchor.transform.app.position.clone();
            const to = nextWayPoint.anchor.transform.app.position.clone();
            const dist = from.subtract(to).length();
            await this.moveTo(nextWayPoint, dist);
            this.waypoint = nextWayPoint;
        }
    }

    public async chase(target: Actor, wayPointGraph: WayPointGraph) {
        while (true) {
            if (this.isDead) { return; }
            // find nearest waypoint to the target
            const targetWayPoint = wayPointGraph.nearestWayPoint(target);
            const targetWayPointID = wayPointGraph.wayPointIds.get(targetWayPoint);
            // find next hop to the nearest waypoint
            const currentWayPoint = this.waypoint;
            const currentWayPointID = wayPointGraph.wayPointIds.get(currentWayPoint);
            if (targetWayPointID == currentWayPointID) {
                this.remove();
                this.onTarget();
                return;
            }

            const nextWayPointID = wayPointGraph.nextHop[currentWayPointID][targetWayPointID];
            if (nextWayPointID === undefined) {
                return;
            }
            const nextWayPoint = wayPointGraph.nodes.get(nextWayPointID).wayPoint;

            const a = currentWayPoint.anchor.transform.app.position.clone();
            const b = nextWayPoint.anchor.transform.app.position.clone();

            this.waypoint = nextWayPoint;
            await this.moveTo(nextWayPoint, a.subtract(b).length(), 1);
        }
    }

    public async moveTo(wayPoint?: WayPoint | Actor, dist?: number, speed: number = 1) {
        const target = wayPoint instanceof WayPoint ? wayPoint.anchor : wayPoint;
        await Animation.AnimateTo(this.context, this.anchor, {
            destination: {
                transform: {
                    local: target.transform.app.toJSON(),
                }
            },
            duration: dist ? dist / speed : 1,
            easing: AnimationEaseCurves.Linear
        });
    }

    public remove() {
        this.anchor.destroy();
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
    }
}