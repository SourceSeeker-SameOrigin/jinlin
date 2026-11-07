# 近邻帮 · Codex 任务清单

共 34 个任务：T00–T15 是核心交易（SPEC.md），T16–T33 是扩展模块（SPEC_EXT.md）。按顺序做，一次一个任务，一个任务一个 PR。T16 之后的扩展任务彼此独立度较高，T16 完成后，T17–T30 可以并行开多个 Codex 任务，但每个 PR 仍单独验收。每个任务开始时，用下面的提示词：

> 阅读 AGENTS.md、docs/SPEC.md（T16 及以后再加读 docs/SPEC_EXT.md），完成 docs/TASKS.md 中的 **T0X**。只改这个任务涉及的文件。完成后运行 `npm test` 并确保通过。在 PR 描述里写清楚：改了什么、如何在微信开发者工具里逐步手动验证、你做了哪些假设、遗留问题。

人（你）在每个 PR 合并前做两件事：看 PR 描述里的验证步骤，在微信开发者工具里走一遍；有问题把现象和截图贴回给 Codex 修。

---

## T00 仓库骨架与工具链

- 按 AGENTS.md 的目录约定建好全部目录和空页面（每个页面 4 个文件，页面先显示标题即可）。
- `project.config.json`：`miniprogramRoot: "miniprogram/"`，`cloudfunctionRoot: "cloudfunctions/"`；当前仓库使用用户提供的 AppID `wx2908c7661d0ed153`。
- `miniprogram/app.json`：注册 SPEC §3 的全部页面；`provider`、`admin` 为分包；tabBar 三项（首页 / 订单 / 我的），图标先用纯色占位 PNG。
- `miniprogram/config/env.js`：当前开发环境为 `cloud1-d4gbpd8zx89564fb6`；正式环境需另行建立、另配生产 ID；`app.js` 里 `wx.cloud.init({ env: envId, traceUser: true })`。
- 根目录 `package.json`：devDependencies 只有 `jest`；scripts：`test`、`sync`。
- `scripts/sync-shared.js`：把 `cloudfunctions/_shared/`（不含 `__tests__`）复制到每个云函数的 `lib/shared/`；`.gitignore` 忽略 `cloudfunctions/*/lib/shared/` 和 `node_modules`。
- 每个云函数目录：`index.js`（按 `event.action` 分发，未知 action 返回 `E_UNKNOWN_ACTION`）、`package.json`（依赖 `wx-server-sdk`）、`config.json`（按 SPEC §14 填权限和触发器）。

**验收**：`npm install && npm test` 通过（此时可以只有一个占位测试）；微信开发者工具导入后能编译、三个 tab 能切换。

## T01 共享逻辑模块与单测

在 `cloudfunctions/_shared/` 实现纯函数（不依赖 wx-server-sdk），每个都有单测：

- `money.js`：`yuan(fen)` → `'3.50'`；`maskPhone`。
- `time.js`：北京时间工具：`nowCST()`、`ymd(date)`、`hm(date)`、`addDays`、`parseWindow`、`nextDutyWindow(windows, now)`、`isWithin(window, now)`。测试要覆盖 UTC 跨日（北京时间 00:30 = UTC 前一天 16:30）。
- `pricing.js`：`quote({ serviceCode, detail, prices, user, membershipState, todayUsedParcels })` → `{ listPrice, discount, payAmount, goodsCap, reason }`，严格按 SPEC §6.1，含全部入参校验（件数、块数、上限范围），非法返回错误码。
- `split.js`：按 SPEC §6.2，**费率用整数万分比计算**。SPEC §6.3 表格里 7 个样例全部写成测试，再加一个：list 500、pay 500、refund 200、服务员有责 → provider 225、property 15、platform 60。
- `stateMachine.js`：`canTransition(from, to)`、`assertTransition`、`STATUS_TEXT`（中文名）；测试覆盖 SPEC §8 每一条合法转换和至少 5 条非法转换。
- `blacklist.js`：`checkText(text, list)` → 命中的词或 null；全角半角、大小写、空格都要能识别（"香 烟"、"ＵＳＢ"类变体）。
- `ids.js`：`orderNo(now)`（`JL` + yyMMddHHmmss + 4 位随机，北京时间）；`shortCode()`（6 位，去掉易混字符 0/O/1/I）；`membershipTaskId(membershipId, ymd, slot)`。
- `auth.js`：`requireRole`、`requireCommunityAccess`、`requireApprovedProvider`，抛出带 `code` 的错误。
- `errors.js`：`AppError(code, message)`；`wrap(handler)` 把异常转成 `{ ok: false, code, message }`，未知异常统一 `E_INTERNAL` "服务开小差了，请稍后再试"。

