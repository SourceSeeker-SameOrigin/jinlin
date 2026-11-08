# 近邻帮 · 第一版产品与技术规格（SPEC）

版本 v1.2 · 2026-11-07（同步用户已确认的跨午夜、事务、投诉退款及 T17–T30 补充规则）

变更基线：原始 `jinlin-spec.zip` 保留。本文同步已确认需求，未确认方案不得作为实现或验收依据。

当前验收约束（2026-11-07，用户选定 A）：开发账号为个人主体，用户暂无企业或个体工商户资质。保留本规格的微信手机号授权及门牌绑定要求；相关资格未满足前，手机号授权和依赖已绑定住户的端到端场景标记为阻塞，不降低验收标准。继续不依赖该资格的开发与测试，不新增开发环境测试身份或绕过手机号校验的路径。具体已验证结果与其他配置依赖见 `ACCEPTANCE.md`。

本文是实现的唯一需求来源。凡标"必须"的，是验收项。

---

## 1. 产品一句话

以小区为单位，物业授权的实名服务员和邻居帮手，为住户提供 15 分钟内上门的小服务。本文件定义核心交易：4 项服务、2 种月卡、支付、分账、状态机、权限与隐私。**第一版同时交付 18 个扩展模块，定义在 `SPEC_EXT.md`，全部受功能开关控制。** 数据结构从第一天就支持多个小区。

### 1.1 第一版范围

| 本文件（核心，默认开启） | SPEC_EXT.md（扩展，默认关闭，按开关打开） |
| --- | --- |
| 4 项服务：代取快递、代扔垃圾、周边代买、帮把手 | 需求广场（悬赏、求助）、出行帮带 |
| 2 种月卡：垃圾月卡、快递月卡 | 闲置交易（信息模式、担保模式）、社区活动 |
| 住户端、服务员端、管理后台（同一个小程序） | 站内聊天、地图定位 |
| 微信支付、退款（经云开发）、人工结算 | 优惠券、环保积分、自动打款 |
| 订阅消息通知 | 助老包、上门喂宠、驿站批量送上门、回收上门、空置房巡检 |
| 楼栋二维码来源追踪、服务员推荐码 | 商家入驻与预约、联合社区、广告位、物业公告 |

独立网页后台不做，管理功能都在小程序的管理后台分包里。

---

## 2. 角色与权限

一个用户可以有多个角色，存在 `users.roles` 数组里。

| 角色 | 代码 | 能做什么 |
| --- | --- | --- |
| 住户 | `resident` | 默认角色。下单、买月卡、确认、评价、投诉 |
| 邻居帮手 | 服务员 `level=1` | 只接"门口任务"（`minLevel=1`）：取快递放门口、收门口垃圾、代买放门口 |
| 认证服务员 | 服务员 `level=2` | 可接全部任务，含需要入户的"帮把手"（`minLevel=2`） |
| 物业 | `property` | 只读：本小区看板、订单列表、投诉、物业分成。不能改价、不能退款 |
| 运营管理员 | `admin` | 全部管理功能，可跨小区 |

服务员身份存在 `providers` 集合，审核通过（`status=approved`）才能值班接单。`level` 由管理员审核时设定。

权限校验统一用 `_shared/auth.js`：

```js
requireRole(user, ['admin'])                   // 不满足抛 E_FORBIDDEN
requireCommunityAccess(user, communityId)       // property 只能访问自己的 communityId
requireApprovedProvider(provider, minLevel)     // 未审核或等级不足抛 E_FORBIDDEN
```

---

## 3. 页面清单

### 3.1 住户端（主包，tabBar：首页 / 订单 / 我的）

| 路径 | 名称 | 要点 |
| --- | --- | --- |
| `pages/index/index` | 首页 | 顶部显示小区名；4 个服务大图标；月卡横幅；首单 1 元横幅（仅未下过付费单的用户）；未绑定门牌时跳 `bind`；底部"不会用？打电话下单"按钮（号码来自 `config.hotline`） |
| `pages/bind/bind` | 选择门牌 | 小区（扫码带入或列表选）→ 楼栋 → 单元 → 门牌号（手输）；手机号授权（`getPhoneNumber`）；隐私协议勾选 |
| `pages/service/express` | 代取快递 | 见 §5.1 |
| `pages/service/trash` | 代扔垃圾 | 见 §5.2；有垃圾月卡时提示"你已有月卡，无需单次下单" |
| `pages/service/buy` | 周边代买 | 见 §5.3 |
| `pages/service/help` | 帮把手 | 见 §5.4 |
| `pages/orders/list` | 订单（tab） | 按状态分组：进行中 / 已完成 / 售后 |
| `pages/orders/detail` | 订单详情 | 状态时间线；服务员姓名（只显示姓 + "师傅"）、工牌照、一键拨号（接单后至完成后 24h 内）；完成照片；确认、评价、投诉按钮 |
| `pages/membership/index` | 月卡 | 可买的月卡、价格、首月价、我的月卡及到期日、垃圾月卡上门时段（早 / 晚）选择 |
| `pages/me/me` | 我的（tab） | 门牌、手机号（打码）、月卡、"成为邻居帮手"入口、客服电话、隐私政策；有对应角色时显示"服务员工作台""管理后台"入口 |
| `pages/legal/privacy` | 隐私政策 | 静态文本，内容见 §12.3 |
| `pages/legal/terms` | 服务协议 | 静态文本，含禁止代买代送清单 |

