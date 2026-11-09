# 全页面 UI 与功能验收册

> 最新：QA29及首批与QA26–QA28详见[本轮记录](../verification/2026-11-09-all-pages/README.md)。P50真实示例活动管理通过所列样本；P29的content已部署，纯文字公告发布/读取/结束通过所列样本；不是69页完整通过。

本册按 app.json 枚举全部69页。目标是逐页视觉符合设计、逐流程功能闭环；当前不是全量通过报告。原40个规格场景、15个关闭回归和4个真实支付场景继续以 [TEST_HANDOFF](../TEST_HANDOFF.md) 为准，不能被本册替代。

> QA07追加：四核心服务（P03–P06）新无人值班提示、实际报价、换行与底部价格栏已在当前模拟器尺寸核对；重新编译后四页累计0错误，原渲染错误未复现但根因未定。其余视觉/交互标准与用户签收仍待验收，见[实景证据](../verification/2026-11-09-remediation/qa07-live-pages.json)。


> QA09–QA13全部A已实施并同步规格；26项针对性回归在3个时区分别通过，605单测/76既有隔离回归/207页加载检查通过。六页视觉与真实流程仍待实景核对，见[最新完整结果](../verification/2026-11-09-all-pages/README.md)。

> 最新追加：QA14已批准并修复，9项隔离回归及活动页空开始日期实际滚顶提示通过；协议上下屏/返回已看；AGENTS缓冲已恢复并保存核对。QA15/QA16均已批准并修复，9+10项回归通过；QA15实际本地校验提示、QA16真实只读刷新/构造失败态按钮恢复通过；真实保存后故障链路待验。完整业务仍未通过。

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
|P01|近邻帮<br>pages/index/index|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|首页已登录、珺悦与4项核心/19项目录可见；未开通标记已核对|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P02|选择门牌<br>pages/bind/bind|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|既有真实手填保存、强刷持久化；QA18加载失败空态隔离回归通过|本人绑定保存及强制刷新持久化已有真实证据；多地址/赠券异常/弱网仍待验|待确认|
|P03|代取快递<br>pages/service/express|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|既有D13真实报价/件数边界、QA07提示及价格栏核对|真实报价与所述拒绝边界已验证；创建、支付、履约、退款未全验|待确认|
|P04|代扔垃圾<br>pages/service/trash|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|既有D13真实报价、QA07提示核对|真实报价与所述拒绝边界已验证；创建、支付、履约、退款未全验|待确认|
|P05|周边代买<br>pages/service/buy|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|既有服务费/商品款分离、上下限拒绝及QA07提示核对|真实报价与所述拒绝边界已验证；创建、支付、履约、退款未全验|待确认|
|P06|帮把手<br>pages/service/help|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|既有39元/30分钟报价与超时不扣费说明核对|真实报价与所述拒绝边界已验证；创建、支付、履约、退款未全验|待确认|
|P07|我的订单<br>pages/orders/list|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|实点进行中/已完成/售后三标签，加载至空结果；标签文字居中|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P08|订单详情<br>pages/orders/detail|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|QA25缺编号提示/按钮实景通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P09|我的月卡<br>pages/membership/index|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|月卡读取完成，暂无已购卡；本小区无可选计划，未购卡|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P10|我的<br>pages/me/me|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|下半屏五工作台及资格说明可见；点击商家显示未开通说明，管理员入口已有证据|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P11|隐私政策<br>pages/legal/privacy|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|隐私政策上下屏可读，无观察到当前尺寸裁切|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P12|服务协议<br>pages/legal/terms|真实微信用户，业务页需对应绑定/参与关系|核心或按操作关联模块|QA10协议上下屏和返回，按次/按时及不自动扣费说明已核对|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P13|服务员申请<br>provider/apply/apply|申请页为住户；工作页需已审服务员|核心或按操作关联模块|经真实工作台进入申请页，上下屏字段已看，未上传/提交|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P14|服务员工作台<br>provider/workbench/workbench|申请页为住户；工作页需已审服务员|核心或按操作关联模块|读取成功的无服务员资料状态、申请入口点击通过；QA18失败隔离通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P15|任务大厅<br>provider/hall/hall|申请页为住户；工作页需已审服务员|核心或按操作关联模块|本人无服务员角色，直达后回首页；成功工作台未测|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P16|任务详情<br>provider/task/task|申请页为住户；工作页需已审服务员|核心或按操作关联模块|QA25缺编号提示/按钮实景通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P17|我的收入<br>provider/earnings/earnings|申请页为住户；工作页需已审服务员|核心或按操作关联模块|本人无服务员角色，当前直达回首页；QA19收入失败/恢复仅隔离验证|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P18|管理看板<br>admin/dashboard/dashboard|管理员；物业按接口与小区限制|核心或按操作关联模块|既有D07管理看板、13导航及零统计已看；非零数据未验|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P19|订单管理<br>admin/orders/orders|管理员；物业按接口与小区限制|核心或按操作关联模块|管理订单真实空列表/全部筛选与导出入口已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P20|订单处理<br>admin/order/order|管理员；物业按接口与小区限制|核心或按操作关联模块|QA25缺编号提示/按钮实景通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P21|服务员审核<br>admin/providers/providers|管理员；物业按接口与小区限制|核心或按操作关联模块|待审核服务员空列表已看，未审核|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P22|小区配置<br>admin/community/community|管理员；物业按接口与小区限制|核心或按操作关联模块|QA15非法数字保留/滚顶、QA16只读回读与草稿保留实景；真实写后读故障未验|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P23|海报码<br>admin/posters/posters|管理员；物业按接口与小区限制|核心或按操作关联模块|示例小区/楼栋与二维码生成表单已看；未生成码|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P24|结算<br>admin/settlements/settlements|管理员；物业按接口与小区限制|核心或按操作关联模块|结算小区/人员/日期/预览生成导出表单已看；未执行结算|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P25|功能开关<br>admin/features/features|管理员；物业按接口与小区限制|核心或按操作关联模块|全局及珺悦定位开启、扩展关闭状态上下屏已读；未改开关|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P26|内容举报审核<br>admin/reports/reports|管理员；物业按接口与小区限制|核心或按操作关联模块|举报空列表及三类标签可见；QA18读取失败隔离通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P27|聊天记录审计<br>admin/chat/chat|管理员；物业按接口与小区限制|核心或按操作关联模块|无案件参数错误/重试，未出现虚假审计成功；真实案件未测|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P28|优惠券模板管理<br>admin/coupons/coupons|管理员；物业按接口与小区限制|核心或按操作关联模块|优惠券表单上下屏中文标签/单位已看；未创建发券|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P29|公告与广告管理<br>admin/content/content|管理员；物业按接口与小区限制|核心或按操作关联模块|QA28已部署；示例小区表单及非空公告390宽实景已核对|纯文字公告发布/读取/结束真实通过；同区住户/图片/广告仍待验|待确认|
|P30|商家入驻审核<br>admin/merchants/merchants|管理员；物业按接口与小区限制|核心或按操作关联模块|待审核商家筛选与空列表已看；未审核|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P31|回收企业月度对账<br>admin/recycle/recycle|管理员；物业按接口与小区限制|核心或按操作关联模块|回收月结日期/小区/导出入口已看；未导出|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P32|数据导出<br>admin/exports/exports|管理员；物业按接口与小区限制|核心或按操作关联模块|管理导出读取完成后表单已看；未生成文件|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P33|驿站账号审核<br>admin/stations/stations|管理员；物业按接口与小区限制|核心或按操作关联模块|驿站审核读取成功无申请；QA18失败隔离通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P34|站内消息<br>chat/list/list|真实微信用户，业务页需对应绑定/参与关系|chat|聊天列表功能关闭，仅错误重试，无虚假空结果|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P35|聊天<br>chat/room/room|真实微信用户，业务页需对应绑定/参与关系|chat|无会话提示，图片/发送禁用实景；QA20恢复与离页迟到响应隔离通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P36|优惠券中心<br>coupons/center/center|真实微信用户，业务页需对应绑定/参与关系|coupons|优惠券中心功能关闭提示已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P37|我的优惠券<br>coupons/mine/mine|真实微信用户，业务页需对应绑定/参与关系|coupons|我的券功能关闭提示及领券中心入口已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P38|需求广场<br>board/list/list|真实微信用户，业务页需对应绑定/参与关系|board / travelCarry|需求列表功能关闭，三类标签居中已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P39|求助详情<br>board/detail/detail|真实微信用户，业务页需对应绑定/参与关系|board / travelCarry|QA25缺编号提示/按钮实景通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P40|发布需求<br>board/create/create|真实微信用户，业务页需对应绑定/参与关系|board / travelCarry|求助/悬赏/帮带三表单上下屏、常驻标签与卡片已看；初始化失败禁用上传/发布|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P41|闲置交易<br>idle/list/list|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|闲置列表功能关闭提示已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P42|闲置详情<br>idle/detail/detail|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|QA25缺编号提示/按钮实景通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P43|发布闲置<br>idle/create/create|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|闲置发布上下屏常驻字段、卡片、失败禁用上传/保存已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P44|我的闲置<br>idle/mine/mine|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|我的闲置关闭提示，历史卖家订单/收入入口可见|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P45|担保交易订单<br>idle/sales/sales|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|历史卖家订单查询成功为空，收入入口可见|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P46|卖家交付<br>idle/sale/sale|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|QA25缺编号提示/按钮实景通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P47|卖家收入<br>idle/income/income|真实微信用户，业务页需对应绑定/参与关系|idle / idleEscrow|QA19真实关闭错误仅重试，不显示默认零收入或结算操作|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P48|社区活动<br>events/list/list|真实微信用户，业务页需对应绑定/参与关系|events|活动列表功能关闭提示已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P49|活动详情<br>events/detail/detail|真实微信用户，业务页需对应绑定/参与关系|events|QA25缺编号提示实景；真实跨区ID直达回首页，非正常详情页通过|跨区detail服务端E_FORBIDDEN、signup拒绝；真实同区详情和报名成功仍待身份|待确认|
|P50|活动管理<br>events/manage/manage|管理员／物业／商家|events|QA26选择/表单/取消卡片已核对；QA29取消卡片隐藏签到；390宽度|示例活动创建/发布/零报名取消通过；event旧批回读及只读复验通过；QA29本地40项，新包未部署；任务queued未执行|待确认|
|P51|上门喂宠<br>pet/order|真实微信用户，业务页需对应绑定/参与关系|pet|喂宠上下屏数量行、任务换行；QA24实际价格栏¥--、确认禁用及底部不遮挡已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P52|喂宠上门清单<br>pet/work|该订单已接单服务员|pet|QA25缺编号提示/按钮实景通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P53|喂宠服务记录<br>pet/reports|真实微信用户，业务页需对应绑定/参与关系|pet|QA25缺编号提示/按钮实景通过；按钮实际返回我的订单|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P54|商家入驻<br>merchant/apply/apply|申请页为住户；工作页需已审商家|merchants|商家申请上下屏，失败重试/上传与提交禁用已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P55|商家工作台<br>merchant/workbench/workbench|申请页为住户；工作页需已审商家|merchants|QA17读取失败仅显示错误重试，不显示未申请状态|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P56|服务管理<br>merchant/services/services|申请页为住户；工作页需已审商家|merchants|本人无商家资格，直达回首页；QA20读取门槛隔离通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P57|商家预约订单<br>merchant/orders/orders|申请页为住户；工作页需已审商家|merchants|本人无商家资格，直达回首页；真实订单未测|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P58|社区商家<br>shops/list/list|真实微信用户，业务页需对应绑定/参与关系|merchants|商家列表关闭错误及资质提示已看|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P59|商家详情<br>shops/detail/detail|真实微信用户，业务页需对应绑定/参与关系|merchants|QA25缺编号提示/按钮实景通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P60|提交预约<br>shops/booking/booking|真实微信用户，业务页需对应绑定/参与关系|merchants|QA23真实绑定地址无undefined；QA25缺编号隐藏预约表单/提交，实际返回商家列表|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P61|申请驿站账号<br>station/apply/apply|住户申请／驿站／服务员，按页面核验|stationDelivery|QA18功能关闭错误，无假未申请/申请表|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P62|驿站工作台<br>station/workbench/workbench|住户申请／驿站／服务员，按页面核验|stationDelivery|本人无驿站资格，直达回首页；成功工作台未测|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P63|创建送上门批次<br>station/create/create|住户申请／驿站／服务员，按页面核验|stationDelivery|建批次常驻门牌标签及每行格式已看，空表单禁用；未建批次|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P64|驿站配送任务<br>station/worker/worker|住户申请／驿站／服务员，按页面核验|stationDelivery|本人无配送资格，直达回首页；成功工作台未测|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P65|驿站批次<br>station/batch/batch|住户申请／驿站／服务员，按页面核验|stationDelivery|QA25缺编号提示/按钮实景通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P66|送餐上门<br>elder/meal|真实微信用户，业务页需对应绑定/参与关系|elder|食堂未配置/功能关闭；QA24实际价格栏及禁用确认已核对|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P67|陪诊预约<br>elder/escort|真实微信用户，业务页需对应绑定/参与关系|elder|陪诊字段、报价¥--及功能关闭已看；下半屏完整交互待验|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P68|预约上门回收<br>recycle/order/order|真实微信用户，业务页需对应绑定/参与关系|recycle / points|回收类别纸类实际切换选中，关闭态提交禁用；未下单|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|
|P69|小区公告<br>notices/list/list|真实微信用户，业务页需对应绑定/参与关系|notices|公告读取成功空列表；QA18读取失败隔离通过|未完成完整业务闭环；具体已有成功样本与前置见PAGE_ACCEPTANCE及TEST_HANDOFF|待确认|

