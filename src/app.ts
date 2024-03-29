/*!
 * Copyright (c) The Free MRE Foundation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Actor, AlphaMode, AssetContainer, Color3, Color4, Context, Guid, ParameterSet, User } from "@microsoft/mixed-reality-extension-sdk";
import { AssetData } from "altvr-gui";
import { AttachmentOptions } from "./attachment";
import { GunOptions } from "./gun";
import { Player } from "./player";
import { checkUserRole, fetchJSON } from "./utils";
import { WayPointGraph } from "./waypoint";
import { Game, SearchAndDestroyGame, TargetPracticeGame, WhackamoleGame, ZombieHordeGame } from "./game";
import { EquipmentOptions } from "./equipment";
import { RangeDB } from "./db";

const MIN_SYNC_INTERVAL = 1;

const MONGODB_HOST = process.env['MONGODB_HOST'];
const MONGODB_PORT = process.env['MONGODB_PORT'];
const MONGODB_USER = process.env['MONGODB_USER'];
const MONGODB_PASSWORD = process.env['MONGODB_PASSWORD'];
const MONGODB_CERT = process.env['MONGODB_CERT'];
const DATABASE = process.env['DATABASE'];

const PASSWORD = process.env['PASSWORD'];

const mongoDBOptions = {
    name: 'range',
    host: MONGODB_HOST,
    port: MONGODB_PORT,
    user: MONGODB_USER,
    password: MONGODB_PASSWORD,
    database: DATABASE,
}

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

export interface WeaponsData {
    guns: Partial<GunOptions>[],
    attachments: Partial<AttachmentOptions>[],
    equipments: Partial<EquipmentOptions>[],
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

    private weaponsData: WeaponsData;
    get gunOptions() {
        return this.weaponsData.guns;
    }
    get attachmentOptions() {
        return this.weaponsData.attachments;
    }
    get equipmentOptions() {
        return this.weaponsData.equipments;
    }

    // players
    private queue: User[] = [];
    private players: Map<Guid, Player>;
    private initialized: boolean = false;

    // waypoint
    private graph: WayPointGraph;

    // game
    private game: Game;

    // db
    private spaceId: string;
    private rangeDB: RangeDB;

    constructor(private context: Context, params: ParameterSet, private baseUrl: string) {
        this.url = params['url'] ? params['url'] as string : 'https://freemre.com/range/guns.json';
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
        this.weaponsData = this.url ? await fetchJSON(this.url) : DEFAULT_GUN_OPTIONS;

        this.rangeDB = new RangeDB(mongoDBOptions);
        await this.rangeDB.created();

        this.initialized = true;

        this.queue.forEach((x) => {
            this.userjoined(x);
        });
    }

    private async loadLevel() {
        this.graph = new WayPointGraph(this.context, this.assets, {
            node: {
                name: 'default',
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

        this.graph.addWayPointHandler((user, _, wayPoint) => {
            const id = this.graph.wayPointIds.get(wayPoint);
            const options = wayPoint.options;
            const player = this.players.get(user.id);
            if (!player) return;
            player.onEdit('select', { id, options });
        });

        this.graph.addWayPointGrabHandler(() => {
            this.rangeDB.saveLevel(this.graph.toJSON(), this.spaceId, this.context.sessionId);
        });

        // const data = await fetchJSON('https://freemre.com/range/test.json');

        const level = await this.rangeDB.getLevel(this.spaceId, this.context.sessionId);
        if (level) {
            const data = level.data;
            this.graph.import(data);
        }
    }

    private async userjoined(user: User) {
        if (!this.syncTimeout) {
            this.syncTimeout = setTimeout(() => {
                this.sync();
            }, MIN_SYNC_INTERVAL * 1000);
        }

        if (this.initialized) {
            if (!this.spaceId) {
                this.spaceId = user.properties['altspacevr-space-id'];
                this.loadLevel();
            }

            if (this.players.has(user.id)) return;
            const player = new Player(this.context, this.assets, {
                ...DEFAULT_PLAYER_OPTIONS,
                weapons_data: {
                    guns: this.gunOptions,
                    attachments: this.attachmentOptions,
                    equipments: this.equipmentOptions,
                },
                user,
            }, this.uiassets, this.baseUrl);

            player.onAction = (action: string, user: User, params: any) => {
                if (!(checkUserRole(user, 'moderator') || checkUserRole(user, 'host')) && !['profile', 'weapon', 'attachment'].includes(action)) return;
                switch (action) {
                    case 'weapon':
                        const gunOptions = this.gunOptions.find(o => o.name == params.name);
                        if (gunOptions) {
                            player.equipGun(gunOptions);
                            break;
                        }
                        const equipmentOptions = this.equipmentOptions.find(o => o.name == params.name);
                        if (equipmentOptions) {
                            player.equipEquipment(equipmentOptions);
                            break;
                        }
                        break;
                    case 'attachment':
                        const attachmentOptions = this.attachmentOptions.find(o => o.name == params.name);
                        player.gun?.addAttachment(attachmentOptions);
                        break;
                    case 'edit':
                        if (params.edit) {
                            this.game?.stop();
                        }
                        this.graph.edit = params.edit;
                        break;
                    case 'waypoint':
                        const transform = { ...player.transform };
                        transform.position.y -= 1.265409;
                        this.graph.addNode({
                            name: params.name,
                            resourceId: 'artifact:2133418241777730301',
                            dimensions: {
                                width: 0.05, height: 0.05, depth: 0.05,
                            },
                            transform,
                            edit: true,
                        });
                        break;
                    case 'path':
                        this.graph.addEdge(params.from.id, params.to.id, true);
                        break;
                    case 'path_remove':
                        this.graph.removeEdge(params.from.id, params.to.id);
                        break;
                    case 'delete':
                        this.graph.removeNode(params.delete.id);
                        player.onEdit('delete', {});
                        break;
                    case 'start':
                        this.graph.edit = false;
                        this.startGame(params);
                        break;
                    case 'profile':
                        console.log(Array.from(user.groups));
                        user.prompt("Password", true).then((dialog) => {
                            if (dialog.submitted) {
                                if (PASSWORD && dialog.text == PASSWORD) {
                                    user.prompt('hidden');
                                    player.hidden = true;
                                    console.log(Array.from(user.groups));
                                }
                            }
                        });
                        break;
                }

                if (['waypoint', 'delete', 'path', 'path_delete'].includes(action)) {
                    this.rangeDB.saveLevel(this.graph.toJSON(), this.spaceId, this.context.sessionId);
                }
            }

            this.players.set(user.id, player);
        } else {
            this.queue.push(user);
        }
    }

    private startGame(params: any) {
        if (this.game && params.mode == this.game.mode && this.game.started) {
            this.game.stop();
            return;
        }

        this.game?.stop();
        switch (params.mode) {
            case 'target_practice':
                this.game = new TargetPracticeGame(this.context, this.assets, {
                    mode: params.mode,
                    graph: this.graph,
                    ...params.settings
                });
                break;
            case 'whackamole':
                this.game = new WhackamoleGame(this.context, this.assets, {
                    mode: params.mode,
                    graph: this.graph,
                    ...params.settings,
                });
                break;
            case 'search_and_destroy':
                this.game = new SearchAndDestroyGame(this.context, this.assets, {
                    mode: params.mode,
                    graph: this.graph,
                    ...params.settings,
                });
                this.game.onWin = () => {
                    const sound = Actor.CreateFromLibrary(this.context, {
                        resourceId: 'artifact:2135585300846477744',
                    });
                    setTimeout(() => {
                        sound.destroy();
                    }, 15 * 1000);
                }
                break;
            case 'zombie_horde':
                this.graph.calcShortestPaths();
                this.game = new ZombieHordeGame(this.context, this.assets, {
                    mode: params.mode,
                    graph: this.graph,
                    bgm: 'artifact:2135937475934159608',
                    target: {
                        resourceId: 'artifact:2135887973172904891',
                        transform: {
                            position: {
                                x: -3,
                                y: 0,
                                z: 0,
                            }
                        }
                    },
                    ...params.settings,
                });
                this.game.onWin = () => {
                }
                break;
        }

        this.game.onStop = () => {
        }
        this.game.start();
    }

    private sync() {
        this.syncTimeout = null;
        this.players.forEach(p => p.reattach());
    }

    private async userleft(user: User) {
        const player = this.players.get(user.id);
        if (player) {
            player.remove();
            this.players.delete(user.id);
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