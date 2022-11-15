import { Actor, AssetContainer, AttachPoint, ButtonBehavior, ColliderType, CollisionLayer, Context, DegreesToRadians, Guid, InvertedGroupMask, Quaternion, ScaledTransformLike, User } from "@microsoft/mixed-reality-extension-sdk";
import { ItemOptions } from "./item";
import { translate } from "./utils";

export enum EquipmentType {
    NVG= 'NVG',
    SHIELD = 'SHIELD',
}

export interface EquipmentOptions extends ItemOptions{
    subType: EquipmentType,
    // equipment
    transform: Partial<ScaledTransformLike>,
    attachPoint: AttachPoint,
    user: User,
}

export class Equipment {
    protected model: Actor;

    constructor(protected context: Context, protected assets: AssetContainer, public options: EquipmentOptions) {
        if (this.options.resourceId){
            this.createModel();
        }
    }

    private createModel(){
        const local = translate(this.options.transform).toJSON();
        this.model = Actor.CreateFromLibrary(this.context, {
            resourceId: this.options.resourceId,
            actor: {
                transform: {
                    local,
                },
                attachment: {
                    userId: this.options.user.id,
                    attachPoint: this.options.attachPoint as AttachPoint
                }
            }
        });
    }

    public reattach(){
        if (this.options.user === undefined){ return; }

        const attachPoint = this.options.attachPoint ? this.options.attachPoint : 'left-hand';
        this.model.detach();
        this.model.attach(this.options.user, attachPoint as AttachPoint);
    }

    public remove(){
        this.model?.destroy();
    }
}

export interface NVGEquipmentOptions extends EquipmentOptions {
    light: string,
    sounds: {[name: string]: string},
    button: {
        dimensions: {width: number, height: number, depth: number},
        transform: Partial<ScaledTransformLike>,
    }
}

export class NVGEquipment extends Equipment{
    private light: Actor;
    private button: Actor;

    private _isOn: boolean;
    get isOn(){
        return this._isOn;
    }

    set isOn(o: boolean){
        if (this._isOn == o) return;
        this._isOn = o;
        if (this._isOn) {
            this.createLight();
        } else {
            this.removeLight();
        }
    }

    constructor(context: Context, assets: AssetContainer, options: NVGEquipmentOptions) {
        super(context, assets, options);

        this.createLight();
        this.createButton();
    }

    private createLight(){
        if (this.light) return;
        this.light = Actor.CreateFromLibrary(this.context, {
            resourceId: (this.options as NVGEquipmentOptions).light,
            actor: {
                exclusiveToUser: this.options.user.id
            }
        });
        this.playSound('on');
    }

    private createButton(){
        const options = (this.options as NVGEquipmentOptions);
        const local = translate(options.button.transform).toJSON();
        const dim = options.button.dimensions;
		const name = `${dim.width},${dim.height},${dim.depth}`;
		let mesh = this.assets.meshes.find(m => m.name === name);
		if (!mesh) {
			mesh = this.assets.createBoxMesh(name, dim.width, dim.height, dim.depth);
		}
		const material = this.assets.materials.find(m => m.name === 'invis');
        this.button = Actor.Create(this.context, {
            actor: {
                name: "nvg_button",
                parentId: this.model.id,
                transform: {
                    local,
                },
                appearance: {
                    meshId: mesh.id,
                    materialId: material.id,
                },
                collider: { 
                    geometry: { shape: ColliderType.Auto },
                    layer: CollisionLayer.Hologram,
                    isTrigger: true
                },
            }
        });

        this.button.setBehavior(ButtonBehavior).onClick((user, _)=>{
            this.isOn = !this.isOn;
        });
    }

    private removeLight(){
        if (!this.light) return;
        this.light.destroy();
        this.light = undefined;
        this.playSound('off');
    }

    private playSound(name: string){
        const options = (this.options as NVGEquipmentOptions);
        const actor = Actor.CreateFromLibrary(this.context, {
            resourceId: options.sounds[name],
            actor: {
                attachment: {
                    userId: options.user.id,
                    attachPoint: 'head',
                }
            }
        });

        setTimeout(()=>{
            actor.destroy();
        }, 6*1000);
    }

    public remove(){
        super.remove();
        this.light.destroy();
        this.model?.destroy();
    }
}