### P01 近邻帮

- 路径：pages/index/index。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、openNotices、openAd、recordAd、introduce、callHotline。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、content.adEvent、content.homeContent。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P02 选择门牌

- 路径：pages/bind/bind。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、communityChange、buildingChange、unitChange、roomChange、toggleContact、contactNameChange、contactPhoneChange、manualPhoneChange、agreementChange、save、backHome。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、catalog.listCommunities、catalog.nearbyCommunities、catalog.resolveScene、user.bindPhone、user.setAddress。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P03 代取快递

- 路径：pages/service/express。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、address、change、slotChange、couponChange、pointsChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P04 代扔垃圾

- 路径：pages/service/trash。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、address、change、slotChange、couponChange、pointsChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P05 周边代买

- 路径：pages/service/buy。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、address、change、slotChange、couponChange、pointsChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P06 帮把手

- 路径：pages/service/help。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、address、change、slotChange、couponChange、pointsChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P07 我的订单

- 路径：pages/orders/list。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：groupChange、retry。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.list、order.listMine。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P08 订单详情

- 路径：pages/orders/detail。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、openChat、subscribeVisitReport、subscribeVacantReport、previewVacant、openPetReports、callProvider、preview、pay、cancel、serviceAction、form。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.open、order.cancel、order.complain、order.confirm、order.detail、order.mockPay、order.rate、order.retryPayment、order.subscribeVisitReport、order.subscriptionTemplates、vacant.subscribeReport。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P09 我的月卡

