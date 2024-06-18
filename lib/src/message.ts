import { Logger } from "./logger";
import { Defer, IElemJson, isWorker } from "./common";
import { messageHandle } from "./messageHandle";

const log = Logger(`WOO:Message:${isWorker ? 'Worker' : 'Main'}`)

interface IMessageData {
    type: string,
    reply?: number,
    id?: number,
    data?: any,
    err?: any
}


const TIMEOUT = 500000
type IMessageType = keyof IMessages

/**
 * 消息类型定义,"W:"为Worker线程消息,"M:"为主线程消息
 */
interface IMessages {
        //========= 工作线程发起事件，主线程响应 =========

    // 当Worker线程准备好时,发送此消息,通知主线程Worker启动完成
    'W:Ready': {
        send: {},
        reply: {}
    },
    // 由于DomParse仅能在主线程调用，因此，当Worker线程需要解析Dom时，发送此消息到主线程，由主线程解析完毕后返回解析结果
    'W:ParseTpl': {
        send: { text: string },
        reply: { tpl: IElemJson }
    },

    // 当Worker线程需要预加载元素时，发送此消息到主线程 
    'W:PreloadElem': {
        send: { relUrl: string, tag: string, attrs: { [key: string]: string } },
        reply: { elem?: { tag: string, attrs: { [key: string]: string } } }
    }


    // ======= 主线程发起事件，工作线程响应 =========
    // 更新全局meta属性
    'M:SetMeta': {
        send: {
            meta: IElemJson[],// 需要更新的meta属性列表
            htmlUrl?: string,// 当前页面的Url
        },
        reply: {}
    },
    // 请求加载元素,传入请求加载的元素标签和属性,一般用于在首页加载固定元素或者独立元素(无父元素)
    'M:LoadElem': {
        send: { tag: string, attrs: { [k: string]: string }, relUrl: string },
        reply: { tag: string, attrs: { [key: string]: string }, content: string }
    },

}

/**
 * 实现Worker和主线程的消息通信,处理应答
 * 
 */
export class Message {
    private _msgId = isWorker ? 10000 : 1;
    private _waitReply = new Map<number, { res: (data: any) => void, rej: (err: string) => void }>()
    private _listeners = new Map<IMessageType, (data: any) => Promise<any>>()
    private _workerReadyDefer = new Defer<IMessageData>('WorkerReady')

    constructor() {
        // log.info('Message.constructor');
        messageHandle.addEventListener('message', this.onMessage.bind(this));

        if (isWorker) {
            // Worker线程，发送WorkerReady消息
            this.send('W:Ready', {}).then((data) => {
                this._workerReadyDefer.reslove(data)
            })
        } else {
            // 主线程，等待WorkerReady消息
            this.on('W:Ready', async (data) => {
                this._workerReadyDefer.reslove(data)
                return {}
            })
            this._workerReadyDefer.result().then(() => {
                log.info('WorkerReady')
            })
        }

    }

    onMessage(ev: MessageEvent) {
        const data = ev.data as IMessageData
        if (data.reply) {
            // 处理应答消息
            const reply = this._waitReply.get(data.reply)
            // log.info('<<= Reply Message ', data);
            if (reply) {
                if (data.err) reply.rej(data.err)
                else reply.res(data.data)
                this._waitReply.delete(data.reply)
            } else {
                log.warn('Message.onMessage', 'reply not found', data)
            }
        } else {
            // 处理请求消息
            // log.info('=>> Received Message', data);
            const listener = this._listeners.get(data.type as IMessageType)
            if (listener) {
                listener(data.data).then((result: any) => {
                    messageHandle.postMessage({
                        type: data.type,
                        reply: data.id,
                        data: result
                    })
                }).catch((err: any) => {
                    log.error(`onMessage ${data.type}`, err)
                    messageHandle.postMessage({
                        reply: data.id,
                        err: err
                    })
                })
            } else {
                log.warn('Message.onMessage', 'listener not found', data)
            }

        }
    }

    // 发送消息,并获取返回结果
    async send<T extends IMessageType>(type: T, data: IMessages[T]['send'], transfer?: any[]): Promise<IMessages[T]['reply']> {
        if (!isWorker) {
            // 主线程，等待Worker准备好
            await this._workerReadyDefer.result()
        }

        return new Promise((res, rej) => {
            const id = this._msgId++
            this._waitReply.set(id, { res, rej })
            // 超时处理
            setTimeout(() => {
                if (this._waitReply.has(id)) {
                    this._waitReply.delete(id)
                    rej('timeout')
                    // log.error('Message.send', 'timeout', type, data)
                }
            }, TIMEOUT)
            // 发送消息
            messageHandle.postMessage({
                type,
                id,
                data,
            }, transfer)
        })
    }

    on<T extends IMessageType>(type: T, callback: (data: IMessages[T]['send']) => Promise<IMessages[T]['reply']>) {
        this._listeners.set(type, callback)
    }

}

export const message = new Message()