**验收**：`npm test` 通过，覆盖以上全部样例。

## T02 数据库种子、索引、安全规则

- `database/seed/communities.json`：1 个示例小区，字段齐全，价格和月卡按 SPEC §4.2 默认值。
- `database/seed/buildings.json`：该小区 3 栋楼，每栋 2 个单元，shortCode 预生成。
- `database/seed/config.json`：SPEC §4.10 默认值，`payMode: "mock"`。
- `database/indexes.md`：SPEC §4.11 的索引，写成在控制台逐条创建的步骤。
- `database/security-rules.json`：按 SPEC §4.12，每个集合一段。
- `database/README.md`：导入顺序和方法（云开发控制台 → 数据库 → 导入 JSON Lines）。注意云开发导入要求每行一个 JSON 对象，种子文件按此格式写（扩展名可用 `.json`，内容为 JSON Lines）。

**验收**：文件格式正确（写一个 Jest 测试逐行 `JSON.parse` 种子文件）。

## T03 登录、绑定门牌、首页

- 云函数 `user`：`login`、`bindPhone`、`setAddress`、`recordScene`；`catalog`：`listCommunities`、`getCommunity`、`resolveScene`。
- 前端 `utils/api.js`：`call(name, action, data)`，统一 loading、错误 toast、`E_FORBIDDEN` 跳回首页。
- `utils/scene.js`：解析 `b=` / `r=`，存 `wx.setStorageSync('scene')`。
- `app.js`：`onLaunch` 调 `login`，解析 scene 并 `recordScene`；全局 `globalData.user`、`globalData.community`。
- 页面：`pages/index`、`pages/bind`、`pages/me`（基础信息部分）、`components/privacy-popup`、`pages/legal/privacy`、`pages/legal/terms`。

**验收**：SPEC §17 场景 1。

## T04 下单与订单（mock 支付）

- 云函数 `order`：`quote`、`create`、`mockPay`、`listMine`、`detail`、`cancel`。`create` 先只支持 mock 和 0 元免支付两条路径（真实支付在 T05）。黑名单和 `msgSecCheck` 在这里接入。
- 页面：`pages/service/express|trash|buy|help`、`pages/orders/list`、`pages/orders/detail`；组件 `price-bar`、`order-card`、`status-timeline`、`service-tile`、`empty-state`。
- 表单任一字段变化时（防抖 300ms）调 `quote` 刷新价格栏。

**验收**：SPEC §17 场景 4、8（mock）；能下 4 种单并在订单页看到。

## T05 真实微信支付与退款

- `order.create` 在 `payMode=wechat` 时调 `cloudPay.unifiedOrder`；新建云函数 `payCallback`、`refundCallback`。
- 抽出 `_shared/payFlow.js`：`onPaid(order, callbackData)`（mock 与真实共用，幂等）、`requestRefund(order, amount, reason)`。
- 前端支付成功后轮询 `order.detail` 最多 10 秒。
- 环境变量读取：`SUB_MCH_ID`、`ENV_ID`、`ALLOW_MOCK_PAY`；缺失时报 `E_CONFIG` 并在日志写明缺哪个。

**验收**：mock 模式下 T04 场景仍然通过；代码审查确认回调幂等、金额校验、状态条件更新。真实支付在商户号就绪后按 SPEC §17.2 由人验证。

## T06 服务员端

- 云函数 `provider` 全部 action；`admin` 的 `listProviders`、`reviewProvider`（通过时设 level，删除身份证照片）、`suspendProvider`、`setInsurance`。
- 页面：`provider/apply`、`provider/workbench`、`provider/hall`、`provider/task`、`provider/earnings`（先只显示明细）、`admin/providers`。
- 接单用条件更新；放弃后该服务员不再看到该单。
- 完成：`wx.chooseMedia` 拍照上传到 `orders/<orderId>/`，代买需小票和实际金额，触发退差额。

**验收**：SPEC §17 场景 2（到 `delivered` 为止）、3、5、6、15。

