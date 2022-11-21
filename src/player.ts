import { Actor, AssetContainer, AttachPoint, ButtonBehavior, ColliderType, CollisionLayer, Context, RigidBodyConstraints, ScaledTransformLike, User } from "@microsoft/mixed-reality-extension-sdk";
import { AssetData } from "altvr-gui";
import { Equipment, EquipmentOptions, EquipmentType, NVGEquipment, NVGEquipmentOptions } from "./equipment";
import { Gun, GunOptions, GUN_COMMONS } from "./gun";
import { StartWindow } from "./menus/start";
import { MenuApp } from "./myapp";
import { translate } from "./utils";

export interface PlayerOptions {
    user: User,
    transform?: Partial<ScaledTransformLike>,
    weapons_data: any,
    reload: {
        dimensions: { width: number, height: number, depth: number }
        transform?: Partial<ScaledTransformLike>,
    },
}

export class Player {
    private logo: Actor;
    private gunApp: MenuApp;

    private _gun: Gun;
    get gun() {
        return this._gun;
    }
    private magazine: Actor;
    private reload: Actor;

    private _equipment: Equipment;
    get equipment() {
        return this._equipment;
    }

    private tracker: Actor;
    get transform() {
        return this.tracker.transform.app.toJSON();
    }

    get user() {
        return this.options.user;
    }

    private _hidden: boolean = false;
    get hidden() {
        return this._hidden;
    }
    set hidden(h: boolean) {
        this._hidden = h;
        if (!this._hidden) {
            this.options.user.groups.delete('hidden');
            this.options.user.groups.add('default');
        } else {
            this.options.user.groups.delete('default');
            this.options.user.groups.add('hidden');
        }
    }

    public onAction: (action: string, user: User, params: any) => void;

    constructor(private context: Context, private assets: AssetContainer, private options: PlayerOptions, private uiassets: { [name: string]: AssetData }, private baseurl: string) {
        this.init();
        this.createLogo(false);
    }

    private async init() {
        this.hidden = false;

        this.createTracker();
        this.createReload();

        // UI
        this.gunApp = new MenuApp(this.context, this.assets, {
            uiassets: this.uiassets,
            baseurl: this.baseurl,
            user: this.options.user,
            exclusive: true,
            attachment: false,
            transform: this.options.transform ? this.options.transform : {},
        });

        await this.gunApp.created();
        this.gunApp.anchor.attach(this.options.user.id, 'spine-middle');
        this.gunApp.anchor.transform.local.copy(
            {
                position: {
                    x: -0.7, y: 0, z: 1.2
                },
                scale: {
                    x: 0.72, y: 0.72, z: 0.72
                }
            }
        );

        await this.installStartWindow();

        this.gunApp.window = '';
    }

    private async installStartWindow() {
        const startWindow = new StartWindow(this.context, {
            baseurl: this.baseurl,
            menu: this.gunApp.menu,
            menu_url: "start.xml",
            options: {},
            attachment_url: "attachment.xml",
            editor_url: "editor.xml",
            game_url: "game.xml",
            help_url: "help.xml",
            weapons_data: this.options.weapons_data,
        });
        await startWindow.created();
        startWindow.onAction = (action: string, user: User, params?: any) => {
            switch (action) {
                case 'close':
                    this.gunApp.window = '';
                    this.logo.destroy();
                    this.createLogo(false);
                    break;
                case 'minimize':
                    this.gunApp.window = '';
                    break;
                default:
                    this.onAction(action, user, params);
                    break;
            }
        };
        startWindow.getPlayer = () => {
            return this;
        }

        this.gunApp.installWindow("start", startWindow);
    }

    private async createLogo(attach: boolean = true) {
        let mesh = this.assets.meshes.find(m => m.name == "icon_mesh");
        if (!mesh) {
            mesh = this.assets.createSphereMesh("icon_mesh", 0.03);
        }
        this.logo = Actor.CreateFromLibrary(this.context, {
            resourceId: 'artifact:2136479123109839116',
            actor: {
                grabbable: false,
                appearance: {
                    meshId: mesh.id,
                    materialId: this.assets.materials.find((m) => m.name == "invis").id,
                },
                collider: {
                    geometry: { shape: ColliderType.Box },
                    layer: CollisionLayer.Hologram,
                },
                exclusiveToUser: this.options.user.id,
            },
        });

        this.logo.setBehavior(ButtonBehavior).onClick(async (user, _) => {
            // this.gunApp.window = '';
            // this.installStartWindow();
            // this.gunApp.window = 'start';
            // return;
            if (!this.logo.attachment) {
                this.attachLogo();
            }

            if (this.gunApp.window == 'start') {
                this.gunApp.window = '';
            } else {
                this.gunApp.window = 'start';
            }
        });

        if (attach) {
            this.attachLogo();
        }
    }

