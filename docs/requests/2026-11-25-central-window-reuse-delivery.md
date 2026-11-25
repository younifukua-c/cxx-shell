# 窗口复用中央交付

来源：codex://threads/01a1626c-7c9d-7842-a91a-c530c45f1994，2026-11-25当前用户消息及既有交付要求，由集成者逐字摘录。

> 继续

> 你以后合并完更新产品依赖,并且起一下,比如当前是repodisk,install依赖然后start

> 以后合并完成都请重启我前面也说过了

合入codex/restart-window-reuse的7540fb884c45413385d82573d2a223afa3b9d171及追加后台自测0ea333a0139d161da7639a2096db217b382eb12f。消费HostRuntime补丁Changeset为0.14.7，以同一份不可变归档更新产品。AppShell0.28.3及其他中央包不变，产品不机械升版。隔离验证后按目标beta交付并正常重启RepoDock；问题只报告，不代改实现。