- 路径：pages/membership/index。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、addressChange、slot、entry、entryPassword、buy、skip。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：membership.buy、membership.mine、membership.plans、membership.skipToday、order.detail、order.mockPay、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P10 我的

- 路径：pages/me/me。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：load、callHotline、doorDeliveryChange、openWorkspace。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.list、merchant.myApplication、station.myApplication、station.setDoorDelivery。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P11 隐私政策

- 路径：pages/legal/privacy。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：静态阅读与系统返回。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：静态页面/共用登录。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P12 服务协议

- 路径：pages/legal/terms。前置：真实微信用户，业务页需对应绑定/参与关系；核心或按操作关联模块。
- 页面操作清点：静态阅读与系统返回。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：静态页面/共用登录。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。 新发现：QA10 帮把手协议过时，已批准并完成本地修复，实景待验。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P13 服务员申请

- 路径：provider/apply/apply。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：load、change、photo、agree、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.listCommunities、provider.apply、provider.myStatus、user.bindPhone。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P14 服务员工作台

- 路径：provider/workbench/workbench。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：load、duty、subscribeMore、saveReferralPoster、task、more。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：order.subscriptionTemplates、provider.myStatus、provider.myTasks、provider.referralPoster、provider.setDuty。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P15 任务大厅

- 路径：provider/hall/hall。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：retry、accept。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：order.subscriptionTemplates、provider.accept、provider.hall。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P16 任务详情

