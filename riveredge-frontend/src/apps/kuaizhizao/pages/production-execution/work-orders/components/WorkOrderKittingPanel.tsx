/**
 * 工单齐套分析（独立 chunk，含表格与叫料逻辑）
 */
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { App, Button, Card, Empty, Progress, Space, Spin, Table, Tag } from 'antd'
import { ShoppingOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { workOrderApi } from '../../../../services/production'
import { warehouseApi } from '../../../../services/warehouse-execution'

const WorkOrderKittingPanel: React.FC<{ workOrderId?: number }> = ({ workOrderId }) => {
  const { t } = useTranslation()
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
      messageApi.success(
        t('app.kuaizhizao.workOrder.msgMaterialCallCreatedFor', { name: record.material_name })
      )
    } catch (error: any) {
      messageApi.error(error.message || t('app.kuaizhizao.workOrder.msgCallFailed'))
    } finally {
      setCalling(prev => ({ ...prev, [record.material_id]: false }))
    }
  }

  const columns = useMemo(
    () => [
      {
        title: t('app.kuaizhizao.workOrder.colMaterialInfo'),
        key: 'material',
        render: (_: any, record: any) => (
          <div>
            <div style={{ fontWeight: 'bold' }}>{record.material_name}</div>
            <div style={{ fontSize: '11px', color: '#999' }}>{record.material_code}</div>
          </div>
        ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colRequiredPicked'),
        key: 'qty',
        render: (_: any, record: any) => (
          <span>
            {record.required_quantity} / {record.picked_quantity}
          </span>
        ),
      },
      {
        title: t('app.kuaizhizao.workOrder.colMainWarehouseAvail'),
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
        title: t('app.kuaizhizao.workOrder.colLineSideStatus'),
        key: 'side_status',
        render: (_: any, record: any) => {
          const shortage = record.required_quantity - record.picked_quantity
          const totalAvailable = (record.warehouse_available || 0) + (record.line_side_inventory || 0)
          const isReady = totalAvailable >= shortage
          return (
            <Space>
              <span style={{ color: '#888' }}>{record.line_side_inventory}</span>
              <Tag color={isReady ? 'success' : 'error'}>
                {isReady ? t('app.kuaizhizao.workOrder.tagKitted') : t('app.kuaizhizao.workOrder.tagShortage')}
              </Tag>
            </Space>
          )
        },
      },
      {
        title: t('app.kuaizhizao.workOrder.colQuickCall'),
        key: 'action',
        width: 100,
        render: (_: any, record: any) => {
          const shortage = record.required_quantity - record.picked_quantity
          if (shortage <= 0) {
            return <Tag color="default">{t('app.kuaizhizao.workOrder.tagNoPickingNeeded')}</Tag>
          }
          return (
            <Button
              type="primary"
              size="small"
              ghost
              loading={calling[record.material_id]}
              onClick={() => handleCreateCall(record)}
            >
              {t('app.kuaizhizao.workOrder.actionCallMaterial')}
            </Button>
          )
        },
      },
    ],
    [t, calling]
  )

  if (isLoading)
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <Spin tip={t('app.kuaizhizao.workOrder.msgComputingKitting')}>
          <div style={{ minHeight: 24 }} />
        </Spin>
      </div>
    )
  if (!kittingData) return <Empty description={t('app.kuaizhizao.workOrder.msgNoKittingData')} />

  return (
    <Card
      size="small"
      title={
        <Space>
          <ShoppingOutlined />
          <span>{t('app.kuaizhizao.workOrder.msgKittingAnalysis')}</span>
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
          {t('app.kuaizhizao.workOrder.actionReanalyze')}
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
