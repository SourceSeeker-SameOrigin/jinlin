# 全页面 UI 与功能验收册

本册按 app.json 枚举全部69页。目标是逐页视觉符合设计、逐流程功能闭环；当前不是全量通过报告。原40个规格场景、15个关闭回归和4个真实支付场景继续以 [TEST_HANDOFF](../TEST_HANDOFF.md) 为准，不能被本册替代。

## 验收标准与记录规则

|维度|要求|
|---|---|
|What|69页的视觉、入口、权限、成功/失败/恢复流程，以及所有跨页业务闭环|
|Why|静态编译不证明页面观感，空列表不证明订单履约成功|
|Who|代理执行技术与界面验证；用户确认视觉和业务结果；真实角色由授权管理员审核|
|When|新版部署→配置/身份准备→逐页→跨角色闭环→真机→用户确认合并|
|Where|本地开发分支、指定开发云、微信开发工具及用户真机；不在生产测试|
|How|每项记录版本、设备、角色、输入、预期、实际、截图/请求ID、通过/失败/阻塞；用户签收单列|
|How much|工作量随角色/配置齐备程度变化，尚不能确定完成时长；不自动付费|

### 每页都要检查的 UI 项

- U1 对照批准设计稿：色彩、标题、图标、卡片、分组和主次按钮，不能仅换色。
- U2 状态栏/按钮文字横纵居中；单行输入框文字居中、不裁切；多行输入仍按正常顶端排版。
- U3 正文≥32rpx、主交互高度≥88rpx，长文案/长小区名不越界。
- U4 320/375/390/430逻辑像素宽度、系统大字体、键盘弹起、安全区和底部价格栏不遮挡最后字段。
- U5 加载、空结果、错误、重试、禁用、提交中有正确反馈；颜色和可读性一致。
- U6 返回、tab切换、重进、下拉刷新不丢失应保留的输入、不重复提交。
- U7 完整目录可用/未开通/待资料与工作台资格状态明确；无权限按钮不误露，直达接口仍拒绝。

### 每页都要检查的功能项

- F1 正常输入成功，刷新后云端记录一致；至少一次真实成功，不能只看空页。
- F2 必填/格式/边界/协议错误，服务端拒绝且无错误写入。
- F3 断网、慢响应、乱序、重试、重复点击，避免重复创建/支付/退款。
- F4 切换小区/地址、过期状态、撤销角色或关闭功能，页面和接口结果一致。
- F5 从真实入口到达并返回；详情参数不存在/越权/已删除时明确提示。
- F6 涉及金额、文件、位置、订阅、扫码等能力时验证真实平台结果与权限拒绝。

## 69页逐项台账

每行 U1–U7、F1–F6 均需逐项填写；不适用必须说明原因。表中“已有截图”不等于用户签收或全部状态已通过。

