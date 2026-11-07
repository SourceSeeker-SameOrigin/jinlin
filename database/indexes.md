# 核心与扩展集合索引

在开发环境的云开发控制台进入「数据库」，逐个选择下表集合，在「索引管理」中添加索引。字段顺序按表填写；未注明倒序的均为升序。索引名称可直接使用表中名称。每个唯一索引创建后确认状态可用，再启动对应写接口。

| 集合 | 索引名称 | 字段顺序 | 唯一 |
| --- | --- | --- | --- |
| users | openid_unique | openid 升序 | 是 |
| orders | orderNo_unique | orderNo 升序 | 是 |
| orders | community_status_created | communityId 升序、status 升序、createdAt 倒序 | 否 |
| orders | user_created | userOpenid 升序、createdAt 倒序 | 否 |
| orders | provider_status | providerOpenid 升序、status 升序 | 否 |
| providers | openid_unique | openid 升序 | 是 |
| providers | community_status_duty | communityId 升序、status 升序、onDuty 升序 | 否 |
| providers | referralCode_unique | referralCode 升序 | 是 |
| buildings | shortCode_unique | shortCode 升序 | 是 |
| buildings | community | communityId 升序 | 否 |
| memberships | user_status | userOpenid 升序、status 升序 | 否 |
| memberships | community_plan_status_end | communityId 升序、planCode 升序、status 升序、endAt 升序 | 否 |
| ledger | community_created | communityId 升序、createdAt 升序 | 否 |
| ledger | provider_settled | providerId 升序、settled.provider 升序 | 否 |
| settlements | community_created | communityId 升序、createdAt 倒序 | 否 |
| settlements | provider_period | providerId 升序、period.from 升序、period.to 升序 | 否 |
| reports | status_created | status 升序、createdAt 倒序 | 否 |
| reports | target_created | targetType 升序、targetId 升序、createdAt 倒序 | 否 |
| mediaChecks | status_created | status 升序、createdAt 升序 | 否 |
| conversations | member_lastAt | members 升序、lastAt 倒序 | 否 |
| conversations | type_closeAt | type 升序、closedAt 升序、closeAt 升序 | 否 |
| messages | conversation_id | convId 升序、_id 升序 | 否 |
| posts | feed | communityId 升序、scope 升序、type 升序、status 升序、expireAt 升序、createdAt 倒序 | 否 |
| posts | type_status_expireAt | type 升序、status 升序、expireAt 升序 | 否 |
| comments | post_status_created | postId 升序、status 升序、createdAt 升序 | 否 |

默认 `_id` 索引由数据库提供，无需重复创建。创建唯一索引失败时先检查重复数据；不要删除现有业务记录来强行通过。验收时逐项核对索引字段、顺序及唯一属性。