- 路径：provider/task/task。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：load、callResident、openChat、openPetTasks、revealEntry、weight、act、photo、goods、checklist、vacantPhoto、vacantNotes、vacantAttention、visitCheck、visitNotes、visitAttention、submitVacantReport。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：order.detail、provider.deliver、provider.release、provider.start、provider.updateLocation、vacant.recordReport、vacant.revealEntry。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P17 我的收入

- 路径：provider/earnings/earnings。前置：申请页为住户；工作页需已审服务员；核心或按操作关联模块。
- 页面操作清点：createPayout、retry。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：payout.create、payout.list、provider.earnings。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P18 管理看板

- 2026-11-09 D07实测：本人开发管理员已从“我的”进入看板，13项管理导航及零数据统计已加载；顶部导航、底部卡片已查看实际截图。日期/小区/联合范围切换、非零业务、物业边界和用户视觉签收未通过，不能将本行全部打勾。证据：[D07记录](../verification/2026-11-09-remediation/d07-admin-setup.json)。

- 路径：admin/dashboard/dashboard。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、chooseCommunity、chooseScope、chooseDate。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.dashboard、admin.notificationTemplates、catalog.listCommunities。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P19 订单管理

- 路径：admin/orders/orders。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：filter、retry、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.exportSubsidyOrders、admin.listOrders。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P20 订单处理

