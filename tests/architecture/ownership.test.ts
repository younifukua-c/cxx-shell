import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
test("框架实现不反向依赖产品或兄弟源码", () => {
  for (const folder of ["packages/app-shell/src", "packages/host-runtime/lib"])
    for (const entry of fs.readdirSync(folder, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile() || !/\.(?:ts|vue|cjs)$/.test(entry.name)) continue;
      const text = fs.readFileSync(
        path.join(entry.parentPath, entry.name),
        "utf8",
      );
      assert.doesNotMatch(
        text,
        /(?:from|require\()\s*['"][^'"]*(?:cxx-repodock|cxx-deploy-flow|\.\.\/\.\.\/cxx-ui)/,
        entry.name,
      );
    }
});

test("桌面装配只通过公开包消费框架，Renderer不读取Node",()=>{
 const source=fs.readFileSync('desktop/renderer/main.ts','utf8');
 assert.doesNotMatch(source,/(?:from|require\()\s*['"](?:node:|electron|\.\.\/.*main)/);
 const runtime=JSON.parse(fs.readFileSync('packages/host-runtime/package.json','utf8'));
 assert.equal(Object.keys(runtime.dependencies||{}).length,0);
 const shell=JSON.parse(fs.readFileSync('packages/app-shell/package.json','utf8'));
 assert.ok(shell.dependencies['@cxx/ui']);
 assert.equal(shell.dependencies['@cxx/project-kit'],undefined);
});
test("外壳滚动条沿用公共UI外观",()=>{
 for(const entry of fs.readdirSync('packages/app-shell/src',{recursive:true,withFileTypes:true})){
  if(!entry.isFile()||!entry.name.endsWith('.css'))continue;
  const source=fs.readFileSync(path.join(entry.parentPath,entry.name),'utf8');
  assert.doesNotMatch(source,/::-webkit-scrollbar|scrollbar-color|scrollbar-width/,entry.name);
 }
});