|编号|页面/路径|角色与前置|开关|当前视觉记录|完整业务|用户签收|
|---|---|---|---|---|---|---|
|P01|近邻帮<br>pages/index/index|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|已有模拟器截图；用户验收待做|待完整业务验收|待确认|
|P02|选择门牌<br>pages/bind/bind|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|已有模拟器截图；用户验收待做|待完整业务验收|待确认|
|P03|代取快递<br>pages/service/express|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P04|代扔垃圾<br>pages/service/trash|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P05|周边代买<br>pages/service/buy|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P06|帮把手<br>pages/service/help|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P07|我的订单<br>pages/orders/list|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|已有模拟器截图；用户验收待做|待完整业务验收|待确认|
|P08|订单详情<br>pages/orders/detail|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P09|我的月卡<br>pages/membership/index|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P10|我的<br>pages/me/me|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|已有模拟器截图；用户验收待做|待完整业务验收|待确认|
|P11|隐私政策<br>pages/legal/privacy|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|已有模拟器截图；用户验收待做|待完整业务验收|待确认|
|P12|服务协议<br>pages/legal/terms|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|已有模拟器截图；用户验收待做|待完整业务验收|待确认|
|P13|服务员申请<br>provider/apply/apply|申请页为住户；工作页需已审服务员|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P14|服务员工作台<br>provider/workbench/workbench|申请页为住户；工作页需已审服务员|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P15|任务大厅<br>provider/hall/hall|申请页为住户；工作页需已审服务员|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P16|任务详情<br>provider/task/task|申请页为住户；工作页需已审服务员|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P17|我的收入<br>provider/earnings/earnings|申请页为住户；工作页需已审服务员|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P18|管理看板<br>admin/dashboard/dashboard|管理员；物业按接口与小区限制|核心或按操作关联模块|已核对顶部/底部实景，完整视觉待验|加载及零数据已通过，筛选/非零业务待验|待确认|
|P19|订单管理<br>admin/orders/orders|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P20|订单处理<br>admin/order/order|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P21|服务员审核<br>admin/providers/providers|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P22|小区配置<br>admin/community/community|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P23|海报码<br>admin/posters/posters|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P24|结算<br>admin/settlements/settlements|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P25|功能开关<br>admin/features/features|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P26|内容举报审核<br>admin/reports/reports|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P27|聊天记录审计<br>admin/chat/chat|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P28|优惠券模板管理<br>admin/coupons/coupons|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P29|公告与广告管理<br>admin/content/content|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P30|商家入驻审核<br>admin/merchants/merchants|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P31|回收企业月度对账<br>admin/recycle/recycle|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P32|数据导出<br>admin/exports/exports|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P33|驿站账号审核<br>admin/stations/stations|管理员；物业按接口与小区限制|核心或按操作关联模块|待实景核查|待完整业务验收|待确认|
|P34|站内消息<br>chat/list/list|真实微信用户，业务页需对应绑定/参与关系|chat|待实景核查|待完整业务验收|待确认|
|P35|聊天<br>chat/room/room|真实微信用户，业务页需对应绑定/参与关系|chat|待实景核查|待完整业务验收|待确认|
|P36|优惠券中心<br>coupons/center/center|真实微信用户，业务页需对应绑定/参与关系|coupons|待实景核查|待完整业务验收|待确认|
|P37|我的优惠券<br>coupons/mine/mine|真实微信用户，业务页需对应绑定/参与关系|coupons|待实景核查|待完整业务验收|待确认|
|P38|需求广场<br>board/list/list|真实微信用户，业务页需对应绑定/参与关系|board / travelCarry|待实景核查|待完整业务验收|待确认|
|P39|求助详情<br>board/detail/detail|真实微信用户，业务页需对应绑定/参与关系|board / travelCarry|待实景核查|待完整业务验收|待确认|
|P40|发布需求<br>board/create/create|真实微信用户，业务页需对应绑定/参与关系|board / travelCarry|待实景核查|待完整业务验收|待确认|
|P41|闲置交易<br>idle/list/list|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|待实景核查|待完整业务验收|待确认|
|P42|闲置详情<br>idle/detail/detail|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|待实景核查|待完整业务验收|待确认|
|P43|发布闲置<br>idle/create/create|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|待实景核查|待完整业务验收|待确认|
|P44|我的闲置<br>idle/mine/mine|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|待实景核查|待完整业务验收|待确认|
|P45|担保交易订单<br>idle/sales/sales|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|待实景核查|待完整业务验收|待确认|
|P46|卖家交付<br>idle/sale/sale|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|待实景核查|待完整业务验收|待确认|
|P47|卖家收入<br>idle/income/income|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|待实景核查|待完整业务验收|待确认|
|P48|社区活动<br>events/list/list|真实微信用户，业务页需对应绑定/参与关系|events|待实景核查|待完整业务验收|待确认|
|P49|活动详情<br>events/detail/detail|真实微信用户，业务页需对应绑定/参与关系|events|待实景核查|待完整业务验收|待确认|
|P50|活动管理<br>events/manage/manage|管理员／物业／商家|events|待实景核查|待完整业务验收|待确认|
|P51|上门喂宠<br>pet/order|真实微信用户，业务页需对应绑定/参与关系|pet|待实景核查|待完整业务验收|待确认|
|P52|喂宠上门清单<br>pet/work|该订单已接单服务员|pet|待实景核查|待完整业务验收|待确认|
|P53|喂宠服务记录<br>pet/reports|真实微信用户，业务页需对应绑定/参与关系|pet|待实景核查|待完整业务验收|待确认|
|P54|商家入驻<br>merchant/apply/apply|申请页为住户；工作页需已审商家|merchants|待实景核查|待完整业务验收|待确认|
|P55|商家工作台<br>merchant/workbench/workbench|申请页为住户；工作页需已审商家|merchants|待实景核查|待完整业务验收|待确认|
|P56|服务管理<br>merchant/services/services|申请页为住户；工作页需已审商家|merchants|待实景核查|待完整业务验收|待确认|
|P57|商家预约订单<br>merchant/orders/orders|申请页为住户；工作页需已审商家|merchants|待实景核查|待完整业务验收|待确认|
|P58|社区商家<br>shops/list/list|真实微信用户，业务页需对应绑定/参与关系|merchants|待实景核查|待完整业务验收|待确认|
|P59|商家详情<br>shops/detail/detail|真实微信用户，业务页需对应绑定/参与关系|merchants|待实景核查|待完整业务验收|待确认|
|P60|提交预约<br>shops/booking/booking|真实微信用户，业务页需对应绑定/参与关系|merchants|待实景核查|待完整业务验收|待确认|
|P61|申请驿站账号<br>station/apply/apply|住户申请／驿站／服务员，按页面核验|stationDelivery|待实景核查|待完整业务验收|待确认|
|P62|驿站工作台<br>station/workbench/workbench|住户申请／驿站／服务员，按页面核验|stationDelivery|待实景核查|待完整业务验收|待确认|
|P63|创建送上门批次<br>station/create/create|住户申请／驿站／服务员，按页面核验|stationDelivery|待实景核查|待完整业务验收|待确认|
|P64|驿站配送任务<br>station/worker/worker|住户申请／驿站／服务员，按页面核验|stationDelivery|待实景核查|待完整业务验收|待确认|
|P65|驿站批次<br>station/batch/batch|住户申请／驿站／服务员，按页面核验|stationDelivery|待实景核查|待完整业务验收|待确认|
|P66|送餐上门<br>elder/meal|真实微信用户，业务页需对应绑定/参与关系|elder|待实景核查|待完整业务验收|待确认|
|P67|陪诊预约<br>elder/escort|真实微信用户，业务页需对应绑定/参与关系|elder|待实景核查|待完整业务验收|待确认|
|P68|预约上门回收<br>recycle/order/order|真实微信用户，业务页需对应绑定/参与关系|recycle / points|待实景核查|待完整业务验收|待确认|
|P69|小区公告<br>notices/list/list|真实微信用户，业务页需对应绑定/参与关系|notices|待实景核查|待完整业务验收|待确认|