- 路径：admin/order/order。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、preview、openChat、retryRefund、provider、assign、cancel、resolutionField、liable、resolve、voidCard。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.assign、admin.forceCancel、admin.listProviders、admin.resolveComplaint、admin.retryRefund、admin.voidMembership、order.detail。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P21 服务员审核

- 路径：admin/providers/providers。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：filter、retry、preview、note、certs、review、cleanup、insurance、suspend。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.cleanupProviderKyc、admin.listProviders、admin.reviewProvider、admin.setCerts、admin.setInsurance、admin.suspendProvider。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P22 小区配置

- 路径：admin/community/community。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、chooseCommunity、input、chooseLocation、editBuilding、newBuilding、addBuilding、rowInput、removeRow、addRow、togglePetCert、choosePlan、saveCommunity、saveGlobal。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.managementConfig、admin.updateCommunity、admin.updateConfig、admin.upsertBuilding。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P23 海报码

- 路径：admin/posters/posters。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：changeCommunity、generate、providerChange、preview、save。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.genPoster、admin.listProviders、catalog.getCommunity、catalog.listCommunities。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P24 结算

- 路径：admin/settlements/settlements。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、select、input、preview、create、markPaid。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.exportCsv、admin.listProviders、admin.listSettlements、admin.settlementCreate、admin.settlementMarkPaid、admin.settlementPreview、catalog.getCommunity、catalog.listCommunities、merchant.adminList。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P25 功能开关

- 路径：admin/features/features。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、scope、choose、toggle。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.getFeatures、admin.updateCommunity、admin.updateConfig、catalog.listCommunities。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P26 内容举报审核

- 路径：admin/reports/reports。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：chooseStatus、load、openChat、resolve、moderate。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.listReports、content.moderateContent、content.moderateUser、content.resolveReport。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P27 聊天记录审计

- 路径：admin/chat/chat。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、preview。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.adminPull。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。 新发现：QA12 审计成功提示，已批准并完成本地修复，实景待验。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P28 优惠券模板管理

- 路径：admin/coupons/coupons。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：field、chooseKind、chooseMode、save、reset、edit、toggleStatus、templatePick、issue。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：coupon.adminTemplates、coupon.manualIssue、coupon.saveTemplate。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P29 公告与广告管理

- 路径：admin/content/content。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：input、chooseImage、togglePinned、saveNotice、endNotice、adSlotChange、adTargetTypeChange、adPathChange、adStatusChange、saveAd、confirmAdReceived、endAd。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.endAd、content.endNotice、content.listAds、content.listNotices、content.markAdReceived、content.saveAd、content.saveNotice。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- QA28最新：content云端76/76文件回读一致；真实示例花园公告发布、完整内容回读、结束后列表移除且无错误已通过。390宽表单和非空公告已核对；同区普通住户查看、图片公告、广告完整流程与多尺寸仍未验收。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P30 商家入驻审核

