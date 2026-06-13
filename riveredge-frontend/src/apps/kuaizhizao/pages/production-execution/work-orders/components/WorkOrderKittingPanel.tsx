/**
 * 工单齐套分析（独立 chunk，含表格与叫料逻辑）
 */
import React, { useState } from 'react'
import { App, Button, Card, Empty, Progress, Space, Spin, Table, Tag } from 'antd'
import { ShoppingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { workOrderApi } from '../../../../services/production'
import { warehouseApi } from '../../../../services/warehouse-execution'
const WorkOrderKittingPanel: React.FC<{ workOrderId?: number }> = ({ workOrderId }) => {
  const { message: messageApi } = App.useApp()
  const { data: kittingData, isLoading, refetch } = useQuery({
    queryKey: ['workOrderKittingAnalysis', workOrderId],
    queryFn: () => workOrderApi.getKittingAnalysis(workOrderId!.toString()),
    enabled: !!workOrderId,
    staleTime: 0,
  })

  const [calling, setCalling] = useState<Record<number, boolean>>({})

  const handleCreateCall = async (record: any) => {
    try {
      setCalling(prev => ({ ...prev, [record.material_id]: true }))
      const shortage = record.required_quantity - record.picked_quantity
      await warehouseApi.materialCall.create({
        work_order_id: workOrderId,
        work_order_code: String(kittingData?.work_order_code ?? ''),
        call_type: 'CUSTOM_SELECTION',
        call_reason: 'LINE_SIDE_SHORTAGE',
        priority: 'normal',
        remarks: '生产现场通过齐套分析发起叫料',
        items: [
          {
            material_id: record.material_id,
            material_code: String(record.material_code ?? ''),
            material_name: String(record.material_name ?? ''),
            material_unit: record.material_unit != null ? String(record.material_unit) : undefined,
            requested_quantity: shortage > 0 ? shortage : 0,
          },
        ],
      })
      messageApi.success(`已为物料 ${record.material_name} 发起叫料请求`)
    } catch (error: any) {
      messageApi.error(error.message || '发起叫料失败')
    } finally {
      setCalling(prev => ({ ...prev, [record.material_id]: false }))
    }
  }

  if (isLoading)
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <Spin tip="计算齐套性中..." />
      </div>
    )
  if (!kittingData) return <Empty description="暂无齐套数据" />

  const columns = [
    {
      title: '物料信息',
      key: 'material',
      render: (_: any, record: any) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{record.material_name}</div>
          <div style={{ fontSize: '11px', color: '#999' }}>{record.material_code}</div>
        </div>
      ),
    },
    {
      title: '需求/已领',
      key: 'qty',
      render: (_: any, record: any) => (
        <span>
          {record.required_quantity} / {record.picked_quantity}
        </span>
      ),
    },
    {
      title: '主仓可用',
      dataIndex: 'warehouse_available',
      key: 'warehouse_available',
      render: (val: number, record: any) => {
        const shortage = record.required_quantity - record.picked_quantity
        const isNotEnough = val < shortage
        return (
          <span
            style={{
              color: isNotEnough ? '#ff4d4f' : '#52c41a',
              fontWeight: isNotEnough ? 'bold' : 'normal',
            }}
          >
            {val}
          </span>
        )
      },
    },
    {
      title: '线边/状态',
      key: 'side_status',
      render: (_: any, record: any) => {
        const shortage = record.required_quantity - record.picked_quantity
        const totalAvailable = (record.warehouse_available || 0) + (record.line_side_inventory || 0)
        const isReady = totalAvailable >= shortage
        return (
          <Space>
            <span style={{ color: '#888' }}>{record.line_side_inventory}</span>
            <Tag color={isReady ? 'success' : 'error'}>{isReady ? '已齐套' : '欠料'}</Tag>
          </Space>
        )
      },
    },
    {
      title: '快速叫料',
      key: 'action',
      width: 100,
      render: (_: any, record: any) => {
        const shortage = record.required_quantity - record.picked_quantity
        if (shortage <= 0) return <Tag color="default">无需领料</Tag>
        return (
          <Button
            type="primary"
            size="small"
            ghost
            loading={calling[record.material_id]}
            onClick={() => handleCreateCall(record)}
          >
            叫料
          </Button>
        )
      },
    },
  ]

  return (
    <Card
      size="small"
      title={
        <Space>
          <ShoppingOutlined />
          <span>齐套分析</span>
          <Progress
            type="circle"
            percent={Math.round((kittingData.kitting_rate || 0) * 100)}
            size={24}
            strokeColor={kittingData.kitting_rate === 1 ? '#52c41a' : '#faad14'}
          />
        </Space>
      }
      extra={
        <Button type="link" size="small" onClick={() => refetch()}>
          重新分析
        </Button>
      }
      styles={{ body: { padding: 0 } }}
    >
      <Table
        dataSource={kittingData.items}
        columns={columns as any}
        pagination={false}
        size="small"
        rowKey="material_id"
        style={{ margin: 0 }}
      />
    </Card>
  )
}

export default WorkOrderKittingPanel