### P01 近邻帮

- 路径：pages/index/index。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、openNotices、openAd、recordAd、introduce、callHotline。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、content.adEvent、content.homeContent。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P02 选择门牌

- 路径：pages/bind/bind。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、communityChange、buildingChange、unitChange、roomChange、toggleContact、contactNameChange、contactPhoneChange、manualPhoneChange、agreementChange、save、backHome。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、catalog.listCommunities、catalog.nearbyCommunities、catalog.resolveScene、user.bindPhone、user.setAddress。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P03 代取快递

- 路径：pages/service/express。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、address、change、slotChange、couponChange、pointsChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P04 代扔垃圾

- 路径：pages/service/trash。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、address、change、slotChange、couponChange、pointsChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P05 周边代买

- 路径：pages/service/buy。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、address、change、slotChange、couponChange、pointsChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P06 帮把手

- 路径：pages/service/help。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、address、change、slotChange、couponChange、pointsChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P07 我的订单

- 路径：pages/orders/list。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：groupChange、retry。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.list、order.listMine。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P08 订单详情

- 路径：pages/orders/detail。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、openChat、subscribeVisitReport、subscribeVacantReport、previewVacant、openPetReports、callProvider、preview、pay、cancel、serviceAction、form。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.open、order.cancel、order.complain、order.confirm、order.detail、order.mockPay、order.rate、order.retryPayment、order.subscribeVisitReport、order.subscriptionTemplates、vacant.subscribeReport。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P09 我的月卡

- 路径：pages/membership/index。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、slot、entry、entryPassword、buy、skip。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：membership.buy、membership.mine、membership.plans、membership.skipToday、order.detail、order.mockPay、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P10 我的

- 路径：pages/me/me。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、callHotline、doorDeliveryChange、openWorkspace。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.list、merchant.myApplication、station.myApplication、station.setDoorDelivery。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P11 隐私政策

- 路径：pages/legal/privacy。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：静态阅读与系统返回。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：静态页面/共用登录。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P12 服务协议

- 路径：pages/legal/terms。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：静态阅读与系统返回。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：静态页面/共用登录。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P13 服务员申请