### 3.2 服务员端（分包 `provider/`）

| 路径 | 名称 | 要点 |
| --- | --- | --- |
| `provider/apply/apply` | 申请 | 真实姓名、手机号授权、身份证号后 4 位、身份证正面照片 1 张、可服务的小区（单选）、申请等级（帮手 / 服务员）、勾选服务规范 |
| `provider/workbench/workbench` | 工作台 | 值班开关（上线 / 下线）；当前小区；今日完成单数、今日收入；进入任务大厅；上线时引导订阅"新任务提醒"（见 §9） |
| `provider/hall/hall` | 任务大厅 | 本小区 `status=paid` 且 `minLevel ≤ 我的等级` 的订单；只显示服务类型、楼栋（不显示单元门牌）、要求时段、预计收入；"接单"按钮；页面可见时每 15 秒刷新 |
| `provider/task/task` | 任务详情 | 接单后显示完整门牌、住户手机号（可拨打）、取件码、代买清单；按钮：开始服务 → 完成（必须拍 1–3 张照片；代买必须拍小票并填实际商品金额）；接单后、开始前可"放弃" |
| `provider/earnings/earnings` | 收入 | 待结算、已结算、明细（按单） |

### 3.3 管理后台（分包 `admin/`）

| 路径 | 名称 | 管理员 | 物业 |
| --- | --- | --- | --- |
| `admin/dashboard/dashboard` | 看板 | 全部小区，可切换 | 仅本小区 |
| `admin/orders/orders` | 订单 | 筛选、未接单告警置顶 | 只读 |
| `admin/order/order` | 订单处理 | 指派服务员、强制取消并退款、处理投诉（全额 / 部分退款、是否服务员责任） | 只读 |
| `admin/providers/providers` | 服务员 | 待审核列表、通过（设等级）/ 拒绝、停用、填保险到期日 | 无 |
| `admin/community/community` | 小区配置 | 价格、值班时段、驿站列表、楼栋、黑名单关键词 | 无 |
| `admin/posters/posters` | 海报码 | 为每栋楼生成小程序码图片并可保存到相册；为服务员生成推荐码 | 无 |
| `admin/settlements/settlements` | 结算 | 生成结算单、标记已付、导出 CSV | 只看物业分成 |

---

## 4. 数据模型（云数据库集合）

所有时间字段存 `Date`（服务端 `db.serverDate()` 或 `new Date()`）。所有金额字段单位为分（整数）。

### 4.1 `users`

```js
{
  _id, openid,                 // openid 唯一
  phone: '13800000000',        // 服务端存全号，返回前端时打码
  roles: ['resident'],
  communityId, buildingId, unit: '1单元', room: '302',
  source: { scene: 'b=K3F9QA', buildingId, referrerProviderId, firstSeenAt },  // 首次触达，只写一次
  firstPaidAt: null,           // 首个付费订单支付时间，决定首单价
  blocked: false,
  createdAt, updatedAt
}
```

### 4.2 `communities`

```js
{
  _id, name: '某某花园', city, district, address,
  status: 'active',                       // active | paused
  propertyName: '某某物业',
  rates: { platform: 0.20, property: 0.05 },   // 服务员 = 1 - platform - property
  dutyWindows: [{ start: '07:00', end: '09:00' }, { start: '14:00', end: '16:00' }, { start: '19:00', end: '21:00' }],
  stations: [{ code: 'S1', name: '南门菜鸟驿站' }],
  prices: {                                // 见 §6
    express: { base: 250, extraParcel: 100, largeSurcharge: 200, maxParcels: 10 },
    trash:   { single: 500 },
    buy:     { serviceFee: 400, goodsCapMax: 20000, goodsCapMin: 1000 },
    help:    { per15min: 1000, maxBlocks: 8 },
    firstOrderPrice: 100,
    membershipTaskPayout: 120              // 垃圾月卡每次上门给服务员的计件费
  },
  cardPlans: [                             // 见 §7
    { code: 'trash_monthly', name: '垃圾月卡', serviceCode: 'trash', price: 4900, firstPeriodPrice: 2500, days: 30 },
    { code: 'express_monthly', name: '快递月卡', serviceCode: 'express', price: 3900, firstPeriodPrice: 1900, days: 30, dailyParcelQuota: 3 }
  ],
  createdAt, updatedAt
}
```

### 4.3 `buildings`

```js
{ _id, communityId, name: '3号楼', units: ['1单元', '2单元'], shortCode: 'K3F9QA', posterFileId: null, createdAt }
```

`shortCode`：6 位大写字母数字，全局唯一，用于二维码 scene。

### 4.4 `providers`

```js
{
  _id, openid, userId,
  realName: '张三', idLast4: '1234', phone,
  communityId,                      // 第一版一个服务员只服务一个小区
  appliedLevel: 1, level: 1,        // 1 = 邻居帮手，2 = 认证服务员
  status: 'pending',                // pending | approved | rejected | suspended
  kycFileIds: [],                   // 审核完成后清空并删除文件
  insuranceUntil: null,             // 管理员填写；过期后不能上线值班
  onDuty: false, dutySince: null,
  referralCode: 'P7M2XQ',           // 推荐住户用，6 位
  stats: { completed: 0, released: 0, ratingSum: 0, ratingCount: 0 },
  reviewNote: '', createdAt, updatedAt
}
```

