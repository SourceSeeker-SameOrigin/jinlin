# 近邻帮 · 扩展模块规格（SPEC_EXT）

版本 v1.1 · 2026-11-07（同步用户已确认的 T17–T30 补充规则）

本文件是 `SPEC.md` 的补充。核心交易（4 项服务、月卡、支付、分账、状态机、权限、隐私）以 `SPEC.md` 为准；本文件定义第一版同时交付的 18 个扩展模块。**所有扩展模块都必须受功能开关控制**，代码一次写完，上线时按资质和准备情况分批打开。

---

## E0. 公共基础

### E0.1 功能开关

`config.features`（全局默认）与 `communities.features`（单小区覆盖，可选）：

```js
features: {
  board: false,          // E1 需求广场
  idle: false,           // E2 闲置交易（信息模式）
  idleEscrow: false,     // E2 闲置担保交易（平台代收货款）
  events: false,         // E3 社区活动
  chat: false,           // E4 站内聊天
  location: false,       // E5 地图定位
  coupons: false,        // E6 优惠券
  points: false,         // E6 环保积分
  autoPayout: false,     // E7 自动打款
  elder: false,          // E8 助老包（送餐、探访、陪诊）
  pet: false,            // E9 上门喂宠
  stationDelivery: false,// E10 驿站批量送上门
  recycle: false,        // E11 回收上门
  merchants: false,      // E12 商家入驻与预约
  vacantHome: false,     // E13 空置房巡检
  travelCarry: false,    // E14 出行帮带
  federation: false,     // E15 联合社区
  ads: false,            // E16 广告位
  notices: false         // E17 物业公告
}
```

- `_shared/features.js`：`isEnabled(name, config, community)`，小区覆盖优先于全局。
- 开关关闭时：前端不显示入口；对应云函数接口返回 `E_FEATURE_OFF`（"该功能暂未开放"）。
- 依赖关系（打开时自动校验，不满足则管理后台拒绝保存并提示）：`idleEscrow` 依赖 `idle`；`travelCarry` 依赖 `board`；`points` 依赖 `recycle`；`federation` 至少依赖 `board`、`idle`、`events` 之一。
- 管理后台新增"功能开关"页：每个开关旁显示它需要的准备事项（见 `MANUAL_SETUP.md` F 部分）。

### E0.4 用户已确认的补充规则

以下规则由用户在实现前逐项决策确认，覆盖原文未明确的业务细节；功能仍须遵守各模块开关与公共权限规则。

- **T17 优惠券与积分**：推荐券发给推荐人；被推荐人首笔付费订单完成后触发发券。全额退款恢复已使用积分；部分退款按服务费退款金额占服务费实付的比例恢复积分，恢复数量向下取整；按退款单幂等记账，商品款退款不参与该比例。
- **T19 悬赏时间**：发布人必须选择日期及小区值班时段；订单服务时段必须与所选值班时段匹配。不可选“尽快”，不可跨社区发布。
- **T21 活动取消**：取消后的退款使用异步分批任务；任务可重试，管理端展示处理进度。
- **T22 广告收入**：仅在管理员确认已收款后写入收入账本；创建广告或设为上线均不记收入。
- **T23 地理数据**：保留 `location:{lat,lng}` API/业务字段，新增 `locationGeo: GeoPoint` 并建立地理索引；客户端/API 对外仍使用 `{lat,lng}`。
- **T24 助老服务**：陪诊预约须落在小区值班时段，2 小时服务不得超出该时段；探访每次服务员报酬由小区配置；送餐预付餐费上限由小区配置；探访报告使用逐项勾选、补充文字及“需关注”开关；政府补贴导出仅含业务字段，不含门牌与手机号。
- **T26 商家报价制**：订单状态先进入 `pending_quote`，商家报价后进入 `pending_pay`；待报价订单不自动过期，只能商家报价或用户主动取消。开锁服务不保存身份证照片；仅记录核验结果，并保留非身份证类服务/门锁证据。
- **T27 回收**：重量精度为 0.1 kg。每小区配置分类积分与回收企业收购价；服务员报酬默认每单 300 分、每 kg 20 分，允许小区覆盖；关键配置缺失时不得开放回收。订单由同小区服务员大厅先到先接；每小区按类别指定回收企业，按企业月度汇总对账。
- **T28 空置房巡检**：巡检任务须落入小区值班时段；月卡有效期为购买日起 30 天，任务仍按每月 1 日、15 日生成；报告沿用 T24 探访报告格式（逐项勾选、补充文字、“需关注”开关）。
- **T29 驿站送货**：仅将 `doorDelivery=true` 的住户纳入批次，驿站不能覆盖住户同意状态。每户配送前重新读取当前同意状态；如已撤回，则跳过该户并记明原因，继续处理其他住户。
- **T30 自动打款**：使用微信支付新版“商家转账”API 与对应状态机；小程序发起仍使用 `wx.requestMerchantTransfer`。不得按旧版“商家转账到零钱”实现。

### E0.2 多地址

