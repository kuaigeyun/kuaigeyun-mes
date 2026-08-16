import React, { useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Result, Space } from 'antd';
import type { ProDescriptionsItemProps } from '@ant-design/pro-components';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  DetailDrawerTemplate,
  DRAWER_CONFIG,
  detailDrawerBasicColumn,
  detailDrawerDescriptionItems,
} from '../../../../../../components/layout-templates';
import { qualityImprovementApi, type DefectLedgerItem } from '../../../../services/quality-improvement';
import { nonconformingLedgerRowGates } from '../../../../../../hooks/useDocumentCapabilities';
import type { ResourcePermissionGates } from '../../../../../../hooks/useResourcePermissions';
import { rowActionKind } from '../../../../../../components/uni-action';
import {
  alignDescriptionColumns,
  GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
} from '../../../sales-management/shared/documentFieldAlignment';
import {
  getQualityDefectTypeText,
  renderQualityDispositionMarkerTag,
  renderNcLedgerStatusTag,
} from '../../components/qualityMeta';
import { sourceInspectionLabel, sourceInspectionPath, sourceInspectionTypeText } from '../ncLedgerSource';

interface NonconformingLedgerDetailDrawerProps {
  open: boolean;
  defectId?: number;
  refreshNonce?: number;
  ncPerms: ResourcePermissionGates;
  canStart8d: boolean;
  onClose: () => void;
  onUpdateDisposition: (row: DefectLedgerItem) => void;
  onStart8d: (row: DefectLedgerItem) => void;
}

