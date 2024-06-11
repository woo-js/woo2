import { IElemJson, JsUtils, NetUtils } from "../common";
import { Logger } from "../logger";
import { message } from "../message";
import { workerMeta } from "./workerMeta";
import { WorkerScope } from "./workerScope";

// Worker 线程加载Components
const log = Logger("WOO:WorkerComponent")

const SelfClosedTagSet = new Set(['img', 'input', 'br', 'hr', 'meta', 'link', 'base', 'area', 'col', 'command', 'embed', 'keygen', 'param', 'source', 'track', 'wbr'])


interface ITplDescriptor {
    rootElem: IElemJson, relUrl: string
}
const tplRegistry = new class TplRegistry {
    private _tplRegistry = new Map<string, ITplDescriptor>()

    async get(tag: string): Promise<ITplDescriptor> {
        if (!this._tplRegistry.has(tag)) {
            let relPrefix = workerMeta.tagPathPrefix(tag)
            let tplUrl = relPrefix + '.html'
            let html = await NetUtils.httpGetText(tplUrl)
            let result = await message.send('W:ParseTpl', { text: html })
            this._tplRegistry.set(tag, {
                rootElem: result.tpl,
                relUrl: relPrefix
            })
        }
        return this._tplRegistry.get(tag)!;
    }
}

// cid => WorkerComponent Map
export const workerComponentRegistry = new Map<string, WorkerComponent>()

type IScope = { [k: string]: any }

/**
 * 属性处理的计算模式:
 * $attr: 值绑定,内容为计算表达式的结果
 * :attr: 模板绑定,内容为模板字符串,在CSS中支持"$" 和 ':' 表示的计算模式 
 * attr.type: 类型绑定,值为自动转换字符串的结果,支持:int,float,bool,object,array,obj,str,string等
 * attr: 默认为静态字符串绑定
 */
class WAttr {
    name = ""
    private _dirty = true
    private _value = '' as any
    private _computeFuncFactory?: Function
    constructor(private _elem: WElem, private _tplName: string, private _tplValue: string) {
        if (_tplName.startsWith('$') || _tplName.startsWith(':')
        ) {
            this.name = _tplName.slice(1)
            // 创建计算函数
            try {
                this._computeFuncFactory = _elem.scope.scopedFunctionFactory(_tplValue)

            } catch (e: any) {
                log.error('Error parse attr:', _tplValue, e.message)
            }
            this._dirty = true
        } else {
            this.name = _tplName
            this._value = _tplValue
            this._dirty = false
        }
    }
    // 计算属性值
    _computeValue() {
        if (this._computeFuncFactory) {
            try {
                let rt = this._computeFuncFactory()
                this._value = rt


            } catch (e: any) {
                log.error('Error compute attr:', this._elem.tag, this._tplName, this._tplValue, e.message)
            }
            this._dirty = false
        } else {
            this._value = this._tplValue
            this._dirty = false
        }
    }
    get value() {
        if (this._dirty) {
            this._computeValue()
        }
        return this._value
    }
    get isDynamic() {
        return !this._computeFuncFactory
    }
    setValue(v: any) {
        log.warn("==>>>???? setValue: ", v)
        this._value = v
    }

    invalidate() {
        this._dirty = true
    }

}
class WTextNode {
    text = "TEXT"
    /**
     * @param _tplText 模板字符串
     * @param calcMode 计算模式,取值 "$"或':',代表值绑定或者模板绑定
     */
    constructor(private _elem: WElem, private _tplText: string, calcMode?: string) {
        if (calcMode == '$') {
        } else if (calcMode == ':') {
        } else {
            this.text = _tplText
        }
    }
}

class WEvent {
    constructor(private _elem: WElem, private _eventName: string, private _tplEvent: string) {
    }
}


/**
 * WebComponent元素,处理WebComponent元素的加载和渲染
 * 跟踪元素作用域的变化依赖,并计算依赖属性的变化,更新元素的属性和内容
 */
