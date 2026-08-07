# 快数采第三方组件合规说明

## InfluxDB 2.x OSS

- **用途**：快数采点位短窗历史（高频时序写入）
- **许可**：MIT（InfluxDB 2.x 开源版）
- **部署方式**：客户或实施方 **自建 OSS 实例**；RiverEdge 通过 HTTP API 读写
- **禁止**：将 InfluxDB Cloud / Enterprise 作为平台默认内置后端；不得 repackage 为独立 TSDB 产品转售

## influxdb-client（Python）

- **用途**：后端写入/查询 InfluxDB
- **许可**：MIT
- **仓库**：https://github.com/influxdata/influxdb-client-python

## aiomqtt（Python）

- **用途**：Taskiq Worker 订阅客户已有 MQTT Broker
- **许可**：BSD 3-Clause（与 MIT 同属宽松许可）
- **说明**：MQTT 为可选连接源，不进开源默认部署栈

## 租户配置

在 **系统 - 数据源** 创建集成：

| 字段 | 值 |
|------|-----|
| type | `influxdb` |
| code | `kuaiiot_tsdb` |
| config.url | InfluxDB 2.x 地址，如 `http://127.0.0.1:8086` |
| config.org | 组织名 |
| config.bucket | Bucket 名（建议 retention 7 天） |
| config.token | API Token |

未配置 InfluxDB 时：HTTP ingest 仍可写 PG 快照与 MES 设备态；历史 API 返回空列表并提示配置。

## 不推荐组件

| 组件 | 原因 |
|------|------|
| TDengine OSS | AGPL-3.0，Pro 商用嵌入风险高 |
| InfluxDB Cloud | 商业 ToS，需客户单独签约 |
