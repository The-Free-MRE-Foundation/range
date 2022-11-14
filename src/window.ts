import { Context } from "@microsoft/mixed-reality-extension-sdk";
import { Menu, ViewElement } from "altvr-gui";
import { Async, fetchText } from "./utils";

export interface WindowOptions {
    baseurl: string,
    menu_url: string,
    menu: Menu,
    options: any
}

export abstract class Window extends Async {
    protected menuXML: string;
    protected menu: Menu;
    protected menuView: ViewElement;

    constructor(protected context: Context, protected options: WindowOptions) {
        super();
        this.initWindow();
    }

    private async initWindow() {
        this.menu = this.options.menu;
        this.menuView = this.menu.view.root.find('#main')[0];

        let url = (this.options as WindowOptions).menu_url;
        url = url.split('://').length > 1 ? url : `${this.options.baseurl}/${url}`;
        this.menuXML = await fetchText(url);
        this.notifyCreated(true);
    }

    public open() {
        this.createMainMenuView();
    }

    public close() {
        this.menuView.clear();
    }

    public remove() {
        this.close();
    }

    public createMainMenuView() {
    }
}