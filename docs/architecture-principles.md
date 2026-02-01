# Architecture Principles

This document captures stable architecture principles for EventFlow.

## P1. Asset / Event 明确分离

系统中的数据必须区分为两类本质不同的对象：

- **Asset（资产 / 台账）**
  - 具有长期稳定性
  - 具备法律、管理或权威意义
  - 变更频率低，变更成本高
- **Event（事件 / 工单 / 作业 / 点检）**
  - 具有时间性与过程性
  - 发生频繁
  - 记录行政行为、委托执行与现场活动

二者在数据模型、生命周期、权限与存储策略上必须明确区分，不得混用。

### Implementation Alignment

- Asset entities (DB): parks/trees/facilities/rivers/pumps/lights (domain tables or unified asset table)
- Event entities (DB): events, inspections, work_orders
- Relation/log tables: event_asset_links, asset_change_requests, asset_versions, audit_logs
- Relationships: Events reference Assets for traceability, but Assets do not carry event workflow state
- Storage: Asset data treated as authoritative ledger; Event data treated as time-series operational records
- Database separation: Master Data DB and Event/Case DB are separate (prototype can co-locate on the same Postgres instance)
- Governance separation: Event Ops and Master Data are different gov departments with distinct roles and permissions
- Road data: read-only tiles/layers only; no Event linking and no asset edit workflow

## P2. Asset 台账以“权威发布”为核心职责

Asset 系统的主要职责是：

- 管理**权威版本（Authoritative Version）**；
- 记录版本变更历史与依据；
- 提供对内、对外的发布视图。

Asset 的更新不应被高频业务直接驱动，

而应通过明确的流程、规则与责任判断后进行。

同时，权威发布所使用的数据结构与流程

应具备以下特性：

- 可审计（Auditability）
- 可迁移（Portability）
- 可被第三方理解（Documented & Explicit）

### Implementation Alignment

- Authoritative store: PostGIS asset tables for parks/trees/facilities/rivers/pumps/lights
- Version/audit trail: asset_change_requests, asset_versions, audit_logs
- Publication views: export APIs (GeoJSON/GeoPackage) and map tiles for read-only distribution
- Portability: GeoJSON + GeoPackage import/export pipeline with versioning metadata
- Documentation: import/export + QGIS guides describe schemas and edit boundaries (roads are read-only)

## P3. 道路数据只读，GIS 为表达层

道路相关数据在本原型中明确排除在编辑与业务闭环之外，仅作为参考图层提供。

- 道路数据仅以 tiles/layers 方式展示
- Event 不可绑定道路
- GIS 是表达层，核心是台账管理 + Event/WorkOrder 流程 + 审计性

### Implementation Alignment

- Road layers served as read-only tiles; no edit endpoints or asset change workflow
- Public Portal consumes road tiles; Gov/Partner apps do not manage road assets
