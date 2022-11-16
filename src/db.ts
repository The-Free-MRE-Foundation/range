import { MongoClient, MongoClientOptions } from "mongodb";
import { Async } from "./utils";
import fs from 'fs';

export interface RangeDBOptions {
	name: string,
	host?: string,
	user: string,
	port: string,
	password: string,
	database: string,
	cert?: string,
}

export class RangeDB extends Async {
	get name() {
		return this.options.name;
	}
	// db
	private client: MongoClient;
	private connection: MongoClient;

	constructor(private options: RangeDBOptions) {
		super();
		this.init();
	}

	private async init() {
		this.client = await this.createClient();
		this.notifyCreated(true);
	}

	// db
	private async createClient() {
		if (this.client) {
			await this.client.close();
		}

		await new Promise(resolve => setTimeout(resolve, 1));
		const host = this.options.host ? this.options.host : '127.0.0.1';
		const port = this.options.port ? this.options.port : 27017;
		const uri = `mongodb://${this.options.user}:${this.options.password}@${host}:${port}?writeConcern=majority`;
		let options: MongoClientOptions = {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		};
		if (this.options.cert) {
			const ca = [fs.readFileSync(`${__dirname}/../${this.options.cert}`)];
			options.ssl = true;
			options.sslCA = ca;
		}
		return new MongoClient(uri, options);
	}

	public async getLevel(spaceId: string, sessionId: string) {
		try {
			if (this.connection === undefined) {
				this.connection = await this.client.connect();
			}
			const db = this.client.db(this.options.database);
			const levelCollection = db.collection('levels');
			const res = levelCollection.findOne({spaceId, sessionId});
			console.log('got level', res);
            return res;
		} catch (err) {
			console.log(err);
		}
	}

    public async saveLevel(data: any, spaceId: string, sessionId: string){
		try {
			if (this.connection === undefined) {
				this.connection = await this.client.connect();
			}
			const db = this.client.db(this.options.database);
			const levelCollection = db.collection('levels');
            await levelCollection.updateOne(
				{ spaceId, sessionId },
				{
					$set: {
						spaceId,
						sessionId,
						data,
					}
				},
				{ upsert: true }
			);
			console.log('saved level');
		} catch (err) {
			console.log(err);
		}
    }
}