住户可为家人下单（如子女为独居父母预约探访、陪诊）。`users.addresses`：

```js
addresses: [{ id, communityId, buildingId, unit, room, contactName, contactPhone, isDefault }]   // 最多 5 个
```

下单时选地址；原 `users.communityId/buildingId/unit/room` 保留为默认地址的冗余字段。订单 `address` 增加 `contactName`、`contactPhone`。服务员看到的联系电话是地址上的联系人电话。

### E0.3 通用排期引擎

把 SPEC §7 的垃圾月卡生成逻辑抽象为 `_shared/schedule.js`，供垃圾月卡、独居探访、空置房巡检共用：

```js
cardPlans[i].schedule = { type: 'daily' }                                   // 垃圾月卡
                      | { type: 'weekly', weekdays: [1, 4] }                 // 每周一、四
                      | { type: 'monthly', days: [1, 15] }                   // 每月 1 日、15 日
memberships.slot: 'morning' | 'afternoon' | 'evening'                        // 对应 dutyWindows 第 1、2、3 个
```

`timer` 生成任务时调用 `dueTasks(membership, plan, today)`，确定性 `_id` 不变（SPEC §7）。单测覆盖跨月、闰年 2 月、`skipDates`。

### E0.4 新角色

| 角色 | 代码 | 用途 |
| --- | --- | --- |
| 商家 | `merchant` | E12 商家员工，绑定 `merchantId` |
| 驿站 | `station` | E10 驿站员工，绑定 `communityId + stationCode` |

角色由管理员在审核商家、驿站后授予。

### E0.5 证书

`providers.certs: ['escort', 'pet']`。管理员核验陪诊培训证书、宠物照护经验后勾选。服务的 `requiredCert` 不在服务员 `certs` 里时，任务大厅不显示。

### E0.6 内容安全（UGC 通用）

所有用户生成内容（帖子、评论、闲置、活动、聊天、商家服务描述）：

- 文本：本地黑名单 → `security.msgSecCheck`（v2，帖子与评论 scene=3，聊天 scene=4，其余 scene=1）。
- 图片：上传后调用 `security.mediaCheckAsync`，结果回调前图片对他人不可见（只作者可见），回调 `risky` 则删除并通知作者。需要在 `user` 云函数之外新建 `mediaCallback` 云函数，并在公众平台配置消息推送到云函数。
- 举报：任何 UGC 详情页都有"举报"，写 `reports` 集合，进入管理后台审核队列；同一内容被 3 个不同用户举报自动隐藏，等待审核。
- 管理员可隐藏内容、禁言用户（`users.mutedUntil`）、封禁用户（`users.blocked`）。

```js
reports: { _id, targetType: 'post'|'comment'|'idle'|'event'|'message'|'merchant', targetId, reporterOpenid, reason, text, status: 'pending'|'upheld'|'dismissed', handledBy, handledAt, createdAt }
```

---

## E1. 需求广场 `board`

邻里之间发需求、接需求。分包 `board/`。

```js
posts: {
  _id, type: 'task' | 'ask' | 'carry',
  communityId, scope: 'community' | 'federation',
  authorOpenid, title, content, images: [],
  // type=task；reward 使用分，slot 属于小区值班时段
  reward, needEnterHome: false, orderId, slot: { date, start, end },
  // type=carry（见 E14）
  carry: { direction: 'offer' | 'request', destination, destinationType: 'domestic' | 'overseas', departAt, returnAt },
  status: 'open' | 'taken' | 'done' | 'closed' | 'hidden',
  commentsCount, expireAt, createdAt, updatedAt
}
comments: { _id, postId, authorOpenid, content, status: 'ok' | 'hidden', createdAt }
```

- **悬赏任务 `task`**：发布人必须选择未来日期及本小区已配置的值班时段（包含开始、不包含结束；跨午夜时段归开始日期），不支持“尽快”或联合社区。发布时悬赏金至少 300 分；帖子和订单 `serviceCode='custom'` 在同一数据库事务中创建，`listPrice = payAmount = reward`，`minLevel = needEnterHome ? 2 : 1`，订单 `slot` 保存所选时段，并走 SPEC 的完整订单状态机、分账、投诉。订单未支付时，任务仅发布人可见；支付成功后才出现在公共列表。帖子状态按关联订单派生：已支付未接单为 `open`，已接单/服务中/待确认/售后中为 `taken`，完成为 `done`，取消/关闭/退款为 `closed`。服务时段结束后不可接单，帖子到所选时段结束时过期。只有审核通过的服务员（含邻居帮手）能接。
- **求助 `ask`**：不涉及钱，只能评论；可选 `federation` 范围。
- **帮带 `carry`**：见 E14。
- 列表：按类型分 tab；可切换"本小区 / 联合社区"（`federation` 开启时；悬赏固定本小区）；按时间倒序；7 天后 `ask` 和 `carry` 自动 `closed`。
- 地址保护：帖子只显示楼栋；悬赏任务接单后服务员才看到门牌。
- 云函数 `board`：`list`、`detail`、`create`、`comment`、`close`、`report`；悬赏的支付与接单复用 `order` 和 `provider`。
- 小程序码分享：帖子详情页支持转发给微信好友（`onShareAppMessage`），落地页仍需登录。