### 4.5 `orders`

```js
{
  _id, orderNo: 'JL261109153012' + '4位随机',   // 同时作为微信支付 outTradeNo
  kind: 'service',                  // service | membership_purchase
  serviceCode: 'express',           // express | trash | buy | help；kind=membership_purchase 时为空
  planCode: null,                   // kind=membership_purchase 时为月卡代码
  communityId, buildingId,
  address: { buildingName: '3号楼', unit: '1单元', room: '302' },
  userOpenid, userPhone,
  minLevel: 1,
  detail: {},                       // 按服务不同，见 §5
  note: '',
  slot: { date: '2026-11-09', start: '19:00', end: '21:00' } | null,   // null = 尽快
  pricing: { listPrice, discount, payAmount, goodsCap, goodsActual, freeByMembership: false },
  status: 'pending_pay',            // 见 §8
  source: 'user',                   // user | membership
  membershipId: null,
  providerOpenid: null, providerId: null,
  photos: [],                       // 完成照片 fileID
  rating: null,                     // { score: 1-5, text, at }
  complaint: null,                  // { reason, text, at, resolution: { refundAmount, serviceRefundAmount, goodsRefundAmount, providerLiable, note, at, by } }
  payment: { outTradeNo, transactionId, paidAt } ,
  refunds: [],                      // [{ outRefundNo, amount, serviceAmount, goodsAmount, reason, status: processing|success|failed, at }]
  timeline: [{ status, at, by }],   // by = openid 或 'system'
  alertedAt: null, acceptedAt: null, deliveredAt: null, completedAt: null,
  createdAt, updatedAt
}
```

### 4.6 `memberships`

```js
{
  _id, userOpenid, communityId, planCode, serviceCode,
  slot: 'morning' | 'evening',      // 仅垃圾月卡；morning = dutyWindows 第一个时段，evening = 最后一个时段
  skipDates: [],                    // 'yyyy-mm-dd'，住户选择"今天不用来"的日期
  startAt, endAt,                   // endAt = 购买时间（或续费时原 endAt）+ days
  status: 'active',                 // active | expired | refunded
  purchaseOrderId, createdAt
}
```

### 4.7 `ledger`（账本，订单完成或月卡售出时写入）

```js
{
  _id, refType: 'order' | 'membership_sale',
  refId, communityId, providerId: null,
  amounts: { gross, provider, property, platform, goods },   // 单位：分；platform 可以为负（补贴）
  settled: { provider: false, property: false },
  settlementIds: { provider: null, property: null },
  createdAt
}
```

### 4.8 `settlements`

```js
{ _id, payee: 'provider' | 'property', providerId, communityId, period: { from, to },
  ledgerIds: [], total, status: 'draft' | 'paid', paidAt, note, createdAt }
```

### 4.9 `events`（来源追踪与漏斗）

```js
{ _id, type: 'scan' | 'bind' | 'first_paid', openid, scene, buildingId, communityId, referrerProviderId, at }
```

### 4.10 `config`（单文档 `_id: 'global'`）

```js
{
  _id: 'global',
  hotline: '400-000-0000',
  payMode: 'mock',                  // mock | wechat；云函数还要求环境变量 ALLOW_MOCK_PAY=true 才允许 mock
  templateIds: { newTask: '', accepted: '', delivered: '', unaccepted: '' },
  adminOpenids: [],                 // 接收未接单告警
  blacklist: ['香烟', '卷烟', '烟草', '电子烟', '烟弹', '雪茄', '烟丝', '处方药', '银行卡', '电话卡', '手机卡', 'U盾', '代收现金'],
  autoConfirmHours: 24,
  acceptAlertMinutes: 10,
  payTimeoutMinutes: 15,
  complaintWindowHours: 24,
  phoneVisibleHoursAfterDone: 24,
  referralBonus: 0                  // 推荐奖励（分），0 = 关闭，见 §13
}
```

### 4.11 索引（写在 `database/indexes.md`，由人在控制台创建）

- `users`: `openid` 唯一
- `orders`: `orderNo` 唯一；`communityId + status + createdAt(desc)`；`userOpenid + createdAt(desc)`；`providerOpenid + status`
- `providers`: `openid` 唯一；`communityId + status + onDuty`；`referralCode` 唯一
- `buildings`: `shortCode` 唯一；`communityId`
- `memberships`: `userOpenid + status`；`communityId + planCode + status + endAt`
- `ledger`: `communityId + createdAt`；`providerId + settled.provider`

### 4.12 安全规则（`database/security-rules.json`）

- `communities`、`buildings`：所有人可读，不可写。
- 其余集合：前端不可读不可写（`{"read": false, "write": false}`），全部经云函数访问。

---

## 5. 四项服务

公共字段：`communityId`、`address`（来自用户绑定的门牌，下单页可改，改了同时更新 `users`）、`note`（选填，≤ 100 字）、`slot`（"尽快" 或当天/次日的值班时段）。

用户确认的时间规则：所有时段包含开始、不包含结束；结束早于开始时跨至次日，时段归属开始日期，凌晨需检查前一天尚未结束的跨夜时段；优先返回当前未结束时段，否则返回最近未来时段。开始与结束相同、重复或重叠时段均拒绝。快递月卡额度始终按北京时间自然日统计，不随跨夜班次顺延。

