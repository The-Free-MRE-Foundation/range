export enum ItemType {
    PISTOL = 'PISTOL',
    SHOTGUN = 'SHOTGUN',
    SMG = 'SMG',
    RIFLE = 'RIFLE',
    SNIPER = 'SNIPER',
    HMG = 'HMG',
    LAUNCHER = 'LAUNCHER',
    SPECIAL = 'SPECIAL',
    THROWABLE = 'THROWABLE',
    EQUIPMENT = 'EQUIPMENT',
    ATTACHMENT = 'ATTACHMENT',
    MAGIC = 'MAGIC',
    MELEE = 'MELEE',
    BOW = 'BOW',
}

export interface ItemOptions {
    name: string,
    type: ItemType,
    resourceId: string,
}