export const NonconformingLedgerDetailDrawer: React.FC<NonconformingLedgerDetailDrawerProps> = ({
  open,
  defectId,
  refreshNonce = 0,
  ncPerms,
  canStart8d,
  onClose,
  onUpdateDisposition,
  onStart8d,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<DefectLedgerItem | null>(null);

  const loadDetail = (id: number) => {
    setLoading(true);
    setError(null);
    return qualityImprovementApi.nonconformingLedger
      .getById(id)
      .then((detail) => {
        setRecord(detail);
      })
      .catch((err: unknown) => {
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message || '')
            : '';
        setError(message || t('app.kuaizhizao.quality.nc.messages.loadDetailFailed'));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!open || !defectId) return;
    let cancelled = false;
    setRecord((prev) => (prev?.id === defectId ? prev : null));
    setLoading(true);
    setError(null);
    void qualityImprovementApi.nonconformingLedger
      .getById(defectId)
      .then((detail) => {
        if (cancelled) return;
        setRecord(detail);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err && typeof err === 'object' && 'message' in err
            ? String((err as { message?: string }).message || '')
            : '';
        setError(message || t('app.kuaizhizao.quality.nc.messages.loadDetailFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, defectId, refreshNonce, t]);

  const contentReady = Boolean(record);
  const showError = Boolean(error && !contentReady && !loading);
  const gates = nonconformingLedgerRowGates(record, ncPerms, canStart8d, t);

  const basicColumns = useMemo<ProDescriptionsItemProps<DefectLedgerItem>[]>(
    () =>
      alignDescriptionColumns(
        [
          { title: t('app.kuaizhizao.quality.nc.columns.ledgerCode'), dataIndex: 'code' },
          {
            title: t('app.kuaizhizao.quality.nc.columns.sourceInspection'),
            key: 'nc_source_inspection',
            render: (_, row) => {
              const typeText = sourceInspectionTypeText(t, row);
              const label = sourceInspectionLabel(row);
              const path = sourceInspectionPath(row);
              if (!typeText && !label) {
                return t('app.kuaizhizao.quality.nc.sourceInspection.empty');
              }
              const text = [typeText, label].filter(Boolean).join(' ');
              if (path && label) {
                return (
                  <Button type="link" size="small" onClick={() => navigate(path)}>
                    {text}
                  </Button>
                );
              }
              return text;
            },
          },
          {
            title: t('app.kuaizhizao.quality.common.columns.workOrderCode'),
            dataIndex: 'work_order_code',
            key: 'linked_work_order_code',
          },
          { title: t('app.kuaizhizao.quality.common.columns.operationName'), dataIndex: 'operation_name' },
          { title: t('app.kuaizhizao.quality.common.columns.materialName'), dataIndex: 'product_name' },
          { title: t('app.kuaizhizao.quality.common.columns.materialCode'), dataIndex: 'product_code' },
          {
            title: t('app.kuaizhizao.quality.nc.columns.defectType'),
            dataIndex: 'defect_type',
            render: (_, row) => getQualityDefectTypeText(t, row.defect_type, row.defect_reason),
          },
          {
            title: t('app.kuaizhizao.quality.common.form.disposition'),
            dataIndex: 'disposition',
            render: (_, row) => renderQualityDispositionMarkerTag(t, row.disposition),
          },
          { title: t('app.kuaizhizao.quality.common.columns.unqualifiedQty'), dataIndex: 'defect_quantity' },
          { title: t('app.kuaizhizao.quality.nc.columns.defectReason'), dataIndex: 'defect_reason' },
          { title: t('app.kuaizhizao.quality.nc.columns.downgradeMaterial'), dataIndex: 'downgrade_material_name' },
          {
            title: t('app.kuaizhizao.quality.common.form.downgradeWarehouse'),
            dataIndex: 'downgrade_warehouse_name',
          },
          {
            title: t('app.kuaizhizao.quality.nc.columns.otherInbound'),
            dataIndex: 'other_inbound_id',
            render: (_, row) => (row.other_inbound_id ? `#${row.other_inbound_id}` : '-'),
          },
          {
            title: t('app.kuaizhizao.quality.common.columns.status'),
            dataIndex: 'status',
            render: (_, row) => renderNcLedgerStatusTag(t, row.status),
          },
          { title: t('app.kuaizhizao.quality.common.form.remarks'), dataIndex: 'remarks' },
        ],
        GLOBAL_DOC_DETAIL_BASIC_FIELD_RANK,
      ),
    [t, navigate],
  );

  if (!open) return null;

  return (
    <DetailDrawerTemplate
      title={`${t('app.kuaizhizao.quality.nc.pageTitle')} ${record?.code || ''}`}
      width={DRAWER_CONFIG.HALF_WIDTH}
      open={open}
      onClose={onClose}
      loading={loading && !contentReady}
      extra={
        contentReady && record ? (
          <Space wrap size="small">
            {gates.updateDisposition.allowed && (
              <Button
                {...rowActionKind('execute')}
                disabled={gates.updateDisposition.disabled}
                title={gates.updateDisposition.title}
                onClick={() => onUpdateDisposition(record)}
              >
                {t('app.kuaizhizao.quality.nc.actions.updateDisposition')}
              </Button>
            )}
            {gates.start8d.allowed && (
              <Button
                {...rowActionKind('execute')}
                disabled={gates.start8d.disabled}
                title={gates.start8d.title}
                onClick={() => onStart8d(record)}
              >
                {t('app.kuaizhizao.quality.nc.actions.start8d')}
              </Button>
            )}
          </Space>
        ) : null
      }
      plainBody={
        showError ? (
          <Result
            status="error"
            title={error}
            extra={
              defectId ? (
                <Button
                  type="primary"
                  onClick={() => {
                    void loadDetail(defectId);
                  }}
                >
                  {t('app.kuaizhizao.quality.nc.actions.retry')}
                </Button>
              ) : null
            }
          />
        ) : undefined
      }
      basic={
        contentReady && record ? (
          <Descriptions
            column={detailDrawerBasicColumn(false)}
            size="small"
            items={detailDrawerDescriptionItems(basicColumns, record)}
          />
        ) : showError ? null : (
          <div style={{ minHeight: 80 }} />
        )
      }
    />
  );
};
