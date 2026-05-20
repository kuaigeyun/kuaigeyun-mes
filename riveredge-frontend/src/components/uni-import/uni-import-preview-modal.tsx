import React, { useMemo } from 'react';
import { Modal, Table, Alert, Space, Typography, Spin, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { buildImportPreviewTableSource } from './import-preview-utils';

export type ImportPrecheckResult = {
  canImport?: boolean;
  errors?: string[];
  warnings?: string[];
};

export interface UniImportPreviewModalProps {
  open: boolean;
  data: any[][];
  dataStartRow?: number;
  maxPreviewRows?: number;
  precheckLoading?: boolean;
  precheckResult?: ImportPrecheckResult | null;
  onCancel: () => void;
  onConfirmImport: () => void;
}

export const UniImportPreviewModal: React.FC<UniImportPreviewModalProps> = ({
  open,
  data,
  dataStartRow = 2,
  maxPreviewRows = 10,
  precheckLoading = false,
  precheckResult,
  onCancel,
  onConfirmImport,
}) => {
  const { t } = useTranslation();

  const preview = useMemo(
    () =>
      buildImportPreviewTableSource({
        data,
        dataStartRow,
        maxPreviewRows,
      }),
    [data, dataStartRow, maxPreviewRows],
  );

  const columns = useMemo(
    () =>
      preview.headers.map((title, colIndex) => ({
        title,
        dataIndex: `col_${colIndex}`,
        key: `col_${colIndex}`,
        ellipsis: true,
        width: Math.min(160, Math.max(80, title.length * 14)),
        render: (text: string) => text || '—',
      })),
    [preview.headers],
  );

  const dataSource = useMemo(
    () =>
      preview.previewRows.map((row, rowIndex) => {
        const record: Record<string, string> = {
          key: String(rowIndex),
          __rowNo: String(dataStartRow + rowIndex + 1),
        };
        row.forEach((cell, colIndex) => {
          record[`col_${colIndex}`] = cell;
        });
        return record;
      }),
    [preview.previewRows, dataStartRow],
  );

  const hasErrors = Boolean(precheckResult?.errors?.length);
  const canCommit = !precheckLoading && !hasErrors && preview.totalDataRows > 0;

  return (
    <Modal
      title={t('components.uniImport.previewModalTitle')}
      open={open}
      onCancel={onCancel}
      width={Math.min(1100, 160 + preview.headers.length * 120)}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onCancel}>{t('components.uniImport.previewBackEdit')}</Button>
          <Button type="primary" disabled={!canCommit} loading={precheckLoading} onClick={onConfirmImport}>
            {t('components.uniImport.previewConfirmImport')}
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">
          {t('components.uniImport.previewSummary', {
            total: preview.totalDataRows,
            shown: preview.previewCount,
            max: maxPreviewRows,
          })}
        </Typography.Text>

        {precheckLoading && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <Spin />
            <div style={{ marginTop: 8 }}>{t('components.uniImport.previewPrechecking')}</div>
          </div>
        )}

        {!precheckLoading && precheckResult?.errors?.map((msg, i) => (
          <Alert key={`err-${i}`} type="error" showIcon message={msg} />
        ))}
        {!precheckLoading && precheckResult?.warnings?.map((msg, i) => (
          <Alert key={`warn-${i}`} type="warning" showIcon message={msg} />
        ))}

        <Table
          size="small"
          bordered
          pagination={false}
          scroll={{ x: 'max-content', y: 320 }}
          loading={precheckLoading}
          columns={[
            {
              title: t('components.uniImport.previewRowNo'),
              dataIndex: '__rowNo',
              key: '__rowNo',
              width: 72,
              fixed: 'left',
            },
            ...columns,
          ]}
          dataSource={dataSource}
        />

        {preview.totalDataRows > maxPreviewRows && (
          <Typography.Text type="secondary">
            {t('components.uniImport.previewMoreRowsHint', {
              rest: preview.totalDataRows - maxPreviewRows,
            })}
          </Typography.Text>
        )}
      </Space>
    </Modal>
  );
};
