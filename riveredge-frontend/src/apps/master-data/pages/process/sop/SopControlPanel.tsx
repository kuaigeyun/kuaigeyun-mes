/**
 * SOP 文控：详情抽屉修订履历、受控份台账、审核操作、打印。
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App, Button, Descriptions, Modal, Space, Table, Typography } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MarkerTag } from '../../../../../constants/statusBadges';
import { sopApi } from '../../../services/process';
import type { SOP, SopControlledCopy, SopRevision } from '../../../types/process';
import { formatDateTimeBySiteSetting } from '../../../../../utils/format';
import { getApiErrorMessage } from '../../../../../utils/errorHandler';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';

const CARRIER_LABELS: Record<string, string> = {
  electronic: '电子',
  paper: '纸质',
  hybrid: '混合',
};

const CONTROL_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  in_review: { label: '审核中', color: 'processing' },
  effective: { label: '生效', color: 'success' },
  obsolete: { label: '作废', color: 'error' },
};

const COPY_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  issued: { label: '已发放', color: 'success' },
  pending_retrieve: { label: '待回收', color: 'warning' },
  retrieved: { label: '已回收', color: 'default' },
  lost: { label: '丢失', color: 'error' },
};

export function renderSopCarrierTag(carrier?: string) {
  const key = carrier || 'electronic';
  return <MarkerTag color="geekblue">{CARRIER_LABELS[key] ?? key}</MarkerTag>;
}

export function renderSopControlStatusTag(status?: string) {
  const key = status || 'draft';
  const cfg = CONTROL_STATUS_LABELS[key] ?? { label: key, color: 'default' };
  return <MarkerTag color={cfg.color}>{cfg.label}</MarkerTag>;
}

function openPrintWindow(data: {
  code: string;
  name: string;
  revision: string;
  watermark: string;
  content?: string;
  storageLocation?: string;
  steps?: Array<Record<string, unknown>>;
}) {
  const stepHtml = (data.steps ?? [])
    .map(
      (s, i) =>
        `<li><strong>${i + 1}. ${String(s.title ?? '')}</strong>${s.description ? `<div>${s.description}</div>` : ''}</li>`,
    )
    .join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${data.code}</title>
<style>
body{font-family:sans-serif;padding:24px;}
.watermark{position:fixed;top:40%;left:10%;font-size:48px;color:rgba(200,0,0,.15);transform:rotate(-25deg);pointer-events:none;z-index:0;}
.content{position:relative;z-index:1;}
h1{font-size:20px;margin:0 0 8px;}
.meta{color:#666;font-size:13px;margin-bottom:16px;}
</style></head><body>
<div class="watermark">${data.watermark}</div>
<div class="content">
<h1>${data.name}</h1>
<div class="meta">${data.code} 修订 ${data.revision}${data.storageLocation ? ` 存放 ${data.storageLocation}` : ''}</div>
${data.content ? `<div>${data.content}</div>` : ''}
${stepHtml ? `<ol>${stepHtml}</ol>` : ''}
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export type SopControlPanelProps = {
  sop: SOP;
  onRefresh: () => void;
};

export const SopControlPanel: React.FC<SopControlPanelProps> = ({ sop, onRefresh }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const perms = useResourcePermissions('master-data:process:sop');
  const [revisions, setRevisions] = useState<SopRevision[]>([]);
  const [copies, setCopies] = useState<SopControlledCopy[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchLocationType, setDispatchLocationType] = useState('workshop');
  const [dispatchNote, setDispatchNote] = useState('');

  const loadControlData = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, copyRes] = await Promise.all([
        sopApi.listRevisions(sop.uuid),
        sopApi.listCopies(sop.uuid),
      ]);
      setRevisions(revRes.data ?? []);
      setCopies(copyRes.data ?? []);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [message, sop.uuid]);

  useEffect(() => {
    void loadControlData();
  }, [loadControlData]);

  const runAction = async (action: () => Promise<unknown>, okMsg: string) => {
    try {
      await action();
      message.success(okMsg);
      onRefresh();
      await loadControlData();
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const handlePrint = async (controlled: boolean, copyId?: number) => {
    try {
      const data = await sopApi.getPrintData(sop.uuid, { controlled, copyId });
      openPrintWindow(data);
    } catch (e) {
      message.error(getApiErrorMessage(e));
    }
  };

  const status = sop.controlStatus ?? 'draft';

  return (
    <>
      <Space wrap style={{ marginBottom: 12 }}>
        {status === 'draft' && perms.canAction?.('submit') && (
          <Button type="primary" onClick={() => runAction(() => sopApi.submit(sop.uuid), '已提交审核')}>
            提交审核
          </Button>
        )}
        {status === 'in_review' && perms.canAction?.('approve') && (
          <Button type="primary" onClick={() => runAction(() => sopApi.approve(sop.uuid), '审核通过')}>
            审核通过
          </Button>
        )}
        {status === 'in_review' && perms.canAction?.('publish') && (
          <Button onClick={() => runAction(() => sopApi.publish(sop.uuid), '已发布生效')}>
            发布生效
          </Button>
        )}
        {status === 'in_review' && perms.canAction?.('reject') && (
          <Button danger onClick={() => runAction(() => sopApi.reject(sop.uuid), '已驳回')}>
            驳回
          </Button>
        )}
        {status === 'in_review' && perms.canAction?.('revoke') && (
          <Button onClick={() => runAction(() => sopApi.revoke(sop.uuid), '已撤销提交')}>
            撤销提交
          </Button>
        )}
        {status === 'effective' && perms.canUpdate && (
          <Button onClick={() => runAction(() => sopApi.revise(sop.uuid, {}), '已升版为草稿')}>
            升版
          </Button>
        )}
        {(status === 'effective' || status === 'draft') && perms.canAction?.('obsolete') && (
          <Button danger onClick={() => runAction(() => sopApi.obsolete(sop.uuid), '已作废')}>
            作废
          </Button>
        )}
        {status === 'effective' && perms.canAction?.('dispatch') && (
          <Button onClick={() => setDispatchOpen(true)}>发放受控份</Button>
        )}
        {perms.canPrint && (
          <>
            <Button icon={<PrinterOutlined />} onClick={() => void handlePrint(false)}>
              非受控打印
            </Button>
            {status === 'effective' && (
              <Button icon={<PrinterOutlined />} onClick={() => void handlePrint(true)}>
                受控打印
              </Button>
            )}
          </>
        )}
      </Space>

      <Typography.Title level={5} style={{ marginTop: 8 }}>
        修订履历
      </Typography.Title>
      <Table<SopRevision>
        size="small"
        rowKey="id"
        loading={loading}
        pagination={false}
        dataSource={revisions}
        columns={[
          { title: '修订号', dataIndex: 'revision', width: 100 },
          {
            title: '载体',
            dataIndex: 'carrier',
            width: 80,
            render: (v) => renderSopCarrierTag(v),
          },
          {
            title: '生效时间',
            dataIndex: 'effectiveAt',
            render: (v) => (v ? formatDateTimeBySiteSetting(v) : '-'),
          },
          {
            title: '作废时间',
            dataIndex: 'obsoleteAt',
            render: (v) => (v ? formatDateTimeBySiteSetting(v) : '-'),
          },
          { title: '发布人', dataIndex: 'publishedByName', ellipsis: true },
          { title: '变更说明', dataIndex: 'changeReason', ellipsis: true },
        ]}
      />

      <Typography.Title level={5} style={{ marginTop: 16 }}>
        受控份台账
      </Typography.Title>
      <Table<SopControlledCopy>
        size="small"
        rowKey="id"
        loading={loading}
        pagination={false}
        dataSource={copies}
        columns={[
          { title: '份号', dataIndex: 'copyNo', width: 90 },
          { title: '修订', dataIndex: 'revision', width: 80 },
          { title: '位置类型', dataIndex: 'locationType', width: 90 },
          { title: '位置说明', dataIndex: 'locationNote', ellipsis: true },
          {
            title: '状态',
            dataIndex: 'status',
            width: 90,
            render: (v: string) => {
              const cfg = COPY_STATUS_LABELS[v] ?? { label: v, color: 'default' };
              return <MarkerTag color={cfg.color}>{cfg.label}</MarkerTag>;
            },
          },
          {
            title: '操作',
            width: 160,
            render: (_, row) =>
              (row.status === 'issued' || row.status === 'pending_retrieve') && perms.canAction?.('recall') ? (
                <Space size={4}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() =>
                      runAction(() => sopApi.recallCopy(sop.uuid, { copyId: row.id }), '已回收')
                    }
                  >
                    回收
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    onClick={() =>
                      runAction(
                        () => sopApi.recallCopy(sop.uuid, { copyId: row.id, markLost: true }),
                        '已标记丢失',
                      )
                    }
                  >
                    标记丢失
                  </Button>
                  {row.status === 'issued' && perms.canPrint && (
                    <Button type="link" size="small" onClick={() => void handlePrint(true, row.id)}>
                      打印
                    </Button>
                  )}
                </Space>
              ) : (
                '-'
              ),
          },
        ]}
      />

      <Modal
        title="发放受控份"
        open={dispatchOpen}
        onCancel={() => setDispatchOpen(false)}
        onOk={() =>
          runAction(
            () =>
              sopApi.dispatchCopy(sop.uuid, {
                locationType: dispatchLocationType,
                locationNote: dispatchNote || undefined,
              }),
            '受控份已发放',
          ).then(() => setDispatchOpen(false))
        }
        destroyOnHidden
      >
        <Descriptions column={1} size="small">
          <Descriptions.Item label="位置类型">
            <select
              value={dispatchLocationType}
              onChange={(e) => setDispatchLocationType(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="plant">厂区</option>
              <option value="workshop">车间</option>
              <option value="station">工位</option>
              <option value="person">人员</option>
            </select>
          </Descriptions.Item>
          <Descriptions.Item label="位置说明">
            <input
              value={dispatchNote}
              onChange={(e) => setDispatchNote(e.target.value)}
              style={{ width: '100%' }}
              placeholder="如 3号线边柜 A-2"
            />
          </Descriptions.Item>
        </Descriptions>
      </Modal>
    </>
  );
};

export const sopControlDetailFields = [
  {
    title: '载体',
    dataIndex: 'carrier',
    render: (_: unknown, r: SOP) => renderSopCarrierTag(r.carrier),
  },
  {
    title: '文控状态',
    dataIndex: 'controlStatus',
    render: (_: unknown, r: SOP) => renderSopControlStatusTag(r.controlStatus),
  },
  {
    title: '现行修订',
    dataIndex: 'currentRevision',
    render: (_: unknown, r: SOP) => r.currentRevision ?? r.version ?? '-',
  },
  {
    title: '存放位置',
    dataIndex: 'storageLocation',
  },
  {
    title: '保管人',
    dataIndex: 'keeperName',
  },
  {
    title: '已发放份数',
    dataIndex: 'issuedCopyCount',
    render: (_: unknown, r: SOP) => r.issuedCopyCount ?? 0,
  },
  {
    title: '待回收份数',
    dataIndex: 'pendingRetrieveCopyCount',
    render: (_: unknown, r: SOP) => r.pendingRetrieveCopyCount ?? 0,
  },
];
