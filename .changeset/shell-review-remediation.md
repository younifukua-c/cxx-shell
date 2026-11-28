---
"@cxx/app-shell": patch
"@cxx/host-runtime": patch
---

原生外壳按类型、样式与异步切换生命周期拆分；应用导航只提交成功入口，失败不恢复失败请求；激活窗口复用一次品牌配置读取。