- 路径：provider/apply/apply。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：load、change、photo、agree、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.listCommunities、provider.apply、provider.myStatus、user.bindPhone。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P14 服务员工作台

- 路径：provider/workbench/workbench。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：load、duty、subscribeMore、saveReferralPoster、task、more。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：order.subscriptionTemplates、provider.myStatus、provider.myTasks、provider.referralPoster、provider.setDuty。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P15 任务大厅

- 路径：provider/hall/hall。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：retry、accept。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：order.subscriptionTemplates、provider.accept、provider.hall。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P16 任务详情

- 路径：provider/task/task。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：load、callResident、openChat、openPetTasks、revealEntry、weight、act、photo、goods、checklist、vacantPhoto、vacantNotes、vacantAttention、visitCheck、visitNotes、visitAttention、submitVacantReport。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：order.detail、provider.deliver、provider.release、provider.start、provider.updateLocation、vacant.recordReport、vacant.revealEntry。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P17 我的收入

- 路径：provider/earnings/earnings。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：createPayout、retry。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：payout.create、payout.list、provider.earnings。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P18 管理看板

- 2026-11-09 D07实测：本人开发管理员已从“我的”进入看板，13项管理导航及零数据统计已加载；顶部导航、底部卡片已查看实际截图。日期/小区/联合范围切换、非零业务、物业边界和用户视觉签收未通过，不能将本行全部打勾。证据：[D07记录](../verification/2026-11-09-remediation/d07-admin-setup.json)。

- 路径：admin/dashboard/dashboard。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、chooseCommunity、chooseScope、chooseDate。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.dashboard、admin.notificationTemplates、catalog.listCommunities。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P19 订单管理

- 路径：admin/orders/orders。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：filter、retry、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.exportSubsidyOrders、admin.listOrders。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P20 订单处理

- 路径：admin/order/order。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、preview、openChat、retryRefund、provider、assign、cancel、resolutionField、liable、resolve、voidCard。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.assign、admin.forceCancel、admin.listProviders、admin.resolveComplaint、admin.retryRefund、admin.voidMembership、order.detail。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P21 服务员审核

- 路径：admin/providers/providers。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：filter、retry、preview、note、certs、review、cleanup、insurance、suspend。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.cleanupProviderKyc、admin.listProviders、admin.reviewProvider、admin.setCerts、admin.setInsurance、admin.suspendProvider。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P22 小区配置

- 路径：admin/community/community。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、chooseCommunity、input、chooseLocation、editBuilding、newBuilding、addBuilding、rowInput、removeRow、addRow、togglePetCert、choosePlan、saveCommunity、saveGlobal。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.managementConfig、admin.updateCommunity、admin.updateConfig、admin.upsertBuilding。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P23 海报码

- 路径：admin/posters/posters。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：changeCommunity、generate、providerChange、preview、save。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.genPoster、admin.listProviders、catalog.getCommunity、catalog.listCommunities。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P24 结算

- 路径：admin/settlements/settlements。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、select、input、preview、create、markPaid。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.exportCsv、admin.listProviders、admin.listSettlements、admin.settlementCreate、admin.settlementMarkPaid、admin.settlementPreview、catalog.getCommunity、catalog.listCommunities、merchant.adminList。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P25 功能开关

- 路径：admin/features/features。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、scope、choose、toggle。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.getFeatures、admin.updateCommunity、admin.updateConfig、catalog.listCommunities。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P26 内容举报审核

- 路径：admin/reports/reports。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：chooseStatus、load、openChat、resolve、moderate。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.listReports、content.moderateContent、content.moderateUser、content.resolveReport。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P27 聊天记录审计

- 路径：admin/chat/chat。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、preview。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.adminPull。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P28 优惠券模板管理

- 路径：admin/coupons/coupons。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：field、chooseKind、chooseMode、save、reset、edit、toggleStatus、templatePick、issue。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：coupon.adminTemplates、coupon.manualIssue、coupon.saveTemplate。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P29 公告与广告管理

- 路径：admin/content/content。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：input、chooseImage、togglePinned、saveNotice、endNotice、adSlotChange、adTargetTypeChange、adPathChange、adStatusChange、saveAd、confirmAdReceived、endAd。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.endAd、content.endNotice、content.listAds、content.listNotices、content.markAdReceived、content.saveAd、content.saveNotice。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P30 商家入驻审核