"尽快"仅在当前小区有 ≥ 1 名值班服务员时可选；否则只能选时段，并提示"现在没有服务员值班，最早 X 点上门"。

### 5.1 代取快递 `express`（minLevel 1）

- `detail.stationCode`：从小区驿站列表选
- `detail.pickupCodes`：取件码，多个，每个 ≤ 20 字符，1–10 个
- `detail.largeCount`：其中大件数（单边 > 50cm 或 > 10kg），0 ≤ largeCount ≤ 件数
- `detail.placement`：`door`（放门口，默认）| `hand`（当面交）
- 件数 = `pickupCodes.length`

### 5.2 代扔垃圾 `trash`（minLevel 1）

- `detail.bags`：1–3 袋
- `detail.sorted`：住户确认已按当地要求分好类（必须勾选）
- `placement` 固定为门口

### 5.3 周边代买 `buy`（minLevel 1）

- `detail.shop`：店名或"就近便利店"
- `detail.items`：清单文本 ≤ 200 字
- `detail.goodsCap`：商品预付上限，`goodsCapMin ≤ goodsCap ≤ goodsCapMax`
- 住户支付 = 服务费 + 商品预付上限
- 服务员完成时必须上传小票照片并填 `goodsActual`（≤ goodsCap）；系统自动退还 `goodsCap - goodsActual`
- `items`、`shop`、`note` 必须过黑名单和内容安全（§10）

### 5.4 帮把手 `help`（minLevel 2，需入户）

- `detail.category`：`carry`（搬重物 / 桶装水上楼）| `elder`（陪老人线下办事）| `other`
- `detail.desc`：描述 ≤ 200 字
- `detail.blocks`：预计时长，15 分钟为 1 块，1–8 块
- 第一版按预计时长收费，不做超时加价

---

## 6. 定价与分账

### 6.1 报价（`_shared/pricing.js`）

```
express: listPrice = base + extraParcel × (件数 − 1) + largeSurcharge × largeCount
trash:   listPrice = single
buy:     listPrice = serviceFee；另收 goodsCap（不参与折扣、不参与分账）
help:    listPrice = per15min × blocks
```

折扣规则（按顺序判断，只取一个）：

1. 快递月卡：用户有有效快递月卡，且当天（北京时间）已用件数 + 本单件数 ≤ `dailyParcelQuota` → `payAmount = 0`，`freeByMembership = true`。超出时**整单按原价**（第一版不拆分）。
2. 首单价：仅适用于 `express`、`trash`、`buy`（`help` 不适用，避免长时长订单被 1 元买走）；`users.firstPaidAt` 为空，且本单 `listPrice > firstOrderPrice` → `payAmount = firstOrderPrice`。
3. 否则 `payAmount = listPrice`。

`discount = listPrice − payAmount`。代买订单实际支付 = `payAmount + goodsCap`。

### 6.2 分账（`_shared/split.js`，订单完成时计算）

输入：`listPrice, payAmount, refundAmount, providerLiable, rates, goodsActual, source, membershipTaskPayout`

```
netCollected = payAmount − refundAmount（服务费部分，不含商品款）
provider:
  source=membership（垃圾月卡任务）     → membershipTaskPayout
  providerLiable=true 且全额退款        → 0
  providerLiable=true 且部分退款        → floor(listPrice × providerRate × netCollected / payAmount)
  其他                                  → floor(listPrice × providerRate)      ← 按原价，首单补贴不让服务员吃亏
property = floor(netCollected × rates.property)   ← 按实收
platform = netCollected − provider − property     ← 可为负，代表平台补贴
goods    = goodsActual（代买商品款，全额给服务员报销，不参与分成）
```

`providerRate = 1 − rates.platform − rates.property`，默认 0.75。

实现时把费率换算成整数万分比（`Math.round(rate × 10000)`），统一用 `Math.floor(金额 × 万分比 / 10000)` 计算，避免浮点误差。

投诉退款由管理员分别填写 `serviceRefundAmount`（服务费）与 `goodsRefundAmount`（商品款），合计为 `refundAmount`。传入分账函数的 `refundAmount` 仅为服务费退款；商品报销额为实际商品金额减去投诉退还的商品款。代买完成时已退的预付差额不得再次退款或再次从实际商品报销中扣除。各部分分别不得超过剩余可退金额；非代买订单的商品款退款必须为 0。

### 6.3 必须通过的分账单测样例

| 场景 | 输入 | provider | property | platform |
| --- | --- | --- | --- | --- |
| 普通快递 2 件 | list 350，pay 350 | 262 | 17 | 71 |
| 首单快递 2 件 | list 350，pay 100 | 262 | 5 | −167 |
| 帮把手 2 块 | list 2000，pay 2000 | 1500 | 100 | 400 |
| 月卡快递（免费） | list 250，pay 0 | 187 | 0 | −187 |
| 垃圾月卡任务 | source=membership | 120 | 0 | −120 |
| 投诉全额退、服务员有责 | list 500，pay 500，refund 500，liable | 0 | 0 | 0 |
| 投诉部分退、服务员无责 | list 500，pay 500，refund 200 | 375 | 15 | −90 |

月卡售出时另写一条 `membership_sale` 账本：`property = floor(pay × rates.property)`，`platform = pay − property`，`provider = 0`。

---

