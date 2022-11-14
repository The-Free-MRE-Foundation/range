import { Context, User } from "@microsoft/mixed-reality-extension-sdk";
import { Button, Grid, Pager, PaginatedGrid, Slider } from "altvr-gui";
import { fetchText } from "../utils";
import { Window, WindowOptions } from "../window";

export interface StartWindowOptions extends WindowOptions {
    attachment_url: string,
    editor_url: string,
}

export class StartWindow extends Window {
    private categoryGrid: Grid;
    private categoryList: PaginatedGrid;

    private weaponGrid: Grid;
    private weaponList: PaginatedGrid;

    private attachmentGrid: Grid;
    private attachmentList: PaginatedGrid;

    private enemyGrid: Grid;
    private enemyList: PaginatedGrid;

    public onAction: (act: string, user: User, params?: any) => void;

    private attachmentXML: string;
    private editorXML: string;

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
            this.onAction('category', params.user, item);
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

        // start
        const startButton = this.menu.view.root.find('#start_btn')[0] as Button;
        startButton.addUIEventHandler('click', (params: { user: User, id: string }) => {
            this.onAction('start', null, {});
        });

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
            this.toggleEditorMenu();
        });

        if (!this.editorXML) {
            let url = (this.options as StartWindowOptions).editor_url;
            url = url.split('://').length > 1 ? url : `${this.options.baseurl}/${url}`;
            this.editorXML = await fetchText(url);
        }
    }

    private updateCategories() {
        this.categoryList.items = ['Pistols', 'Heavy', 'SMGs', 'Rifles', 'Gear', 'Grendades'].map(name => ({
            name
        }));
        this.categoryList.update();
    }

    private updateWeapons() {
        this.weaponList.items = [
            {
                id: 0,
                asset: 'Blaster',
                name: 'Blaster'
            },
            {
                id: 1,
                asset: 'M9',
                name: 'M9'
            },
            {
                id: 2,
                asset: 'M16',
                name: 'M16'
            },
            {
                id: 3,
                asset: '590A1',
                name: '590A1'
            },
            {
                id: 4,
                asset: 'MK18',
                name: 'MK18'
            },
            {
                id: 5,
                asset: 'Hunter',
                name: 'Hunter'
            },
            {
                id: 6,
                asset: 'MP5',
                name: 'MP5'
            },
        ];
        this.weaponList.update();
    }

    private async toggleAttachmentMenu() {
        const side = this.menu.view.root.find('#side')[0];

        const opened = side.find('#attachment').length > 0;
        side.clear();
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

        this.attachmentList.items = [
            {
                id: 0,
                name: 'Flash Light',
            },
            {
                id: 1,
                name: 'Pistol Silencer',
            },
            {
                id: 2,
                name: 'Rifle Silencer',
            },
            {
                id: 3,
                name: 'Tactical Laser',
            },
            {
                id: 4,
                name: 'ForeGrip',
            },
            {
                id: 5,
                name: 'SR Scope',
            }
        ];
        this.attachmentList.update();
    }

    private async toggleEditorMenu() {
        const side = this.menu.view.root.find('#side')[0];
        const opened = side.find('#editor').length > 0;
        side.clear();
        if (opened) {
            return;
        }
        side.append(this.editorXML);
    }
}