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
    protected bots: Map<number, Bot>;
    get graph() {
        return this.options.graph;
    }

    get mode() {
        return this.options.mode;
    }
    public started: boolean = false;

    constructor(protected context: Context, protected assets: AssetContainer, protected options: GameOptions) {
        this.bots = new Map<number, Bot>();
    }

    public start() {
    }
    public stop() {
        this.bots.forEach(b => b?.remove());
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

        this.started = true;
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
                    if (this.started) {
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
        this.started = false;
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
        this.started = true;

        this.interval = setInterval(()=>{
            if (!this.started) return;
            this.createBot();
        }, 3*1000);
    }

    private createBot() {
        const indexes = [...Array(this.graph.wayPoints.length).keys()];
        shuffleArray(indexes);

        const i = indexes.find(i=>[...this.bots.values()].every(b=>{
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
        clearInterval(this.interval);
        this.started = false;
    }
}