- 路径：admin/merchants/merchants。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、inspect、serviceStatus、review。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.adminList、merchant.adminServices、merchant.review、merchant.setServiceStatus。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。 新发现：QA11 中文/标签/金额展示，已批准并完成本地修复，实景待验。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P31 回收企业月度对账

- 路径：admin/recycle/recycle。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：select、input。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.exportRecyclerStatement、catalog.listCommunities。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P32 数据导出

- 路径：admin/exports/exports。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、select、input、exportData。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：admin.exportCsv、admin.exportRecyclerStatement、admin.exportSubsidyOrders、admin.listProviders、catalog.getCommunity、catalog.listCommunities、merchant.adminList、station.exportStatement。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P33 驿站账号审核

- 路径：admin/stations/stations。前置：管理员；物业按接口与小区限制；核心或按操作关联模块。
- 页面操作清点：load、review。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.listApplications、station.reviewApplication。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P34 站内消息

- 路径：chat/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；chat。
- 页面操作清点：load、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.list。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P35 聊天

- 路径：chat/room/room。前置：真实微信用户，业务页需对应绑定/参与关系；chat。
- 页面操作清点：start、reportContent、input、image、send。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.markRead、chat.open、chat.pull、chat.send、content.report。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P36 优惠券中心

- 路径：coupons/center/center。前置：真实微信用户，业务页需对应绑定/参与关系；coupons。
- 页面操作清点：load、claim。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：coupon.center、coupon.claim。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P37 我的优惠券

- 路径：coupons/mine/mine。前置：真实微信用户，业务页需对应绑定/参与关系；coupons。
- 页面操作清点：load、retryWelcome。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：coupon.mine、user.retryWelcomeCoupons。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P38 需求广场

- 路径：board/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；board / travelCarry。
- 页面操作清点：chooseType、chooseScope、retryAds、openAd、recordAd、load、open、create、more。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：board.list、catalog.getCommunity、content.adEvent、content.adsForSlot。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P39 求助详情

- 路径：board/detail/detail。前置：真实微信用户，业务页需对应绑定/参与关系；board / travelCarry。
- 页面操作清点：load、preview、continuePayment、close、report、reportComment、input、comment。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：board.close、board.comment、board.detail、board.report。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P40 发布需求

- 路径：board/create/create。前置：真实微信用户，业务页需对应绑定/参与关系；board / travelCarry。
- 页面操作清点：field、scope、choose、toggleEnterHome、agree、photos、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：board.create、catalog.getCommunity、order.detail、order.mockPay、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。 新发现：QA09 日期函数缺失，已批准并完成本地修复，实景待验。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P41 闲置交易

- 路径：idle/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：scope、load、open、more、create、mine。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、idle.list。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P42 闲置详情

- 路径：idle/detail/detail。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、preview、edit、markSold、sales、remove、buy、contact、want、carry、report。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：chat.openIdle、idle.buy、idle.contact、idle.detail、idle.markSold、idle.remove、idle.report、order.detail、order.mockPay、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P43 发布闲置

- 路径：idle/create/create。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：field、condition、switch、tradeMode、scope、photos、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、idle.create、idle.detail、idle.update。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P44 我的闲置

- 路径：idle/mine/mine。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、open、sales、income、create。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：idle.mine。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P45 担保交易订单

- 路径：idle/sales/sales。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：idle.sales。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P46 卖家交付

- 路径：idle/sale/sale。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、accept、preview、photos、note、deliver。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：idle.acceptSale、idle.deliverSale、order.detail。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P47 卖家收入

- 路径：idle/income/income。前置：真实微信用户，业务页需对应绑定/参与关系；idle / idleEscrow。
- 页面操作清点：load、withdraw。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：idle.earnings、payout.create、payout.list。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P48 社区活动

- 路径：events/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；events。
- 页面操作清点：load、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：event.list。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P49 活动详情

