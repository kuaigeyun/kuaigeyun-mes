import React from 'react'
import { useTranslation } from 'react-i18next'
import { ProFormText } from '@ant-design/pro-components'
import { Form } from 'antd'
import { UniWarehouseSelect } from '../../../components/uni-warehouse-select'
import type { Warehouse } from '../../master-data/types/warehouse'

type ReportingInboundWarehouseFieldProps = {
  isLastOperation: boolean
  warehouseRequired: boolean
  colProps?: { span?: number }
}

/** 末道工序报工：入库仓库选择 */
export const ReportingInboundWarehouseField: React.FC<ReportingInboundWarehouseFieldProps> = ({
  isLastOperation,
  warehouseRequired,
  colProps,
}) => {
  const { t } = useTranslation()
  const form = Form.useFormInstance()

  if (!isLastOperation) return null

  return (
    <>
      <UniWarehouseSelect
        name="inbound_warehouse_id"
        label={t('apps.kuaizhizao.workOrder.quickReport.inboundWarehouse')}
        placeholder={t('app.kuaizhizao.warehouseInbound.entry.workOrder.selectWarehouse')}
        required={warehouseRequired}
        colProps={{ span: 12, ...colProps }}
        onChange={(_value: number | undefined, warehouse: Warehouse | undefined) => {
          form?.setFieldsValue({
            inbound_warehouse_name: warehouse?.name ?? undefined,
          })
        }}
      />
      <ProFormText name="inbound_warehouse_name" hidden />
    </>
  )
}

export default ReportingInboundWarehouseField
