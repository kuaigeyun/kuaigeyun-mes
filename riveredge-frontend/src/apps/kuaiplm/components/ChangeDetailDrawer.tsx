/**
 * 工程变更详情抽屉（BOM / 工艺路线 / 图纸 / ECN）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Descriptions, Input, Modal, Select, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DetailDrawerTemplate, DetailDrawerSection } from '../../../components/layout-templates';
import { formatDateTime } from '../../../utils/format';
import { getApiErrorMessage } from '../../../utils/errorHandler';
import { getBomChange, type BomChangeRecord } from '../../master-data/services/bom-change';
import {
  getProcessRouteChange,
  type ProcessRouteChangeRecord,
} from '../../master-data/services/process-route-change';
import { getDeskChange, getDrawingChange } from '../services/change-desk';
import {
  engineeringChangeApi,
  type EcnFormProfile,
  type EngineeringChange,
} from '../services/engineering-change';
import { isIndustryFormProfileActive } from '../../../utils/industryFormProfile';
import { buildEcnDetailMaterialColumns, sortedHeaderFields } from '../utils/ecnFormProfile';
import {
  buildBomChangeCreateUrl,
  buildMasterDataUrl,
  buildRouteChangeCreateUrl,
} from '../services/master-data-links';
import {
  renderPlmChangeCategoryMarker,
  renderPlmChangeStatusTag,
  renderPlmChangeTypeMarker,
} from '../utils/plmListPresentation';
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

type ChangeDetail = BomChangeRecord | ProcessRouteChangeRecord | DrawingChangeDetail | EngineeringChange;

export interface ChangeDetailDrawerProps {
  row: UnifiedChangeRow | null;
  onClose: () => void;
  onChanged?: () => void;
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

const ChangeDetailDrawer: React.FC<ChangeDetailDrawerProps> = ({ row, onClose, onChanged }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<ChangeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [erpOpen, setErpOpen] = useState(false);
  const [erpNo, setErpNo] = useState('');
  const [erpResult, setErpResult] = useState('pass');
  const [erpNotes, setErpNotes] = useState('');
  const [ecnFormProfile, setEcnFormProfile] = useState<EcnFormProfile | null>(null);

  useEffect(() => {
    if (row?.change_category !== 'ecn') {
      setEcnFormProfile(null);
      return;
    }
    let cancelled = false;
    void engineeringChangeApi
      .formProfile()
      .then((p) => {
        if (!cancelled) setEcnFormProfile(p);
      })
      .catch(() => {
        if (!cancelled) setEcnFormProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [row?.change_category]);

  const ecnIndustryActive = isIndustryFormProfileActive(ecnFormProfile);
  const ecnHeaderFields = useMemo(
    () => sortedHeaderFields(ecnFormProfile, ecnIndustryActive),
    [ecnFormProfile, ecnIndustryActive],
  );
  const ecnMaterialColumns = useMemo(
    () => buildEcnDetailMaterialColumns(ecnFormProfile, t, ecnIndustryActive),
    [ecnFormProfile, ecnIndustryActive, t],
  );

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
      } else if (row.change_category === 'ecn') {
        setDetail((await getDeskChange(row.uuid, 'ecn')) as EngineeringChange);
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
  const ecnDetail = category === 'ecn' ? (detail as EngineeringChange | null) : null;
  const drawingUuid = drawingDetail?.drawingUuid ?? drawingDetail?.drawing_uuid;
  const drawingCode = drawingDetail?.drawingCode ?? drawingDetail?.drawing_code ?? '';
  const drawingName = drawingDetail?.drawingName ?? drawingDetail?.drawing_name ?? row?.target_name ?? '';
  const drawingRevision = drawingDetail?.drawingRevision ?? drawingDetail?.drawing_revision ?? '';
  const changeType =
    ecnDetail?.change_kind ??
    drawingDetail?.changeType ??
    drawingDetail?.change_type ??
    (detail as { change_type?: string } | null)?.change_type;
  const changeReason =
    ecnDetail?.change_reason ??
    drawingDetail?.changeReason ??
    drawingDetail?.change_reason ??
    (detail as { change_reason?: string } | null)?.change_reason;
  const changeContent =
    drawingDetail?.changeContent ??
    drawingDetail?.change_content ??
    (detail as { change_content?: unknown } | null)?.change_content;
  const createdByName =
    ecnDetail?.created_by_name ??
    drawingDetail?.createdByName ??
    drawingDetail?.created_by_name ??
    (detail as { created_by_name?: string; applicant_name?: string } | null)?.created_by_name ??
    (detail as { applicant_name?: string } | null)?.applicant_name;
  const createdAt =
    ecnDetail?.created_at ??
    drawingDetail?.createdAt ??
    drawingDetail?.created_at ??
    (detail as { created_at?: string } | null)?.created_at;

  const openSource = () => {
    if (category === 'ecn') return;
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
    <>
      <DetailDrawerTemplate
        open={!!row}
        onClose={onClose}
        title={
          category === 'ecn'
            ? ecnDetail?.ecn_code || t('app.kuaiplm.ecn.title')
            : t('app.kuaiplm.change.detailTitle')
        }
        size={640}
        loading={loading}
        extra={
          row ? (
            category === 'ecn' && ecnDetail?.status === 'erp_pending' ? (
              <Button
                type="primary"
                size="small"
                onClick={() => {
                  setErpNo(ecnDetail.erp_ecn_no || '');
                  setErpResult('pass');
                  setErpNotes('');
                  setErpOpen(true);
                }}
              >
                {t('app.kuaiplm.ecn.actions.erpAudit')}
              </Button>
            ) : category !== 'ecn' ? (
              <Button type="primary" size="small" onClick={openSource}>
                {category === 'bom'
                  ? t('app.kuaiplm.change.openBomDesigner')
                  : category === 'drawing'
                    ? t('app.kuaiplm.change.openDrawing')
                    : t('app.kuaiplm.change.openRouteList')}
              </Button>
            ) : null
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
                  <Descriptions.Item label={t('common.status')}>
                    {renderPlmChangeStatusTag(t, detail.status)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaiplm.common.columns.changeType')} span={2}>
                    {renderPlmChangeTypeMarker(t, changeType, category)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('app.kuaiplm.common.columns.target')} span={2}>
                    {category === 'ecn'
                      ? ecnDetail?.title || row?.target_name || '-'
                      : category === 'bom'
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
                  {category === 'ecn' ? (
                    <>
                      {ecnHeaderFields.map((field) => {
                        const key = String(field.key || '');
                        if (!key) return null;
                        const raw = ecnDetail?.extension_payload?.[key];
                        return (
                          <Descriptions.Item
                            key={key}
                            label={String(field.label || key)}
                            span={field.type === 'textarea' ? 2 : 1}
                          >
                            {raw != null && raw !== '' ? String(raw) : '-'}
                          </Descriptions.Item>
                        );
                      })}
                      {(ecnFormProfile?.header_option_flags || []).map((flag) => {
                        const key = String(flag.key || '');
                        if (!key) return null;
                        const raw = ecnDetail?.extension_payload?.[key];
                        const display =
                          flag.type === 'boolean'
                            ? raw
                              ? t('common.yes')
                              : t('common.no')
                            : raw != null && raw !== ''
                              ? String(raw)
                              : '-';
                        return (
                          <Descriptions.Item key={key} label={String(flag.label || key)}>
                            {display}
                          </Descriptions.Item>
                        );
                      })}
                      <Descriptions.Item label={t('app.kuaiplm.ecn.fields.erpEcnNo')}>
                        {ecnDetail?.erp_ecn_no || '-'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('app.kuaiplm.ecn.fields.erpAuditStatus')}>
                        {ecnDetail?.erp_audit_status || '-'}
                      </Descriptions.Item>
                    </>
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
              {category === 'ecn' && ecnDetail ? (
                <>
                  <DetailDrawerSection title={t('app.kuaiplm.ecn.fields.materials')}>
                    <Table
                      size="small"
                      pagination={false}
                      scroll={{ x: 'max-content' }}
                      rowKey={(r) => String(r.id ?? r.material_code)}
                      dataSource={ecnDetail.materials || []}
                      columns={ecnMaterialColumns}
                    />
                  </DetailDrawerSection>
                  <DetailDrawerSection title={t('app.kuaiplm.ecn.fields.signoffs')}>
                    <Table
                      size="small"
                      pagination={false}
                      rowKey="dept_code"
                      dataSource={ecnDetail.signoffs || []}
                      columns={[
                        { title: t('app.kuaiplm.ecn.fields.deptName'), dataIndex: 'dept_name' },
                        { title: t('common.status'), dataIndex: 'status', width: 90 },
                        {
                          title: t('app.kuaiplm.ecn.fields.signerName'),
                          dataIndex: 'signer_name',
                          render: (v) => v || '—',
                        },
                      ]}
                    />
                  </DetailDrawerSection>
                </>
              ) : changeContent != null ? (
                <DetailDrawerSection title={t('app.kuaiplm.change.detailContent')}>
                  <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{formatJsonBlock(changeContent)}</pre>
                </DetailDrawerSection>
              ) : null}
            </>
          )
        }
      />

      <Modal
        title={t('app.kuaiplm.ecn.actions.erpAudit')}
        open={erpOpen}
        destroyOnHidden
        onCancel={() => setErpOpen(false)}
        onOk={async () => {
          if (!ecnDetail?.id) return;
          if (!erpNo.trim()) {
            messageApi.error(t('app.kuaiplm.ecn.messages.erpNoRequired'));
            return;
          }
          try {
            await engineeringChangeApi.erpAudit(ecnDetail.id, {
              erp_ecn_no: erpNo.trim(),
              result: erpResult,
              notes: erpNotes || undefined,
            });
            messageApi.success(t('app.kuaiplm.ecn.messages.erpAuditSuccess'));
            setErpOpen(false);
            await load();
            onChanged?.();
          } catch (e) {
            messageApi.error(getApiErrorMessage(e));
          }
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>{t('app.kuaiplm.ecn.fields.erpEcnNo')}</div>
          <Input value={erpNo} onChange={(e) => setErpNo(e.target.value)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>{t('app.kuaiplm.ecn.fields.erpAuditStatus')}</div>
          <Select
            style={{ width: '100%' }}
            value={erpResult}
            onChange={setErpResult}
            options={[
              { value: 'pass', label: t('app.kuaiplm.ecn.erpResult.pass') },
              { value: 'fail', label: t('app.kuaiplm.ecn.erpResult.fail') },
            ]}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}>{t('app.kuaiplm.ecn.fields.erpAuditNotes')}</div>
          <Input.TextArea rows={3} value={erpNotes} onChange={(e) => setErpNotes(e.target.value)} />
        </div>
      </Modal>
    </>
  );
};

export default ChangeDetailDrawer;