- 路径：events/detail/detail。前置：真实微信用户，业务页需对应绑定/参与关系；events。
- 页面操作清点：load、signup、cancelSignup、reportContent。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.report、event.cancelSignup、event.detail、event.signup、event.templates、order.detail、order.mockPay、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。 新发现：QA11 中文/标签/金额展示，已批准并完成本地修复，实景待验。
- 最新：真实珺悦身份请求示例活动detail/signup分别被E_FORBIDDEN/E_INVALID_PARAM拒绝；真实编号直达页面因本人小区活动关闭返回首页。仅记录跨区接口拒绝，不计正常详情/报名成功；同区住户和双微信验收待身份就绪。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P50 活动管理

- 路径：events/manage/manage。前置：管理员／物业／商家；events。
- 页面操作清点：load、input、typeChange、createActivity、scan、publish、showSignups、checkin、cancel、retryCancellation。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：event.adminList、event.cancelEvent、event.checkin、event.create、event.listSignups、event.publish、event.retryCancellation、event.review。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。 新发现：QA11 中文/标签/金额展示，已批准并完成本地修复，实景待验；QA13 固定默认日期，已批准并完成本地修复，实景待验。
- 实景追加：bfcf067，iPhone12/13 Pro 75%；用户导航后上半屏中文字段/元人单位/卡片已核对，三个日期请选择日期及默认时刻仅AX确认；0错误/8警告。下半屏、选择器、提交与非空流程仍待验，见qa11-13-event-live.json。
- QA26最新：管理员真实小区选择器切换示例花园、创建并发布0元/容量1活动、读取空报名及点击取消均已核对，保留珺悦绑定。页面显示已取消0/1，后台任务queued 0/0；未执行timer。QA27免费报名取消仅本地通过，旧批event已76文件云回读，timer待部署；QA29本地40项通过，实际取消卡片已隐藏签到按钮，新event修复未部署；签到成功、云并发、同区报名与多尺寸仍待验。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P51 上门喂宠

- 路径：pet/order。前置：真实微信用户，业务页需对应绑定/参与关系；pet。
- 页面操作清点：load、addressChange、removePetDate、addPetDate、change、slotChange、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P52 喂宠上门清单

- 路径：pet/work。前置：该订单已接单服务员；pet。
- 页面操作清点：load、reveal、done、missed、closeSecret。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：pet.listVisits、pet.markDone、pet.markMissed、pet.revealEntry。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P53 喂宠服务记录

- 路径：pet/reports。前置：真实微信用户，业务页需对应绑定/参与关系；pet。
- 页面操作清点：load。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：pet.listVisits。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P54 商家入驻

- 路径：merchant/apply/apply。前置：申请页为住户；工作页需已审商家；merchants。
- 页面操作清点：input、chooseCategory、upload、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.apply、merchant.myApplication。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。 新发现：QA11 中文/标签/金额展示，已批准并完成本地修复，实景待验。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P55 商家工作台

- 路径：merchant/workbench/workbench。前置：申请页为住户；工作页需已审商家；merchants。
- 页面操作清点：load、orders、services、apply。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.myApplication。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。 新发现：QA11 中文/标签/金额展示，已批准并完成本地修复，实景待验。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P56 服务管理

- 路径：merchant/services/services。前置：申请页为住户；工作页需已审商家；merchants。
- 页面操作清点：input、chooseType、photos、save。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.myServices、merchant.upsertService。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。 新发现：QA11 中文/标签/金额展示，已批准并完成本地修复，实景待验。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P57 商家预约订单

- 路径：merchant/orders/orders。前置：申请页为住户；工作页需已审商家；merchants。
- 页面操作清点：load、chooseQuote、input、quote、transition、complete。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.completeBooking、merchant.merchantOrders、merchant.merchantTransition、merchant.quoteBooking。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P58 社区商家

- 路径：shops/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；merchants。
- 页面操作清点：retryAds、openAd、recordAd、load、open。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.adEvent、content.adsForSlot、merchant.listForCommunity。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P59 商家详情

- 路径：shops/detail/detail。前置：真实微信用户，业务页需对应绑定/参与关系；merchants。
- 页面操作清点：load、book、reportContent。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.report、merchant.servicesForMerchant。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P60 提交预约

- 路径：shops/booking/booking。前置：真实微信用户，业务页需对应绑定/参与关系；merchants。
- 页面操作清点：address、input、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：merchant.createBooking、order.detail、order.mockPay、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P61 申请驿站账号

