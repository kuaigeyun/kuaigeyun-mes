import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, App, Modal, Select } from 'antd';
import { warehouseApi } from '../../../../master-data/services/warehouse';
import type { Warehouse } from '../../../../master-data/types/warehouse';
import { batchingOrderApi } from '../../../services/batching-order';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';

export type BatchingPullFromWorkOrderPayload = {
  work_order_id: number;
  allow_existing_draft?: boolean;
  warehouse_id?: number;
  warehouse_name?: string;
  target_warehouse_id?: number;
  target_warehouse_name?: string;
  batching_date?: string;
  remarks?: string;
  attachments?: unknown;
};

export function isLineSideWarehouseNotFoundError(error: unknown): boolean {
  const msg = getApiErrorMessage(error, '');
  if (msg.includes('未找到线边仓')) return true;
  const details = (error as { response?: { data?: { error?: { details?: { reason?: string } } } } })
    ?.response?.data?.error?.details;
  return details?.reason === 'line_side_warehouse_not_found';
}

type Options = {
  onSuccess?: () => void | Promise<void>;
  successMessageKey?: string;
};

export function useBatchingPullFromWorkOrder(options: Options = {}) {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const successMessageKey =
    options.successMessageKey ?? 'app.kuaizhizao.batchingCenter.generateBatchingSuccess';

  const [modalOpen, setModalOpen] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<BatchingPullFromWorkOrderPayload | null>(null);
  const [warehouseId, setWarehouseId] = useState<number | undefined>();
  const [warehouseName, setWarehouseName] = useState('');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAllWarehousesHint, setShowAllWarehousesHint] = useState(false);

  const loadWarehouses = useCallback(async () => {
    setLoadingWarehouses(true);
    try {
      const lineSideRes = await warehouseApi.list({
        warehouse_type: 'line_side',
        is_active: true,
        limit: 200,
      });
      const lineSideItems = lineSideRes.items ?? [];
      if (lineSideItems.length > 0) {
        setWarehouses(lineSideItems);
        setShowAllWarehousesHint(false);
        return;
      }
      const allRes = await warehouseApi.list({ is_active: true, limit: 200 });
      setWarehouses(allRes.items ?? []);
      setShowAllWarehousesHint(true);
    } catch (error: unknown) {
      messageApi.error(getApiErrorMessage(error, t('common.loadFailed')));
      setWarehouses([]);
      setShowAllWarehousesHint(false);
    } finally {
      setLoadingWarehouses(false);
    }
  }, [messageApi, t]);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setPendingPayload(null);
    setWarehouseId(undefined);
    setWarehouseName('');
    setShowAllWarehousesHint(false);
  }, []);

  const executePull = useCallback(
    async (payload: BatchingPullFromWorkOrderPayload) => {
      await batchingOrderApi.pullFromWorkOrder(payload);
      messageApi.success(t(successMessageKey));
      await options.onSuccess?.();
    },
    [messageApi, options, successMessageKey, t],
  );

  const pullFromWorkOrder = useCallback(
    async (payload: BatchingPullFromWorkOrderPayload) => {
      try {
        await executePull(payload);
        return true;
      } catch (error: unknown) {
        if (isLineSideWarehouseNotFoundError(error)) {
          setPendingPayload(payload);
          setWarehouseId(undefined);
          setWarehouseName('');
          setModalOpen(true);
          void loadWarehouses();
          return false;
        }
        throw error;
      }
    },
    [executePull, loadWarehouses],
  );

  const confirmWarehouseSelection = useCallback(async () => {
    if (!pendingPayload) return;
    if (!warehouseId) {
      messageApi.warning(t('app.kuaizhizao.batchingCenter.selectTargetLineSideWarehouse'));
      return;
    }
    setSubmitting(true);
    try {
      await executePull({
        ...pendingPayload,
        target_warehouse_id: warehouseId,
        target_warehouse_name: warehouseName,
      });
      closeModal();
    } catch (error: unknown) {
      messageApi.error(
        getApiErrorMessage(error, t('app.kuaizhizao.batchingCenter.generateBatchingFailed')),
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    closeModal,
    executePull,
    messageApi,
    pendingPayload,
    t,
    warehouseId,
    warehouseName,
  ]);

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((item) => ({
        label: `${item.code ?? ''} ${item.name ?? ''}`.trim() || String(item.id),
        value: Number(item.id),
      })),
    [warehouses],
  );

  const lineSideWarehouseModal = (
    <Modal
      title={t('app.kuaizhizao.batchingCenter.lineSideWarehousePickModalTitle')}
      open={modalOpen}
      onCancel={closeModal}
      onOk={() => void confirmWarehouseSelection()}
      confirmLoading={submitting}
      destroyOnHidden
      width={480}
    >
      <Alert
        type="info"
        showIcon
        message={t('app.kuaizhizao.batchingCenter.lineSideWarehousePickModalHint')}
        style={{ marginBottom: 16 }}
      />
      {showAllWarehousesHint ? (
        <Alert
          type="warning"
          showIcon
          message={t('app.kuaizhizao.batchingCenter.lineSideWarehousePickModalFallbackHint')}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <Select
        showSearch
        allowClear
        placeholder={t('app.kuaizhizao.batchingCenter.selectTargetLineSideWarehouse')}
        style={{ width: '100%' }}
        loading={loadingWarehouses}
        options={warehouseOptions}
        value={warehouseId}
        optionFilterProp="label"
        onChange={(value) => {
          const id = value != null ? Number(value) : undefined;
          setWarehouseId(id);
          const wh = warehouses.find((item) => Number(item.id) === id);
          setWarehouseName(wh?.name ?? '');
        }}
      />
    </Modal>
  );

  return {
    pullFromWorkOrder,
    lineSideWarehouseModal,
  };
}
