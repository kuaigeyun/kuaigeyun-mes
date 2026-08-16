/**
 * 工程变更详情抽屉（BOM / 工艺路线）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Descriptions } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DetailDrawerTemplate, DetailDrawerSection } from '../../../components/layout-templates';
import { formatDateTime } from '../../../utils/format';
import { getBomChange, type BomChangeRecord } from '../../master-data/services/bom-change';
import {
  getProcessRouteChange,
  type ProcessRouteChangeRecord,
} from '../../master-data/services/process-route-change';
import { getDrawingChange } from '../services/change-desk';
import {
  buildBomChangeCreateUrl,
  buildMasterDataUrl,
  buildRouteChangeCreateUrl,
} from '../services/master-data-links';
import {
  getKuaiplmChangeStatusText,
  renderPlmChangeCategoryMarker,
  renderPlmChangeStatusTag,
  renderPlmChangeTypeMarker,
} from './kuaiplmMeta';
import type { ChangeDeskCategory, UnifiedChangeRow } from '../services/change-desk';

type DrawingChangeDetail = {
  drawing_uuid?: string;
  drawingUuid?: string;
  drawing_code?: string;
  drawingCode?: string;
  drawing_name?: string;
  drawingName?: string;
  drawing_revision?: string;
  drawingRevision?: string;
  change_type?: string;
  changeType?: string;
  change_reason?: string;
  changeReason?: string;
  change_content?: unknown;
  changeContent?: unknown;
  status?: string;
  created_by_name?: string;
  createdByName?: string;
  applicant_name?: string;
  created_at?: string;
  createdAt?: string;
};

type ChangeDetail = BomChangeRecord | ProcessRouteChangeRecord | DrawingChangeDetail;

export interface ChangeDetailDrawerProps {
  row: UnifiedChangeRow | null;
  onClose: () => void;
}

function formatJsonBlock(value: unknown): string {
  if (value == null) return '-';
  if (typeof value === 'string') return value || '-';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

const ChangeDetailDrawer: React.FC<ChangeDetailDrawerProps> = ({ row, onClose }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ChangeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!row?.uuid || !row.change_category) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (row.change_category === 'bom') {
        setDetail(await getBomChange(row.uuid));
      } else if (row.change_category === 'route') {
        setDetail(await getProcessRouteChange(row.uuid));
      } else {
        setDetail((await getDrawingChange(row.uuid)) as DrawingChangeDetail);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t('common.loadFailed');
      setError(msg);
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [row?.uuid, row?.change_category, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const category = row?.change_category ?? 'bom';
  const bomDetail = category === 'bom' ? (detail as BomChangeRecord | null) : null;
  const routeDetail = category === 'route' ? (detail as ProcessRouteChangeRecord | null) : null;
  const drawingDetail = category === 'drawing' ? (detail as DrawingChangeDetail | null) : null;
  const drawingUuid = drawingDetail?.drawingUuid ?? drawingDetail?.drawing_uuid;
  const drawingCode = drawingDetail?.drawingCode ?? drawingDetail?.drawing_code ?? '';
  const drawingName = drawingDetail?.drawingName ?? drawingDetail?.drawing_name ?? row?.target_name ?? '';
  const drawingRevision = drawingDetail?.drawingRevision ?? drawingDetail?.drawing_revision ?? '';
  const changeType = drawingDetail?.changeType ?? drawingDetail?.change_type ?? (detail as { change_type?: string } | null)?.change_type;
  const changeReason =
    drawingDetail?.changeReason ??
    drawingDetail?.change_reason ??
    (detail as { change_reason?: string } | null)?.change_reason;
  const changeContent = drawingDetail?.changeContent ?? drawingDetail?.change_content ?? (detail as { change_content?: unknown } | null)?.change_content;
  const createdByName =
    drawingDetail?.createdByName ??
    drawingDetail?.created_by_name ??
    (detail as { created_by_name?: string; applicant_name?: string } | null)?.created_by_name ??
    (detail as { applicant_name?: string } | null)?.applicant_name;
  const createdAt = drawingDetail?.createdAt ?? drawingDetail?.created_at ?? (detail as { created_at?: string } | null)?.created_at;

  const openSource = () => {
    if (category === 'bom' && bomDetail?.material_id != null) {
      const url = buildBomChangeCreateUrl(bomDetail.material_id);
      const version = bomDetail.to_version ? `&version=${encodeURIComponent(bomDetail.to_version)}` : '';
      window.open(`${url}${version}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (category === 'drawing') {
      const url = buildMasterDataUrl({ link_type: 'drawing', target_uuid: drawingUuid });
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(buildRouteChangeCreateUrl());
  };

  return (
    <DetailDrawerTemplate
      open={!!row}
      onClose={onClose}
      title={t('app.kuaiplm.change.detailTitle')}
      width={640}
      loading={loading}
      extra={
        row ? (
          <Button type="primary" size="small" onClick={openSource}>
            {category === 'bom'
              ? t('app.kuaiplm.change.openBomDesigner')
              : category === 'drawing'
                ? t('app.kuaiplm.change.openDrawing')
                : t('app.kuaiplm.change.openRouteList')}
          </Button>
        ) : null
      }
      plainBody={
        error ? (
          <div>
            <p>{error}</p>
            <Button onClick={() => void load()}>{t('common.retry')}</Button>
          </div>
        ) : !detail ? null : (
          <>
            <DetailDrawerSection title={t('app.kuaiplm.change.detailBasic')}>
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label={t('app.kuaiplm.common.columns.category')}>
                  {renderPlmChangeCategoryMarker(t, category as ChangeDeskCategory)}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaiplm.common.columns.status')}>
                  {renderPlmChangeStatusTag(t, detail.status)}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaiplm.common.columns.changeType')} span={2}>
                  {renderPlmChangeTypeMarker(t, changeType, category)}
                </Descriptions.Item>
                <Descriptions.Item label={t('app.kuaiplm.common.columns.target')} span={2}>
                  {category === 'bom'
                    ? `${bomDetail?.material_code ?? ''} ${bomDetail?.material_name ?? row?.target_name ?? ''}`.trim() ||
                      '-'
                    : category === 'drawing'
                      ? `${drawingCode} ${drawingName} ${drawingRevision}`.trim() || '-'
                      : `${routeDetail?.process_route_code ?? ''} ${routeDetail?.process_route_name ?? row?.target_name ?? ''}`.trim() ||
                        '-'}
                </Descriptions.Item>
                {bomDetail?.from_version || bomDetail?.to_version ? (
                  <Descriptions.Item label={t('app.kuaiplm.change.versionRange')} span={2}>
                    {bomDetail.from_version ?? '-'} → {bomDetail.to_version ?? '-'}
                  </Descriptions.Item>
                ) : null}
                <Descriptions.Item label={t('app.kuaiplm.common.columns.changeReason')} span={2}>
                  {changeReason || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('common.createdBy')}>
                  {createdByName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label={t('common.createdAt')}>
                  {createdAt ? formatDateTime(createdAt) : '-'}
                </Descriptions.Item>
              </Descriptions>
            </DetailDrawerSection>
            <DetailDrawerSection title={t('app.kuaiplm.change.detailContent')}>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: 'var(--ant-color-fill-quaternary)',
                  borderRadius: 6,
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {formatJsonBlock(changeContent)}
              </pre>
            </DetailDrawerSection>
            <p style={{ marginTop: 16, color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
              {category === 'drawing'
                ? t('app.kuaiplm.change.executeHintDrawing')
                : t('app.kuaiplm.change.executeHint')}
            </p>
          </>
        )
      }
    />
  );
};

export default ChangeDetailDrawer;
