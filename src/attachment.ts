import { Actor, AssetContainer, ButtonBehavior, ColliderType, CollisionLayer, Context, Guid, ScaledTransformLike, User } from "@microsoft/mixed-reality-extension-sdk";
import { ItemOptions } from "./item";
import { translate } from "./utils";

export enum AttachmentType {
    SCOPE = 'SCOPE',
    GRIP = 'GRIP',
    LIGHT = 'LIGHT',
    SILENCER = 'SILENCER'
}

export interface AttachmentOptions extends ItemOptions {
    subType: AttachmentType,
    transform: Partial<ScaledTransformLike>,
}

export class Attachment {
    protected model: Actor;

    get name() {
        return this.options.name;
    }

    get type() {
        return this.options.subType;
    }

    constructor(protected context: Context, protected assets: AssetContainer, public options: AttachmentOptions, private parentId: Guid) {
        if (this.options.resourceId) {
            this.createModel();
        }
    }

    private createModel() {
        const local = translate(this.options.transform).toJSON();
        this.model = Actor.CreateFromLibrary(this.context, {
            resourceId: this.options.resourceId,
            actor: {
                parentId: this.parentId,
                transform: {
                    local
                }
            }
        });
    }

    public remove() {
        this.model.destroy();
    }
}

// scope
export interface ScopeAttachmentOptions extends AttachmentOptions {
    // scope
    scope: {
        resourceId: string,
        transform: Partial<ScaledTransformLike>,
        bullet?: Partial<ScaledTransformLike>,
    },
    owner?: User
}

export class ScopeAttachment extends Attachment {
    private scope: Actor;

    get bullet() {
        return (this.options as ScopeAttachmentOptions).scope.bullet;
    }

    constructor(context: Context, assets: AssetContainer, options: ScopeAttachmentOptions, parentId: Guid) {
        super(context, assets, options, parentId);
        if ((this.options as ScopeAttachmentOptions).scope.resourceId) {
            this.createScopeModel();
        }
    }

    private createScopeModel() {
        const options = (this.options as ScopeAttachmentOptions);
        const local = translate(options.scope.transform).toJSON();
        this.scope = Actor.CreateFromLibrary(this.context, {
            resourceId: options.scope.resourceId,
            actor: Object.assign({
                parentId: this.model.id,
                transform: {
                    local
                }
            },
                options.owner !== undefined ? { exclusiveToUser: options.owner.id } : {},
            )
        });
    }
}

// silencer
export interface SilencerAttachmentOptions extends AttachmentOptions {
    silencer: {
        single: string,
        auto: string
    }
}

export class SilencerAttachment extends Attachment {
    get single() {
        return (this.options as SilencerAttachmentOptions).silencer.single;
    }
    get auto() {
        return (this.options as SilencerAttachmentOptions).silencer.auto;
    }

    constructor(context: Context, assets: AssetContainer, options: SilencerAttachmentOptions, parentId: Guid) {
        super(context, assets, options, parentId);
    }
}

// light
export interface LightAttachmentOptions extends AttachmentOptions {
    light: {
        resourceId: string,
        transform: Partial<ScaledTransformLike>,
        dimensions: { width: number, height: number, depth: number }
    },
}

export class LightAttachment extends Attachment {
    private light: Actor;
    private button: Actor;

    get on() { return this.light != undefined; }

    constructor(context: Context, assets: AssetContainer, options: LightAttachmentOptions, parentId: Guid) {
        super(context, assets, options, parentId);
        this.createLight();
        this.createButton();
    }

    private async createLight() {
        const options = (this.options as LightAttachmentOptions);
        const local = translate(options.light.transform).toJSON();
        this.light = Actor.CreateFromLibrary(this.context, {
            resourceId: options.light.resourceId,
            actor: {
                parentId: this.model.id,
                transform: {
                    local,
                },
                appearance: {
                    enabled: true
                }
            }
        });
    }

    private removeLight() {
        if (this.light) {
            this.light.destroy();
            this.light = undefined;
        }
    }

    private createButton() {
        const options = (this.options as LightAttachmentOptions);
        const dim = options.light.dimensions;
        const local = translate(options.light.transform);
		const name = `${dim.width},${dim.height},${dim.depth}`;
		let mesh = this.assets.meshes.find(m => m.name === name);
		if (!mesh) {
			mesh = this.assets.createBoxMesh(name, dim.width, dim.height, dim.depth);
		}
		const material = this.assets.materials.find(m => m.name === 'invis');
        this.button = Actor.Create(this.context, {
            actor: {
                name: "light_switch",
                parentId: this.model.id,
                appearance: {
                    meshId: mesh.id,
                    materialId: material.id,
                },
                transform: {
                    local
                },
                collider: {
                    geometry: { shape: ColliderType.Auto },
                    layer: CollisionLayer.Hologram,
                    isTrigger: true
                },
            }
        });

        this.button.setBehavior(ButtonBehavior).onClick((user, _) => {
            if (this.on) {
                this.turnOff();
            } else {
                this.turnOn();
            }
        });
    }

    public turnOn() {
        if (!this.light) this.createLight();
    }

    public turnOff() {
        if (this.light) this.removeLight();
    }
}