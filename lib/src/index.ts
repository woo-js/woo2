import pkg from '../package.json'

// 获取当前脚本的路径
const src = (document.currentScript as HTMLScriptElement).src
console.log('Hello, world!',pkg.name,pkg.version,src);



// new Worker(src.replace('index.js','worker.js' ))
new Worker(URL.createObjectURL(new Blob([`console.log("in worker.js")`], { type: 'application/javascript' })))

