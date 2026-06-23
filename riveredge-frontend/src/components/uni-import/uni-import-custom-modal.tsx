import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Checkbox, Space, Typography, Button, Divider, Select } from 'antd';
import { HolderOutlined } from '@ant-design/icons';
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

interface CustomImportRow {
  key: string;
  header: string;
  fieldKey: string;
  canSelect: boolean;
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
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const allFieldKeys = useMemo(
    () => headers.map((h) => resolveSystemFieldKey(h, fieldMap)),
    [headers, fieldMap],
  );
  const allRows = useMemo<CustomImportRow[]>(
    () =>
      headers.map((header, idx) => ({
        key: `${idx}-${allFieldKeys[idx]}`,
        header,
        fieldKey: allFieldKeys[idx],
        canSelect: Boolean(allFieldKeys[idx]),
      })),
    [headers, allFieldKeys],
  );
  const [orderedRows, setOrderedRows] = useState<CustomImportRow[]>(allRows);
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
    const initialSelection = initialSelectedFieldKeys?.length
      ? initialSelectedFieldKeys.filter((key) => allFieldKeys.includes(key))
      : allFieldKeys;
    const normalizedSelection = initialSelection.length ? initialSelection : allFieldKeys;
    const selectedSet = new Set(normalizedSelection);
    const selectedRows = allRows.filter((row) => selectedSet.has(row.fieldKey));
    selectedRows.sort(
      (a, b) =>
        normalizedSelection.indexOf(a.fieldKey) - normalizedSelection.indexOf(b.fieldKey),
    );
    const unselectedRows = allRows.filter((row) => !selectedSet.has(row.fieldKey));

    setOrderedRows([...selectedRows, ...unselectedRows]);
    setSelectedFieldKeys(normalizedSelection);
    setRelationEntities(
      initialRelationEntities?.length ? initialRelationEntities : defaultRelationEntities,
    );
    setWriteStrategy(initialWriteStrategy ?? defaultWriteStrategy);
    setHasInitialized(true);
  }, [
    open,
    hasInitialized,
    allRows,
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
      orderedRows.map((row, idx) => ({
        ...row,
        index: idx + 1,
        checked: selectedSet.has(row.fieldKey),
      })),
    [orderedRows, selectedSet],
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

  const moveRow = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setOrderedRows((prev) => {
      const from = prev.findIndex((row) => row.key === fromKey);
      const to = prev.findIndex((row) => row.key === toKey);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleApply = () => {
    const selectedRows = orderedRows.filter((row) => selectedSet.has(row.fieldKey));
    onApply({
      selectedHeaders: selectedRows.map((row) => row.header),
      selectedFieldKeys: selectedRows.map((row) => row.fieldKey),
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
              onChange={(e) =>
                setSelectedFieldKeys(
                  e.target.checked ? orderedRows.map((row) => row.fieldKey) : [],
                )
              }
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
            width: 42,
            dataIndex: 'drag',
            render: (_, record: { key: string }) => (
              <span
                draggable
                style={{ cursor: 'grab', color: '#999' }}
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDraggingKey(record.key);
                }}
                onDragEnd={() => setDraggingKey(null)}
              >
                <HolderOutlined />
              </span>
            ),
          },
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
        onRow={(record: { checked: boolean; fieldKey: string; canSelect: boolean; key: string }) => ({
          onDragOver: (e) => {
            e.preventDefault();
          },
          onDrop: (e) => {
            e.preventDefault();
            if (draggingKey) moveRow(draggingKey, record.key);
          },
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
