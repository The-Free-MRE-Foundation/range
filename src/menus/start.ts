import { Context, User } from "@microsoft/mixed-reality-extension-sdk";
import { Button, Checkbox, Grid, Pager, PaginatedGrid, Slider, Text } from "altvr-gui";
import { WeaponsData } from "../app";
import { ItemType } from "../item";
import { Player } from "../player";
import { fetchText } from "../utils";
import { Window, WindowOptions } from "../window";

const CATEGORIES = ['Pistols', 'Heavy', 'SMGs', 'Rifles', 'Gear', 'Grenades'];

const CATEGORIES_MAP: { [name: string]: ItemType[] } = {
    'Pistols': [ItemType.PISTOL],
    'Heavy': [ItemType.SHOTGUN, ItemType.HMG],
    'SMGs': [ItemType.SMG],
    'Rifles': [ItemType.RIFLE, ItemType.SNIPER],
    'Gear': [ItemType.EQUIPMENT],
    'Grenades': [ItemType.THROWABLE],
}

export interface StartWindowOptions extends WindowOptions {
    weapons_data: WeaponsData,
    attachment_url: string,
    editor_url: string,
    game_url: string,
}

export class StartWindow extends Window {
    private categoryGrid: Grid;
    private categoryList: PaginatedGrid;

    private weaponGrid: Grid;
    private weaponList: PaginatedGrid;

    private attachmentXML: string;
    private attachmentGrid: Grid;
    private attachmentList: PaginatedGrid;

    private editorXML: string;
    private enemyGrid: Grid;
    private enemyList: PaginatedGrid;

    private gameXML: string;

    public onAction: (act: string, user: User, params?: any) => void;
    public getPlayer: () => Player;

    private _from: { [name: string]: string };
    get from() {
        return this._from;
    }
    set from(f: { [name: string]: string }) {
        const side = this.menu.view.root.find('#side')[0];
        const fromText = side.find('#from')[0] as Text;
        if (!fromText) return;
        this._from = f;
        fromText.text(f ? `#${f.id}\n${f.name}` : '');
    }

    private _to: { [name: string]: string };
    get to() {
        return this._to;
    }
    set to(t: { [name: string]: string }) {
        const side = this.menu.view.root.find('#side')[0];
        const toText = side.find('#to')[0] as Text;
        if (!toText) return;
        this._to = t;
        toText.text(t ? `#${t.id}\n${t.name}` : '');
    }

    private _delete: { [name: string]: string };
    get delete() {
        return this._delete;
    }
    set delete(d: { [name: string]: string }) {
        const side = this.menu.view.root.find('#side')[0];
        const deleteText = side.find('#delete_text')[0] as Text;
        if (!deleteText) return;
        this._delete = d ? d : {};
        deleteText.text(d ? `#${d.id}\n${d.name}` : '');
    }

    private _category: string;
    get category() {
        return this._category;
    }
    set category(c: string) {
        if (this._category == c) return;
        this._category = c;
        this.updateWeapons();
    }

    constructor(context: Context, options: StartWindowOptions) {
        super(context, options);
    }