## E2. 闲置交易 `idle` / `idleEscrow`

分包 `idle/`。

```js
idleItems: {
  _id, communityId, scope: 'community' | 'federation',
  sellerOpenid, title, desc, images: [], category, condition: 'new' | 'like_new' | 'used',
  price, negotiable: true, tradeMode: 'offline' | 'escrow',
  status: 'on_sale' | 'reserved' | 'sold' | 'removed' | 'hidden',
  createdAt, updatedAt
}
```

- **信息模式（默认）**：买家点"我想要"→ 打开与卖家的聊天（E4，需 `chat` 开启；未开启时显示卖家打码手机号并提供一键拨号）。线下交易，卖家标记"已售"。平台不经手货款。
- **帮搬**：买家或卖家可一键下"帮把手"订单，地址预填。
- **担保模式（`idleEscrow`）**：仅本小区商品可选 `tradeMode='escrow'`。买家创建待支付订单时商品锁定为 `reserved`，同一商品不能创建第二笔担保订单；支付超时或未付款取消后释放锁定。买家支付货款 → 订单 `kind='idle_purchase'` → 卖家接单并上传 1–3 张交付凭证 → 买家确认（或交付 72 小时自动确认）。订单完成后商品标记 `sold`，账本 `refType='idle_sale'`，平台佣金按 `Math.round(商品金额分 × config.idleCommissionRate)` 四舍五入到分（默认 0），卖家净额为成交金额减佣金。卖家收入按 T30 的 `autoPayout` 开关结算：开启时卖家可申请新版商家转账，关闭时管理员人工结算。退款成功后，若商品记录仍属于原卖家且仍关联该订单，则自动恢复上架。
- 担保订单纠纷走 SPEC §8 的投诉流程；退款成功后检查商品所有权和关联订单再恢复，避免误上架已转手商品。
- 禁售：`config.idleBlacklist`（默认：烟草、酒类、药品、医疗器械、活体动物、管制刀具、自制食品、贴身衣物、虚拟账号）+ 通用黑名单。
- 云函数 `idle`：`list`、`detail`、`create`、`update`、`markSold`、`remove`、`report`、`buy`（担保）、`confirm`（担保）。

## E3. 社区活动 `events`

分包 `events/`。区分公益活动和兴趣活动（见分析文档）。

```js
events: {
  _id, communityIds: [], scope: 'community' | 'federation',
  organizerType: 'platform' | 'property' | 'merchant', organizerId,
  type: 'charity' | 'interest',
  title, desc, images: [], location, startAt, endAt, signupDeadline,
  capacity, fee,                 // 分；type=charity 时强制 0
  sponsors: [{ name, merchantId, amount, note }],
  status: 'draft' | 'published' | 'ended' | 'cancelled',
  createdAt, updatedAt
}
signups: { _id, eventId, openid, people: 1, orderId, status: 'pending_pay'|'signed'|'cancelled'|'checked_in'|'refunded', checkinCode, createdAt }
eventCancelJobs: { _id, eventId, status: 'queued'|'processing'|'completed'|'attention', scanCursor, scanComplete, totalCount, completedCount, failedCount, retryCount, leaseUntil, createdAt, updatedAt }
eventCancelTasks: { _id, jobId, signupId, orderId, status: 'pending'|'processing'|'waiting'|'retry'|'completed'|'failed', attempts, nextAt, leaseUntil, lastErrorCode, updatedAt }
```

- 公益活动：住户免费报名；组织费来自赞助（`sponsors`），由管理员录入，写账本 `refType='sponsorship'`。
- 兴趣活动：报名即支付（复用支付），订单 `kind='event_signup'`；截止前可取消全额退款，截止后不可退；活动取消全额退款。取消后的退款由每 5 分钟 timer 按游标分页创建、分批处理，单项使用稳定退款键保证幂等；失败任务退避重试，超时租约任务可恢复，管理员可重试终止失败项。管理端显示总数、成功数、失败数和待重试数。账本 `refType='event'`，物业分成按 `rates.property`。
- 签到：报名成功生成签到码（`checkinCode` 的小程序码或二维码图片），组织者在活动管理页用 `wx.scanCode` 扫码签到。
- 组织者：管理员可发布任何活动；物业可为本小区发布活动（需管理员审核后发布）；商家可发布兴趣活动（需审核）。
- 订阅消息：活动开始前 2 小时提醒（新模板 `eventReminder`，报名时请求订阅）。
- 云函数 `event`：`list`、`detail`、`create`、`update`、`publish`、`signup`、`cancelSignup`、`checkin`、`cancelEvent`、`listSignups`。

## E4. 站内聊天 `chat`

分包 `chat/`。

