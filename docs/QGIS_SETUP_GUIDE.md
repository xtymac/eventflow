# QGIS PostGIS 数据库连接指南

> 本指南帮助您通过 QGIS 连接并编辑 Nagoya Construction Lifecycle 数据库

## 目录
- [连接前准备](#1-连接前准备)
- [QGIS 连接配置](#2-qgis-连接配置)
- [表结构和权限说明](#3-表结构和权限说明)
- [编辑注意事项](#4-编辑注意事项)
- [故障排除](#5-故障排除)

---

## 1. 连接前准备

### 访问权限

数据库连接仅对授权用户开放。如果您无法连接，请联系管理员确认您的访问权限。

### 连接信息

管理员会提供以下信息：
- 服务器 IP 地址
- 数据库端口
- 用户名
- 密码

---

## 2. QGIS 连接配置

### 创建新的 PostGIS 连接

1. 打开 QGIS
2. 菜单栏：**图层** → **添加图层** → **添加 PostGIS 图层**
3. 点击 **新建** 按钮，填写以下信息：

| 字段 | 值 |
|------|-----|
| Name | Nagoya Construction DB |
| Host | 18.177.72.233 |
| Port | 5433 |
| Database | nagoya_construction |
| SSL mode | prefer |
| Authentication | Basic |
| Username | nagoya_editor |
| Password | [管理员提供的密码] |

4. 点击 **测试连接** → 应该显示"连接成功"
5. 点击 **确定** 保存连接

### 添加图层

1. 在 PostGIS 连接列表中，选择 **Nagoya Construction DB**
2. 点击 **连接**
3. 勾选以下表作为图层：
   - **construction_events** （施工事件）
   - **road_assets** （道路资产）
   - **inspection_records** （检查记录）
4. 以下表仅供参考（只读）：
   - **event_road_assets** （事件-道路关联）
   - **road_asset_changes** （道路资产变更历史）
   - **osm_sync_logs** （OSM 同步日志）
5. 点击 **添加** 加载图层

---

## 3. 表结构和权限说明

### construction_events (施工事件)

**权限**：SELECT（查询）、UPDATE（更新）、INSERT（禁止新增）

**重要限制**：您只能更新现有事件的信息，**不能创建新事件**。创建事件需通过 Web 界面或 API。

#### ID 生成
- **格式**：`CE-XXXXXXXX`（如：CE-a1B2c3D4）
- **自动生成**：数据库触发器自动生成，无需手动填写

#### 必填字段（NOT NULL）

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `name` | VARCHAR(255) | 事件名称 | "名古屋駅前工事" |
| `status` | VARCHAR(20) | 状态 | 'planned'（默认值） |
| `start_date` | TIMESTAMP | 开始日期 | 2026-01-10 09:00:00+09 |
| `end_date` | TIMESTAMP | 结束日期 | 2026-01-20 18:00:00+09 |
| `restriction_type` | VARCHAR(50) | 限制类型 | 'closure', 'lane_reduction', 'detour' |
| `geometry` | Geometry | 几何形状 | LineString 或 Polygon（SRID 4326） |
| `department` | VARCHAR(100) | 负责部门 | "道路管理部" |

#### 可选字段

| 字段名 | 类型 | 说明 | 默认值 |
|--------|------|------|--------|
| `geometry_source` | VARCHAR(20) | 几何来源 | 'manual' |
| `ward` | VARCHAR(100) | 行政区 | NULL |
| `created_by` | VARCHAR(100) | 创建人 | NULL |

#### restriction_type 参考值
- `closure` - 完全封闭
- `lane_reduction` - 车道减少
- `detour` - 绕行
- `partial_closure` - 部分封闭

#### QGIS 主键配置

**必须设置主键**：
1. 右键点击图层 → **属性**
2. **字段** 选项卡
3. 勾选 `id` 字段为主键
4. 点击 **确定**

---

### road_assets (道路资产)

**权限**：SELECT、INSERT、UPDATE

**说明**：完全编辑权限。可以创建新道路资产和修改现有资产。

#### ID 生成
- **格式**：`RA-XXXXXXXX`（如：RA-x9Y8z7W6）
- **自动生成**：新增时留空 id 字段即可

#### 必填字段（NOT NULL）

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `geometry` | Geometry | 道路线形 | LineString（SRID 4326） |
| `road_type` | VARCHAR(50) | 道路类型 | 'primary', 'secondary', 'residential' |
| `lanes` | INTEGER | 车道数 | 2（默认值） |
| `direction` | VARCHAR(50) | 行驶方向 | 'both', 'forward', 'backward' |
| `status` | VARCHAR(20) | 状态 | 'active'（默认值） |
| `valid_from` | TIMESTAMP | 有效起始时间 | 2026-01-01 00:00:00+09 |

#### 推荐字段（强烈建议填写）

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `name` | VARCHAR(255) | 道路名称 | "広小路通" |
| `name_ja` | VARCHAR(255) | 日文名称 | "広小路通" |
| `ref` | VARCHAR(100) | 路线编号 | "国道23号" |
| `ward` | VARCHAR(100) | 行政区 | "中区" |
| `owner_department` | VARCHAR(100) | 所属部门 | "中区土木事務所" |

#### 自动设置字段（触发器）

以下字段会被数据库触发器自动设置，**无需手动填写**：
- `is_manually_edited` → 自动设为 `TRUE`
- `sync_source` → 自动设为 `'manual'`

#### road_type 参考值
- `motorway` - 高速公路
- `primary` - 主干道（国道）
- `secondary` - 次干道（県道）
- `tertiary` - 三级道路（市道）
- `residential` - 住宅区道路
- `service` - 服务道路

#### direction 参考值
- `both` - 双向（最常用）
- `forward` - 正向单行
- `backward` - 反向单行

#### QGIS 主键配置

**必须设置主键**：
1. 右键点击图层 → **属性**
2. **字段** 选项卡
3. 勾选 `id` 字段为主键
4. 点击 **确定**

---

### inspection_records (检查记录)

**权限**：SELECT、INSERT、UPDATE（历史记录不可修改）

**说明**：只能添加新的检查记录，不能修改已有记录（审计追踪）。

#### ID 生成
- **格式**：`INS-XXXXXXXX`（如：INS-m5N4o3P2）
- **自动生成**：新增时留空 id 字段即可

#### 必填字段（NOT NULL）

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `inspection_date` | DATE | 检查日期 | 2026-01-08 |
| `result` | VARCHAR(100) | 检查结果 | "良好", "需要修复", "紧急" |
| `geometry` | Geometry | 检查位置 | Point（SRID 4326） |

#### 关联字段（二选一必填）

**重要约束**：`event_id` 和 `road_asset_id` **有且仅有一个**不为空。

| 字段名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `event_id` | VARCHAR(50) | 关联施工事件 ID | "CE-a1B2c3D4" |
| `road_asset_id` | VARCHAR(50) | 关联道路资产 ID | "RA-x9Y8z7W6" |

**如何选择**：
- 如果检查与某个施工事件相关 → 填写 `event_id`，`road_asset_id` 留空
- 如果检查与某个道路资产相关 → 填写 `road_asset_id`，`event_id` 留空

#### 可选字段

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `notes` | TEXT | 详细备注 |

#### QGIS 主键配置

**必须设置主键**：
1. 右键点击图层 → **属性**
2. **字段** 选项卡
3. 勾选 `id` 字段为主键
4. 点击 **确定**

---

### event_road_assets (事件-道路关联) - 只读

**权限**：SELECT（仅查询）

**说明**：多对多关系表，记录施工事件影响的道路资产。使用复合主键（event_id, road_asset_id），QGIS 难以编辑。此表应由 Web 界面或 API 维护。

**用途**：查看某个施工事件影响了哪些道路资产。

---

### road_asset_changes (道路资产变更历史) - 只读

**权限**：SELECT（仅查询）

**说明**：审计表，记录道路资产的变更历史。应由 API 或触发器自动维护，不允许手动修改。

**用途**：追溯道路资产的历史变更记录。

---

### osm_sync_logs (OSM 同步日志) - 只读

**权限**：SELECT（仅查询）

**说明**：记录从 OpenStreetMap 同步道路数据的操作日志。

**用途**：查看 OSM 数据同步的历史和状态。

---

## 4. 编辑注意事项

### 操作前检查清单

在开始编辑前，请确认：

- [ ] QGIS 连接测试成功
- [ ] 已为每个可编辑表设置主键为 `id` 字段
- [ ] QGIS 项目坐标系设为 **EPSG:4326**（WGS 84）

### 关键注意事项

#### 1. 主键配置

**每个可编辑表都必须在 QGIS 中设置 `id` 为主键**，否则无法保存编辑。

**操作步骤**：
1. 右键点击图层 → **属性**
2. **字段** 选项卡
3. 勾选 `id` 字段为主键
4. 点击 **确定**

#### 2. 坐标系（SRID）

**所有几何字段必须为 EPSG:4326（WGS 84）**

- 创建新要素前，确认 QGIS 项目坐标系为 EPSG:4326
- 如果导入其他坐标系的数据，请先转换坐标系

#### 3. ID 自动生成

- **新增要素时**：**留空 id 字段**，触发器会自动生成
- **手动指定 ID**（不推荐）：如需指定，请遵循格式：
  - construction_events: `CE-` + 8位字母数字
  - road_assets: `RA-` + 8位字母数字
  - inspection_records: `INS-` + 8位字母数字

#### 4. 删除限制

您的账户**无删除权限**。如需删除记录，请联系系统管理员。

#### 5. 新增事件限制

**不能直接在 QGIS 中创建施工事件**（construction_events 无 INSERT 权限）。

创建新事件请使用：
- Web 界面
- API

原因：创建事件涉及复杂的关联逻辑（event_road_assets 关系表维护）。

#### 6. 必填字段检查

新增记录前，请确保填写所有必填字段（NOT NULL）。如果遗漏，数据库会返回错误。

---

## 5. 故障排除

### 连接失败："无法连接到服务器"

**可能原因**：
1. 网络连接问题
2. 密码错误
3. 访问权限未开通

**解决方法**：
1. 检查网络连接
2. 确认密码正确
3. 联系管理员确认访问权限

---

### 保存失败："权限不足"

**可能原因**：
1. 尝试新增 construction_events 记录（无 INSERT 权限）
2. 尝试修改 inspection_records 记录（无 UPDATE 权限）
3. 尝试删除记录（所有表均无 DELETE 权限）

**解决方法**：
- 检查表权限（见上方权限表）
- construction_events：只能更新现有记录
- inspection_records：只能新增，不能修改
- 如需删除，请联系管理员

---

### 保存失败："违反 NOT NULL 约束"

**可能原因**：遗漏必填字段

**解决方法**：
1. 查看错误消息，确认缺失字段名称
2. 参考上方表结构说明，填写所有必填字段
3. 重新保存

---

### 保存失败："CHECK 约束 chk_inspection_one_parent 失败"

**错误说明**：inspection_records 的 `event_id` 和 `road_asset_id` 必须有且仅有一个不为空。

**解决方法**：
- 如果两个都为空 → 填写其中一个
- 如果两个都不为空 → 清空其中一个

---

### 几何无效："无效的几何对象"

**可能原因**：
1. 坐标系不是 EPSG:4326
2. 几何拓扑错误（自相交、重复点等）

**解决方法**：
```
1. 确保 QGIS 项目坐标系为 EPSG:4326
2. 菜单栏：向量 → 几何工具 → 修复几何
3. 使用修复后的图层保存到数据库
```

---

### ID 冲突："重复的主键"

**可能原因**：手动指定了已存在的 ID

**解决方法**：
- **推荐**：新增时留空 id 字段，让触发器自动生成
- 如果必须手动指定 ID，请确保：
  - 格式正确（CE-/RA-/INS- + 8位字母数字）
  - ID 在数据库中不存在

---

## 联系支持

如遇到本指南未涵盖的问题，请联系：

- **系统管理员**：[管理员联系方式]
- **技术支持**：[支持邮箱/电话]

---

## 附录：常见字段值速查表

### construction_events.restriction_type
| 值 | 中文 | 英文 |
|----|------|------|
| `closure` | 完全封闭 | Full Closure |
| `lane_reduction` | 车道减少 | Lane Reduction |
| `detour` | 绕行 | Detour |
| `partial_closure` | 部分封闭 | Partial Closure |

### road_assets.road_type
| 值 | 中文 | 英文 |
|----|------|------|
| `motorway` | 高速公路 | Motorway |
| `primary` | 主干道（国道） | Primary Road |
| `secondary` | 次干道（県道） | Secondary Road |
| `tertiary` | 三级道路（市道） | Tertiary Road |
| `residential` | 住宅区道路 | Residential |
| `service` | 服务道路 | Service Road |

### road_assets.direction
| 值 | 中文 | 英文 |
|----|------|------|
| `both` | 双向 | Bidirectional |
| `forward` | 正向单行 | Forward One-way |
| `backward` | 反向单行 | Backward One-way |

---

**文档版本**：2.0（直连版）
**最后更新**：2026-01-08
**适用 QGIS 版本**：3.28+
