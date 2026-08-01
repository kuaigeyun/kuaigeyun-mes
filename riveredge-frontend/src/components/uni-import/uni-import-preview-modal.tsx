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
  /** 与导入 Modal 同宽 */
  width?: string | number;
  precheckLoading?: boolean;
  commitLoading?: boolean;
  precheckResult?: ImportPrecheckResult | null;
  onCancel: () => void;
  onConfirmImport: () => void;
}

export const UniImportPreviewModal: React.FC<UniImportPreviewModalProps> = ({
  open,
  data,
  dataStartRow = 2,
  maxPreviewRows = 10,
  width = 1200,
  precheckLoading = false,
  commitLoading = false,
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

  const ROW_NO_WIDTH = 72;

  const columns = useMemo(
    () =>
      preview.headers.map((title, colIndex) => {
        // 固定列宽：避免 scroll.y 下表头按长标题、表体按「—」各自算宽导致错位
        const width = Math.min(180, Math.max(110, Math.min(title.length, 10) * 14));
        return {
          title,
          dataIndex: `col_${colIndex}`,
          key: `col_${colIndex}`,
          ellipsis: true,
          width,
          render: (text: string) => text || '—',
        };
      }),
    [preview.headers],
  );

  const scrollX = useMemo(
    () => ROW_NO_WIDTH + columns.reduce((sum, col) => sum + Number(col.width ?? 0), 0),
    [columns],
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

  const errorMessages = useMemo(
    () => (precheckResult?.errors ?? []).map(s => String(s).trim()).filter(Boolean),
    [precheckResult?.errors],
  );
  const warningMessages = useMemo(
    () => (precheckResult?.warnings ?? []).map(s => String(s).trim()).filter(Boolean),
    [precheckResult?.warnings],
  );

  const hasErrors = errorMessages.length > 0;
  const canCommit =
    !precheckLoading && !commitLoading && !hasErrors && preview.totalDataRows > 0;

  const renderAlertLines = (lines: string[]) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lines.map((line, index) => (
        <Typography.Paragraph key={index} style={{ marginBottom: 0 }}>
          {line}
        </Typography.Paragraph>
      ))}
    </div>
  );

  return (
    <Modal
      title={t('components.uniImport.previewModalTitle')}
      open={open}
      onCancel={onCancel}
      width={width}
      destroyOnHidden
      footer={
        <Space>
          <Button onClick={onCancel}>{t('components.uniImport.previewBackEdit')}</Button>
          <Button
            type="primary"
            disabled={!canCommit}
            loading={precheckLoading || commitLoading}
            onClick={onConfirmImport}
          >
            {t('components.uniImport.previewConfirmImport')}
          </Button>
        </Space>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
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

        {!precheckLoading && errorMessages.length > 0 && (
          <Alert
            type="error"
            showIcon
            title={t('components.uniImport.previewPrecheckErrorTitle')}
            description={renderAlertLines(errorMessages)}
          />
        )}
        {!precheckLoading && warningMessages.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title={t('components.uniImport.previewPrecheckWarningTitle')}
            description={renderAlertLines(warningMessages)}
          />
        )}

        <Table
          size="small"
          bordered
          pagination={false}
          tableLayout="fixed"
          scroll={{ x: scrollX, y: 320 }}
          loading={precheckLoading}
          columns={[
            {
              title: t('components.uniImport.previewRowNo'),
              dataIndex: '__rowNo',
              key: '__rowNo',
              width: ROW_NO_WIDTH,
              ellipsis: true,
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
