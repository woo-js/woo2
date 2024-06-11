import { JsUtils } from "../common";
import { Logger } from "../logger";

const log = Logger('workerScope');

// 观察对象,symObserver 保存了依赖的Set集合
const SymObserver = Symbol('ScopeObserver');
const SymScopeVerison = Symbol('ScopeVersion')

/**
 * 作用域对象, 自动跟踪对象的属性变化,并通知依赖的对象处理变更
 * 当一个对象添加到作用域中时,会自动跟踪对象的属性变化
 * 每个WebComponent实例拥有唯一的作用域对象
 * 当WebComponent实例销毁时,作用域对象也会销毁
 */
export class WorkerScope {
    private _scope

    constructor(
        private _name: string,// 作用域名称,(tag|cid), 用于调试输出
        _initObject: object,// 初始化对象
        private _parentScope?: WorkerScope,// 父级作用域
    ) {
        this._scope = this._initScopedObject(_initObject)
        if (_parentScope) {
            // 设置父级作用域对象
            // debugger;
            Reflect.setPrototypeOf(this._scope, _parentScope._scope)
        } else {
            // 根作用域,设置根作用域的版本号对象,用于检测作用域属性数量的变化,作用域属性数量的变化将导致重新生成计算函数
            Reflect.defineProperty(this, SymScopeVerison, { value: 0 })
        }
        log.debug('new WorkerScope', _name, _initObject, _parentScope)
    }
    get scope() {
        return this._scope
    }

    // 初始化传入的预定义对象
    private _initScopedObject(obj:any):any{
        let root={}
        // 检测obj是否为类,如果是类则初始化一个实例       
        if(obj instanceof Function){
            try{
                root =  new obj()                
            }catch(e){
                log.error('root object not class',this._name)
            }
        }else if(typeof obj === 'object'){
            root = obj
        }else{
            // 不支持非对象类型
            log.error('root object not object',this._name, typeof obj, obj)
        }

        this._makeObserver(root)
        return root;
    }

    // 为一个对象初始化可观测对象
    private _makeObserver(obj: any) {
        if (Reflect.getOwnPropertyDescriptor(obj, SymObserver)) return ;
        if(typeof obj !== 'object' || obj === null) return ;
        Reflect.defineProperty(obj, SymObserver, {
            value: {
                // 依赖的Set集合，即当自身发生变化时,可能会影响到的其他对象
                deps: new Set<string>(),
            }
        });
        // 为对象所有自身属性创建get/set函数
        Reflect.ownKeys(obj).forEach(k => {
            if(typeof k !== 'string') return;
            this._observeObjectProp(obj, k)
        })
        // 为对象原型创建proxy,以处理新建属性
    }
    private _observeObjectProp(obj: any, prop: string) {
        let desc = Reflect.getOwnPropertyDescriptor(obj, prop)
        if(desc && desc.configurable && desc.enumerable && desc.writable && !desc.get && !desc.set){
            // 为对象属性创建get/set函数
            Reflect.defineProperty(obj, prop, {
                get(){
                    return desc.value
                },
                set(value){
                    desc.value = value
                }
            })
        }


        // 为对象原型创建proxy,以处理新建属性
    }

    // 搜集作用域对象的所有属性,并生成执行函数
    private _scopeMembersDeep(): string[] {
        let members = new Set<string>()
        let workScope: WorkerScope|undefined = this
        while (workScope) {
            const keys = Reflect.ownKeys(workScope.scope).filter(k => typeof k === 'string')
            keys.forEach(k => members.add(k.toString()))
            workScope = workScope._parentScope
        }
        return Array.from(members)
    }

    // 创建一个函数,用于执行表达式
    // 表达式中的变量会被转换为局部变量
    // 表达式中的变量数量发生变化时,会重新生成函数
    scopedFunctionFactory(expr: string) {
        let _scopedVersion = (this as any)[SymScopeVerison]
        // 将作用域对象的属性转换为局部变量,包括父级作用域
        let scopedFunction: Function
        let scopedMembers=[] as any[]
        return () => {
            if (!scopedFunction || _scopedVersion !== (this as any)[SymScopeVerison] ) {
                // 创建新函数,并保存版本号
                scopedMembers = this._scopeMembersDeep()
                // 创建异步执行函数
                try{
                    scopedFunction = new Function(...scopedMembers, `return ${expr};`) as any
                    log.debug('new scopedFunction', expr, scopedMembers)
                }catch(e){
                    scopedFunction =  new Function(...scopedMembers, "return ''") as any
                    log.error('new scopedFunction error', expr, scopedMembers, e)
                }
                _scopedVersion = (this as any)[SymScopeVerison]    
            }

            let values = scopedMembers.map(k => this._scope[k])
            return scopedFunction.apply(this._scope,values );
        }
    }
    // 执行一个表达式函数,跟踪表达式执行过程中的依赖关系,当依赖的对象发生变化时,通知依赖的对象处理变更
    // 表达式支持异步对象
    $watch<T>(func: () => T, listener: (old: T, compute: () => T) => T): T {
        const err = new Error()

        return {} as T
    }



    // private _mkProxy<T extends object>(obj: T): T {
    //     const _this = this
    //     // 不是对象则返回
    //     if (typeof obj !== 'object' || obj === null) return obj;
    //     if (Reflect.getOwnPropertyDescriptor(obj, SymObserver)) return obj
    //     // 定义观察对象
    //     Object.defineProperty(obj, SymObserver, {
    //         value: {
    //             $deps: new Set<string>(),// 依赖对象集合,当自身发生改变时,通知依赖对象变化
    //         }
    //     });

    //     return new Proxy(obj as any, {
    //         get(target, prop) {
    //         },
    //         set(target, prop, value) {
    //             // 如果value为对象,则递归生成代理对象
    //             target[prop] = _this._mkProxy(value);
    //             return true
    //         }
    //     })
    // }
}



// export class WatcherClass {
//     constructor() {
//         return makeProxy(this);
//     }
// }
// export function watchObject<T extends {}>(obj: T): T {
//     return makeProxy(obj)
// }

export const workerObserver = new class WorkerObserver {

    /**
     * 创建一个可观测对象,在对象的属性发生变化时,通知依赖的对象处理变更
     * @param target 
     * @param prop 
     */
    observe(target: { [k: string]: any }) {
    }

    // 生成代理对象
    makeProxy(obj: any) {
        const _this = this
        if (Reflect.getOwnPropertyDescriptor(obj, SymObserver)) return obj;
        Reflect.defineProperty(obj, SymObserver, {
            value: {
                // 依赖的Set集合，即当自身发生变化时,可能会影响到的其他对象
                deps: new Set<string>(),
            }
        });
        console.log('makeProxy', obj);
        return new Proxy(obj, {
            get(target, prop) {
                const value = target[prop];
                if (typeof value !== 'object' || value === null || Reflect.getOwnPropertyDescriptor(value, SymObserver)) {
                    return value;
                }
                target[prop] = _this.makeProxy(value);
                return target[prop];
            },
            set(target, prop, value) {
                if (target[prop] === value) return true;
                if (typeof value !== 'object' || value === null || Reflect.getOwnPropertyDescriptor(value, SymObserver)) {
                    target[prop] = value;
                    return true;
                }
                target[prop] = _this.makeProxy(value);
                return true;
            }
        });
    }
}


// const globalScope = new WorkerScope('globalScope',{},undefined)
