/**
 * 工单详情关联 ESOP（工艺作业指导，不走 KU-AI）。
 * 取数：work-orders/{id}/related-esops（工单所含工序全部适用 SOP，非报工择一）。
 */

import React, { useEffect, useState } from 'react';
import { Button, Descriptions, Divider, Drawer, Empty, List, Result, Spin, Typography } from 'antd';
import { BookOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { SecureImage } from '../../../../../../components/secure-image';
import { getFileDownloadUrlWithToken } from '../../../../../../services/file';
import { getApiErrorMessage } from '../../../../../../utils/errorHandler';
import {
  workOrderApi,
  type WorkOrderEsopDocument,
  type WorkOrderEsopFileItem,
  type WorkOrderOperationEsopItem,
} from '../../../../services/work-order';

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

export type WorkOrderEsopSidebarProps = {
  open: boolean;
  onClose: () => void;
  workOrderId?: number;
  operations?: unknown[];
  zIndex?: number;
};

function firstNonEmpty(...candidates: unknown[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return undefined;
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

function operationLabel(item: WorkOrderOperationEsopItem): string {
  const sequence = item.sequence != null ? `${item.sequence}.` : '';
  const name = firstNonEmpty(item.operation_name) || `#${item.work_order_operation_id}`;
  const code = firstNonEmpty(item.operation_code);
  return [sequence, name, code && `(${code})`].filter(Boolean).join(' ');
}

function EsopSection({
  heading,
  sops,
}: {
  heading: string;
  sops: WorkOrderEsopDocument[];
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {heading}
      </Typography.Title>
      {sops.map((sop, index) => (
        <div key={sop.uuid || `${heading}-${index}`} style={{ marginBottom: 16 }}>
          {sops.length > 1 && index > 0 ? <Divider /> : null}
          <EsopBody sop={sop} />
        </div>
      ))}
    </div>
  );
}

export const WorkOrderEsopSidebar: React.FC<WorkOrderEsopSidebarProps> = ({
  open,
  onClose,
  workOrderId,
  zIndex,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sharedSops, setSharedSops] = useState<WorkOrderEsopDocument[]>([]);
  const [operationItems, setOperationItems] = useState<WorkOrderOperationEsopItem[]>([]);
  const [hasOperations, setHasOperations] = useState(true);

  useEffect(() => {
    if (!open || !workOrderId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await workOrderApi.getRelatedEsops(workOrderId);
        if (cancelled) return;
        const shared = (data.shared_sops || [])
          .map((row) => normalizeEsop(row))
          .filter((row): row is WorkOrderEsopDocument => row != null && Boolean(row.uuid));
        const ops = (data.operations || []).map((item) => ({
          ...item,
          sops: (item.sops || [])
            .map((row) => normalizeEsop(row))
            .filter((row): row is WorkOrderEsopDocument => row != null && Boolean(row.uuid)),
        }));
        setSharedSops(shared);
        setOperationItems(ops);
        setHasOperations(ops.length > 0);
      } catch (e) {
        if (!cancelled) {
          setSharedSops([]);
          setOperationItems([]);
          setHasOperations(true);
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
  }, [open, workOrderId, t]);

  const boundOps = operationItems.filter((item) => (item.sops || []).length > 0);
  const hasAny = sharedSops.length > 0 || boundOps.length > 0;

  return (
    <Drawer
      title={
        <>
          <BookOutlined /> {t('app.kuaizhizao.workOrder.esop.title')}
        </>
      }
      open={open}
      onClose={onClose}
      size={480}
      zIndex={zIndex}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <Spin />
        </div>
      ) : error ? (
        <Result status="error" title={error} />
      ) : !hasOperations && sharedSops.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaizhizao.workOrder.esop.noOperations')}
        />
      ) : !hasAny ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('app.kuaizhizao.workOrder.esop.empty')}
        />
      ) : (
        <>
          {sharedSops.length > 0 ? (
            <EsopSection heading={t('app.kuaizhizao.workOrder.esop.sharedHeading')} sops={sharedSops} />
          ) : null}
          {boundOps.map((item, index) => (
            <div key={item.work_order_operation_id}>
              {sharedSops.length > 0 || index > 0 ? <Divider /> : null}
              <EsopSection heading={operationLabel(item)} sops={item.sops || []} />
            </div>
          ))}
        </>
      )}
    </Drawer>
  );
};

export default WorkOrderEsopSidebar;