## T07 确认、评价、投诉、定时任务

- `order.confirm`、`order.rate`、`order.complain`；`admin.resolveComplaint`、`admin.forceCancel`、`admin.assign`、`admin.retryRefund`。
- 进入 `completed` 时写账本（用 `split.js`）。
- 用户已确认：投诉处理分别填写服务费退款与商品款退款并展示合计，各自校验剩余额度；商品款只调整报销，服务费退款影响服务分成。覆盖 SPEC §17 场景 9 的新增代买分项退款与重复/超额退款测试。
- 云函数 `timer`（每 5 分钟）：关闭超时未付、未接单告警（先只写 `alertedAt`，通知在 T09）、自动确认、月卡到期。每项单独 try/catch，一项失败不影响其他项。
- 页面：`pages/orders/detail` 补齐确认 / 评价 / 投诉；`admin/orders`、`admin/order`。

**验收**：SPEC §17 场景 2（完整）、7（不含通知）、9、10。

## T08 月卡

- 云函数 `membership`：`plans`、`buy`、`mine`、`skipToday`；`payFlow.onPaid` 里处理开卡和续期；`timer` 里生成垃圾月卡任务（确定性 `_id`，`add` 遇到重复键视为已生成）。
- 快递月卡额度在 `pricing.quote` 里生效（`todayUsedParcels` 由 `order` 云函数统计当天该用户 `freeByMembership=true` 的件数）。
- 页面：`pages/membership/index`；首页月卡横幅。

**验收**：SPEC §17 场景 11、12。

## T09 订阅消息

- `_shared/notify.js`：`send(openid, templateKey, data, page)`，模板 ID 为空时跳过。
- 接入 SPEC §9 的 4 个场景；前端在对应时机调用 `wx.requestSubscribeMessage`。
- 工作台显示本地累计的"剩余提醒次数"并提示补订。
- `docs/TEMPLATES.md`：写明 4 个模板在公众平台应选择的类型和字段（如"订单状态通知"：订单号、服务内容、状态、时间），以及字段映射。

**验收**：模板 ID 为空时全流程不报错；填入后由人在真机验证。

## T10 管理后台：看板、小区配置、海报码

- `admin.dashboard`（SPEC §15，物业只看本小区）、`updateCommunity`、`upsertBuilding`、`updateConfig`、`genPoster`。
- 页面：`admin/dashboard`、`admin/community`、`admin/posters`（生成后预览，`wx.saveImageToPhotosAlbum` 保存）。
- 所有管理接口做角色校验；物业调用写接口返回 `E_FORBIDDEN`。

**验收**：SPEC §17 场景 13；能为 3 栋楼生成 3 张不同的小程序码。

## T11 结算

- `admin.settlementPreview`（按期间汇总未结算账本：每个服务员一行、每个小区物业一行）、`settlementCreate`、`settlementMarkPaid`、`exportCsv`（UTF-8 带 BOM，Excel 打开不乱码）。
- `provider/earnings` 显示待结算 / 已结算合计与明细；`admin/settlements` 页面。

**验收**：SPEC §17 场景 14。

## T12 来源漏斗与推荐

- 看板加来源漏斗（SPEC §13），按楼栋和推荐服务员各一张表。
- 推荐奖励（`config.referralBonus > 0` 时）在首单完成时写奖励账本。
- 服务员工作台显示"我的推荐码"，可保存图片。

**验收**：用 3 个测试账号分别扫 2 栋楼的码和 1 个推荐码，漏斗数字正确。

## T13 隐私与合规走查

- 逐项核对 SPEC §12：大厅不露门牌；手机号可见时限；身份证照片删除；所有返回前端的手机号已打码。
- 写一个 Jest 测试：对 `order.detail` 的字段裁剪函数（抽到 `_shared/views.js`）按 5 种角色断言可见字段。
- `pages/legal/*` 文本定稿。

**验收**：字段裁剪测试通过；人工核对清单写进 PR 描述。

## T14 体验打磨（面向老人）

- 正文字号、按钮尺寸按 SPEC §16；所有页面空状态 / 加载 / 错误 / 重试。
- 首页"打电话下单"；下单成功页提示"服务员接单后会给您打电话"。
- 网络失败时表单内容不丢（本地暂存）。

**验收**：在开发者工具里切换"弱网"和"离线"走一遍下单。

