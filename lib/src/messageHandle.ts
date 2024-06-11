/**
 * @file messageHandle.ts
 * Worker和Main都进行引用的公共包，导出通讯消息句柄
 * 同时如果是主线程则创建Worker线程
 */

import { worker } from "./main/mainWorkerLoader";


export let messageHandle = (worker || self) as any  as {
    postMessage: (message: any, transfer?: Transferable[] | undefined) => void;
    addEventListener: (type: string, listener: (this: Worker, ev: MessageEvent) => any, options?: boolean | AddEventListenerOptions | undefined) => void;
};