```js
conversations: { _id, type: 'order' | 'idle' | 'board', refId, members: [openidA, openidB], lastMessage, lastAt, unread: { [openid]: 0 }, closedAt }
messages: { _id, convId, from, type: 'text' | 'image', content, fileId, status: 'ok' | 'pending' | 'blocked', createdAt }
```

- 订单聊天：接单后住户与服务员之间自动建立；订单完成 `phoneVisibleHoursAfterDone` 小时后只读关闭。
- 闲置聊天：买家点"我想要"建立；悬赏任务：接单后建立。
- 实时性：聊天页可见时每 3 秒调 `chat.pull(convId, afterId)`；"我的"页和订单页显示未读数（进入页面时刷新）。
- 文本过内容安全；图片走异步审核（审核通过前对方看到"图片审核中"）。
- 隐私提示：消息含 11 位数字或"微信号"字样时，发送前提示"为保护隐私，建议不要发送手机号或微信号"，用户可继续发送。
- 每条消息 ≤ 500 字；同一用户 1 秒内最多 1 条。
- 管理员只能在处理该订单的投诉或举报时查看对应会话，每次查看写审计日志 `auditLogs`。
- 云函数 `chat`：`open`、`pull`、`send`、`list`、`markRead`。

## E5. 地图定位 `location`

- `communities.location: { lat, lng }`，管理员在小区配置页用 `wx.chooseLocation` 设定。
- 为地图查询另存 `communities.locationGeo: GeoPoint`（经度、纬度顺序），建立地理索引；`location` 保持 `{lat,lng}` 业务/API 结构。
- 绑定页：用户授权后 `wx.getLocation` → 列出 3 公里内的合作小区，按距离排序（`_shared/geo.js` 用 haversine 公式，单测覆盖）。拒绝授权时退回到列表选择。
- 服务员位置共享：订单为 `accepted` 或 `in_service`、且服务员停留在任务详情页时，每 30 秒 `wx.getLocation` 上报到 `providers.lastLocation = { lat, lng, at, orderId }`。**只用前台定位，不申请后台持续定位。**
- 住户订单详情：用 `<map>` 显示服务员最近位置标记和"X 分钟前"；订单离开上述两个状态后不再返回位置。
- `app.json` 声明 `requiredPrivateInfos: ['getLocation', 'chooseLocation']`；隐私弹窗与隐私政策补充位置用途。
- `database/indexes.md` 记录 `locationGeo` 地理索引。

## E6. 优惠券与环保积分 `coupons` / `points`

```js
couponTemplates: {
  _id, name, kind: 'amount_off' | 'percent_off' | 'free',
  value,                         // amount_off: 分；percent_off: 1–99（折扣百分比）；free: 忽略
  maxOff,                        // percent_off/free 的封顶（分）
  threshold,                     // listPrice 门槛（分）
  services: ['express', 'trash'] | 'all',
  validDays, totalLimit, perUserLimit, issued,
  issueMode: 'claim' | 'auto_new_user' | 'referral' | 'event' | 'manual',
  communityIds: [] | 'all', status: 'active' | 'paused', createdAt
}
coupons: { _id, templateId, openid, status: 'unused' | 'locked' | 'used' | 'expired', validFrom, validTo, orderId, createdAt }
pointsLedger: { _id, openid, delta, reason: 'recycle' | 'redeem' | 'refund' | 'admin', refId, balanceAfter, createdAt }
```

定价顺序（扩展 SPEC §6.1，`_shared/pricing.js` 同步扩展并补单测）：

1. 月卡免费（不变）。
2. 首单价与优惠券**不叠加**，系统自动选择对用户更优的一项；用户也可手动选券。
3. 积分抵扣：100 积分 = 1 元，最多抵扣服务费的 50%，在第 2 步之后计算。
4. `payAmount` 最低 1 分（为 0 时走免支付）。

券的生命周期：创建订单时 `locked` → 支付成功 `used` → 订单关闭或支付前取消 `unused`；已支付订单全额退款时，若券仍在有效期内退回 `unused`。分账规则不变：服务员按 `listPrice`，物业按实收。

- `issueMode='referral'` 的券发给推荐人；被推荐人首笔付费订单完成时发放，不能仅凭注册、下单或支付成功提前发券。
- 退款积分恢复按服务费部分计算：全额服务费退款恢复该订单全部已抵扣积分；部分服务费退款按“服务费退款金额 / 服务费实付金额”比例计算并向下取整；每个退款编号只能恢复一次积分，商品款退款不恢复积分。

页面：`coupons/center`（领券中心）、`coupons/mine`；各下单页价格栏增加"优惠券 / 积分"选择。管理后台：券模板管理、按手机号或用户列表手动发券。

## E7. 自动打款 `autoPayout`

用微信支付新版“商家转账”给服务员和担保交易的卖家打款。后端使用新版商家转账 API 与状态查询/回调规则，小程序侧使用 `wx.requestMerchantTransfer`；不得实现已暂停新增接入的旧版“商家转账到零钱”。