- 路径：station/apply/apply。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：load、chooseCommunity、chooseStation、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.applicationOptions、station.apply、station.myApplication。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P62 驿站工作台

- 路径：station/workbench/workbench。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：monthChange、exportStatement、load。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.exportStatement、station.listMyBatches。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P63 创建送上门批次

- 路径：station/create/create。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：change、create。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.createBatch。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P64 驿站配送任务

- 路径：station/worker/worker。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：load、accept。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.acceptBatch、station.providerHall。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P65 驿站批次

- 路径：station/batch/batch。前置：住户申请／驿站／服务员，按页面核验；stationDelivery。
- 页面操作清点：load、start、delivered、failed。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：station.checkDoorDeliveryConsent、station.providerBatch、station.recordDelivery、station.startBatch。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P66 送餐上门

- 路径：elder/meal。前置：真实微信用户，业务页需对应绑定/参与关系；elder。
- 页面操作清点：load、addressChange、change、slotChange、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P67 陪诊预约

- 路径：elder/escort。前置：真实微信用户，业务页需对应绑定/参与关系；elder。
- 页面操作清点：load、addressChange、change、retryQuote、submit。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：catalog.getCommunity、order.create、order.detail、order.mockPay、order.quote、order.subscriptionTemplates。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P68 预约上门回收

- 路径：recycle/order/order。前置：真实微信用户，业务页需对应绑定/参与关系；recycle / points。
- 页面操作清点：category、note、selectSlot、load、create。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：order.create、order.quote。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

### P69 小区公告

- 路径：notices/list/list。前置：真实微信用户，业务页需对应绑定/参与关系；notices。
- 页面操作清点：load、loadMore。逐项触发，验证文字、数据、导航及失败恢复，不把事件存在当作功能通过。
- 后端关联：content.listNotices。
- 本轮检查：静态引用通过；3组均无未捕获异常（非成功业务验收）。本轮实景UI/成功流程未验证，用户签收待完成。
- 记录：版本____ / 设备____ / 角色____ / U1–U7____ / F1–F6____ / 实际结果____ / 证据____ / 用户签收____。

## 当前必须保留的验收缺口

1. 前轮授权部署已完成；最新order/admin为02a4470，77+76=153源码一致，替代此前12函数回读中的对应版本。本轮仅前端修改，无新云函数部署；不把历史回读当作本轮云端实测。
2. 珺悦真实楼栋/单元已维护，本人手填绑定及刷新持久化已验证；四核心价格/班次/北门站点已保存回读，四项报价和五项拒绝边界已测。月卡/报酬/分成/人员等资料尚不齐备。
3. 本人住户/admin入口及管理读取已有实景记录；其他角色、跨账号/跨小区权限、真实审核发布履约结算和非空分页未完整验收。
4. QA09–QA13已批准并完成代码/规格/本地回归，实景仍待验，详见续验报告。未开通扩展仍保持原开关；各模块成功数据与平台能力测试不因源码存在而通过。
5. D05、D06继续暂缓；真实支付退款提现、门锁加解密、timer定时任务及补偿不宣称通过。
6. 定位全局开关和珺悦坐标已按此前授权配置；真机允许/拒绝、GPS远近、前台共享和停止、坐标索引一致性仍待完整实测。
7. 69页全部U1–U7/F1–F6、320/375/390/430宽度、大字体、键盘、安全区、所有状态以及用户设计签收仍未完成；四核心页局部通过不能外推全页/全设备。
8. 原40场景、15关闭回归、4真实支付场景不缩减，全部平台、配置、上线前剩余事项见[当前完整清单](../verification/2026-11-09-all-pages/README.md#当前仍未完成不遗漏原验收范围)。


## QA17–QA25逐项状态（2026-11-09）

69页均有单独状态记录；完整通过页数仍为0（以全部UI/功能标准和用户签收计）。[机器可读台账](../verification/2026-11-09-all-pages/page-status.json)为每页列出U1–U7、F1–F6，共897个判定项；“部分”不计作“通过”。当前主要390逻辑宽度，其他尺寸/键盘/大字体、真实非空数据和多角色链路仍待验。最新证据和剩余分组见[续验报告](../verification/2026-11-09-all-pages/README.md)。
