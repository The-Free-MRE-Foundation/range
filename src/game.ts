import { Actor, AssetContainer, Context, ScaledTransformLike, TextAnchorLocation } from "@microsoft/mixed-reality-extension-sdk";
import { Bot, defaultBotHitBoxes } from "./bot";
import { shuffleArray, translate } from "./utils";
import { WayPoint, WayPointGraph } from "./waypoint";

export interface GameOptions {
    mode: string,
    graph: WayPointGraph,
    bgm?: string,
}

export abstract class Game {
    protected interval: NodeJS.Timeout;
    protected timeout: NodeJS.Timeout;
    protected bots: Map<number, Bot>;

    private bgm: Actor;

    get graph() {
        return this.options.graph;
    }

    get mode() {
        return this.options.mode;
    }
    protected _started: boolean = false;
    get started() {
        return this._started;
    }

    public onWin: () => void;
    public onStop: () => void;

    constructor(protected context: Context, protected assets: AssetContainer, protected options: GameOptions) {
        this.bots = new Map<number, Bot>();
    }

    public start() {
        if (this.options.bgm) {
            console.log('bgm');
            this.bgm = Actor.CreateFromLibrary(this.context, {
                resourceId: this.options.bgm,
            });
        }
    }
    public stop() {
        this.bots.forEach(b => b?.remove());
        this.bgm?.destroy();
        if (this.onStop) this.onStop();
    }
}

export interface TargetPracticeGameOptions extends GameOptions {
    respawn: boolean,
}

export class TargetPracticeGame extends Game {
    constructor(context: Context, assets: AssetContainer, options: TargetPracticeGameOptions) {
        super(context, assets, options);
    }

    public start() {
        super.start();
        const options = (this.options as TargetPracticeGameOptions);
        this.graph.wayPoints.map((w, i) => {
            const bot = this.createBot(w, i, options.respawn);
            this.bots.set(i, bot);
        });

        this._started = true;
    }

    private createBot(w: WayPoint, i: number, respawn: boolean) {
        const bot = new Bot(this.context, this.assets, {
            spawn: w,
            model: {
                resourceId: 'artifact:2133418241777730301',
            },
            hp: 200,
            hitboxes: defaultBotHitBoxes
        });
        bot.onDeath = () => {
            this.bots.get(i)?.remove();
            this.bots.delete(i);

            if (respawn) {
                setTimeout(() => {
                    if (this._started) {
                        this.createBot(w, i, respawn);
                    }
                }, 3 * 1000);
            } else if (this.allDead()) {
                this.start();
            }
        };
        return bot;
    }


    private allDead() {
        return [...this.bots.values()].every(b => !b);
    }

    public stop() {
        super.stop();
        this._started = false;
    }
}

export interface WhackamoleGameOptions extends GameOptions {
    moving: boolean,
}

export class WhackamoleGame extends Game {
    private id: number = 0;

    constructor(context: Context, assets: AssetContainer, options: WhackamoleGameOptions) {
        super(context, assets, options);
    }

    public start() {
        super.start();

        this._started = true;

        this.createBot();
        this.interval = setInterval(() => {
            if (!this._started) return;
            this.createBot();
        }, 3 * 1000);
    }

    private createBot() {
        const indexes = [...Array(this.graph.wayPoints.length).keys()];
        shuffleArray(indexes);

        const i = indexes.find(i => [...this.bots.values()].every(b => {
            const id = this.graph.wayPointIds.get(b.waypoint);
            const wid = this.graph.wayPointIds.get(this.graph.wayPoints[i]);
            return id != wid;
        }));
        if (!i) return;
        const bot = new Bot(this.context, this.assets, {
            spawn: this.graph.wayPoints[i],
            model: {
                resourceId: 'artifact:2133418241777730301',
            },
            hp: 200,
            ttl: 5,
            hitboxes: defaultBotHitBoxes
        });

        if ((this.options as WhackamoleGameOptions).moving) {
            bot.traverse(this.graph);
        }

        const id = this.id;
        this.bots.set(id, bot);
        this.id++;

        bot.onDeath = () => {
            bot.remove();
            this.bots.delete(id);
        };
        bot.onMiss = () => {
            bot.remove();
            this.bots.delete(id);
        }
        return bot;
    }

    public stop(): void {
        super.stop();
        if (this.interval) clearInterval(this.interval);
        this._started = false;
    }
}

export interface SearchAndDestroyGameOptions extends GameOptions {
}

