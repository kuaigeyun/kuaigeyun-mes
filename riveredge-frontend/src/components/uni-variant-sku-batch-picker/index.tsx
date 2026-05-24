/**
 * UniVariantSkuBatchPicker — 主物料下属性 SKU 多选弹窗（样式对齐 UniMaterialBatchPicker）
 */

import React, { useEffect, useState } from 'react';
import { App, Flex, Modal } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Material } from '../../apps/master-data/types/material';
import type { UniVariantSkuBatchPickerProps } from './types';
import { VariantSkuPickerPanel } from './VariantSkuPickerPanel';

export type { UniVariantSkuBatchPickerProps } from './types';

const DEFAULT_WIDTH = 960;

export const UniVariantSkuBatchPicker: React.FC<UniVariantSkuBatchPickerProps> = ({
  open,
  onCancel,
  onConfirm,
  masterMaterialUuid,
  excludeAttrKeys,
  zIndex,
  width = DEFAULT_WIDTH,
  selectionMode = 'multiple',
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const isSingle = selectionMode === 'single';
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [selectedMap, setSelectedMap] = useState<Map<string, Material>>(() => new Map());

  useEffect(() => {
    if (!open) return;
    setSelectedUuid(null);
    setSelectedMap(new Map());
  }, [open]);

  const handleOk = () => {
    if (isSingle) {
      if (!selectedUuid) {
        message.warning(t('app.master-data.priceBook.batchSelectSkuNone', '请至少选择一条 SKU'));
        return;
      }
      const row = selectedMap.get(selectedUuid);
      if (!row) {
        message.warning(t('app.master-data.priceBook.batchSelectSkuNone', '请至少选择一条 SKU'));
        return;
      }
      onConfirm([row]);
      setSelectedUuid(null);
      setSelectedMap(new Map());
      onCancel();
      return;
    }
    if (selectedMap.size === 0) {
      message.warning(t('app.master-data.priceBook.batchSelectSkuNone', '请至少选择一条 SKU'));
      return;
    }
    onConfirm(Array.from(selectedMap.values()));
    setSelectedMap(new Map());
    onCancel();
  };

  const handleCancel = () => {
    setSelectedMap(new Map());
    setSelectedUuid(null);
    onCancel();
  };

  const handleSelectedSkuChange = (sku: Material | null) => {
    if (!sku?.uuid) {
      setSelectedMap(new Map());
      return;
    }
    setSelectedMap(new Map([[String(sku.uuid), sku]]));
  };

  const modalTitle = (
    <Flex align="center" gap={12} wrap="wrap" style={{ width: '100%', paddingRight: 28, fontWeight: 'normal' }}>
      <span style={{ fontWeight: 600, flexShrink: 0 }}>
        {isSingle
          ? t('app.kuaizhizao.salesOrder.selectVariantSkuTitle', '选择属性 SKU')
          : t('app.master-data.priceBook.batchSelectSkuTitle', '多选属性 SKU')}
      </span>
    </Flex>
  );

  return (
    <Modal
      title={modalTitle}
      styles={{ header: { marginBottom: 0 }, body: { paddingTop: 12 } }}
      open={open}
      onCancel={handleCancel}
      onOk={handleOk}
      zIndex={zIndex}
      width={width}
      destroyOnHidden
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      okButtonProps={{ disabled: !masterMaterialUuid }}
    >
      <VariantSkuPickerPanel
        active={open}
        masterMaterialUuid={masterMaterialUuid}
        selectionMode={selectionMode}
        excludeAttrKeys={excludeAttrKeys}
        selectedUuid={selectedUuid}
        onSelectedUuidChange={setSelectedUuid}
        onSelectedSkuChange={isSingle ? handleSelectedSkuChange : undefined}
        selectedMap={selectedMap}
        onSelectedMapChange={setSelectedMap}
        showSelectedCount
      />
    </Modal>
  );
};

export default UniVariantSkuBatchPicker;

export { VariantSkuPickerPanel } from './VariantSkuPickerPanel';
