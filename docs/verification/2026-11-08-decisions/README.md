# 2026-11-08 已批准修正验证证据

本轮是 `d893f9b` 后的 D01–D04/D33–D37 修正；D38 通用历史订单细分规则待决。全部自动化使用本地合成数据，不伪造云身份、不写真实云数据。

| 证据 | 当前结果 | 验收边界 |
|---|---|---|
| jest-summary.json | 48套、529项通过 | 共享逻辑；不是全部云端业务 |
| baseline-frontend.json | 原44项全部通过 | 修复原3项失败；ADDRESS_RACE脚本改为等待实际异步handler完成后断言，断言未削弱 |
| frontend.json | 新15项全部通过 | 密码草稿迁移、地址反序/隐藏/重试、回收恢复/重复点击、图片过期/撤权/预览/旧外链拒绝 |
| feature-boundaries.json | 56项全部通过 | 真实云函数入口代码 + 只读合成数据库；全局/小区覆盖、绑定、越权和管理员准备例外 |
| login-contract.json | 登录成功、我的入口有效、locationGeo不返回 | 实际源码隔离调用，不代表已部署 |
| static.json | 69页/14分包；77WXML、78WXSS官方编译通过；issues为空 | 组件/路由/事件/语法检查；不代替真机排版和官方包体 |
| boundary.json | 21函数、165actions、288项通过；1428共享副本一致 | 无微信上下文时拒绝，DB/网络0调用 |
| permissions.json | 21函数声明匹配人工核对清单 | 实际云授权未回读，接口尚未真实验收 |
| ui-status.json | 当前项目重新编译0错误；清理获准缓存 | 官方分析仍旧2分包，不能认定包体通过；浏览器工具关闭 |

重跑（仓库根目录）：

```sh
npm run sync
npm test
node docs/verification/2026-11-08/frontend.cjs
node docs/verification/2026-11-08/login-contract.cjs
node docs/verification/2026-11-08/static.cjs
node docs/verification/2026-11-08/boundary.cjs
node docs/verification/2026-11-08-decisions/frontend.cjs
node docs/verification/2026-11-08-decisions/feature-boundaries.cjs
node docs/verification/2026-11-08-decisions/permissions.cjs
```

前四个旧脚本输出到 `/tmp/jinlin-check-20261108`，本目录保存本次结果；原2026-11-08目录历史JSON保留未覆盖。

D02平台依据与限制：微信服务端SDK类型及[腾讯云Node SDK存储说明](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/storage.md)列有 maxAge；[CloudBase当前存储OpenAPI](https://docs.cloudbase.net/api-reference/openapi/storage)同样列出该参数。但[Web SDK更新日志](https://docs.cloudbase.net/api-reference/webv3/changelog)对传统模式TTL有兼容性说明，接口产品/模式不同，不能外推保证本环境恰好600秒。代码请求600秒并限制前端缓存；须部署后用非敏感图片验证同一链接实际过期。未验证前不启用真实证件流程，若平台不支持则按5W2H重新决策，不擅自扩大有效期或改公开存储。

完整用户验收仍以 ../../TEST_HANDOFF.md 为准：40规格场景、15关闭回归、4真实支付、补充与69页索引均保留。D01资格、D05–D07配置、D10部署、D38待决与真机/跨角色实测未完成，不标总体完成。
