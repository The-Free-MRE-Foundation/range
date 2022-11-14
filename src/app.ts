/*!
 * Copyright (c) The Free MRE Foundation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Actor, AlphaMode, AssetContainer, Color3, Color4, Context, Guid, ParameterSet, User } from "@microsoft/mixed-reality-extension-sdk";
import { AssetData } from "altvr-gui";
import { AttachmentOptions } from "./attachment";
import { Bot, defaultBotHitBoxes } from "./bot";
import { GunOptions } from "./gun";
import { Player } from "./player";
import { fetchJSON } from "./utils";
import { WayPointGraph } from "./waypoint";

const MIN_SYNC_INTERVAL = 1;

const DEFAULT_GUN_OPTIONS = [
    {
        name: "Blaster",
        attachPoint: "right-hand",
        dimensions: {
            width: 0.04125,
            height: 0.16625,
            depth: 0.2375,
        },
        model: {
            resourceId: "artifact:2123959088265035918",
            transform: {
                position: {
                    x: -0.05343617,
                    y: -0.01144117,
                    z: 0.1769055
                },
                rotation: {
                    x: 0,
                    y: 0,
                    z: 90
                }
            }
        },
        bullet: {
            resourceId: "artifact:2123959088139206797",
            transform: {
                position: {
                    x: 0,
                    y: 0.0288,
                    z: 0.0793
                }
            },
            ttl: 10,
        },
    },
];

const DEFAULT_PLAYER_OPTIONS = {
    reload: {
        dimensions: {
            width: 0.2, height: 0.1, depth: 0.1,
        },
        transform: {
            position: {
                x: 0, y: 0, z: 0.05
            }
        }
    }
}

/**
 * The main class of this app. All the logic goes here.
 */
export default class App {
    private url: string;
    private assets: AssetContainer;
    private uiassets: { [name: string]: AssetData } = {};

    // sync fix
    private syncTimeout: NodeJS.Timeout;

    private gunOptions: Partial<GunOptions>[];
    private attachmentOptions: Partial<AttachmentOptions>[];

    // players
    private queue: User[] = [];
    private players: Map<Guid, Player>;
    private initialized: boolean = false;

    // waypoint
    private graph: WayPointGraph;

    constructor(private context: Context, params: ParameterSet, private baseUrl: string) {
        this.url = params['url'] as string;
        this.assets = new AssetContainer(this.context);
        this.players = new Map<Guid, Player>();
        this.context.onStarted(() => this.started());
        this.context.onUserJoined((u: User) => this.userjoined(u));
        this.context.onUserLeft((u: User) => this.userleft(u));
    }

    /**
     * Once the context is "started", initialize the app.
     */
    private async started() {
        await this.loadMaterials();
        await this.loadUIAssets(`${this.baseUrl}/icon_pack_1.json`);
        this.preload();
        const options = this.url ? await fetchJSON(this.url) : DEFAULT_GUN_OPTIONS;
        this.gunOptions = options.guns;
        this.attachmentOptions = options.attachments;

        this.graph = new WayPointGraph(this.context, this.assets, {
            node: {
                resourceId: 'artifact:2133418241777730301',
                dimensions: {
                    width: 0.05, height: 0.05, depth: 0.05,
                },
            },
            edge: {
                resourceId: 'artifact:2133046878856544441',
                length: 1,
            }
        });

        const data = await fetchJSON('https://freemre.com/range/test.json');
        this.graph.import(data);

        this.graph.wayPoints.forEach(w => {
            new Bot(this.context, this.assets, {
                spawn: w,
                model: {
                    resourceId: 'artifact:2133418241777730301',
                },
                hp: 200,
                ttl: 200,
                hitboxes: defaultBotHitBoxes
            });
        });

        this.initialized = true;

        this.queue.forEach((x) => {
            this.userjoined(x);
        });
    }

    private async userjoined(user: User) {
        if (!this.syncTimeout) {
            this.syncTimeout = setTimeout(() => {
                this.sync();
            }, MIN_SYNC_INTERVAL * 1000);
        }

        if (this.initialized) {
            if (this.players.has(user.id)) return;
            const player = new Player(this.context, this.assets, {
                ...DEFAULT_PLAYER_OPTIONS,
                user,
            }, this.uiassets, this.baseUrl);

            player.onAction = (action: string, user: User, params: any) => {
                console.log(action, params);
                switch (action) {
                    case 'weapon':
                        const gunOptions = this.gunOptions.find(o => o.name == params.name);
                        player.equipGun(gunOptions);
                        break;
                    case 'attachment':
                        const attachmentOptions = this.attachmentOptions.find(o => o.name == params.name);
                        player.gun?.addAttachment(attachmentOptions);
                        break;
                    case 'start':
                        break;
                }
            }

            this.players.set(user.id, player);
        } else {
            this.queue.push(user);
        }
    }

    private sync() {
        this.syncTimeout = null;
        this.players.forEach(p => p.reattach());
    }

    private async userleft(user: User) {
        const player = this.players.get(user.id);
        if (player) {
            player.remove();
        }
    }

    private async loadMaterials() {
        this.assets.createMaterial("invis", {
            color: Color4.FromColor3(Color3.Red(), 0.0),
            alphaMode: AlphaMode.Blend,
        });
        this.assets.createMaterial("highlight", {
            color: Color4.FromColor3(Color3.Teal(), 0.0),
            alphaMode: AlphaMode.Blend,
        });
        this.assets.createMaterial("debug", {
            color: Color4.FromColor3(Color3.Teal(), 0.1),
            alphaMode: AlphaMode.Blend,
        });
        this.assets.createMaterial("gray", {
            color: Color4.FromColor3(Color3.Gray(), 1.0),
            alphaMode: AlphaMode.Blend,
        });
    }

    private async loadUIAssets(url: string) {
        const uiassets = await fetchJSON(url);
        uiassets.forEach((a: any) => {
            this.uiassets[a.name] = a;
        });
    }

    private preload() {
        [...Object.keys(this.uiassets)].forEach((k) => {
            const a = this.uiassets[k];
            Actor.CreateFromLibrary(this.context, {
                resourceId: a.resourceId,
                actor: {
                    appearance: {
                        enabled: false,
                    },
                },
            });
        });
    }
}