- 前置：商户号开通**新版商家转账**、充值转账余额、在商户平台配置佣金报酬场景（场景 ID 通常为 `1005`，以商户实际开通项为准）。旧版“商家转账到零钱”已停止新增接入；接口采用新版用户确认模式，前端仍调用 `wx.requestMerchantTransfer`。
- 新建云函数 `payout`，调用新版 APIv3 `POST /v3/fund-app/mch-transfer/transfer-bills` 和 `GET /v3/fund-app/mch-transfer/transfer-bills/out-bill-no/{out_bill_no}`；云开发 `cloudPay` 不覆盖此接口。环境变量：`MCH_ID`、`MCH_SERIAL_NO`、`MCH_PRIVATE_KEY_B64`、`WXPAY_PUBLIC_KEY_B64`、`WXPAY_PUBLIC_KEY_ID`、`MINI_APP_ID`、`TRANSFER_SCENE_ID`、`TRANSFER_JOB_TYPE`、`TRANSFER_REPORT_DESCRIPTION`。**任何密钥不得写进代码或数据库。**不配置回调地址，以定时查单兜底。
- 提现流程：服务员或卖家在收入页点“提现”→ `payout.create` 汇总已超过 `complaintWindowHours` 且未结算、未锁定的对应账本余额→ 同一事务锁账本并创建提现记录→ 请求新版发起转账接口→ 前端 `wx.requestMerchantTransfer` 拉起微信确认收款页。前端调起成功只表示页面已展示，不代表到账；须通过查单的终态确认。
- 服务员规则：单次 10–2000 元、每人每天 1 次；金额达到 2000 元时按微信要求加密发送服务员真实姓名。担保交易卖家未有已核验的收款真实姓名，单笔自动打款上限为 1999.99 元；超出部分留在未结算余额中，可后续分笔申请。人工结算可由管理员按实际对账金额处理。
- 账本已有人工结算单或提现锁定时不得重复申请；转账中的账本锁定。成功后只结算本批锁定账目，失败/取消才解锁。
- 状态：`payouts: { _id, payeeType: 'provider'|'seller', providerId, sellerOpenid, payeeOpenid, ledgerIds, ledgerAmounts, amount, outBillNo, state: 'created'|'wait_user_confirm'|'processing'|'success'|'failed'|'cancelled', wxState, transferBillNo, requestBody, packageInfo, failReason, createdAt, updatedAt }`。卖家可拆分单条账本多次支付，成功一笔只累计对应 `ledgerAmounts`，累计全部收清后才标记账本已结算。`timer` 每 5 分钟查询未终结转账；只有微信终态 `SUCCESS` 结算本批金额，`FAIL`/`CANCELLED` 解锁。用户超过 24 小时未确认时继续查单，未确认终态前不解锁。
- 开关关闭时继续使用 SPEC §11 的人工结算。物业分成、商家货款始终走人工结算（B2B 对公转账）。

## E8. 助老包 `elder`

三项新服务，均 `minLevel = 2`，页面放分包 `elder/`。

| 服务 | 代码 | 要点 |
| --- | --- | --- |
| 送餐上门 | `meal` | 从小区配置的合作食堂（`communities.canteens: [{ code, name, merchantId }]`）取餐送到门口。流程复用 SPEC §5.3 代买：餐费按小区配置的 `prices.meal.goodsCapMax` 预付上限付，服务员拍小票填实际金额，自动退差。默认服务费 300 分。 |
| 独居探访 | `visit` | 按月订阅（E0.3 排期引擎，`schedule.weekly`），默认每周 2 次。每次服务员报酬必须按小区配置 `prices.visit.taskPayout`。探访地址按周期快照保存：当前周期地址不因用户改地址或续卡而变化，续卡选择的新地址从后续周期起生效。服务员逐项完成精神状态、饮食、用电用气安全、门窗、是否需要就医五项检查，补充文字并设置“需关注”；关注项须先由服务员电话通知下单人，再提交报告。住户可在每条任务订单详情单独授权一次 `visitReport` 通知；授权后仅对应本次报告发送订阅消息，未授权仍可在订单详情查看报告，后台标记关注项。月价默认 19900 分（每周 2 次）。 |
| 陪诊 | `escort` | `requiredCert='escort'`。字段：医院、科室、日期、开始时间、时长（2 小时为一档、1–4 档）、是否需要接送。仅可预约未来 30 天内的日期，开始时间和完整服务时长必须落在小区某个值班时段内。按档计价，默认 16800 分/2 小时。规则写进服务协议：**陪诊师不得代替患者问诊或转述病情、不得代为签署医疗文书**；只做挂号取号、陪同、缴费取药、记录医嘱。 |

探访任务保存当前周期的地址快照；用户修改地址只从续期周期生效，不改写当前周期已排任务。探访报告逐项勾选检查事项，可补充文字并设置“需关注”；报告通知下单人，关注项在管理后台标红。

政府养老补贴（如助餐补贴、失能老人消费补贴）第一版不在线核销；管理员可按日期导出业务订单字段（订单号、小区、服务类型、状态、时间、金额与退款合计），不得导出门牌、姓名、手机号、用户标识、备注或服务照片。

