/*!
 * Copyright (c) The Free MRE Foundation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Actor, User, ColliderType, CollisionLayer, AttachPoint, ScaledTransformLike, ButtonBehavior, AssetContainer, Context } from '@microsoft/mixed-reality-extension-sdk';
import { Attachment, AttachmentOptions, AttachmentType, LightAttachment, LightAttachmentOptions, ScopeAttachment, ScopeAttachmentOptions, SilencerAttachment, SilencerAttachmentOptions } from './attachment';
import { ItemOptions, ItemType } from './item';
import { translate } from './utils';

export const DEFAULT_GUN_DIMENSIONS = {
	width: 0.4, height: 0.7, depth: 0.2
};
const DEFAULT_BULLET_TTL = 5;

export const GUN_COMMONS = {
	trigger: {
		dimensions: {
			width: 0.04,
			height: 0.04,
			depth: 0.04
		},
		transform: {
			position: {
				x: -0.06,
				y: -0.035,
				z: 0.14
			}
		}
	},
}

export enum ReloadMode {
	MAGAZINE = 'MAGAZINE',
	SHELL = 'SHELL'
}

const defaultSounds = {
	'drop': 'artifact:1690630580212859369',
	'insert': 'artifact:1690630589255778973',
	'empty': 'artifact:1692113559984538059',
}

export interface GunOptions extends ItemOptions {
	attachPoint: AttachPoint,
	type: ItemType,
	transform?: Partial<ScaledTransformLike>,
	anchor: {
		dimensions: { width: number, height: number, depth: number },
		transform?: Partial<ScaledTransformLike>,
	},
	trigger: {
		dimensions: { width: number, height: number, depth: number },
		transform?: Partial<ScaledTransformLike>,
	},
	model: {
		resourceId: string,
		attachment?: string,
		transform?: Partial<ScaledTransformLike>,
	},
	magazine?: {
		size: number,
		ttl?: number,
		resourceId: string,
		transform?: Partial<ScaledTransformLike>,
	},
	reload?: {
		mode?: ReloadMode,
		dimensions: { width: number, height: number, depth: number },
		transform?: Partial<ScaledTransformLike>,
	},
	bullet: {
		single?: string,
		auto?: string,
		fireRate?: number,
		transform: Partial<ScaledTransformLike>,
		ttl: number,
	},
	dimensions?: {
		width: number,
		height: number,
		depth: number,
	},
	sounds?: { [name: string]: string },
	user: User,
	attachments?: Partial<AttachmentOptions>[],
}

export class Gun {
	private anchor: Actor;
	private trigger: Actor;
	private model: Actor;
	private magazine: Actor;
	private reload: Actor;

	private attachments: Attachment[] = [];

	private resourceId: string;
	private bullet: GunOptions['bullet'];

	private isHolding: boolean = false;
	private isReloading: boolean = false;

	private _ammo: number = 0;
	get ammo() { return this._ammo; }
	set ammo(n: number) {
		this._ammo = Math.max(n, 0);
		this.onAmmo(n);
	}

	get name() { return this._options.name; }
	get user() { return this._options.user; }
	get options() {
		return this._options;
	}

	private interval: NodeJS.Timeout;

	public onAmmo: (n: number) => void;
	public onMag: () => void;
	public onReload: () => boolean;

	constructor(private context: Context, private assets: AssetContainer, private _options: GunOptions) {
		this.init();
	}

	private init() {
		this.resourceId = this._options.model.resourceId;
		this.bullet = { ...this._options.bullet };

		this._ammo = this._options.magazine ? (this._options.magazine.size ? this._options.magazine.size : Infinity) : Infinity;
		this.createAnchor();
		this.createModel();
		this.createTrigger();
		const mode = this._options.reload ? (this._options.reload.mode ? this._options.reload.mode : ReloadMode.MAGAZINE) : undefined;
		if (this._options.reload && mode == ReloadMode.MAGAZINE) {
			this.createMagazine();
		}
		this.createReload();
	}

	private createAnchor() {
		const local = translate(this._options.transform ? this._options.transform : {}).toJSON();
		this.anchor = Actor.Create(this.context, {
			actor: {
				attachment: {
					userId: this.user.id,
					attachPoint: this._options.attachPoint
				}
			},
		});
	}

	private createModel() {
		const local = translate(this._options.model.transform ? this._options.model.transform : {}).toJSON();
		this.model = Actor.CreateFromLibrary(this.context, {
			resourceId: this.resourceId,
			actor: {
				parentId: this.anchor.id,
				transform: {
					local
				}
			}
		});
	}

	private createTrigger() {
		const local = translate(this._options.trigger.transform ? this._options.trigger.transform : {}).toJSON();
		const dim = this._options.trigger.dimensions;
		const name = `${dim.width},${dim.height},${dim.depth}`;
		let mesh = this.assets.meshes.find(m => m.name === name);
		if (!mesh) {
			mesh = this.assets.createBoxMesh(name, dim.width, dim.height, dim.depth);
		}
		const material = this.assets.materials.find(m => m.name === 'invis');

		this.trigger = Actor.Create(this.context, {
			actor: {
				name: "trigger",
				parentId: this.anchor.id,
				appearance: {
					meshId: mesh.id,
					materialId: material.id,
				},
				transform: {
					local
				},
				collider: {
					geometry: { shape: ColliderType.Auto },
					layer: CollisionLayer.Hologram
				},
			}
		});

		const buttonBehavior = this.trigger.setBehavior(ButtonBehavior);
		buttonBehavior.onClick(async (u, _) => {
			if (this.user && u.id != this.user.id) { return; }
			if (!this.bullet.single) { return; }

			if (this.ammo <= 0) {
				this.playSound('empty');
				return;
			}


			if (this.interval) {
				clearInterval(this.interval);
			}
			this.ammo--;

			const local = translate(this.bullet.transform ? this.bullet.transform : {}).toJSON();
			const resourceId = this.bullet.single;
			const actor = Actor.CreateFromLibrary(this.context, {
				resourceId,
				actor: {
					parentId: this.anchor.id,
					transform: {
						local
					}
				}
			});

			const timeout = this.bullet.ttl ? this.bullet.ttl : DEFAULT_BULLET_TTL;
			setTimeout(() => {
				actor.destroy();
			}, timeout * 1000);
		});

		let auto: Actor;
		buttonBehavior.onButton('holding', (user, _) => {
			if (this.isHolding) { return; }
			this.isHolding = true;

			if (!this.bullet.auto) { return; }

			if (this.ammo <= 0) {
				this.playSound('empty');
				return;
			}
			const local = translate(this.bullet.transform).toJSON();
			auto = Actor.CreateFromLibrary(this.context, {
				resourceId: this.bullet.auto,
				actor: {
					parentId: this.anchor.id,
					transform: {
						local
					}
				}
			});

			if (this.interval) {
				clearInterval(this.interval);
			}
			this.interval = setInterval(() => {
				// ammo
				this.ammo--;
				if (this.ammo <= 0) {
					clearInterval(this.interval);
					auto?.destroy();
				}
			}, 1 / this.bullet.fireRate * 1000);
		});
		buttonBehavior.onButton('released', (user, _) => {
			this.isHolding = false;
			if (!this.bullet.auto) { return; }
			if (this.interval) {
				clearInterval(this.interval);
			}
			if (auto) {
				auto.destroy();
				auto = undefined;
			}
		});
	}

	private createMagazine() {
		if (
			this._options.type == ItemType.MAGIC ||
			this._options.type == ItemType.MELEE
		) { return; }
		const local = translate(this._options.model.transform);
		this.magazine = Actor.CreateFromLibrary(this.context, {
			resourceId: this._options.magazine.resourceId,
			actor: {
				parentId: this.anchor.id,
				transform: {
					local,
				},
				collider: {
					enabled: false,
					geometry: { shape: ColliderType.Auto },
					layer: CollisionLayer.Default
				}
			}
		});
	}

	private createReload() {
		if (
			this._options.type == ItemType.MAGIC ||
			this._options.type == ItemType.MELEE
		) { return; }
		const local = translate(this._options.reload.transform ? this._options.reload.transform : {}).toJSON();
		const dim = this._options.reload.dimensions;
		const name = `${dim.width},${dim.height},${dim.depth}`;
		let mesh = this.assets.meshes.find(m => m.name === name);
		if (!mesh) {
			mesh = this.assets.createBoxMesh(name, dim.width, dim.height, dim.depth);
		}
		const material = this.assets.materials.find(m => m.name === 'invis');
		this.reload = Actor.Create(this.context, {
			actor: {
				name: "reload",
				parentId: this.anchor.id,
				appearance: {
					meshId: mesh.id,
					materialId: material.id,
				},
				transform: {
					local,
				},
				collider: {
					geometry: { shape: ColliderType.Auto },
					layer: CollisionLayer.Hologram,
					isTrigger: true
				},
			}
		});

		this.reload.setBehavior(ButtonBehavior).onClick((user, _) => {
			this.doUnload();
		});

		this.reload.collider.onTrigger('trigger-enter', (actor: Actor) => {
			this.doReload();
		});
	}

	private doUnload() {
		const ttl = this._options.magazine.ttl ? this._options.magazine.ttl : 4;
		const mode = this._options.reload.mode ? this._options.reload.mode : ReloadMode.MAGAZINE;
		if (mode == ReloadMode.MAGAZINE) {
			this.isReloading = true;
			this.ammo = 0;
			if (this.magazine && !this.magazine.rigidBody) {
				this.magazine.collider.enabled = true;
				this.magazine.enableRigidBody({
					useGravity: true
				});
				this.playSound('drop');
				const mag = this.magazine;
				setTimeout(() => {
					mag.destroy();
				}, ttl * 1000);
			}
			this.onMag();
		} else if (this.ammo < this._options.magazine.size) {
			this.onMag();
		}
	}

	private doReload() {
		const mode = this._options.reload.mode ? this._options.reload.mode : ReloadMode.MAGAZINE;
		if (mode == ReloadMode.MAGAZINE && !this.isReloading) {
			return;
		}

		if (!this.onReload()) { return; }
		let playSound = true;
		if (mode == ReloadMode.MAGAZINE) {
			this.ammo = this._options.magazine.size;
			this.createMagazine();
			this.isReloading = false;
		} else if (this.ammo < this._options.magazine.size) {
			this.ammo = this._options.magazine.size;
			if (this.ammo >= this._options.magazine.size) {
				this.ammo = this._options.magazine.size;
			} else {
				this.onMag();
			}
		} else {
			playSound = false;
		}

		if (playSound) {
			this.playSound('insert');
		}
	}

	private playSound(name: string) {
		const sounds = this._options.sounds ? this._options.sounds : defaultSounds;
		const sound = Actor.CreateFromLibrary(this.context, {
			resourceId: sounds[name],
			actor: { parentId: this.anchor.id }
		});
		setTimeout(() => {
			sound.destroy();
		}, 3 * 1000);
	}

	public removeAttachment(attachment: string) {
		const i = this.attachments.findIndex(a => a.name == attachment);
		if (i >= 0) {
			const attachmentToRemove = this.attachments.splice(i, 1)[0];
			attachmentToRemove.remove();
			this.onRemoveAttachment(attachmentToRemove);
		}
	}

	public addAttachment(options: Partial<AttachmentOptions>) {
		const name = options.name;
		// options
		if (!this.options.attachments) { return; }
		const attachmentOptions = this.options.attachments.find(o => o.name == name);
		if (!attachmentOptions) { return; }

		const ao = {
			...options,
			...attachmentOptions
		};
		// equipped attachment
		const duplicate = this.attachments.find(a => a.name == name);
		if (duplicate) {
			this.removeAttachment(duplicate.name);
			return;
		}

		const conflict = this.attachments.find(a => a.type == ao.subType);
		if (conflict) {
			this.removeAttachment(conflict.name);
		}

		// new attachment
		let attachmentToAttach: Attachment;
		switch (ao.subType) {
			case AttachmentType.SCOPE:
				attachmentToAttach = new ScopeAttachment(this.context, this.assets, Object.assign(ao, { owner: this.options.user }) as ScopeAttachmentOptions, this.anchor.id);
				break;
			case AttachmentType.LIGHT:
				attachmentToAttach = new LightAttachment(this.context, this.assets, ao as LightAttachmentOptions, this.anchor.id);
				break;
			case AttachmentType.SILENCER:
				attachmentToAttach = new SilencerAttachment(this.context, this.assets, ao as SilencerAttachmentOptions, this.anchor.id);
				break;
			default:
				attachmentToAttach = new Attachment(this.context, this.assets, ao as AttachmentOptions, this.anchor.id);
				break;
		}
		this.attachments.push(attachmentToAttach);
		this.onAddAttachment(attachmentToAttach);
	}

	private onRemoveAttachment(attachment: Attachment) {
		switch (attachment.type) {
			case AttachmentType.SCOPE:
				this.bullet.transform = { ...this._options.bullet.transform };
				if (this._options.model.attachment) {
					this.resourceId = this._options.model.resourceId;
					this.model.destroy();
					this.createModel();
				}
				break;
			case AttachmentType.SILENCER:
				this.bullet.single = this._options.bullet.single;
				this.bullet.auto = this._options.bullet.auto;
				break;
			default:
				break;
		}
	}

	private onAddAttachment(attachment: Attachment) {
		switch (attachment.type) {
			case AttachmentType.SCOPE:
				const scope = (attachment as ScopeAttachment);
				if (scope.bullet) this.bullet.transform = scope.bullet;
				if (this.options.model.attachment) {
					this.resourceId = this.options.model.attachment;
					this.model.destroy();
					this.createModel();
				}
				break;
			case AttachmentType.SILENCER:
				const silencer = (attachment as SilencerAttachment);
				if (this._options.bullet.single && silencer.single) {
					this.bullet.single = silencer.single;
				}
				if (this._options.bullet.auto && silencer.auto) {
					this.bullet.auto = silencer.auto;
				}
				break;
			default:
				break;
		}
	}

	public remove() {
		this.trigger?.destroy();
		this.anchor.destroy();
	}

	public reattach() {
		if (this.user === undefined) { return; }

		const attachPoint = this._options.attachPoint ? this._options.attachPoint : 'right-hand';
		this.anchor.detach();
		this.anchor.attach(this.user, attachPoint as AttachPoint);
	}
}