## 7. 月卡

- 购买：`membership.buy` 创建 `kind=membership_purchase` 订单并拉起支付。用户在该小区从未买过同一 `planCode` 时，价格为 `firstPeriodPrice`，否则为 `price`。
- 支付成功：若已有同 plan 的有效月卡则顺延 `endAt + days`，否则新建 `startAt = 支付时间`、`endAt = startAt + days`。写 `membership_sale` 账本。
- 垃圾月卡：购买时选 `slot`（morning = 早班值班时段，evening = 晚班值班时段）。定时任务每天为每张有效月卡生成一个 `trash` 订单：
  - 早班在当天 05:30 后生成，晚班在 15:30 后生成；
  - 订单 `_id = 'm_' + membershipId + '_' + yyyymmdd + '_' + slot`，用这个确定性 ID 保证幂等；
  - `status = paid`，`source = membership`，`payAmount = 0`，`slot` 为对应值班时段，`detail.bags = 1`。
- 住户可在月卡页"今天不用来"跳过当天任务：把当天已生成且未接单的任务改为 `cancelled`（无退款）；未生成的写入 `memberships.skipDates`。
- 月卡第一版不支持退款（服务协议写明）；管理员可在后台手动作废并全额或部分退款。

---

## 8. 订单状态机（`_shared/stateMachine.js`）

| 状态 | 中文 | 可转到 | 触发者 |
| --- | --- | --- | --- |
| `pending_quote` | 待报价 | `pending_pay`（商家提交报价）；`closed`（用户取消） | 商家、住户 |
| `pending_pay` | 待支付 | `paid`（支付回调 / mock）；`closed`（超时或用户取消） | 系统、住户 |
| `paid` | 待接单 | `accepted`（服务员接单 / 管理员指派）；`cancelled`（住户取消，全额退款） | 服务员、管理员、住户 |
| `accepted` | 已接单 | `in_service`（服务员开始）；`paid`（服务员放弃）；`cancelled`（管理员取消，全额退款） | 服务员、管理员 |
| `in_service` | 服务中 | `delivered`（服务员完成，带照片）；`cancelled`（管理员） | 服务员、管理员 |
| `delivered` | 待确认 | `completed`（住户确认 / 超时自动）；`disputed`（住户投诉，24h 内） | 住户、系统 |
| `disputed` | 售后处理中 | `completed`（无退款）；`refunded`（有退款，全额或部分） | 管理员 |
| `completed` | 已完成 | `disputed`（仍在投诉时限内） | 住户 |
| `cancelled` / `closed` / `refunded` | 终态 | — | — |

规则：

- `transition(order, to, actor)` 校验合法性；不合法抛 `E_BAD_STATE`。
- 每次转换追加 `timeline`，并用条件更新防并发。两名服务员同时接单，只有一人成功，另一人收到 `E_CONFLICT`，提示"手慢了，单已被接走"。
- 用户确认的事务等效方案：单文档继续使用 `where` 条件更新；涉及支付、用户资格、月卡额度或账本等多文档一致性时，在事务内读取并核对旧状态后用 `doc` 更新，冲突返回 `E_CONFLICT`。状态边不变，事务内不调用外部接口。
- 进入 `completed` 时写账本（§6.2）；`disputed` 期间不写，处理完写。已写账本的订单再被投诉并退款，写一条冲减账本（金额为负的差额）。
- 服务员放弃：`stats.released + 1`；同一订单被同一人放弃后，不再对他显示。
- 进入 `paid` 后 `acceptAlertMinutes` 分钟仍未接单：通知 `config.adminOpenids`，记 `alertedAt`，不重复提醒。
- `pending_pay` 超过 `payTimeoutMinutes`：关单，微信支付侧调用关闭订单。
- `pending_quote` 是报价制商家订单的未付款前置状态；收到报价后才进入 `pending_pay` 并按 §11 创建/发起支付。用户已确认待报价订单不自动过期；只能由商家报价或用户主动取消，不得套用支付超时。
- `delivered` 超过 `autoConfirmHours`：自动 `completed`。

---

## 9. 通知（订阅消息）

微信订阅消息是一次性的：用户每点一次"允许"，只能收到一条。因此：

| 场景 | 接收人 | 何时请求订阅 |
| --- | --- | --- |
| 新任务提醒 `newTask` | 值班服务员 | 每次上线值班、每次接单后，各请求一次（累计额度） |
| 已接单 `accepted` | 住户 | 支付成功后 |
| 待确认 `delivered` | 住户 | 支付成功后（与上一条同一次弹窗请求两个模板） |
| 未接单告警 `unaccepted` | 管理员 | 管理员打开后台看板时 |

- 模板 ID 从 `config.templateIds` 读取，为空时跳过发送，不报错。
- 发送失败（如用户无额度）只记日志，不影响业务。
- 服务员端任务大厅另有 15 秒轮询兜底；工作台显示"剩余提醒次数"（本地累计，仅供参考），低于 3 时提示再点一次订阅。

---

## 10. 内容安全与禁止事项

- `order.create` 对 `note`、`detail.items`、`detail.shop`、`detail.desc` 依次做：
  1. 本地黑名单（`config.blacklist`，包含匹配）→ 命中返回 `E_BLOCKED`，提示"该物品或服务暂不提供（如烟草、处方药、银行卡等）"；
  2. 微信内容安全 `security.msgSecCheck`（v2，scene=2，传 openid）→ `suggest !== 'pass'` 返回 `E_BLOCKED`。