- 路径：admin/merchants/merchants。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、inspect、serviceStatus、review。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.adminList、merchant.adminServices、merchant.review、merchant.setServiceStatus。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P31 回收企业月度对账

- 路径：admin/recycle/recycle。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：select、input。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.exportRecyclerStatement、catalog.listCommunities。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P32 数据导出

- 路径：admin/exports/exports。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、select、input、exportData。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.exportCsv、admin.exportRecyclerStatement、admin.exportSubsidyOrders、admin.listProviders、catalog.getCommunity、catalog.listCommunities、merchant.adminList、station.exportStatement。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P33 驿站账号审核

- 路径：admin/stations/stations。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、review。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.listApplications、station.reviewApplication。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P34 站内消息

- 路径：chat/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；chat。
- 页面操作清点：load、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.list。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P35 聊天

- 路径：chat/room/room。前置：真实微信用户，业务页需对应绑定/参与关系；chat。
- 页面操作清点：start、reportContent、input、image、send。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.markRead、chat.open、chat.pull、chat.send、content.report。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P36 优惠券中心

- 路径：coupons/center/center。前置：真实微信用户，业务页需对应绑定/参与关系；coupons。
- 页面操作清点：load、claim。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：coupon.center、coupon.claim。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P37 我的优惠券

- 路径：coupons/mine/mine。前置：真实微信用户，业务页需对应绑定/参与关系；coupons。
- 页面操作清点：load、retryWelcome。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：coupon.mine、user.retryWelcomeCoupons。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P38 需求广场

- 路径：board/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；board / travelCarry。
- 页面操作清点：chooseType、chooseScope、retryAds、openAd、recordAd、load、open、create、more。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：board.list、catalog.getCommunity、content.adEvent、content.adsForSlot。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P39 求助详情

- 路径：board/detail/detail。前置：真实微信用户，业务页需对应绑定/参与关系；board / travelCarry。
- 页面操作清点：load、preview、continuePayment、close、report、reportComment、input、comment。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：board.close、board.comment、board.detail、board.report。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P40 发布需求

- 路径：board/create/create。前置：真实微信用户，业务页需对应绑定/参与关系；board / travelCarry。
- 页面操作清点：field、scope、choose、toggleEnterHome、agree、photos、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：board.create、catalog.getCommunity、order.detail、order.mockPay、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P41 闲置交易

- 路径：idle/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：scope、load、open、more、create、mine。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、idle.list。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P42 闲置详情

- 路径：idle/detail/detail。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、preview、edit、markSold、sales、remove、buy、contact、want、carry、report。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.openIdle、idle.buy、idle.contact、idle.detail、idle.markSold、idle.remove、idle.report、order.detail、order.mockPay、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P43 发布闲置

- 路径：idle/create/create。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：field、condition、switch、tradeMode、scope、photos、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、idle.create、idle.detail、idle.update。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P44 我的闲置

- 路径：idle/mine/mine。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、open、sales、income、create。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：idle.mine。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P45 担保交易订单

- 路径：idle/sales/sales。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：idle.sales。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P46 卖家交付

- 路径：idle/sale/sale。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、accept、preview、photos、note、deliver。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：idle.acceptSale、idle.deliverSale、order.detail。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P47 卖家收入

- 路径：idle/income/income。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、withdraw。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：idle.earnings、payout.create、payout.list。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P48 社区活动

- 路径：events/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；events。
- 页面操作清点：load、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：event.list。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P49 活动详情

- 路径：events/detail/detail。前置：真实微信用户，业务页需对应绑定/参与关系；events。
- 页面操作清点：load、signup、cancelSignup、reportContent。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.report、event.cancelSignup、event.detail、event.signup、event.templates、order.detail、order.mockPay、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P50 活动管理

- 路径：events/manage/manage。前置：管理员／物业／商家；events。
- 页面操作清点：load、input、typeChange、createActivity、scan、publish、showSignups、checkin、cancel、retryCancellation。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：event.adminList、event.cancelEvent、event.checkin、event.create、event.listSignups、event.publish、event.retryCancellation、event.review。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P51 上门喂宠

- 路径：pet/order。前置：真实微信用户，业务页需对应绑定/参与关系；pet。
- 页面操作清点：load、addressChange、removePetDate、addPetDate、change、slotChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P52 喂宠上门清单