## E9. 上门喂宠 `pet`

分包 `pet/`。`minLevel = 2`，可选 `requiredCert='pet'`（小区配置决定）。

```js
detail: {
  dates: ['2026-12-31', '2027-01-01'],   // 1–15 天
  visitsPerDay: 1 | 2,
  pets: [{ kind: 'cat' | 'dog' | 'other', count, note }],
  tasks: ['feed', 'water', 'litter', 'walk', 'play'],   // walk 仅狗，30 分钟
  entry: 'password' | 'key_handover' | 'property_keybox'
}
```

- 定价：`pet.perVisitCat`（默认 4000）、`pet.perVisitDog`（默认 5000，含遛狗）；`holidayDates` 内每次上门加价 `holidaySurcharge`（默认 50%）。`listPrice = Σ 每次上门价`。
- 父订单支付一次；接单的服务员负责全部上门。系统生成子任务 `visits: { _id, parentOrderId, date, seq, status: 'pending'|'done'|'missed', photos, videoFileId, doneAt }`。
- 每次上门必须上传至少 1 段视频或 2 张照片；住户在订单详情逐次查看。
- 门锁密码：住户填写后用 AES-256-GCM 加密存 `secrets` 集合（密钥在环境变量 `SECRET_KEY`），只有接单服务员在服务日期内、通过 `pet.revealEntry` 才能查看，每次查看记审计日志；订单完成或取消后立即删除密文。
- 全部上门完成后父订单进入 `delivered`；有 `missed` 的上门按次自动部分退款。

## E10. 驿站批量送上门 `stationDelivery`

分包 `station/`，角色 `station`。

- 住户可在"我的"设置"快递默认送上门"（`users.prefs.doorDelivery=true`），只有明确同意的住户可加入批次；驿站无权覆盖住户设置。
- 驿站员工创建批次：录入或粘贴门牌列表（楼栋-单元-门牌，每行一条），系统校验门牌存在。仅将明确开启 `users.prefs.doorDelivery=true` 的住户加入批次；未授权、无住户关联或已撤回授权的门牌只计入跳过数量，不保留其标识。
- 批次仅为同意住户保存关联和地址快照；服务员处理每户前及提交配送结果时重新核验当前授权。住户撤回授权时将该户记为 `skipped` 并记原因，不上传照片、不计费，其他住户仍可继续配送。
- 批次 `deliveryBatches: { _id, communityId, stationCode, items: [{ _id, userId, buildingId, buildingName, unit, room, consented: true, status: 'pending'|'delivered'|'failed'|'skipped', failReason, photoFileId, at }], providerId, status: 'open'|'assigned'|'done', priceSnapshot, createdAt }` 发布到任务大厅，作为一个整单由一名服务员接。
- 计费：每件 `stationDelivery.perPiece`（默认 50 分）向驿站收，服务员每件 `perPiecePayout`（默认 40 分）。账本 `refType='station_delivery'`。驿站按月对公结算（人工）。
- 管理后台：驿站账号审核、驿站月度对账单导出。

## E11. 回收上门 `recycle`

- 住户预约上门回收可回收物（纸、塑料、金属、衣物、小家电）。服务员上门称重，重量按 0.1 kg 精度录入；逐类填写重量，系统按小区配置的分类积分单价计算积分并写入 `pointsLedger`。
- 第一版回收不付现金给住户，只发环保积分；积分在下单时抵扣（E6）。
- 每小区按回收类别配置积分单价、企业收购价和指定回收企业。只有类别配置齐全才可开启回收；订单由同小区服务员大厅先到先接。回收企业按企业维度月度对账。服务员报酬默认每单 300 分 + 每公斤 20 分，小区可覆盖默认值。积分按“重量 kg × 积分单价”向下取整；企业收购金额按重量乘单价后四舍五入到分。
- 大件和装修垃圾清运：不自营，走 E12 商家预约（`category='haul'`）。
- 回收企业须是已备案的正规回收企业，管理员审核营业执照。

## E12. 商家入驻与预约 `merchants`

撮合周边商家：家政、维修、洗衣、开锁、清运、食堂、回收企业。分包 `merchant/`（商家端）与 `shops/`（住户端）。

```js
merchants: {
  _id, name, category: 'housekeeping' | 'repair' | 'laundry' | 'locksmith' | 'haul' | 'canteen' | 'recycler' | 'other',
  licenseFileId, licenseInfo: { name, creditCode },  // 营业执照信息，详情页公示
  contactName, phone, staffOpenids: [], communityIds: [],
  commissionRate: 0.10, status: 'pending' | 'approved' | 'suspended',
  ratingSum, ratingCount, createdAt
}
merchantServices: { _id, merchantId, title, desc, images, priceType: 'fixed' | 'quote', price, unit, status: 'on' | 'off' }
```

