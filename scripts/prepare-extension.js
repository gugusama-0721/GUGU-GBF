// 把 vue 运行时从 node_modules 同步到 extension/，供 MV3 扩展直接以 <script> 加载。
// 扩展不能走打包器，因此这里只做文件拷贝，保持 extension/vue.global.prod.js 与依赖版本一致。
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "node_modules", "vue", "dist", "vue.global.prod.js");
const dest = path.join(root, "extension", "vue.global.prod.js");

if (!fs.existsSync(src)) {
  console.error(`未找到 ${path.relative(root, src)}，请先执行 npm install。`);
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log(`已同步 vue → ${path.relative(root, dest)}`);