- 路径：pet/work。前置：该订单已接单服务员；pet。
- 页面操作清点：load、reveal、done、missed、closeSecret。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：pet.listVisits、pet.markDone、pet.markMissed、pet.revealEntry。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P53 喂宠服务记录

- 路径：pet/reports。前置：真实微信用户，业务页需对应绑定/参与关系；pet。
- 页面操作清点：load。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：pet.listVisits。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P54 商家入驻

- 路径：merchant/apply/apply。前置：申请页为住户；工作页需已审商家；merchants。
- 页面操作清点：input、chooseCategory、upload、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.apply、merchant.myApplication。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P55 商家工作台

- 路径：merchant/workbench/workbench。前置：申请页为住户；工作页需已审商家；merchants。
- 页面操作清点：load、orders、services、apply。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.myApplication。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P56 服务管理

- 路径：merchant/services/services。前置：申请页为住户；工作页需已审商家；merchants。
- 页面操作清点：input、chooseType、photos、save。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.myServices、merchant.upsertService。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P57 商家预约订单

- 路径：merchant/orders/orders。前置：申请页为住户；工作页需已审商家；merchants。
- 页面操作清点：load、chooseQuote、input、quote、transition、complete。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.completeBooking、merchant.merchantOrders、merchant.merchantTransition、merchant.quoteBooking。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P58 社区商家

- 路径：shops/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；merchants。
- 页面操作清点：retryAds、openAd、recordAd、load、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.adEvent、content.adsForSlot、merchant.listForCommunity。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P59 商家详情

- 路径：shops/detail/detail。前置：真实微信用户，业务页需对应绑定/参与关系；merchants。
- 页面操作清点：load、book、reportContent。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.report、merchant.servicesForMerchant。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P60 提交预约

- 路径：shops/booking/booking。前置：真实微信用户，业务页需对应绑定/参与关系；merchants。
- 页面操作清点：address、input、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.createBooking、order.detail、order.mockPay、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P61 申请驿站账号

- 路径：station/apply/apply。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：load、chooseCommunity、chooseStation、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.applicationOptions、station.apply、station.myApplication。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P62 驿站工作台

- 路径：station/workbench/workbench。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：monthChange、exportStatement、load。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.exportStatement、station.listMyBatches。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P63 创建送上门批次

- 路径：station/create/create。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：change、create。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.createBatch。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P64 驿站配送任务

- 路径：station/worker/worker。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：load、accept。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.acceptBatch、station.providerHall。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P65 驿站批次

- 路径：station/batch/batch。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：load、start、delivered、failed。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.checkDoorDeliveryConsent、station.providerBatch、station.recordDelivery、station.startBatch。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P66 送餐上门

- 路径：elder/meal。前置：真实微信用户，业务页需对应绑定/参与关系；elder。
- 页面操作清点：load、addressChange、change、slotChange、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P67 陪诊预约

- 路径：elder/escort。前置：真实微信用户，业务页需对应绑定/参与关系；elder。
- 页面操作清点：load、addressChange、change、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P68 预约上门回收

- 路径：recycle/order/order。前置：真实微信用户，业务页需对应绑定/参与关系；recycle / points。
- 页面操作清点：category、note、selectSlot、load、create。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：order.create、order.quote。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P69 小区公告

- 路径：notices/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；notices。
- 页面操作清点：load、loadMore。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.listNotices。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

## 当前必须保留的验收缺口

1. 两批授权更新已完成，去重12函数、886/886源码文件回读一致；其余9函数不在本轮更新范围。真实手填成功与重进持久化仍须验收。
2. 珺悦国际真实楼栋、单元由管理员手填维护，住户仍选择；价格、班次和服务人员未提供；不能复制示例数据冒充真实小区。
3. D07本人开发管理员已配置，真实会话、七项后台读取及看板加载已验证；物业/服务员/商家/驿站资格与跨账号测试尚未完成。
4. 非定位扩展开关不因本次任务自动打开；模块数据、内容安全、订阅模板与密钥按原决策逐项配置。
5. D05、D06仍暂缓；D07配置及管理员访问已验证，通知送达仍待验。真实支付/退款/提现与timer周期结果不能宣称通过。
6. 定位必须分别验证数据库开关/坐标、catalog查询、设备授权与拒绝、近/远距离、订单前台共享及停止；公开中心坐标查询不等于手机实际定位成功。
7. 真机大小屏、系统大字体及69页所有内容状态仍须实景验证。
