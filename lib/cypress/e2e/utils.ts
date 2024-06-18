
// 实现一个简单的defer, 并可以测量函数执行时间
export class Defer<T> {
  private _resolve: Function;
  private _reject: Function;
  private _promise: Promise<T>;
    private _start: number;
    private _end: number;
    private _duration: number;
    constructor() {
        this._promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
            this._start = Date.now();
        });
    }
    resolve(value: T) {
        this._end = Date.now();
        this._duration = this._end - this._start;
        this._resolve(value);
    }
    reject(reason: any) {
        this._end = Date.now();
        this._duration = this._end - this._start;
        this._reject(reason);
    }
    get promise() {
        return this._promise;
    }
    get duration() {
        return this._duration;
    }
}