class WElem {
    private _tag: string
    private _attrs: { [k: string]: WAttr } = {}
    private _events: WEvent[] = []
    private _children: (WElem | WTextNode)[] = []
    // 创建作用域对象,每个元素的scope中保存元素的动态属性,不包括静态属性
    private _workScope: WorkerScope

    private _loadPromises: Promise<void>[] = []
    private _contentCalcMode = ''

    // 从ElemJson构造WElem
    constructor(private _componentRoot: WorkerComponent, private _parent: WElem | undefined, tplElem: IElemJson) {
        this._tag = tplElem.tag
        this._workScope = new WorkerScope(this.indentify, {}, this._parent?._workScope)

        // 解析和处理属性
        this._initAttrs(tplElem)

        // 处理子元素
        this._initChildContent(tplElem)

        // 加载自定义组件
        if (this._tag.includes('-')) {
            // 检测当前自定义的组件是否已经注册
            this._loadPromises.push(this._loadWebComponentElem())
        }
    }


    private _initAttrs(tplElem: IElemJson) {
        JsUtils.objectForEach(tplElem.attrs, (v, k) => {
            // 检测元素内容计算模式
            if (k == '$' || k == ':') {
                this._contentCalcMode = k
                return
            }
            let att = new WAttr(this, k, v)
            if (att.name) {
                this._attrs[att.name] = att
                if (att.isDynamic) {
                    // 动态属性,为作用域添加get属性
                    this._workScope.scope[att.name] = att.value
                }
            }
        })

        // 根元素不设置eid,因为根元素的eid由外部组件分配
        if (this._parent)
            this._attrs['_eid'] = new WAttr(this, '_eid', this._componentRoot.newEid(this).toString())
    }

    private _initChildContent(tplElem: IElemJson) {
        tplElem.children.forEach(child => {
            if (typeof child === 'string') {
                // 文本节点
                this._children.push(new WTextNode(this, child, this._contentCalcMode))
            } else {
                let elem = new WElem(this._componentRoot, this, child)
                this._children.push(elem)
                if (elem.tag.includes('-'))
                    this._loadPromises.push(elem.waitLoad())
            }
        })

    }

    private async _loadWebComponentElem() {
        // 检测是否符合组件自定义标签规范
        // 首先查找是否已经注册
        // 如果未注册则请求主线程确定是否自定义组件已经注册(可能第三方已经注册),并注册和加载组件
        let result = await message.send('W:PreloadElem', { relUrl: this._componentRoot.relUrl, tag: this._tag, attrs: JsUtils.objectMap(this._attrs, (v, k) => { return v.value }) })
        // 如果返回，则代表自定义标签已经完成注册和创建
        if (result.elem) {
            this._tag = result.elem.tag
            // 更新属性
            JsUtils.objectForEach(result.elem.attrs, (v, k) => {
                if (this._attrs[k]) {
                    this._attrs[k].setValue(v)
                } else {
                    // 加载子组件可能会产生新属性,此属性不在模板属性中,保存为标准静态模板属性
                    this._attrs[k] = new WAttr(this, k, v)
                }
            })
        }
    }
    get tag() {
        return this._tag
    }
    async waitLoad() {
        await Promise.all(this._loadPromises)
    }

    attrsValue() {
        return JsUtils.objectMap(this._attrs, (v, k) => {
            return v.value
        })
    }

    // 生成当前元素的完整HTML
    renderOuterHtml(outStringBuilder: string[], includeChilds: boolean = true) {
        outStringBuilder.push(`<${this._tag} `,
            ...JsUtils.objectMapToArray(this._attrs, (attr) => {
                return `${attr.name}="${attr.value}" `
            }),
            '>')
        if (includeChilds) this.renderInnerHtml(outStringBuilder)
        outStringBuilder.push(`</${this._tag}>`)
    }
    // 生成所有子元素的HTML
    renderInnerHtml(outStringBuilder: string[]) {
        this._children.forEach(child => {
            if (child instanceof WTextNode) {
                outStringBuilder.push(child.text)
            } else {
                child.renderOuterHtml(outStringBuilder)
            }
        })
    }
    get scope() {
        return this._workScope
    }
    get indentify() {
        return `${this._componentRoot.indentify}|<${this._tag} eid=${this._attrs['_eid']}>`
    }
}


