# QGIS PostGIS 数据库连接指南

> 本指南帮助您通过 QGIS 连接并查看（只读）Nagoya Construction Lifecycle 数据库

## 目录
- [范围更新（2026-01-28）](#范围更新2026-01-28)
- [连接前准备](#1-连接前准备)
- [QGIS 连接配置](#2-qgis-连接配置)
- [表结构和权限说明](#3-表结构和权限说明)
- [只读使用注意事项](#4-只读使用注意事项)
- [Legacy：实时地图同步（道路编辑）](#5-legacy实时地图同步道路编辑)
- [故障排除](#6-故障排除)

---

## 范围更新（2026-01-28）

根据最新 Prototype Architecture & Scope（1/28），本系统对道路数据采取只读策略：

- 道路资产仅作为 tiles/layers 显示，**不允许编辑**。
- Event 不可直接绑定道路资产。
- QGIS 仅用于**查看与验证**，不用于维护台账或编辑道路资产。

本指南中涉及编辑的内容仅用于理解既有结构，**不作为当前 prototype 的操作流程**。

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
3. 勾选以下表作为图层（只读）：
   - **construction_events** （施工事件）
   - **road_assets** （道路资产，read-only）
   - **inspection_records** （检查记录）
4. 以下表仅供参考（只读）：
   - **event_road_assets** （事件-道路关联）
   - **road_asset_changes** （道路资产变更历史）
   - **osm_sync_logs** （OSM 同步日志）
   - **river_assets** （河流资产 - OSM 同步）
   - **greenspace_assets** （绿地资产 - OSM 同步）
   - **streetlight_assets** （路灯资产 - OSM 同步）
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

**权限**：SELECT（只读，prototype 范围）

**说明**：在 prototype 中道路资产为只读图层，不允许在 QGIS 中编辑。以下字段说明仅用于理解既有结构（legacy 道路编辑流程已停用）。

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

### river_assets (河流资产) - 只读

**权限**：SELECT（仅查询）

**说明**：从 OpenStreetMap 同步的河流和水道数据。此表为只读，不支持 QGIS 编辑。

**几何类型**：LineString（河流中心线）或 Polygon（水体面）

**数据来源**：OpenStreetMap 自动同步

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(50) | 主键，格式 RV-XXXXXXXX |
| `name` | VARCHAR(255) | 河流名称 |
| `name_ja` | VARCHAR(255) | 日文名称 |
| `display_name` | VARCHAR(255) | 显示名称（自动计算） |
| `geometry` | Geometry | 几何形状（SRID 4326） |
| `geometry_type` | VARCHAR(20) | 几何类型：'line'、'polygon'、'collection' |
| `waterway_type` | VARCHAR(50) | 水道类型：river、stream、canal、drain |
| `water_type` | VARCHAR(50) | 水体类型：river、pond、lake |
| `width` | INTEGER | 宽度（米） |
| `management_level` | VARCHAR(50) | 管理级别：national、prefectural、municipal |
| `ward` | VARCHAR(100) | 所属行政区 |
| `status` | VARCHAR(20) | 数据状态：active、inactive |

**用途**：查看名古屋市内的河流和水道分布。

---

### greenspace_assets (绿地资产) - 只读

**权限**：SELECT（仅查询）

**说明**：从 OpenStreetMap 同步的公园、绿地数据。此表为只读，不支持 QGIS 编辑。

**几何类型**：Polygon

**数据来源**：OpenStreetMap 自动同步

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(50) | 主键，格式 GS-XXXXXXXX |
| `name` | VARCHAR(255) | 绿地名称 |
| `name_ja` | VARCHAR(255) | 日文名称 |
| `display_name` | VARCHAR(255) | 显示名称（自动计算） |
| `geometry` | Polygon | 几何形状（SRID 4326） |
| `green_space_type` | VARCHAR(50) | 绿地类型：park、garden、grass、forest、meadow、playground |
| `leisure_type` | VARCHAR(50) | OSM leisure 标签 |
| `landuse_type` | VARCHAR(50) | OSM landuse 标签 |
| `natural_type` | VARCHAR(50) | OSM natural 标签 |
| `area_m2` | INTEGER | 面积（平方米） |
| `operator` | VARCHAR(255) | 运营组织 |
| `ward` | VARCHAR(100) | 所属行政区 |
| `status` | VARCHAR(20) | 数据状态：active、inactive |

**用途**：查看名古屋市内的公园和绿地分布。

---

### streetlight_assets (路灯资产) - 只读

**权限**：SELECT（仅查询）

**说明**：从 OpenStreetMap 同步的路灯数据。此表为只读，不支持 QGIS 编辑。

**几何类型**：Point

**数据来源**：OpenStreetMap 自动同步

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `id` | VARCHAR(50) | 主键，格式 SL-XXXXXXXX |
| `lamp_id` | VARCHAR(50) | 物理灯具编号 |
| `display_name` | VARCHAR(255) | 显示名称 |
| `geometry` | Point | 位置坐标（SRID 4326） |
| `lamp_type` | VARCHAR(50) | 灯具类型：led、sodium、mercury、fluorescent、halogen |
| `wattage` | INTEGER | 功率（瓦） |
| `install_date` | DATE | 安装日期 |
| `lamp_status` | VARCHAR(50) | 设备状态：operational、maintenance、damaged、replaced |
| `road_ref` | VARCHAR(50) | 关联道路 ID |
| `ward` | VARCHAR(100) | 所属行政区 |
| `status` | VARCHAR(20) | 数据状态：active、inactive |

**注意**：`status` 和 `lamp_status` 含义不同：
- `status`：数据生命周期状态（active = 有效数据）
- `lamp_status`：设备运行状态（operational = 正常工作）

**用途**：查看名古屋市内的路灯分布和状态。

---

## 4. 只读使用注意事项

### 基本原则

- 所有图层在 prototype 范围内均为只读，请勿开启编辑模式。
- QGIS 用于查看与验证空间分布、字段内容和数据质量。
- 资产更新必须通过系统流程（AssetChangeRequest -> Draft -> Review -> Publish），不通过 QGIS。

### 建议用途

- 对照地图与台账字段，进行核对与抽查。
- 导出截图或可视化结果用于沟通说明。
- 作为参考图层进行空间理解（不产生编辑结果）。

---

## 5. Legacy：实时地图同步（道路编辑）

该功能描述了历史版本中的道路编辑同步流程。根据 2026-01-28 的 prototype 范围，**道路编辑已被排除**，本节仅保留作为技术背景参考。

如需了解历史机制，请参考 [REALTIME_MAP_SYNC.md](./REALTIME_MAP_SYNC.md)。

---

## 6. 故障排除

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

**文档版本**：4.0（多资产类型支持）
**最后更新**：2026-01-11
**适用 QGIS 版本**：3.28+
