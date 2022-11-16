import { Actor, AssetContainer, AttachPoint, Context, ScaledTransformLike, User } from "@microsoft/mixed-reality-extension-sdk";
import { Async, translate } from "./utils";
import { AssetData, Menu } from 'altvr-gui';
import { Window } from "./window";

const ATTACHMENT_TRANSFORMS: { [attachPoint: string]: Partial<ScaledTransformLike> } = {
    'spine-middle': {
        position: {
            x: 0, y: 0, z: 1.2
        },
        scale: {
            x: 0.72, y: 0.72, z: 0.72
        }
    },
    'left-hand': {
        position: {
            x: 0, y: 0.1, z: -0.04
        },
        rotation: {
            x: 0, y: -90, z: 0
        },
        scale: {
            x: 0.36, y: 0.36, z: 0.36
        }
    },
    'right-hand': {
        position: {
            x: 0, y: 0.1, z: -0.04
        },
        rotation: {
            x: 0, y: 90, z: 0
        },
        scale: {
            x: 0.36, y: 0.36, z: 0.36
        }
    }
}

export interface AppOptions {
    uiassets: { [name: string]: AssetData },
    baseurl: string,
    user?: User,
    exclusive?: boolean,
    transform?: Partial<ScaledTransformLike>,
    attachment?: boolean,
    attachPoint?: string,
}

export class MenuApp extends Async {
    private _anchor: Actor;
    get anchor() {
        return this._anchor;
    }

    private attachPoint: string = 'spine-middle';

    // menu
    private mainMenu: Menu;
    get menu() {
        return this.mainMenu;
    }

    // windows
    private windows: { [name: string]: Window } = {};
    private _window: string = null;
    public opened: Window;
    get window() { return this._window; }
    set window(s: string) {
        if (this._window == s) { return; }
        this._window = s;

        if (s === null) {
            this.opened.remove();
            return;
        }

        if (this.opened) {
            this.opened.remove();
        }

        const a = this.windows[this.window];
        if (a) {
            this.opened = a;
            a.open();
        }
    }

    constructor(private context: Context, private assets: AssetContainer, private options: AppOptions) {
        super();
        this.init();
    }

    private async init() {
        this.attachPoint = this.options.attachPoint ? this.options.attachPoint : this.attachPoint;
        await this.createMenus();
        this.notifyCreated(true);
    }

    private async createMenus() {
        const local = translate(this.options.transform ? this.options.transform : {}).toJSON();
        this._anchor = Actor.Create(this.context, {
            actor: {
                transform: { local }
            }
        });

        if (this.options.user) {
            const device = this.options.user.properties['device-model'];
            const isMobile = device.includes('Oculus Quest');
            this.mainMenu = new Menu(this.context, this.assets, {
                assets: this.options.uiassets,
                baseUrl: this.options.baseurl,
                url: 'main.xml',
                scale: this.options.transform ? (this.options.transform.scale ? this.options.transform.scale.x : 0.5) : 0.5,
                exclusive: this.options.exclusive !== undefined ? this.options.exclusive : true,
            }, this.options.user);

            await this.mainMenu.created();
            this.mainMenu.view.root.anchor.parentId = this._anchor.id;

            if (this.options.attachment != false) {
                this.reattachMenu(this.attachPoint, this.options.transform);
            }
        } else {
            this.mainMenu = new Menu(this.context, this.assets, {
                assets: this.options.uiassets,
                baseUrl: this.options.baseurl,
                url: 'main.xml',
                scale: 0.8,
                exclusive: false,
            }, null);
            await this.mainMenu.created();
            this.mainMenu.view.root.anchor.parentId = this._anchor.id;
        }
    }

    private reattachMenu(attachPoint: string, transform?: Partial<ScaledTransformLike>) {
        if (this._anchor.attachment && this._anchor.attachment.attachPoint) {
            this._anchor.detach();
        }
        this._anchor.attach(this.options.user, attachPoint as AttachPoint);
        const local = translate(transform ? transform : ATTACHMENT_TRANSFORMS[attachPoint]);
        this._anchor.transform.local.copy(local);

        this.attachPoint = attachPoint;
    }

    public installWindow(name: string, window: Window) {
        this.windows[name] = window;
    }

    public remove() {
        this._anchor?.destroy();
        [...Object.keys(this.windows)].forEach(k => {
            this.windows[k].remove();
        });
    }

    public reattach(transform?: Partial<ScaledTransformLike>) {
        this.reattachMenu(this.attachPoint, transform);
    }
}