## T15 端到端验收与修复

- 逐条走 SPEC §17 全部 15 个场景，把结果写成 `docs/ACCEPTANCE.md`（场景、结果、截图文件名、问题）。
- 修复发现的问题；本任务允许改任何文件，但每处修改在 PR 里列明原因。

**验收**：15 个场景全部通过。

---

# 扩展模块（SPEC_EXT.md）

每个扩展任务都要：①受功能开关控制（开关默认关闭，管理后台可打开）；②新增的纯逻辑放 `_shared/` 并写单测；③PR 描述写明"打开开关后如何验证"和"关闭开关后入口是否消失"。

## T16 扩展基础：功能开关、多地址、排期引擎、新角色

- `_shared/features.js`（含依赖校验）及单测；`config.features`、`communities.features` 种子数据；管理后台"功能开关"页。
- 多地址（E0.2）：`users.addresses`，下单页地址选择器，订单 `address` 加联系人。
- 排期引擎（E0.3）：把 T08 的垃圾月卡生成改为 `_shared/schedule.js`，支持 daily / weekly / monthly 与三个时段；单测覆盖跨月、2 月、`skipDates`。T08 的验收场景必须仍然通过。
- `merchant`、`station` 角色与证书字段 `providers.certs`（E0.4、E0.5）；管理后台服务员详情可勾选证书。
- UGC 公共能力（E0.6）：`_shared/ugc.js`（文本检查）、`mediaCallback` 云函数、`reports` 集合与管理后台审核队列、禁言与封禁。

**验收**：所有开关关闭时，T00–T15 的全部场景照常通过；打开 / 关闭任一开关，入口即时出现 / 消失。

## T17 优惠券与环保积分（E6）

- 扩展 `_shared/pricing.js`：券、积分、首单价择优，补单测（每种券类型、门槛、封顶、与首单价择优、积分 50% 上限、最低 1 分）。
- 云函数 `coupon`；券的锁定 / 使用 / 释放 / 退回；新用户自动发券、推荐发券、手动发券。
- 页面：`coupons/center`、`coupons/mine`；下单页价格栏增加券与积分选择；管理后台券模板管理。

**验收**：SPEC_EXT E19 场景 8。

## T18 站内聊天（E4）

- 云函数 `chat`；聊天页（文字、图片、3 秒轮询、未读数）；订单接单自动建会话、完成后定时关闭；隐私提示；频率限制；审计日志。

**验收**：E19 场景 6。

## T19 需求广场与出行帮带（E1、E14）

- 云函数 `board`；分包 `board/`：列表（类型 tab、范围切换）、详情（评论、举报、接单）、发布页。
- 悬赏任务要求发布人选择未来的小区值班日期/时段；帖子与 `custom` 订单事务等效创建，未支付不公开，支付后复用订单支付、接单、分账、退款流程；进入家中任务仅认证服务员可接；境外帮带规则与拦截。

**验收**：E19 场景 2、3、17。

## T20 闲置交易（E2）

- 云函数 `idle`；分包 `idle/`：列表、详情、发布、我的闲置、卖家担保订单；信息模式与担保模式（预留商品、`idle_purchase` 付款/交付/72 小时自动确认、退款后恢复上架、卖家账本和 T30 自动/人工结算）；一键帮搬。

**验收**：E19 场景 4。

## T21 社区活动（E3）

- 云函数 `event`；分包 `events/`：列表、详情、报名、我的报名、组织者管理页（报名名单、扫码签到）；公益 / 兴趣两类规则；赞助录入；活动提醒订阅消息。

**验收**：E19 场景 5。

## T22 联合社区、广告位、物业公告（E15、E16、E17）

- `federationGroupId` 与可见范围过滤（写成 `_shared/visibility.js` 并单测）；云函数 `content`（广告、公告）；首页轮播与公告条；管理后台广告与公告管理；物业发布公告；管理员确认广告款到账后写一笔幂等平台收入账本，确认后锁定广告金额。

**验收**：E19 场景 18、19、20。

## T23 地图定位（E5）

- `_shared/geo.js` 与单测；保留 `location:{lat,lng}`，管理员保存时同步写入 `locationGeo: GeoPoint`；为其建立地理位置索引但不向客户端暴露该内部字段；绑定页附近小区；服务员任务详情页前台定时上报；住户订单详情地图；`app.json` 的 `requiredPrivateInfos`；隐私文本更新。

