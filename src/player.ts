import { Actor, AssetContainer, ButtonBehavior, ColliderType, CollisionLayer, Context, RigidBodyConstraints, ScaledTransformLike, User } from "@microsoft/mixed-reality-extension-sdk";
import { AssetData } from "altvr-gui";
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
    }
}

export class Player {
    private gunApp: MenuApp;

    private _gun: Gun;
    get gun() {
        return this._gun;
    }
    private magazine: Actor;
    private reload: Actor;

    private tracker: Actor;
    get transform() {
        return this.tracker.transform.app.toJSON();
    }

    public onAction: (action: string, user: User, params: any) => void;

    constructor(private context: Context, private assets: AssetContainer, private options: PlayerOptions, private uiassets: { [name: string]: AssetData }, private baseurl: string) {
        this.init();
        this.debug();
    }

    private async init() {
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
        await this.installStartWindow();

        this.gunApp.window = 'start';
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
            weapons_data: this.options.weapons_data,
        });
        await startWindow.created();
        startWindow.onAction = (action: string, user: User, params?: any) => {
            this.onAction(action, user, params);
        };
        startWindow.getPlayer = () => {
            return this;
        }

        this.gunApp.installWindow("start", startWindow);
    }

    private async debug() {
        const local = translate({}).toJSON();
        const debug = Actor.Create(this.context, {
            actor: {
                transform: {
                    local,
                },
                appearance: {
                    meshId: this.assets.createBoxMesh("debug_mesh", 0.05, 0.05, 0.05).id,
                    materialId: this.assets.materials.find((m) => m.name == "debug").id,
                },
                collider: {
                    geometry: { shape: ColliderType.Box },
                    layer: CollisionLayer.Hologram,
                },
                grabbable: false,
            },
        });

        debug.setBehavior(ButtonBehavior).onClick(async (user, _) => {
            await this.installStartWindow();
            this.gunApp.window = "";
            this.gunApp.window = "start";
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
        this.tracker?.destroy();
        this.reload?.destroy();
        this._gun?.remove();
        this.gunApp?.remove();
    }

    public reattach() {
    }
}