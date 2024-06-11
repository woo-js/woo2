import './message'
import { loadDoument } from "./main/mainComponent";
import pkg from '../package.json'
import "./messageHandle"
import "./main/mainMessage"

console.log('Power By ', pkg.name, pkg.version);
const startTm = Date.now()
const rootEl = document.head.parentElement!!
// 为避免启动时的闪烁,html可通过 <style> 标签初始化隐藏body对象
// 

window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded1')
    loadDoument().then(() => {
        document.body.setAttribute('_ready', '')
        console.log('DOMContentLoaded', 'loadDoument', Date.now() - startTm)
    })
})
new EventSource('/esbuild').addEventListener('change', (ev) => {
    console.log('change', ev)
    // location.reload()
})

// 获取当前脚本的路径
export default {}

// class A1{
//     constructor(){
//         return makeProxy(this)
//     }
// }

// class ABC extends A1{
//     aaa='aaa'
//     constructor() {
//         super()
//         console.log('ABC.constructor')
//         this.fn()
//     }

//     fn(){
//         setTimeout(()=>{
//             this.fn1()
//         },1000)
//     }
//     fn1(){
//         this.aaa="aaa1111"
//         console.log('ABC.fn',this.aaa)

//     }
// }

// const abc = new ABC()
// debugger
// abc.fn()
// abc.aaa="bbb"