**验收**：E19 场景 7。

## T24 助老包（E8）

- `meal`、`visit`、`escort` 三项服务：`_shared/services/` 服务端定价与校验、送餐/陪诊下单页（分包 `elder/`）、探访月卡和周期地址快照、服务员端探访清单与报告、住户订单详情报告、异常标记及订阅通知、陪诊证书过滤、服务协议条款、仅含业务字段的补贴明细 CSV。送餐餐费上限和探访每次服务员报酬必须由各小区配置；陪诊只开放未来 30 天且全时长必须落在值班时段内。

**验收**：E19 场景 11、12。

## T25 上门喂宠（E9）

- `pet` 服务：多日排期、子任务 `visits`、每次上门视频或照片、漏次自动部分退款、节假日加价；门锁密码 AES-256-GCM 加密（`_shared/crypto.js` 单测）、按服务日期授权查看、审计日志、完成即删除。

**验收**：E19 场景 13。

## T26 商家入驻与预约（E12）

- 云函数 `merchant`；分包 `merchant/`（商家工作台、服务管理、订单、报价）与 `shops/`（住户浏览、预约）；入驻审核与执照公示；固定价 / 报价制两种流程；佣金与物业分成账本；开锁类核验规则。

**验收**：E19 场景 15。

## T27 回收上门（E11）

- `recycle` 服务：预约、值班时段/同小区接单、按 0.1 kg 称重、按批准舍入规则幂等发积分；确认后写服务员计件账本；回收企业（商家 `category='recycler'`）按企业和类别月度对账导出。

**验收**：E19 场景 9。

## T28 空置房巡检（E13）

- `vacant` 月卡计划（30 日、每月 1 日和 15 日排期且落在值班时段）、按小区 `prices.vacantHome.perVisitPayout` 固化单次计件费、逐项巡检报告与逐次订阅、钥匙方式复用 T25 密码加密与当天审计访问。

**验收**：E19 场景 16。

## T29 驿站批量送上门（E10）

- 云函数 `station`；分包 `station/`：粘贴门牌并创建幂等批次，只纳入明确同意的住户；服务员逐户配送前与提交时双重校验授权，撤回后标记跳过且不计费；住户"快递默认送上门"设置；驿站人员申请、管理员通过/拒绝并记录结果；驿站月度对账导出。驿站账号使用 `stationCommunityId + stationCode`，不覆盖住户 `communityId`。

**验收**：E19 场景 14。

## T30 自动打款（E7）

- 云函数 `payout`：新版商家转账用户确认模式；APIv3 签名（`_shared/wxpayV3.js`，签名串构造写单测，用固定测试密钥对比已知结果）、发起转账、查询转账单；`timer` 轮询；前端提现与 `wx.requestMerchantTransfer`；金额与频次限制；账本锁定与解锁。
- 环境变量缺失时 `payout` 返回 `E_CONFIG`，开关无法打开。

**验收**：E19 场景 10（商户号开通商家转账后由人验证；之前用单测和代码审查）。

## T31 管理后台扩展

- 功能开关页显示每个开关的准备事项（取自 MANUAL_SETUP F 部分的文字）；内容审核队列；商家、驿站审核；扩展看板指标（各模块订单数与金额、活动报名、闲置成交、券核销、积分发放、广告曝光点击、打款状态）；所有导出功能统一到"数据导出"页。

**验收**：管理员能在后台完成所有扩展模块的配置和审核，不需要进云开发控制台。

## T32 扩展合规走查

- 按 SPEC_EXT 逐条核对：UGC 内容安全全覆盖、广告标识、境外帮带规则、陪诊与开锁条款、门锁密码与审计、位置只前台、密钥未入库、公益活动收费为 0。
- 扩展 `_shared/views.js` 的字段裁剪测试，覆盖新角色 `merchant`、`station`。

**验收**：核对清单逐项写进 PR 描述，测试通过。

## T33 全量验收

- 打开全部开关，逐条走 SPEC §17 的 15 个场景和 SPEC_EXT E19 的 25 个场景，结果写进 `docs/ACCEPTANCE.md`；再关闭全部扩展开关，回归 SPEC §17。
- 修复发现的问题，每处修改在 PR 里列明原因。

**验收**：40 个场景全部通过。
