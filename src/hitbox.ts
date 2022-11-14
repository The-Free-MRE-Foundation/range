import { Actor, AssetContainer, AttachPoint, ColliderType, CollisionLayer, Context, RigidBodyConstraints, ScaledTransformLike, User } from "@microsoft/mixed-reality-extension-sdk";
import { translate } from "./utils";

export enum HitBoxShape {
    SPHERE = 'SPHERE',
    BOX = 'BOX',
    CAPSULE = 'CAPSULE',
}

export interface HitBoxOptions {
    blood?: {
        resourceId: string,
        transform?: Partial<ScaledTransformLike>,
    },
    trigger: {
        transform?: Partial<ScaledTransformLike>,
        dimensions: { width: number, height: number, depth: number },
        shape?: HitBoxShape,
    },
    rigidbody: {
        dimensions: { width: number, height: number, depth: number },
        shape?: HitBoxShape,
    },
    damage: number,
    attachPoint?: string,
}

export class HitBox {
    private trigger: Actor;
    private rigidbody: Actor;

    // callback
    public onHit: (damage: number) => void;
    constructor(private context: Context, private assets: AssetContainer, private options: HitBoxOptions, private target: Actor | User) {
        const local = translate(this.options.trigger.transform ? this.options.trigger.transform : {}).toJSON();
        const dim = this.options.trigger.dimensions;
        const name = `${this.options.trigger.shape},${dim.width},${dim.height},${dim.depth}`;
        let mesh = this.assets.meshes.find(m => m.name === name);
        if (!mesh) {
            switch (this.options.trigger.shape) {
                case HitBoxShape.SPHERE:
                    mesh = this.assets.createSphereMesh(name, dim.width);
                    break;
                case HitBoxShape.CAPSULE:
                    mesh = this.assets.createCapsuleMesh(name, dim.width, dim.height);
                    break;
                default:
                    mesh = this.assets.createBoxMesh(name, dim.width, dim.height, dim.depth);
                    break;
            }
        }

        const material = this.assets.materials.find(m => m.name === 'invis');
        this.trigger = Actor.Create(this.context, {
            actor: Object.assign({
                appearance: {
                    meshId: mesh.id,
                    materialId: material.id,
                },
                collider: {
                    geometry: { shape: ColliderType.Auto },
                    layer: CollisionLayer.Default,
                    isTrigger: true
                },
                transform: {
                    local
                }
            },
                target instanceof User ? {
                    attachment: {
                        userId: target.id,
                        attachPoint: this.options.attachPoint as AttachPoint
                    }
                } : {
                    parentId: target.id,
                },
            )
        });

        this.rigidbody = this.spawnRigidBody(target);
        // behavior
        this.trigger.collider.onTrigger('trigger-exit', (actor: Actor) => {
            if (actor.id != this.rigidbody.id) { return; }
            if (this.options.blood) {
                const local = translate(this.options.trigger.transform ? this.options.trigger.transform : {}).toJSON();
                const blood = Actor.CreateFromLibrary(this.context, {
                    resourceId: this.options.blood ? this.options.blood.resourceId : 'artifact:1688444119770202767',
                    actor: {
                        transform: {
                            local
                        }
                    }
                });
                if (target instanceof User) {
                    blood.attach(target.id, this.options.attachPoint as AttachPoint);
                } else {
                    blood.parentId = target.id;
                }
                setTimeout(() => {
                    blood.destroy();
                }, 1.500 * 1000);
            }
            this.rigidbody.destroy();
            this.rigidbody = this.spawnRigidBody(target);

            this.onHit(this.options.damage);
        });
    }

    private spawnRigidBody(target: Actor | User) {
        const local = translate(this.options.trigger.transform ? this.options.trigger.transform : {}).toJSON();
        const dim = this.options.rigidbody.dimensions;
        const name = `${this.options.rigidbody.shape},${dim.width},${dim.height},${dim.depth}`;
        let mesh = this.assets.meshes.find(m => m.name === name);
        if (!mesh) {
            switch (this.options.rigidbody.shape) {
                case HitBoxShape.SPHERE:
                    mesh = this.assets.createSphereMesh(name, dim.width);
                    break;
                case HitBoxShape.CAPSULE:
                    mesh = this.assets.createCapsuleMesh(name, dim.width, dim.height);
                    break;
                default:
                    mesh = this.assets.createBoxMesh(name, dim.width, dim.height, dim.depth);
                    break;
            }
        }

        const material = this.assets.materials.find(m => m.name === 'invis');
        const rigid = Actor.Create(this.context, {
            actor: Object.assign({
                appearance: {
                    meshId: mesh.id,
                    materialId: material.id,
                },
                collider: {
                    geometry: { shape: ColliderType.Auto },
                    layer: CollisionLayer.Default,
                },
                rigidBody: {
                    useGravity: false,
                    constraints: [RigidBodyConstraints.FreezePositionY]
                },
                transform: {
                    local
                }
            },
                target instanceof User ? {
                    attachment: {
                        userId: target.id,
                        attachPoint: this.options.attachPoint as AttachPoint,
                    }
                } : {
                    parentId: target.id,
                }
            )
        });

        return rigid;
    }

    public remove() {
        this.trigger.destroy();
        this.rigidbody?.destroy();
    }
}