- 入驻：商家在小程序提交资料 → 管理员审核营业执照 → 授予 `merchant` 角色。商家详情页公示营业执照名称和统一社会信用代码。
- 预约订单 `kind='merchant'`：
  - 固定价：住户下单即支付；
  - 报价制：住户提交需求 → 订单 `pending_quote` → 商家报价后转为 `pending_pay` → 住户支付；
  - 商家接单 → 商家标记完成并拍照 → 住户确认（或 24 小时自动）→ 账本 `refType='merchant_order'`，商家收入 = 实收 − 佣金；物业分成从平台佣金中按 `rates.property` 计提。
- 商家货款人工结算（每周对公）。
- 开锁类商家：订单必须由下单人当面核验身份证与门牌一致，写进服务协议；平台不保存身份证照片，仅保存核验结果，并保留非身份证类的门锁/服务过程证据。
- 云函数 `merchant`：入驻、审核（admin）、服务管理、预约、报价、接单、完成、评价。

## E13. 空置房巡检 `vacantHome`

- 月卡自购买日起有效 30 天；有效期内每月 1 日、15 日按小区值班时段生成任务。默认月价 9900 分。
- 每次服务员计件报酬由小区配置 `prices.vacantHome.perVisitPayout`（人民币分）；生成任务时固化到订单，调整配置不追溯已生成订单。
- 清单：门窗、水电燃气、漏水与霉斑、开窗通风 30 分钟、代收快递信件、巡检拍照；服务员逐项勾选，每项至少上传 1 张照片，可补充文字并标记需关注。报告保存在订单详情。
- 报告通知按每个任务逐次订阅；未授权时仍可在订单详情查看报告。
- 钥匙：`entry` 同 E9（密码加密 / 交接钥匙 / 物业钥匙柜）；仅已接单二级服务员在巡检当天可读门锁密码，读取写审计事件且不存明文。月卡过期后删除密码密文。
- 巡检日期和执行时段必须匹配小区值班时段；`minLevel = 2`。

## E14. 出行帮带 `travelCarry`

在需求广场（E1）内以 `type='carry'` 实现。

- 国内（`destinationType='domestic'`）：可发"我能帮带"或"求帮带"；实际帮带需要付费时，转为悬赏任务（E1），走正常订单。
- 境外（`destinationType='overseas'`）：**只允许信息发布，不能附带悬赏或任何付款**；发布前必须勾选声明："仅限个人自用、不加价、按海关规定如实申报；居民旅客境外获取物品免税额度为 5000 元，超出部分需申报纳税。"帖子内显示同样提示。
- 含"代购""加价""收费代带"等词的境外帮带帖直接拦截（`config.carryBlacklist`）。

## E15. 联合社区 `federation`

- `communities.federationGroupId`：同一组的小区组成联合社区（如同一街道或同一物业公司下的小区）。
- `scope='federation'` 的内容对同组所有小区可见。适用：求助帖、帮带帖、闲置、活动。**付费悬赏任务只能是本小区**（需要上门）。
- 列表页提供"本小区 / 联合社区"切换；联合社区内容标注来源小区名。
- 看板增加按联合社区汇总的视图。

## E16. 广告位 `ads`

```js
ads: { _id, slot: 'home_banner' | 'board_top' | 'shops_top', title, imageFileId, target: { type: 'merchant' | 'event' | 'page', id, path }, communityIds, startAt, endAt, price, advertiser, status: 'draft' | 'live' | 'ended', paymentReceivedAt, revenueLedgerId }
```

- 只能由管理员创建；首页轮播最多 3 条。
- 每条广告右上角固定显示"广告"标识。
- 链接只能跳到小程序内页面（商家页、活动页）。
- 广告收入由管理员确认已收到广告款后，才将收入录入账本 `refType='ad'`；创建广告和设为上线均不记收入。每条广告仅记一笔平台收入，账本 `communityId=null` 并保存 `communityIds` 投放范围；以广告 ID 作为幂等账本 ID。确认收款后广告金额不可修改。
- 广告位曝光与点击计数写 `events`（`ad_view`、`ad_click`），看板显示。

## E17. 物业公告 `notices`

- 物业角色为本小区发布公告：标题、正文、图片、是否置顶、有效期。
- 首页显示最新 1 条置顶公告，"公告"列表页显示全部。
- 公告内容同样过内容安全。

---

## E18. 新增云函数与集合汇总

| 云函数 | 主要职责 |
| --- | --- |
| `board` | E1、E14 |
| `idle` | E2 |
| `event` | E3 |
| `chat` | E4 |
| `coupon` | E6 券与积分 |
| `payout` | E7 |
| `merchant` | E12、E11 回收企业 |
| `station` | E10 |
| `content` | E16 广告、E17 公告、E0.6 举报审核 |
| `mediaCallback` | E0.6 图片异步审核结果 |

`elder`、`pet`、`recycle`、`vacant` 的下单与履约并入现有 `order`、`provider`、`membership` 云函数，按 `serviceCode` 分支，各自的校验与定价放进 `_shared/services/<code>.js`。