export class SearchAndDestroyGame extends Game {
    constructor(context: Context, assets: AssetContainer, options: SearchAndDestroyGameOptions) {
        super(context, assets, options);
    }

    public start() {
        super.start();

        this.graph.wayPoints.map((w, i) => {
            const bot = this.createBot(w, i);
            this.bots.set(i, bot);
        });

        this._started = true;
    }

    private createBot(w: WayPoint, i: number) {
        const bot = new Bot(this.context, this.assets, {
            spawn: w,
            model: {
                resourceId: 'artifact:2135579602205016539',
            },
            hp: 200,
            hitboxes: defaultBotHitBoxes
        });
        bot.onDeath = () => {
            this.bots.get(i)?.remove();
            this.bots.delete(i);

            if (this.allDead()) {
                this.onWin();
            }
        };
        return bot;
    }


    private allDead() {
        return [...this.bots.values()].every(b => !b);
    }

    public stop() {
        super.stop();
        this._started = false;
    }
}

export interface ZombieHordeGameOptions extends GameOptions {
    target: {
        resourceId: string,
        transform: Partial<ScaledTransformLike>,
    },
}

export class ZombieHordeGame extends Game {
    private id: number = 0;
    private target: Actor;
    private targetText: Actor;

    private _hp: number = 200;
    get hp() {
        return this._hp;
    }
    set hp(n: number) {
        this._hp = Math.max(n, 0);
        this.targetText.text.contents = this._hp > 0 ? `HP Left: ${this._hp}` : 'The zombies ate your brain';
    }

    constructor(context: Context, assets: AssetContainer, options: ZombieHordeGameOptions) {
        super(context, assets, options);

        this.createTarget();
    }

    public start() {
        super.start();

        this._started = true;

        this.createBot();
        this.interval = setInterval(() => {
            if (!this._started) return;
            this.createBot();
        }, 3 * 1000);
    }

    private createTarget() {
        const options = this.options as ZombieHordeGameOptions;
        const local = translate(options.target.transform).toJSON();
        this.target = Actor.CreateFromLibrary(this.context, {
            resourceId: options.target.resourceId,
            actor: {
                grabbable: true,
                transform: {
                    local,
                },
                subscriptions: ["transform"]
            }
        });

        Actor.Create(this.context, {
            actor: {
                parentId: this.target.id,
                transform: {
                    local: {
                        position: {
                            x: 0,
                            y: 0.5,
                            z: 0
                        }
                    }
                },
                text: {
                    contents: 'The zombies are coming for your brains!',
                    anchor: TextAnchorLocation.MiddleCenter,
                    height: 0.06,
                }
            }
        });

        this.targetText = Actor.Create(this.context, {
            actor: {
                parentId: this.target.id,
                transform: {
                    local: {
                        position: {
                            x: 0,
                            y: -0.5,
                            z: 0
                        }
                    }
                },
                text: {
                    contents: '',
                    anchor: TextAnchorLocation.MiddleCenter,
                    height: 0.06,
                }
            }
        });
    }

    private async createBot() {
        const indexes = [...Array(this.graph.wayPoints.length).keys()];
        shuffleArray(indexes);

        const nearestWayPoint = this.graph.nearestWayPoint(this.target);
        const nearestWayPointID = this.graph.wayPointIds.get(nearestWayPoint);

        const i = indexes.find(i => {
            const wid = this.graph.wayPointIds.get(this.graph.wayPoints[i]);
            return wid != nearestWayPointID && [...this.bots.values()].every(b => {
                const id = this.graph.wayPointIds.get(b.waypoint);
                return id != wid;
            })
        });

        if (!i) return;
        const bot = new Bot(this.context, this.assets, {
            spawn: this.graph.wayPoints[i],
            model: {
                resourceId: 'artifact:2135579602599281117',
            },
            hp: 200,
            hitboxes: defaultBotHitBoxes
        });

        await bot.created();

        bot.onTarget = () => {
            this.hp -= 10;
        }
        bot.chase(this.target, this.graph);

        const id = this.id;
        this.bots.set(id, bot);
        this.id++;

        bot.onDeath = () => {
            bot.remove();
            this.bots.delete(id);
        };
        bot.onMiss = () => {
            bot.remove();
            this.bots.delete(id);
        }
        return bot;
    }

    public stop() {
        super.stop();
        if (this.interval) clearInterval(this.interval);
        this.target?.destroy();
        this._started = false;
    }
}