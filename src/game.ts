import { AssetContainer, Context } from "@microsoft/mixed-reality-extension-sdk";
import { Bot, defaultBotHitBoxes } from "./bot";
import { shuffleArray } from "./utils";
import { WayPoint, WayPointGraph } from "./waypoint";

export interface GameOptions {
    mode: string,
    graph: WayPointGraph
}

export abstract class Game {
    protected interval: NodeJS.Timeout;
    protected timeout: NodeJS.Timeout;
    protected bots: Map<number, Bot>;
    get graph() {
        return this.options.graph;
    }

    get mode() {
        return this.options.mode;
    }
    protected _started: boolean = false;
    get started(){
        return this._started;
    }

    public onWin: () => void;
    public onStop: () => void;

    constructor(protected context: Context, protected assets: AssetContainer, protected options: GameOptions) {
        this.bots = new Map<number, Bot>();
    }

    public start() {
    }
    public stop() {
        this.bots.forEach(b => b?.remove());
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
}

export class WhackamoleGame extends Game {
    private id: number = 0;

    constructor(context: Context, assets: AssetContainer, options: WhackamoleGameOptions) {
        super(context, assets, options);
    }

    public start() {
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

        bot.traverse(this.graph);

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
                resourceId: 'artifact:2133418241777730301',
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
}

export class ZombieHordeGame extends Game {
    constructor(context: Context, assets: AssetContainer, options: ZombieHordeGameOptions) {
        super(context, assets, options);
    }

    public start() {
        this._started = true;
    }

    private createBot(w: WayPoint, i: number) {
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
        };
        return bot;
    }

    public stop() {
        super.stop();
        this._started = false;
    }
}