新增集合：`posts`、`comments`、`reports`、`idleItems`、`events`、`signups`、`conversations`、`messages`、`couponTemplates`、`coupons`、`pointsLedger`、`payouts`、`merchants`、`merchantServices`、`deliveryBatches`、`visits`、`secrets`、`ads`、`notices`、`auditLogs`。安全规则一律前端不可读写。

分包：`board/`、`idle/`、`events/`、`chat/`、`coupons/`、`elder/`、`pet/`、`shops/`、`merchant/`、`station/`。主包只放 SPEC §3.1 列出的页面（首页、绑定、4 项核心服务、订单列表与详情、月卡、我的、隐私政策、服务协议），保证主包小于 2MB。

---

## E19. 扩展验收场景

在 SPEC §17 的 15 个场景之外，逐条走通：

1. 关闭 `board` 时首页没有"需求广场"入口；直接调用 `board.list` 返回 `E_FEATURE_OFF`。
2. 发 5 元悬赏"帮我把纸箱搬到楼下"→ 支付 → 邻居帮手接单 → 完成 → 账本 provider = 375。
3. 求助帖含违规词被拦截；含违规图片在审核回调后被删除并通知作者；被 3 人举报自动隐藏。
4. 闲置信息模式：买家点"我想要"→ 进入聊天 → 卖家标记已售。担保模式：买家支付 → 卖家交付 → 买家确认 → 卖家账本金额正确。
5. 兴趣活动 30 元报名 → 截止前取消全额退款；截止后取消按钮不可用；签到扫码成功。公益活动费用无法设为非 0。
6. 订单聊天：发送含手机号的消息出现隐私提示；订单完成 24 小时后会话只读。
7. 拒绝定位授权时绑定页退回列表；允许时显示附近小区；服务员在任务详情页时住户地图上能看到位置，订单完成后看不到。
8. 新用户自动发券；首单价与 5 元券同时可用时系统选择更优者；全额退款后券退回。验证推荐券只给推荐人且在被推荐人首笔付费订单完成后触发；积分全额服务费退款恢复全部、部分退款按服务费比例向下取整、商品款退款不恢复，重复退款回调不重复入账。
10. 自动打款：服务员提现 50 元 → 官方确认页 → 成功后账本标记已结算；单次超过 2000 元被拒。
11. 独居探访月卡：子女为父母地址下单（多地址）→ 每周二、五生成任务 → 服务员填写逐项报告、补充文字及“需关注”状态 → 子女收到报告；勾选“需关注”后台标红。修改地址仅影响续期后的新周期；探访服务员报酬按小区配置。政府补贴导出不包含门牌与手机号。送餐预付金额不得超过小区配置上限。
12. 陪诊：没有 `escort` 证书的服务员在大厅看不到。
13. 喂宠 3 天每天 2 次：生成 6 个上门任务；服务员只在服务日期内能查看门锁密码，且查看被记录；1 次 missed 自动退该次费用；完成后密文删除。
14. 驿站粘贴 20 个门牌创建批次；只纳入 `doorDelivery=true` 住户；模拟一户在分拣后撤回同意，服务员配送时该户标记 `skipped` 并记录原因，其余住户继续配送；核对结算件数与金额。
15. 商家入驻 → 审核 → 发布报价制服务 → 住户预约进入 `pending_quote` → 商家报价转为 `pending_pay` → 支付 → 完成 → 商家收入 = 实收 × 90%。开锁订单仅保存身份证核验结果，不保存身份证图片。
16. 空置房月卡购买日起有效 30 天；每月 1 日、15 日排任务；任务时段在值班窗口内；报告推送业主且使用逐项勾选、补充文字及“需关注”开关。
17. 境外帮带帖不能填悬赏，必须勾选声明；含"代购"字样被拦截。
18. 两个小区同一联合社区：A 小区的联合社区闲置在 B 小区可见；A 小区的悬赏任务在 B 小区不可见。
19. 首页广告显示“广告”标识，点击跳到商家页并计数；广告创建与上线不写收入，管理员确认收到款后才产生一笔广告收入账本。
20. 物业发布置顶公告，首页显示。
21. 兴趣活动取消创建异步退款任务；超过单批处理上限仍可续批；模拟若干退款失败后可重试，管理端总数、成功、失败进度准确且任务不会重复退款。
22. 小区附近查询按 `locationGeo` 地理索引工作，业务字段/API 仍返回 `{lat,lng}`；变更坐标后 GeoPoint 同步更新。
23. 回收以 0.1 kg 精度称重；每小区分类积分、企业收购价缺项时不能开启；每单服务员报酬默认 300 分并加每 kg 20 分且允许覆盖；首到先接只显示同小区；按回收企业输出月度对账。
24. 空置房之外的探访与陪诊排期校验值班窗口；陪诊 2 小时档不得越过窗口；地址修改不改变当前周期已生成任务。
25. 新版商家转账完成服务员提现：后端按新版 API 创建/查单和处理结果，小程序按微信官方确认页发起；超限拒绝，重复请求幂等，旧版“商家转账到零钱”接口不调用。
