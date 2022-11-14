/*!
 * Copyright (c) The Free MRE Foundation. All rights reserved.
 * Licensed under the MIT License.
 */

import { DegreesToRadians, Quaternion, ScaledTransform, ScaledTransformLike } from "@microsoft/mixed-reality-extension-sdk";
import fetch from "node-fetch";

export function translate(transformLike: Partial<ScaledTransformLike>) {
    const pos = transformLike.position ? transformLike.position : { x: 0, y: 0, z: 0 };
    const rot = transformLike.rotation ? transformLike.rotation : { x: 0, y: 0, z: 0 };
    const scale = transformLike.scale ? transformLike.scale : { x: 1, y: 1, z: 1 };
    const transform = new ScaledTransform();
    transform.copy({
        position: pos,
        rotation: Quaternion.FromEulerAngles(
            rot.x * DegreesToRadians,
            rot.y * DegreesToRadians,
            rot.z * DegreesToRadians
        ),
        scale,
    });
    return transform;
}

export async function fetchJSON(url: string) {
    const res = await fetch(url);
    const text = await res.text();
    return JSON.parse(text);
}

export async function fetchText(url: string) {
    const res = await fetch(url);
    const text = await res.text();
    return text;
}

interface promise {
    resolve: (...args: any[]) => void;
    reject: (reason?: any) => void;
}

export class Async {
    private _created: boolean;
    private createPromises: promise[] = [];

    protected notifyCreated(success: boolean) {
        this.createPromises.forEach(p => {
            if (success) {
                p.resolve();
            } else {
                p.reject();
            }
        });
    }

    public created() {
        if (!this._created) {
            return new Promise<void>((resolve, reject) => this.createPromises.push({ resolve, reject }));
        } else {
            return Promise.resolve();
        }
    }
}