- 服务协议页列出禁止清单：烟草制品（含电子烟）、处方药、违禁品、银行卡 / 电话卡 / 证件代送、现金代收、来源不明包裹。

---

## 11. 支付与退款

### 11.1 支付（云开发微信支付）

- `order.create` / `membership.buy` 生成订单后调用 `cloud.cloudPay.unifiedOrder`：`body`（如"近邻帮-代取快递"）、`outTradeNo = orderNo`、`spbillCreateIp: '127.0.0.1'`、`subMchId = process.env.SUB_MCH_ID`、`totalFee`（分）、`envId = process.env.ENV_ID`、`functionName: 'payCallback'`，返回 `payment` 给前端 `wx.requestPayment`。
- 实付为 0（快递月卡免费单）时不调起支付，直接进入 `paid`。
- `payCallback` 云函数：校验 `returnCode === 'SUCCESS' && resultCode === 'SUCCESS'`，按 `outTradeNo` 找订单，**金额一致且状态为 `pending_pay`** 才转 `paid`；已是 `paid` 直接返回成功（幂等）；返回 `{ errcode: 0, errmsg: '' }`。
- 订单 `kind=membership_purchase` 支付成功后执行 §7 的开卡逻辑。
- 首个付费的服务订单（`kind=service` 且 `payAmount > 0`）支付成功时，写 `users.firstPaidAt` 和 `events(first_paid)`。购买月卡不占用首单资格。
- 前端支付成功后不直接改状态，轮询 `order.detail` 最多 10 秒等待回调。

### 11.2 Mock 支付（开发与体验版用）

- 当 `config.payMode === 'mock'` **且** 云函数环境变量 `ALLOW_MOCK_PAY === 'true'` 时，`order.create` 不调微信支付，返回 `{ mock: true }`；前端弹出"模拟支付"确认框，确认后调用 `order.mockPay`，按与 `payCallback` 相同的逻辑转 `paid`。
- 两个条件缺一不可。正式版上线前必须把环境变量设为 `false`。

### 11.3 退款

- `cloud.cloudPay.refund`：`outTradeNo`、`outRefundNo = orderNo + 'R' + 序号`、`totalFee`（原支付总额）、`refundFee`、`subMchId`、`envId`、`functionName: 'refundCallback'`。
- 触发场景：住户在 `paid` 取消（全额）；管理员取消（全额）；代买完成时退差额；投诉处理（全额或部分）；月卡作废（管理员填金额）。
- `refunds[]` 先写 `processing`，`refundCallback` 改为 `success` / `failed`。失败的在管理后台订单详情标红并可重试。
- Mock 模式下退款直接记为 `success`。
- 投诉处理分别录入服务费退款与商品款退款，前端展示合计，服务端校验分项与总额；已申请但处理中或失败待重试的退款仍占用对应可退额度，重试沿用同一退款号，不新增一笔退款。

---

## 12. 隐私与合规

### 12.1 小程序隐私授权

- 使用 `getPhoneNumber`、`chooseMedia`（拍照）、`saveImageToPhotosAlbum` 前，需用户同意隐私保护指引。实现 `wx.onNeedPrivacyAuthorization` + 自定义弹窗组件 `privacy-popup`（按钮 `open-type="agreePrivacyAuthorization"`）。

### 12.2 信息可见范围

- 任务大厅：只显示楼栋、服务类型、时段、预计收入。
- 接单后：服务员看到完整门牌和住户手机号；订单完成 `phoneVisibleHoursAfterDone` 小时后，手机号恢复打码。
- 住户看到服务员：姓 + "师傅"、工牌照（服务员头像，审核时由管理员上传或服务员自拍）、等级标签。
- 身份证照片：审核完成（通过或拒绝）后立即 `cloud.deleteFile` 并清空 `kycFileIds`，只保留 `idLast4`。
- 所有手机号在返回前端前用 `maskPhone`（`138****0000`），除上述授权场景。

### 12.3 隐私政策页内容要点

收集哪些信息（手机号、门牌、订单内容、服务照片）、用途（履约、联系、售后）、谁能看到、保存期限（订单数据 3 年，身份证照片审核后即删除）、如何注销（联系客服）。

---

## 13. 来源追踪（海报与推荐）

- 楼栋海报码：管理员在 `admin/posters` 为楼栋生成小程序码，`wxacode.getUnlimited({ scene: 'b=' + shortCode, page: 'pages/index/index', checkPath: false })`，图片存云存储，记录 `posterFileId`。
- 服务员推荐码：`scene: 'r=' + referralCode`。
- 前端 `app.js` 的 `onLaunch` / `onShow` 读取 `options.query.scene`（需 `decodeURIComponent`），解析后存本地，并调用 `user.recordScene` 写 `events(scan)`。
- `users.source` 只在首次写入（首次触达归因）。`b=` 扫码后进入绑定页时，自动预选对应小区和楼栋。
- 看板漏斗（按楼栋、按推荐服务员）：扫码人数 → 绑定门牌人数 → 首单付费人数 → 第二单人数。
- 推荐奖励：`config.referralBonus`（分，默认 0 = 关闭）。开启后，被推荐住户首单完成时给推荐服务员记一条奖励账本。

---

