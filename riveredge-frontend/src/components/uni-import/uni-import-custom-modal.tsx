import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Checkbox, Space, Typography, Button, Divider, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { resolveSystemFieldKey } from './apply-import-mapping';
import type {
  UniRelationImportEntity,
  UniRelationImportWriteStrategy,
} from './uni-import-relation-modal';

export interface UniImportCustomModalApplyResult {
  selectedHeaders: string[];
  selectedFieldKeys: string[];
  relationEntities: UniRelationImportEntity[];
  writeStrategy: UniRelationImportWriteStrategy;
}

export interface UniImportCustomModalProps {
  open: boolean;
  headers: string[];
  fieldMap?: Record<string, string>;
  initialSelectedFieldKeys?: string[];
  enableRelationImport?: boolean;
  defaultRelationEntities?: UniRelationImportEntity[];
  defaultWriteStrategy?: UniRelationImportWriteStrategy;
  supportedStrategies?: UniRelationImportWriteStrategy[];
  initialRelationEntities?: UniRelationImportEntity[];
  initialWriteStrategy?: UniRelationImportWriteStrategy;
  onCancel: () => void;
  onApply: (result: UniImportCustomModalApplyResult) => void;
}

export const UniImportCustomModal: React.FC<UniImportCustomModalProps> = ({
  open,
  headers,
  fieldMap,
  initialSelectedFieldKeys,
  enableRelationImport = false,
  defaultRelationEntities = ['material', 'processRoute', 'operation', 'performance'],
  defaultWriteStrategy = 'upsert',
  supportedStrategies = ['upsert', 'create_only', 'link_only', 'strict_fail'],
  initialRelationEntities,
  initialWriteStrategy,
  onCancel,
  onApply,
}) => {
  const { t } = useTranslation();
  const [hasInitialized, setHasInitialized] = useState(false);
  const allFieldKeys = useMemo(
    () => headers.map((h) => resolveSystemFieldKey(h, fieldMap)),
    [headers, fieldMap],
  );
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>(allFieldKeys);
  const [relationEntities, setRelationEntities] = useState<UniRelationImportEntity[]>(
    initialRelationEntities?.length ? initialRelationEntities : defaultRelationEntities,
  );
  const [writeStrategy, setWriteStrategy] = useState<UniRelationImportWriteStrategy>(
    initialWriteStrategy ?? defaultWriteStrategy,
  );

  useEffect(() => {
    if (!open) {
      setHasInitialized(false);
      return;
    }
    if (hasInitialized) return;
    const initial = initialSelectedFieldKeys?.length
      ? allFieldKeys.filter((key) => initialSelectedFieldKeys.includes(key))
      : allFieldKeys;
    setSelectedFieldKeys(initial.length ? initial : allFieldKeys);
    setRelationEntities(
      initialRelationEntities?.length ? initialRelationEntities : defaultRelationEntities,
    );
    setWriteStrategy(initialWriteStrategy ?? defaultWriteStrategy);
    setHasInitialized(true);
  }, [
    open,
    hasInitialized,
    allFieldKeys,
    initialSelectedFieldKeys,
    initialRelationEntities,
    defaultRelationEntities,
    initialWriteStrategy,
    defaultWriteStrategy,
  ]);

  const selectedSet = useMemo(() => new Set(selectedFieldKeys), [selectedFieldKeys]);
  const allChecked = selectedFieldKeys.length > 0 && selectedFieldKeys.length === allFieldKeys.length;
  const indeterminate = selectedFieldKeys.length > 0 && selectedFieldKeys.length < allFieldKeys.length;

  const rows = useMemo(
    () =>
      headers.map((header, idx) => {
        const fieldKey = allFieldKeys[idx];
        return {
          key: `${idx}-${fieldKey}`,
          index: idx + 1,
          header,
          fieldKey,
          checked: selectedSet.has(fieldKey),
          canSelect: Boolean(fieldKey),
        };
      }),
    [headers, allFieldKeys, selectedSet],
  );

  const toggleField = (fieldKey: string, checked: boolean) => {
    setSelectedFieldKeys((prev) => {
      if (checked) {
        if (prev.includes(fieldKey)) return prev;
        return [...prev, fieldKey];
      }
      return prev.filter((key) => key !== fieldKey);
    });
  };

  const handleApply = () => {
    const pickedHeaders = headers.filter((h, idx) => selectedSet.has(allFieldKeys[idx]));
    onApply({
      selectedHeaders: pickedHeaders,
      selectedFieldKeys,
      relationEntities,
      writeStrategy,
    });
  };

  const relationEntityOptions = useMemo(
    () => [
      { value: 'material', label: t('components.uniImport.relationEntityMaterial') },
      { value: 'processRoute', label: t('components.uniImport.relationEntityProcessRoute') },
      { value: 'operation', label: t('components.uniImport.relationEntityOperation') },
      { value: 'performance', label: t('components.uniImport.relationEntityPerformance') },
    ],
    [t],
  );
  const strategyOptions = useMemo(
    () =>
      supportedStrategies.map((s) => ({
        value: s,
        label: t(`components.uniImport.relationStrategy.${s}`),
      })),
    [supportedStrategies, t],
  );

  return (
    <Modal
      title={t('components.uniImport.customImportTitle')}
      open={open}
      onCancel={onCancel}
      destroyOnHidden
      width={720}
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space align="center">
            <Checkbox
              checked={allChecked}
              indeterminate={indeterminate}
              onChange={(e) => setSelectedFieldKeys(e.target.checked ? [...allFieldKeys] : [])}
            >
              {t('components.uniImport.customImportSelectAll')}
            </Checkbox>
            <Typography.Text type="secondary">
              {t('components.uniImport.customImportSelectedCount', {
                selected: selectedFieldKeys.length,
                total: allFieldKeys.length,
              })}
            </Typography.Text>
          </Space>
          <Space>
            <Button onClick={onCancel}>{t('common.cancel')}</Button>
            <Button type="primary" onClick={handleApply} disabled={selectedFieldKeys.length === 0}>
              {t('components.uniImport.customImportApply')}
            </Button>
          </Space>
        </Space>
      }
    >
      <Table
        size="small"
        rowKey="key"
        dataSource={rows}
        pagination={false}
        scroll={{ y: 360 }}
        columns={[
          {
            title: '',
            width: 56,
            dataIndex: 'checked',
            render: (_, record: { checked: boolean; fieldKey: string; canSelect: boolean }) => (
              <Checkbox
                checked={record.checked}
                disabled={!record.canSelect}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => toggleField(record.fieldKey, e.target.checked)}
              />
            ),
          },
          {
            title: '#',
            width: 72,
            dataIndex: 'index',
          },
          {
            title: t('components.uniImport.mappingSystemField'),
            dataIndex: 'header',
            ellipsis: true,
          },
          {
            title: t('components.uniImport.customImportFieldKey'),
            dataIndex: 'fieldKey',
            width: 220,
            ellipsis: true,
          },
        ]}
        onRow={(record: { checked: boolean; fieldKey: string; canSelect: boolean }) => ({
          onClick: () => {
            if (!record.canSelect) return;
            toggleField(record.fieldKey, !record.checked);
          },
        })}
      />
      {enableRelationImport && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Typography.Text strong>{t('components.uniImport.relationEntityTitle')}</Typography.Text>
            <Checkbox.Group
              options={relationEntityOptions}
              value={relationEntities}
              onChange={(vals) => setRelationEntities(vals as UniRelationImportEntity[])}
            />
            <Space align="center" wrap>
              <Typography.Text>{t('components.uniImport.relationStrategyTitle')}</Typography.Text>
              <Select
                style={{ width: 300 }}
                value={writeStrategy}
                options={strategyOptions}
                onChange={(v) => setWriteStrategy(v)}
              />
            </Space>
          </Space>
        </>
      )}
    </Modal>
  );
};