    private attachLogo() {
        this.logo.attach(this.options.user.id, 'spine-middle');
        this.logo.transform.local.copy({
            position: {
                x: 0.7, y: -0.5, z: 1
            },
            rotation: {
                x: 40, y: -30, z: 0
            },
            scale: {
                x: 2, y: 2, z: 2
            }
        });
    }

    public equipGun(options: Partial<GunOptions>) {
        this._gun?.remove();
        if (!this._gun || (this._gun && this._gun.name != options.name)) {
            this._gun = new Gun(this.context, this.assets, {
                ...GUN_COMMONS,
                ...options,
                user: this.options.user,
            } as GunOptions);
            this._gun.onAmmo = (ammo: number) => { }
            this._gun.onMag = () => {
                this.equipMag();
            }
            this._gun.onReload = () => {
                if (this.magazine) {
                    this.magazine.destroy();
                    this.magazine = undefined;
                    return true;
                }
                return false;
            }
        } else {
            this._gun = undefined;
        }
    }

    public equipEquipment(options: Partial<EquipmentOptions>) {
        if (this._equipment && this._equipment.options.name == options.name) {
            this._equipment.remove();
            this._equipment = undefined;
            return;
        }

        switch (options.subType) {
            case EquipmentType.NVG:
                this._equipment = new NVGEquipment(this.context, this.assets, {
                    ...options,
                    user: this.options.user,
                } as NVGEquipmentOptions);
                break;
            default:
                this._equipment = new Equipment(this.context, this.assets, {
                    ...options,
                    user: this.options.user,
                } as EquipmentOptions);
                break;
        }
    }

    private equipMag() {
        if (!this._gun) { return; }
        if (this.magazine) { return; }
        const options = this._gun.options;
        const local = translate(options.magazine.transform).toJSON();
        this.magazine = Actor.CreateFromLibrary(this.context, {
            resourceId: options.magazine.resourceId,
            actor: {
                transform: {
                    local
                },
                attachment: {
                    userId: this.options.user.id,
                    attachPoint: 'left-hand'
                }
            }
        });
        this.reload.destroy();
        this.createReload();
    }

    private createTracker() {
        this.tracker = Actor.Create(this.context, {
            actor: {
                subscriptions: ['transform'],
                attachment: {
                    userId: this.options.user.id,
                    attachPoint: 'spine-middle',
                }
            }
        });
    }

    private createReload() {
        const local = translate(this.options.reload.transform).toJSON();
        const dim = this.options.reload.dimensions;
        const name = `${dim.width},${dim.height},${dim.depth}`;
        let mesh = this.assets.meshes.find(m => m.name === name);
        if (!mesh) {
            mesh = this.assets.createBoxMesh(name, dim.width, dim.height, dim.depth);
        }
        const material = this.assets.materials.find(m => m.name === 'invis');
        this.reload = Actor.Create(this.context, {
            actor: {
                name: "reload",
                appearance: {
                    meshId: mesh.id,
                    materialId: material.id,
                },
                transform: {
                    local
                },
                rigidBody: {
                    isKinematic: true,
                    useGravity: false,
                    constraints: [RigidBodyConstraints.FreezeAll]
                },
                collider: {
                    geometry: { shape: ColliderType.Auto },
                    layer: CollisionLayer.Hologram
                },
                attachment: {
                    attachPoint: "left-hand",
                    userId: this.options.user.id
                },
            }
        });
    }

    public onEdit(action: string, params: any) {
        switch (action) {
            case 'select':
                if (this.gunApp.window == 'start') {
                    (this.gunApp.opened as StartWindow).onEdit(action, params);
                }
                break;
            case 'delete':
                if (this.gunApp.window == 'start') {
                    (this.gunApp.opened as StartWindow).onEdit(action, params);
                }
                break;
        }
    }

    public remove() {
        this.options.user.groups.delete('hidden');
        this.options.user.groups.delete('default');
        this.logo?.destroy();
        this.tracker?.destroy();
        this.reload?.destroy();
        this._gun?.remove();
        this._equipment?.remove();
        this.gunApp?.remove();
    }

    public reattach() {
        this._gun?.reattach();
        this._equipment?.reattach();
    }
}