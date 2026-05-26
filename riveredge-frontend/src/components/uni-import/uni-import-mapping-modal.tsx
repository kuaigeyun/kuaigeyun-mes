import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Table, Select, InputNumber, Button, Space, Typography, App } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  autoMatchColumnMapping,
  buildMappedImportRows,
  extractExcelHeaders,
  type ColumnMapping,
} from './apply-import-mapping';

export interface UniImportMappingModalProps {
  open: boolean;
  systemHeaders: string[];
  exampleRow?: string[];
  fieldMap?: Record<string, string>;
  rawRows: string[][];
  onCancel: () => void;
  onApply: (mappedRows: string[][]) => void;
}

export const UniImportMappingModal: React.FC<UniImportMappingModalProps> = ({
  open,
  systemHeaders,
  exampleRow,
  fieldMap,
  rawRows,
  onCancel,
  onApply,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [headerRowIndex, setHeaderRowIndex] = useState(1);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>([]);

  const maxHeaderRow = Math.max(1, rawRows.length);

  const excelHeaders = useMemo(
    () => extractExcelHeaders(rawRows, headerRowIndex),
    [rawRows, headerRowIndex],
  );

  const excelColumnOptions = useMemo(() => {
    const opts = excelHeaders
      .map((label, idx) => {
        const text = String(label ?? '').trim();
        if (!text) return null;
        return { value: idx, label: text };
      })
      .filter((o): o is { value: number; label: string } => o != null);
    return opts;
  }, [excelHeaders]);

  const runAutoMatch = () => {
    setColumnMapping(autoMatchColumnMapping(systemHeaders, excelHeaders, fieldMap));
  };

  useEffect(() => {
    if (!open) return;
    setHeaderRowIndex(1);
  }, [open, rawRows]);

  useEffect(() => {
    if (!open) return;
    const headers = extractExcelHeaders(rawRows, headerRowIndex);
    setColumnMapping(autoMatchColumnMapping(systemHeaders, headers, fieldMap));
  }, [open, rawRows, systemHeaders, fieldMap, headerRowIndex]);

  const tableData = useMemo(
    () =>
      systemHeaders.map((label, index) => ({
        key: String(index),
        systemField: label,
        excelColumn: columnMapping[index] ?? -1,
        index,
      })),
    [systemHeaders, columnMapping],
  );

  const matchedCount = columnMapping.filter(idx => idx >= 0).length;

  const handleApply = () => {
    if (matchedCount === 0) {
      messageApi.warning(t('components.uniImport.mappingNoColumns'));
      return;
    }
    const mapped = buildMappedImportRows({
      systemHeaders,
      exampleRow,
      rawRows,
      headerRowIndex,
      columnMapping,
    });
    if (mapped.length <= 2) {
      messageApi.warning(t('components.uniImport.mappingNoDataRows'));
      return;
    }
    onApply(mapped);
  };

  return (
    <Modal
      title={t('components.uniImport.mappingModalTitle')}
      open={open}
      onCancel={onCancel}
      width={720}
      destroyOnHidden
      footer={
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Button onClick={runAutoMatch}>{t('components.uniImport.mappingAutoMatch')}</Button>
          <Space>
            <Button onClick={onCancel}>{t('common.cancel')}</Button>
            <Button type="primary" onClick={handleApply}>
              {t('components.uniImport.mappingApplyPreview')}
            </Button>
          </Space>
        </Space>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Space wrap align="center">
          <Typography.Text>{t('components.uniImport.mappingHeaderRow')}：</Typography.Text>
          <InputNumber
            min={1}
            max={maxHeaderRow}
            value={headerRowIndex}
            onChange={v => setHeaderRowIndex(Math.max(1, Number(v) || 1))}
          />
          <Typography.Text type="secondary">
            {t('components.uniImport.mappingMatchedCount', {
              matched: matchedCount,
              total: systemHeaders.length,
            })}
          </Typography.Text>
        </Space>
        <Table
          size="small"
          pagination={false}
          scroll={{ y: 360 }}
          dataSource={tableData}
          columns={[
            {
              title: t('components.uniImport.mappingSystemField'),
              dataIndex: 'systemField',
              width: 200,
              ellipsis: true,
            },
            {
              title: t('components.uniImport.mappingExcelColumn'),
              dataIndex: 'excelColumn',
              render: (value: number, record) => (
                <Select
                  style={{ width: '100%' }}
                  value={value}
                  options={[
                    { value: -1, label: t('components.uniImport.mappingSkip') },
                    ...excelColumnOptions,
                  ]}
                  onChange={colIdx => {
                    setColumnMapping(prev => {
                      const next = [...prev];
                      next[record.index] = colIdx;
                      return next;
                    });
                  }}
                  showSearch
                  optionFilterProp="label"
                  placeholder={t('components.uniImport.mappingSelectColumn')}
                />
              ),
            },
          ]}
        />
      </Space>
    </Modal>
  );
};
