/**
 * 工单详情关联 ESOP（工艺作业指导，不走 KU-AI）。
 * 取数与工位端同一路径：work-order operations/{id}/documents。
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Descriptions, Drawer, Empty, List, Result, Select, Spin, Typography } from 'antd';
import { BookOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { SecureImage } from '../../../../../../components/secure-image';
import { getFileDownloadUrlWithToken } from '../../../../../../services/file';
import { getApiErrorMessage } from '../../../../../../utils/errorHandler';
import {
  workOrderApi,
  type WorkOrderEsopDocument,
  type WorkOrderEsopFileItem,
  type WorkOrderOperationDocuments,
} from '../../../../services/work-order';

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

export type WorkOrderEsopSidebarProps = {
  open: boolean;
  onClose: () => void;
  workOrderId?: number;
  operations?: unknown[];
  zIndex?: number;
};

type OperationRow = {
  id: number;
  label: string;
  sopHint?: string;
};

function asOperationList(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw && typeof raw === 'object') {
    const ops = (raw as { operations?: unknown }).operations;
    if (Array.isArray(ops)) return ops as Record<string, unknown>[];
  }
  return [];
}

function firstNonEmpty(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
}

function toOperationRows(raw: unknown): OperationRow[] {
  return asOperationList(raw)
    .map((op) => {
      const id = Number(op.id);
      if (!Number.isFinite(id) || id <= 0) return null;
      const sequence = op.sequence != null ? String(op.sequence) : '';
      const name =
        firstNonEmpty(op.operation_name, op.operationName, op.name) || `#${id}`;
      const code = firstNonEmpty(op.operation_code, op.operationCode);
      const sopHint = firstNonEmpty(op.sop_name, op.sopName);
      return {
        id,
        label: [sequence && `${sequence}.`, name, code && `(${code})`].filter(Boolean).join(' '),
        sopHint,
      };
    })
    .filter((row): row is OperationRow => row != null);
}

function normalizeEsop(raw: WorkOrderEsopDocument | Record<string, unknown> | null | undefined): WorkOrderEsopDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const sop = raw as Record<string, unknown>;
  const stepsRaw = Array.isArray(sop.steps) ? sop.steps : [];
  const attachmentsRaw = Array.isArray(sop.attachments) ? sop.attachments : [];
  return {
    uuid: String(sop.uuid || ''),
    name: firstNonEmpty(sop.name),
    version: firstNonEmpty(sop.version),
    current_revision: firstNonEmpty(sop.current_revision, sop.currentRevision),
    carrier: firstNonEmpty(sop.carrier) || 'electronic',
    storage_location: firstNonEmpty(sop.storage_location, sop.storageLocation),
    content: firstNonEmpty(sop.content),
    steps: stepsRaw.map((step, index) => {
      const row = (step ?? {}) as Record<string, unknown>;
      const uuids = row.attachment_uuids ?? row.attachmentUuids;
      return {
        id: firstNonEmpty(row.id) || `step-${index}`,
        type: firstNonEmpty(row.type) || 'step',
        title: firstNonEmpty(row.title) || '',
        description: firstNonEmpty(row.description),
        key_points: firstNonEmpty(row.key_points, row.keyPoints),
        attachment_uuids: Array.isArray(uuids) ? uuids.map(String).filter(Boolean) : [],
      };
    }),
    attachments: attachmentsRaw.map((file, index) => {
      const row = (file ?? {}) as Record<string, unknown>;
      return {
        key: firstNonEmpty(row.key) || String(index),
        name: firstNonEmpty(row.name) || '',
        file_uuid: firstNonEmpty(row.file_uuid, row.fileUuid),
        url: firstNonEmpty(row.url),
        source: firstNonEmpty(row.source) || 'sop',
      };
    }),
  };
}

function hasEsop(doc?: WorkOrderOperationDocuments | null): boolean {
  if (!doc) return false;
  const flag = (doc as WorkOrderOperationDocuments & { esopAvailable?: boolean }).esopAvailable;
  return Boolean(doc.sop || doc.esop_available || flag);
}

function looksLikeImage(name?: string): boolean {
  const n = String(name || '').trim();
  if (!n || !n.includes('.')) return true;
  return IMAGE_EXT_RE.test(n);
}

function EsopAttachments({ files }: { files: WorkOrderEsopFileItem[] }) {
  const { t } = useTranslation();
  if (!files.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {files.map((file) => {
        const uid = String(file.file_uuid || '').trim();
        if (!uid) return null;
        const name = file.name || t('app.kuaizhizao.workOrder.esop.attachment');
        if (looksLikeImage(name)) {
          return (
            <SecureImage
              key={file.key || uid}
              fileUuid={uid}
              alt={name}
              width={64}
              height={64}
              thumbSize={128}
              previewSize={512}
              enableOriginalAction
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
          );
        }
        return (
          <Button
            key={file.key || uid}
            icon={<PaperClipOutlined />}
            onClick={() => {
              void getFileDownloadUrlWithToken(uid).then((url) => {
                window.open(url, '_blank', 'noopener,noreferrer');
              });
            }}
          >
            {name}
          </Button>
        );
      })}
    </div>
  );
}

function EsopBody({ sop }: { sop: WorkOrderEsopDocument }) {
  const { t } = useTranslation();
  const carrier = sop.carrier || 'electronic';
  const steps = sop.steps || [];
  const attachments = sop.attachments || [];
  const content = typeof sop.content === 'string' ? sop.content.trim() : '';

  return (
    <>
      <Descriptions size="small" column={1} style={{ marginBottom: 16 }}>
        <Descriptions.Item label={t('app.kuaizhizao.workOrder.esop.name')}>
          {sop.name || '—'}
        </Descriptions.Item>
        {sop.version ? (
          <Descriptions.Item label={t('app.kuaizhizao.workOrder.esop.version')}>
            {sop.version}
          </Descriptions.Item>
        ) : null}
        {sop.current_revision ? (
          <Descriptions.Item label={t('app.kuaizhizao.workOrder.esop.revision')}>
            {sop.current_revision}
          </Descriptions.Item>
        ) : null}
        <Descriptions.Item label={t('app.kuaizhizao.workOrder.esop.carrier')}>
          {t(`app.kuaizhizao.workOrder.esop.carrier.${carrier}`, { defaultValue: carrier })}
        </Descriptions.Item>
        {sop.storage_location ? (
          <Descriptions.Item label={t('app.kuaizhizao.workOrder.esop.storageLocation')}>
            {sop.storage_location}
          </Descriptions.Item>
        ) : null}
      </Descriptions>
      {content ? (
        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{content}</Typography.Paragraph>
      ) : null}
      {attachments.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary">{t('app.kuaizhizao.workOrder.esop.attachments')}</Typography.Text>
          <div style={{ marginTop: 8 }}>
            <EsopAttachments files={attachments} />
          </div>
        </div>
      ) : null}
      {steps.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaizhizao.workOrder.esop.noSteps')}
        />
      ) : (
        <List
          header={t('app.kuaizhizao.workOrder.esop.steps')}
          dataSource={steps}
          renderItem={(step, index) => (
            <List.Item>
              <List.Item.Meta
                title={`${index + 1}. ${step.title || t('app.kuaizhizao.workOrder.esop.untitledStep')}`}
                description={
                  <>
                    {step.description ? (
                      <Typography.Paragraph style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                        {step.description}
                      </Typography.Paragraph>
                    ) : null}
                    {step.key_points ? (
                      <Typography.Paragraph type="secondary" style={{ marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                        {t('app.kuaizhizao.workOrder.esop.keyPoints')}: {step.key_points}
                      </Typography.Paragraph>
                    ) : null}
                    {(step.attachment_uuids || []).length > 0 ? (
                      <EsopAttachments
                        files={(step.attachment_uuids || []).map((uuid) => ({
                          key: uuid,
                          name: uuid,
                          file_uuid: uuid,
                          source: 'sop',
                        }))}
                      />
                    ) : null}
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </>
  );
}

export const WorkOrderEsopSidebar: React.FC<WorkOrderEsopSidebarProps> = ({
  open,
  onClose,
  workOrderId,
  operations,
  zIndex,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docsByOpId, setDocsByOpId] = useState<Record<number, WorkOrderOperationDocuments>>({});
  const [selectedOpId, setSelectedOpId] = useState<number | null>(null);
  const [resolvedOps, setResolvedOps] = useState<OperationRow[]>([]);

  const propOps = useMemo(() => toOperationRows(operations), [operations]);

  useEffect(() => {
    if (!open || !workOrderId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        let rows = propOps;
        if (rows.length === 0) {
          const fetched = await workOrderApi.getOperations(String(workOrderId));
          rows = toOperationRows(fetched);
        }
        if (cancelled) return;
        setResolvedOps(rows);
        if (rows.length === 0) {
          setDocsByOpId({});
          setSelectedOpId(null);
          return;
        }
        const results = await Promise.all(
          rows.map(async (row) => {
            try {
              const doc = await workOrderApi.getOperationDocuments(workOrderId, row.id);
              return [row.id, doc] as const;
            } catch {
              return [row.id, null] as const;
            }
          }),
        );
        if (cancelled) return;
        const next: Record<number, WorkOrderOperationDocuments> = {};
        let failedCount = 0;
        for (const [id, doc] of results) {
          if (doc) next[id] = doc;
          else failedCount += 1;
        }
        setDocsByOpId(next);
        if (failedCount === rows.length) {
          setSelectedOpId(null);
          setError(t('app.kuaizhizao.workOrder.esop.loadFailed'));
          return;
        }
        const firstWithEsop = rows.find((row) => hasEsop(next[row.id]));
        setSelectedOpId(firstWithEsop?.id ?? null);
      } catch (e) {
        if (!cancelled) {
          setDocsByOpId({});
          setSelectedOpId(null);
          setError(getApiErrorMessage(e, t('app.kuaizhizao.workOrder.esop.loadFailed')));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [open, workOrderId, propOps, t]);

  const boundOps = resolvedOps.filter((row) => hasEsop(docsByOpId[row.id]));
  const selectedDoc = selectedOpId != null ? docsByOpId[selectedOpId] : undefined;
  const selectedSop = normalizeEsop(selectedDoc?.sop);

  return (
    <Drawer
      title={
        <>
          <BookOutlined /> {t('app.kuaizhizao.workOrder.esop.title')}
        </>
      }
      open={open}
      onClose={onClose}
      width={480}
      zIndex={zIndex}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : error ? (
        <Result status="error" title={error} />
      ) : resolvedOps.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaizhizao.workOrder.esop.noOperations')}
        />
      ) : boundOps.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaizhizao.workOrder.esop.empty')}
        />
      ) : (
        <>
          {boundOps.length > 1 ? (
            <Select
              style={{ width: '100%', marginBottom: 16 }}
              value={selectedOpId ?? undefined}
              options={boundOps.map((row) => ({
                value: row.id,
                label: row.sopHint ? `${row.label} / ${row.sopHint}` : row.label,
              }))}
              onChange={(value) => setSelectedOpId(Number(value))}
            />
          ) : (
            <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              {boundOps[0]?.label}
              {boundOps[0]?.sopHint ? ` / ${boundOps[0].sopHint}` : ''}
            </Typography.Text>
          )}
          {selectedSop ? (
            <EsopBody sop={selectedSop} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('app.kuaizhizao.workOrder.esop.empty')}
            />
          )}
        </>
      )}
    </Drawer>
  );
};

export default WorkOrderEsopSidebar;