export class WorkerComponent {
    private _eidMap = new Map<string, WElem>()
    private _cid = ''
    private _eidCounter = 0

    // WebComponent内部根元素
    private _interRootElem?: WElem
    private _relUrl = ''

    // 全局作用域, 保存组件 <script scope=""></script> 中使用的变量 

    constructor(public rootTag: string, private _compAttrs: { [k: string]: string }) {
        this._cid = _compAttrs['_cid']
        if (!this._cid) throw new Error('WorkerComponent must have _cid attribute')
        workerComponentRegistry.set(this._cid, this)
    }
    newEid(elem: WElem) {
        let eid = `${this._cid}:${this._eidCounter++}`
        this._eidMap.set(eid, elem)
        return eid;
    }
    get indentify() {
        return `<${this.rootTag} cid="${this._cid}">`
    }

    // 加载组件
    async load() {
        // 加载组件
        let tpl = await tplRegistry.get(this.rootTag)
        this._relUrl = tpl.relUrl

        if (tpl.rootElem.tag != 'template') {
            log.error('load component:', this.rootTag, '\"root element must be <template>\"')
            return
        }
        this._interRootElem = new WElem(this, undefined, tpl.rootElem)
        await this._interRootElem.waitLoad()

    }
    get relUrl() {
        return this._relUrl
    }

    // 获取根元素的属性
    rootAttrs() {
        let rootAttrs = this._interRootElem?.attrsValue() || {}
        // 如果组件传入属性不在rootElem中,则添加到rootElem中
        JsUtils.objectForEach(this._compAttrs, (v, k) => {
            if (!rootAttrs[k]) {
                rootAttrs[k] = v
            }
        })

        return rootAttrs
    }
    renderContentHtml(outStringBuilder: string[]) {
        // 渲染内容
        this._interRootElem?.renderInnerHtml(outStringBuilder)
    }
}


// 全局标签到工厂的映射表
const _tagFactoryMap = new Map<string, WcFactory>()

const _cidInstanceMap = new Map<string, WorkerComponent>()


/**
 * 请求组件工厂,并等待加载初始化完毕
 * 组件工厂加载和初始化标签的模板,使用组件默认值创建初始化组件树和scope作用域
 * 生成组件对象实例时可直接复制组件树和scope作用域,structuredClone快速克隆算法
 * @param tag  组件标签
 * @returns 
 */
export async function requestWcFactory(tag: string): Promise<WcFactory> {
    let fa = _tagFactoryMap.get(tag) as WcFactory
    if (!fa) {
        fa = new WcFactory(tag)
        _tagFactoryMap.set(tag, fa)
    }
    await fa.waitReady()
    return fa
}

export class Wc{
    private _hostElem?:WElem
    private _rootElem?:WElem
}

// 组件模板工厂类，解析和预处理模板,生成初始化模板元素树和对应作用域
// 每个动态元素包含_id属性,id属性使用:分割tid+eid组合,用于标识元素以及定位模板元素
// 每个根元素包含_cid属性,用于标识全局唯一组件实例
export class WcFactory {
    // 
    // 解析模板生成的_tid元素对应的元素
    private _tidMap = new Map<string, WElem>()

    // 生成元素树和初始作用域树
    constructor(private _tag: string) {

    }
    // 等待组件工厂加载完毕
    async waitReady() {

    }

    /**
     * 创建组件实例,初始化实例时需重新计算所有的作用域变量
     * 
     */
    createInstance(attrs: { [k: string]: any }) {
        // 创建组件实例,初始化scope,创建新实例
    }
}