    public async createMainMenuView() {
        if (this.menuView.find('#start').length > 0) { return; }
        this.menuView.append(this.menuXML);

        // categories
        this.categoryGrid = this.menu.view.root.find('#categories_grid')[0] as Grid;
        await this.categoryGrid.created();
        let r = this.categoryGrid.dom.options.row;
        let c = this.categoryGrid.dom.options.col;
        this.categoryList = new PaginatedGrid({
            list: this.categoryGrid,
            pageSize: r * c,
        });

        this.categoryGrid.addUIEventHandler('selected', (params: { user: User, id: string, selected: string }) => {
            const index = parseInt(params.id);
            const item = this.categoryList.page[index];
            this.category = item.name;
        });

        this.updateCategories();

        // weapons
        this.weaponGrid = this.menu.view.root.find('#weapons_grid')[0] as Grid;
        await this.weaponGrid.created();
        r = this.weaponGrid.dom.options.row;
        c = this.weaponGrid.dom.options.col;
        const pager = this.menu.view.root.find("#weapons_pager")[0] as Pager;
        this.weaponList = new PaginatedGrid({
            list: this.weaponGrid,
            pageSize: r * c,
            pager,
        });

        this.weaponGrid.addUIEventHandler('selected', (params: { user: User, id: string, selected: string }) => {
            const index = parseInt(params.id);
            const item = this.weaponList.page[index];
            this.onAction('weapon', params.user, item);
            this.updateAttachments();
        });

        this.updateWeapons();

        // profile
        const profileButton = this.menu.view.root.find('#profile')[0] as Button;
        profileButton.img({
            url: 'https://cdn-content-ingress.altvr.com/uploads/user/profile_image/1297921030701973550/thumbnail_SPOILER_IMG_4171.jpg',
            width: 0.20,
            height: 0.20,
        });

        // slider
        const expSlider = this.menu.view.root.find('#exp_slider')[0] as Slider;
        expSlider.val('0.6');

        // attachments
        const attachmentButton = this.menu.view.root.find('#attachment_btn')[0] as Button;
        attachmentButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            this.toggleAttachmentMenu();
        });

        if (!this.attachmentXML) {
            let url = (this.options as StartWindowOptions).attachment_url;
            url = url.split('://').length > 1 ? url : `${this.options.baseurl}/${url}`;
            this.attachmentXML = await fetchText(url);
        }

        // editor
        const editorButton = this.menu.view.root.find('#editor_btn')[0] as Button;
        editorButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            this.toggleEditorMenu(params.user);
        });

        if (!this.editorXML) {
            let url = (this.options as StartWindowOptions).editor_url;
            url = url.split('://').length > 1 ? url : `${this.options.baseurl}/${url}`;
            this.editorXML = await fetchText(url);
        }

        // game
        const gameButton = this.menu.view.root.find('#game_btn')[0] as Button;
        gameButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            this.toggleGameMenu();
        });

        if (!this.gameXML) {
            let url = (this.options as StartWindowOptions).game_url;
            url = url.split('://').length > 1 ? url : `${this.options.baseurl}/${url}`;
            this.gameXML = await fetchText(url);
        }
    }

    private updateCategories() {
        this.categoryList.items = CATEGORIES.map(name => ({
            name
        }));
        this.categoryList.update();
    }

    private updateWeapons() {
        const options = (this.options as StartWindowOptions);
        const guns = [...options.weapons_data.guns, ...options.weapons_data.equipments];

        const items = guns.filter(g => !this.category || CATEGORIES_MAP[this.category].includes(g.type)).map((g, i) => ({
            id: i,
            asset: g.name,
            name: g.name,
        }));
        this.weaponList.items = items;
        this.weaponList.update();

        this.weaponList.pageNum = 0;
    }

    private async toggleAttachmentMenu() {
        const side = this.menu.view.root.find('#side')[0];

        const opened = side.find('#attachment').length > 0;
        this.clear();
        if (opened) {
            return;
        }
        side.append(this.attachmentXML);

        this.attachmentGrid = side.find('#attachment_grid')[0] as Grid;
        await this.attachmentGrid.created();
        let r = this.attachmentGrid.dom.options.row;
        let c = this.attachmentGrid.dom.options.col;
        this.attachmentList = new PaginatedGrid({
            list: this.attachmentGrid,
            pageSize: r * c,
        });

        this.attachmentGrid.addUIEventHandler('selected', (params: { user: User, id: string, selected: string }) => {
            const index = parseInt(params.id);
            const item = this.attachmentList.page[index];
            this.onAction('attachment', params.user, item);
        });

        this.updateAttachments();
    }

    private updateAttachments() {
        const player = this.getPlayer();
        if (!player.gun) return;

        const side = this.menu.view.root.find('#side')[0];
        if (side.find('#attachment').length <= 0) return;

        const attachments = player.gun.options.attachments;
        const items = attachments.map((a, i) => ({
            id: i,
            name: a.name
        }));
        this.attachmentList.items = items;
        this.attachmentList.update();
    }

    private async toggleEditorMenu(user: User) {
        const side = this.menu.view.root.find('#side')[0];
        const opened = side.find('#editor').length > 0;
        this.clear();
        if (opened) {
            this.onAction('edit', user, { edit: false });
            return;
        }
        side.append(this.editorXML);

        this.onAction('edit', user, { edit: true });

        this.enemyGrid = side.find('#enemy_grid')[0] as Grid;
        await this.enemyGrid.created();
        let r = this.enemyGrid.dom.options.row;
        let c = this.enemyGrid.dom.options.col;
        this.enemyList = new PaginatedGrid({
            list: this.enemyGrid,
            pageSize: r * c,
        });

        this.enemyList.items = [
            {
                id: 0,
                name: 'Ghost',
            },
            {
                id: 1,
                name: 'Zombie',
            },
            {
                id: 2,
                name: 'Terrorist',
            },
        ];
        this.enemyList.update();

        // add waypoint
        const waypointButton = side.find('#waypoint')[0] as Button;
        waypointButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            if (this.enemyGrid.selected.length <= 0) {
                params.user.prompt('Select a target first');
                return;
            }
            const index = parseInt(this.enemyGrid.selected[0]);
            const item = this.enemyList.items[index];
            this.onAction('waypoint', params.user, item);
        });

        // delete
        const deleteButton = side.find('#delete')[0] as Button;
        deleteButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            if (!this.delete) {
                params.user.prompt('Click on a waypoint to select it');
                return;
            }
            this.onAction('delete', params.user, { delete: this.delete });
            this.delete = undefined;
        });

        // add path
        const pathButton = side.find('#path')[0] as Button;
        pathButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            if (!this.from || !this.to) {
                params.user.prompt('Select both the "from" and "to" waypoint');
                return;
            }
            this.onAction('path', params.user, { from: this.from, to: this.to });
            this.from = undefined;
            this.to = undefined;
        });
    }

    private async toggleGameMenu() {
        const side = this.menu.view.root.find('#side')[0];
        const opened = side.find('#game').length > 0;
        this.clear();
        if (opened) {
            return;
        }
        side.append(this.gameXML);

        // start
        const targetPracticeStartButton = side.find('#target_practice_start')[0] as Button;
        targetPracticeStartButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            const respawnCheckbox = side.find('#respawn_checkbox')[0] as Checkbox;
            this.onAction('start', params.user, {
                mode: 'target_practice', settings: {
                    respawn: respawnCheckbox.checked,
                }
            });
            this.refreshStartButton('target_practice_start');
        });

        const whackamoleStartButton = side.find('#whackamole_start')[0] as Button;
        whackamoleStartButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            const movingCheckbox = side.find('#moving_checkbox')[0] as Checkbox;
            this.onAction('start', params.user, { mode: 'whackamole', settings: {
                moving: movingCheckbox.checked,
            } });
            this.refreshStartButton('whackamole_start');
        });

        const searchAndDestroyButton = side.find('#search_and_destroy_start')[0] as Button;
        searchAndDestroyButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            this.onAction('start', params.user, { mode: 'search_and_destroy', settings: {} });
            this.refreshStartButton('search_and_destroy_start');
        });

        const zombieHordeButton = side.find('#zombie_horde_start')[0] as Button;
        zombieHordeButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            this.onAction('start', params.user, { mode: 'zombie_horde', settings: {} });
            this.refreshStartButton('zombie_horde_start');
        });
    }

    private refreshStartButton(id: string) {
        const side = this.menu.view.root.find('#side')[0];
        side.find('.start').forEach(b => {
            if (b.dom.id == id) {
                b.dom.style.asset = 'Stop';
            } else {
                b.dom.style.asset = 'Play';
            }
            b.refreshStyle();
        });
    }

    private clear() {
        const side = this.menu.view.root.find('#side')[0];
        side.clear();
        this.from = undefined;
        this.to = undefined;
    }

    public onEdit(action: string, params: any) {
        const side = this.menu.view.root.find('#side')[0];
        if (side.find('#editor').length <= 0) return;
        switch (action) {
            case 'select':
                if (!this.from || this.from && this.to) {
                    this.from = { id: params.id, name: params.options.name };
                } else if (!this.to) {
                    this.to = { id: params.id, name: params.options.name };
                }
                this.delete = { id: params.id, name: params.options.name };
                break;
            case 'delete':
                this.from = undefined;
                this.to = undefined;
                break;
        }
    }
}