## 14. 云函数接口

所有接口：`wx.cloud.callFunction({ name, data: { action, ...params } })`，返回 `{ ok, data }` 或 `{ ok: false, code, message }`。

| 云函数 | action | 角色 | 说明 |
| --- | --- | --- | --- |
| `user` | `login` | 任何人 | 不存在则创建；返回 profile（手机号打码）、roles、provider 摘要、绑定的小区 |
| | `bindPhone` | 任何人 | 入参 `code`，调 `phonenumber.getPhoneNumber` |
| | `setAddress` | 任何人 | `communityId, buildingId, unit, room` |
| | `recordScene` | 任何人 | `scene`；解析 `b=` / `r=` |
| `catalog` | `listCommunities` | 任何人 | `status=active` 的小区 |
| | `getCommunity` | 任何人 | 价格、月卡、楼栋、驿站、值班时段、当前值班人数、下一个值班时段 |
| | `resolveScene` | 任何人 | `b=` → 小区和楼栋 |
| `order` | `quote` | 住户 | 入参同 create；返回 `listPrice, discount, payAmount, goodsCap, reason` |
| | `create` | 住户 | 校验 → 黑名单与内容安全 → 定价 → 建单 → 支付参数或 mock 或免支付 |
| | `mockPay` | 住户 | 见 §11.2 |
| | `listMine` | 住户 | 分页，`status` 分组 |
| | `detail` | 住户 / 接单服务员 / 管理员 / 物业 | 按角色裁剪字段 |
| | `cancel` | 住户 | 仅 `pending_quote`、`pending_pay`、`paid` |
| | `confirm` | 住户 | `delivered → completed` |
| | `rate` | 住户 | 1–5 分 + ≤ 100 字，仅 `completed`，只能评一次 |
| | `complain` | 住户 | `reason`（未上门 / 物品损坏或丢失 / 态度 / 其他）+ 文本，时限内 |
| `provider` | `apply` / `myStatus` | 任何人 | 申请、查看审核状态 |
| | `setDuty` | 服务员 | `on`；上线前检查 `approved`、保险未过期 |
| | `hall` | 服务员 | 任务大厅 |
| | `accept` / `release` / `start` | 服务员 | 状态转换 |
| | `deliver` | 服务员 | `photos`（1–3 个 fileID），代买另需 `receiptPhoto`、`goodsActual` |
| | `myTasks` / `earnings` | 服务员 | |
| `membership` | `plans` / `buy` / `mine` / `skipToday` | 住户 | |
| `admin` | `dashboard` | 管理员 / 物业 | 指标见 §15 |
| | `listOrders` / `assign` / `forceCancel` / `resolveComplaint` / `retryRefund` | 管理员（物业仅 listOrders） | |
| | `listProviders` / `reviewProvider` / `suspendProvider` / `setInsurance` | 管理员 | |
| | `updateCommunity` / `upsertBuilding` / `updateConfig` | 管理员 | 改价立即生效，只影响新订单 |
| | `genPoster` | 管理员 | `buildingId` 或 `providerId` |
| | `settlementPreview` / `settlementCreate` / `settlementMarkPaid` / `exportCsv` | 管理员（物业仅查看本小区物业分成） | 导出 CSV 存云存储，返回临时链接 |
| `timer` | （定时触发，每 5 分钟） | 系统 | 关闭超时未付；未接单告警；自动确认；生成月卡任务；月卡到期置 `expired` |
| `payCallback` | （支付回调） | 系统 | §11.1 |
| `refundCallback` | （退款回调） | 系统 | §11.3 |

各云函数 `config.json` 需声明云调用权限：

- `user`：`phonenumber.getPhoneNumber`
- `order`：`security.msgSecCheck`、`subscribeMessage.send`
- `provider`：`subscribeMessage.send`、`wxacode.getUnlimited`
- `payCallback`：`subscribeMessage.send`（支付成功后的任务/住户通知）
- `admin`：`wxacode.getUnlimited`、`subscribeMessage.send`
- `timer`：`subscribeMessage.send`；触发器 `{"name":"every5min","type":"timer","config":"0 */5 * * * * *"}`

---

## 15. 看板指标

按小区、按日期范围（默认今天）：

- 订单数（按状态）、付费订单数、服务费流水（payAmount 合计）、实际收入（扣退款）
- 下单住户数、新增首单住户数、第二单住户数
- 15 分钟接单率、平均接单时长、未接单告警次数
- 投诉数、投诉率、退款总额
- 有效月卡数（按月卡类型）
- 值班服务员数、各服务员完成单数与平均评分
- 来源漏斗（§13）

---

## 16. 界面要求

- 主色一个（建议深绿 `#1F7A5C`），其余用灰阶；状态色：待处理橙、完成绿、售后红。
- 正文 32rpx 起，按钮高度 ≥ 88rpx，首页服务图标 ≥ 160rpx，适合老人点按。
- 每个表单页底部固定"价格 + 主按钮"栏，价格实时来自 `order.quote`。
- 空状态、加载中、网络错误都要有中文提示和重试按钮。
- 不使用第三方 UI 库；公共组件放 `components/`：`service-tile`、`order-card`、`status-timeline`、`price-bar`、`empty-state`、`privacy-popup`、`phone-mask`。

---

## 17. 端到端验收场景

体验版里逐条走通（mock 支付即可，§17.2 用真实支付再走一遍）：

