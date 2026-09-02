import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Modal } from 'antd';
import { ProForm, type ProFormInstance } from '@ant-design/pro-components';
import { UniWarehouseSelect } from '../../../../../components/uni-warehouse-select';
import { warehouseApi } from '../../../services/warehouse-execution';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';

type WorkOrderBatchPickingModalProps = {
  open: boolean;
  workOrderIds: number[];
  onClose: () => void;
  onSuccess: (createdCount: number) => void;
};

type BatchPickingFormValues = {
  warehouse_id?: number;
};

export function WorkOrderBatchPickingModal({
  open,
  workOrderIds,
  onClose,
  onSuccess,
}: WorkOrderBatchPickingModalProps) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const formRef = useRef<ProFormInstance<BatchPickingFormValues>>(null);
  const [submitting, setSubmitting] = useState(false);
  const [warehouseName, setWarehouseName] = useState<string | undefined>();

  const handleOk = async () => {
    if (!workOrderIds.length) {
      messageApi.warning(t('app.kuaizhizao.workOrder.batchPicking.selectWorkOrdersFirst'));
      return;
    }
    let values: BatchPickingFormValues;
    try {
      values = await formRef.current!.validateFields();
    } catch {
      return;
    }
    const warehouseId = Number(values.warehouse_id);
    if (!Number.isFinite(warehouseId) || warehouseId <= 0) {
      messageApi.warning(t('app.kuaizhizao.workOrder.batchPicking.warehouseRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const created = await warehouseApi.productionPicking.batchPick({
        work_order_ids: workOrderIds,
        warehouse_id: warehouseId,
        warehouse_name: warehouseName,
      });
      const createdCount = Array.isArray(created) ? created.length : 0;
      if (createdCount <= 0) {
        messageApi.warning(t('app.kuaizhizao.workOrder.batchPicking.noneCreated'));
        return;
      }
      if (createdCount < workOrderIds.length) {
        messageApi.warning(
          t('app.kuaizhizao.workOrder.batchPicking.partialSuccess', {
            created: createdCount,
            total: workOrderIds.length,
          }),
        );
      } else {
        messageApi.success(
          t('app.kuaizhizao.warehouseOutbound.msg.batchPickingSuccess', { count: createdCount }),
        );
      }
      formRef.current?.resetFields();
      setWarehouseName(undefined);
      onSuccess(createdCount);
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('app.kuaizhizao.workOrder.batchPicking.failed')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (submitting) return;
    formRef.current?.resetFields();
    setWarehouseName(undefined);
    onClose();
  };

  return (
    <Modal
      title={t('app.kuaizhizao.workOrder.batchPicking.title')}
      open={open}
      onOk={() => void handleOk()}
      onCancel={handleCancel}
      confirmLoading={submitting}
      destroyOnHidden
      okText={t('app.kuaizhizao.workOrder.batchPicking.confirm')}
      cancelText={t('common.cancel')}
    >
      <p style={{ marginBottom: 16 }}>
        {t('app.kuaizhizao.workOrder.batchPicking.summary', { count: workOrderIds.length })}
      </p>
      <ProForm<BatchPickingFormValues>
        formRef={formRef}
        submitter={false}
        layout="vertical"
      >
        <UniWarehouseSelect
          name="warehouse_id"
          label={t('app.kuaizhizao.warehouseOutbound.field.warehouse')}
          placeholder={t('app.kuaizhizao.warehouseOutbound.field.selectWarehouse')}
          required
          onChange={(_value, warehouse) => {
            setWarehouseName(warehouse?.name);
          }}
        />
      </ProForm>
    </Modal>
  );
}