1. 新用户扫 3 号楼海报码 → 首页自动跳绑定页且已选好小区和 3 号楼 → 填 1 单元 302、授权手机号 → `users.source.scene = 'b=…'`，`events` 有 scan 和 bind。
2. 首单代取快递 2 件（1 件大件）→ 报价 list 550、首单价 100 → 支付 → 值班服务员大厅出现该单（只见楼栋）→ 接单 → 可见门牌和手机号 → 开始 → 拍 2 张照片完成 → 住户确认 → 评 5 星 → 账本 provider = floor(550×0.75) = 412。
3. 代买：服务费 400 + 上限 5000 → 实付 5400 → 服务员填实际 3250 并拍小票 → 自动退 1750 → 账本 goods = 3250。
4. 下单备注含"香烟"→ 被拒，提示禁止清单。
5. 帮把手：level 1 帮手大厅里看不到；level 2 服务员能看到并接单。
6. 两个服务员同时点接单 → 只有一人成功，另一人提示"单已被接走"。
7. 支付后 10 分钟无人接 → 管理员收到告警 → 后台指派给某服务员 → 状态 `accepted`。
8. 住户在 `paid` 状态取消 → 全额退款，状态 `cancelled`。
9. 完成后投诉"物品损坏"→ 管理员部分退款 200、判定服务员无责 → 状态 `refunded`，账本按 §6.3 样例。
   补充代买验收：服务费 400、预付商品 5000、实际商品 3250，先退差额 1750；投诉再退服务费 200、商品款 1000，合计 1200。服务员无责时最终账本 provider=300、property=10、platform=−110、goods=2250；已入账则写差额。分别超退、重复提交与失败重试不得重复退款。
10. `delivered` 超过 24 小时未确认 → 自动完成并写账本。
11. 买垃圾月卡（晚班），首月价 25 元 → 当天 15:30 后自动生成任务（重复触发不重复生成）→ 服务员完成 → 计件 120。
12. 快递月卡用户当天第 1、2、3 件免费；同一天再下 2 件 → 整单原价。
13. 物业账号登录后台：只看到本小区，改价、退款按钮不显示，直接调接口返回 `E_FORBIDDEN`。
14. 生成上周结算单 → 服务员收入页"待结算"变"已结算"；导出 CSV 金额与账本合计一致。
15. 服务员保险过期 → 无法上线值班，提示联系管理员。

### 17.2 真实支付回归

商户号绑定后，用 0.01 元测试价（管理员临时改价）走一遍场景 2、3、8、9，确认微信支付账单与退款到账。


## 18. 2026-11-08 联调修正规格（用户已批准）

本节覆盖对应旧表述；原始压缩包保留不动。实施与验收状态另见 TEST_HANDOFF，不以本节表示云端已部署。

- D01：当前个人主体继续保留真实手机号授权与绑定校验，不新增手填手机号、伪造身份或直接写用户数据的绕过路径。
- D02：云存储保持私有。业务入口鉴权并裁剪返回字段后，只签发该业务记录允许的媒体字段；同时核验文件目录与记录的用户/订单/会话/批次归属，禁止任意 fileID 列表签发。未审内容仍按既有可见性规则处理；证件仅审核中且具有审核权限时签发。无法证明归属的旧图停止签发并提示重新上传，原文件不自动移动、删除。
- 临时链接请求目标有效期为 600 秒，实际平台失效时间须部署后验证；不能把前端定时刷新当作平台过期证明。返回 `_media[fileID]` 的 url/expiresAt/error 元数据；业务对象仍保留 fileID。链接仅驻留内存，不写本地持久缓存。失败时重新调用原业务入口鉴权刷新一次，之后显示手动重试；权限撤销不回退使用旧链接。
- D33：服务草稿只保存已知非敏感字段；门锁密码与包含密码的请求签名不持久化。恢复旧喂宠草稿时移除上述敏感字段并重写该草稿，保留其他合法输入，不清除其他本地存储。未结束页面中的重试请求仅保留内存；重进页面需重新输入密码。
- D34：地址切换立即作废旧小区/报价请求并清空有效报价，重新报价前禁止提交。只接纳最新选择对应的响应；隐藏/销毁页面后的响应无效。失败可以重试当前地址，重载优先保留当前有效选择。
- D35：login 与 catalog 公共小区对象统一提供按全局/小区覆盖计算的 `enabledFeatures`；兼容字段 `features` 与其一致，均为有效布尔开关。不得返回 `locationGeo`，定位仍使用 `location:{lat,lng}`。
- D36：已确认的正文/类别按钮至少 32rpx；回收页提供初始化及报价失败重试，保留类别和备注，忽略过期报价；加载、报价和提交期间阻止重复预约。辅助时间/徽标的字号及实际按钮尺寸由真机验收记录，不据静态编译声称通过。
- D04：按实际可达业务调用声明最小云调用权限。ZIP 内声明不等于云端授权已生效；实际权限与接口调用需分别验证。D05–D07 暂缓，D10 新部署按具体包清单授权。

历史订单兼容补充：2026-11-08 用户批准 D38。通用订单的历史查看、取消/投诉/退款和支付退款回调/补偿按原授权和状态规则继续；关闭扩展后的新支付、接单、履约与新增结算受开关限制。具体映射和验收以 SPEC_EXT E20.2 为准。
