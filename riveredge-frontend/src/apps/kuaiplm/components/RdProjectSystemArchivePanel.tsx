/**
 * 研发项目体系归档八类（R-01 #70）
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Descriptions,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  CloudUploadOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import {
  ProFormText,
  ProFormTextArea,
  ProFormUploadDragger,
} from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
import { FormModalTemplate } from '../../../components/layout-templates';
import { ActionConfirmPopconfirm } from '../../../components/action-confirm';
import { uploadMultipleFiles } from '../../../services/file';
import {
  acceptSystemArchiveItem,
  clearSystemArchiveItem,
  linkSystemArchiveItem,
  markSystemArchiveMissing,
  rejectSystemArchiveItem,
  uploadSystemArchiveItem,
  type RdProjectSystemArchiveItem,
  type RdProjectSystemArchiveList,
} from '../services/rd-project';

const FILE_CATEGORY = 'kuaiplm-rd-project-system-archive';

const FILL_COLOR: Record<string, string> = {
  empty: 'default',
  uploaded: 'processing',
  linked: 'blue',
  missing_marked: 'warning',
};

const ACCEPT_COLOR: Record<string, string> = {
  none: 'default',
  pending: 'processing',
  accepted: 'success',
  rejected: 'error',
};

export interface RdProjectSystemArchivePanelProps {
  projectId: number;
  archive?: RdProjectSystemArchiveList | null;
  canUpdate: boolean;
  onChanged: () => void;
}

export const RdProjectSystemArchivePanel: React.FC<RdProjectSystemArchivePanelProps> = ({
  projectId,
  archive,
  canUpdate,
  onChanged,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<RdProjectSystemArchiveItem | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const uploadFormRef = useRef<any>(null);
  const linkFormRef = useRef<any>(null);
  const missingFormRef = useRef<any>(null);
  const rejectFormRef = useRef<any>(null);

  const summary = archive?.summary;
  const items = archive?.items ?? [];

  const fillLabel = useCallback(
    (status: string) => t(`app.kuaiplm.rdProjects.systemArchive.fillStatus.${status}`, status),
    [t],
  );
  const acceptLabel = useCallback(
    (status: string) => t(`app.kuaiplm.rdProjects.systemArchive.acceptanceStatus.${status}`, status),
    [t],
  );

  const columns = useMemo(
    () => [
      {
        title: t('app.kuaiplm.rdProjects.systemArchive.columns.type'),
        dataIndex: 'archive_type_name',
        width: 160,
      },
      {
        title: t('app.kuaiplm.rdProjects.systemArchive.columns.fill'),
        dataIndex: 'fill_status',
        width: 100,
        render: (v: string) => <Tag color={FILL_COLOR[v] ?? 'default'}>{fillLabel(v)}</Tag>,
      },
      {
        title: t('app.kuaiplm.rdProjects.systemArchive.columns.content'),
        key: 'content',
        ellipsis: true,
        render: (_: unknown, row: RdProjectSystemArchiveItem) => {
          if (row.fill_status === 'missing_marked') {
            return row.missing_notes || t('app.kuaiplm.rdProjects.systemArchive.pendingSupplement');
          }
          if (row.file_name) return row.file_name;
          if (row.linked_target_name) {
            return `${row.linked_target_code ?? ''} ${row.linked_target_name}`.trim();
          }
          return '-';
        },
      },
      {
        title: t('app.kuaiplm.rdProjects.systemArchive.columns.acceptance'),
        dataIndex: 'acceptance_status',
        width: 100,
        render: (v: string) => <Tag variant="filled" color={ACCEPT_COLOR[v] ?? 'default'}>{acceptLabel(v)}</Tag>,
      },
      {
        title: t('common.actions'),
        key: 'actions',
        width: 280,
        render: (_: unknown, row: RdProjectSystemArchiveItem) => (
          <Space size={4} wrap>
            {row.upload_template ? (
              <Button
                type="link"
                size="small"
                icon={<FileSearchOutlined />}
                onClick={() => {
                  setActiveItem(row);
                  setTemplateOpen(true);
                }}
              >
                {t('app.kuaiplm.rdProjects.systemArchive.viewTemplate')}
              </Button>
            ) : null}
            {canUpdate && row.modes?.includes('upload') ? (
              <Button
                type="link"
                size="small"
                icon={<CloudUploadOutlined />}
                onClick={() => {
                  setActiveItem(row);
                  setUploadOpen(true);
                }}
              >
                {t('common.upload')}
              </Button>
            ) : null}
            {canUpdate && row.modes?.includes('link') ? (
              <Button
                type="link"
                size="small"
                icon={<LinkOutlined />}
                onClick={() => {
                  setActiveItem(row);
                  setLinkOpen(true);
                }}
              >
                {t('app.kuaiplm.rdProjects.systemArchive.link')}
              </Button>
            ) : null}
            {canUpdate ? (
              <Button
                type="link"
                size="small"
                icon={<ExclamationCircleOutlined />}
                onClick={() => {
                  setActiveItem(row);
                  setMissingOpen(true);
                }}
              >
                {t('app.kuaiplm.rdProjects.systemArchive.markMissing')}
              </Button>
            ) : null}
            {canUpdate && (row.fill_status === 'uploaded' || row.fill_status === 'linked') ? (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={async () => {
                    await acceptSystemArchiveItem(projectId, row.id!, {});
                    messageApi.success(t('app.kuaiplm.rdProjects.systemArchive.acceptSuccess'));
                    onChanged();
                  }}
                >
                  {t('app.kuaiplm.rdProjects.systemArchive.accept')}
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => {
                    setActiveItem(row);
                    setRejectOpen(true);
                  }}
                >
                  {t('app.kuaiplm.rdProjects.systemArchive.reject')}
                </Button>
              </>
            ) : null}
            {canUpdate && row.fill_status !== 'empty' ? (
              <ActionConfirmPopconfirm
                title={t('app.kuaiplm.rdProjects.systemArchive.clearConfirm')}
                onConfirm={async () => {
                  await clearSystemArchiveItem(projectId, row.id!);
                  messageApi.success(t('common.success'));
                  onChanged();
                }}
              >
                <Button type="link" size="small" danger>
                  {t('common.clear')}
                </Button>
              </ActionConfirmPopconfirm>
            ) : null}
          </Space>
        ),
      },
    ],
    [canUpdate, fillLabel, acceptLabel, messageApi, onChanged, projectId, t],
  );

  return (
    <>
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {summary ? (
          <Typography.Text type="secondary">
            {t('app.kuaiplm.rdProjects.systemArchive.summaryLine', {
              filled: summary.filled,
              total: summary.total,
              missing: summary.missing_marked,
              accepted: summary.accepted,
            })}
          </Typography.Text>
        ) : null}
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={columns}
          dataSource={items}
          scroll={{ x: 960 }}
        />
      </Space>

      <Modal
        open={templateOpen}
        title={activeItem?.upload_template?.title ?? activeItem?.archive_type_name}
        onCancel={() => setTemplateOpen(false)}
        footer={null}
        destroyOnHidden
      >
        {activeItem?.upload_template ? (
          <>
            <Typography.Paragraph>{activeItem.upload_template.hint}</Typography.Paragraph>
            <Descriptions column={1} size="small" bordered>
              {activeItem.upload_template.columns.map((col) => (
                <Descriptions.Item key={col} label={col}>
                  {t('app.kuaiplm.rdProjects.systemArchive.templateFieldPlaceholder')}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </>
        ) : null}
      </Modal>

      <FormModalTemplate
        title={t('app.kuaiplm.rdProjects.systemArchive.uploadTitle', {
          name: activeItem?.archive_type_name ?? '',
        })}
        open={uploadOpen}
        onClose={() => {
          setUploadOpen(false);
          setActiveItem(null);
        }}
        formRef={uploadFormRef}
        onFinish={async (values) => {
          const files = values.file_upload as Array<{ response?: { uuid?: string; file_name?: string; url?: string } }>;
          const file = files?.[0]?.response;
          if (!file?.uuid) {
            messageApi.error(t('app.kuaiplm.rdProjects.systemArchive.uploadRequired'));
            return;
          }
          await uploadSystemArchiveItem(projectId, activeItem!.id!, {
            file_uuid: file.uuid,
            file_name: file.file_name,
            file_url: file.url,
            notes: values.notes,
          });
          messageApi.success(t('common.success'));
          setUploadOpen(false);
          setActiveItem(null);
          onChanged();
        }}
      >
        {activeItem?.upload_template ? (
          <Typography.Paragraph type="secondary">
            {activeItem.upload_template.hint}
          </Typography.Paragraph>
        ) : null}
        <ProFormUploadDragger
          name="file_upload"
          label={t('common.attachments')}
          max={1}
          rules={[{ required: true }]}
          fieldProps={{
            multiple: false,
            maxCount: 1,
            customRequest: async (options) => {
              try {
                const res = await uploadMultipleFiles([options.file as File], {
                  category: FILE_CATEGORY,
                });
                options.onSuccess?.(res[0], options.file as any);
              } catch (err) {
                options.onError?.(err as Error);
              }
            },
          }}
        />
        <ProFormTextArea name="notes" label={t('common.remark')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.rdProjects.systemArchive.linkTitle', {
          name: activeItem?.archive_type_name ?? '',
        })}
        open={linkOpen}
        onClose={() => {
          setLinkOpen(false);
          setActiveItem(null);
        }}
        formRef={linkFormRef}
        onFinish={async (values) => {
          await linkSystemArchiveItem(projectId, activeItem!.id!, values);
          messageApi.success(t('common.success'));
          setLinkOpen(false);
          setActiveItem(null);
          onChanged();
        }}
      >
        <ProFormText
          name="linked_target_type"
          label={t('app.kuaiplm.rdProjects.systemArchive.linkType')}
          rules={[{ required: true }]}
          extra={(activeItem?.link_target_types ?? []).join(', ')}
        />
        <ProFormText
          name="linked_target_id"
          label={t('app.kuaiplm.rdProjects.systemArchive.linkTargetId')}
        />
        <ProFormText name="linked_target_code" label={t('common.code')} />
        <ProFormText name="linked_target_name" label={t('common.name')} rules={[{ required: true }]} />
        <ProFormTextArea name="notes" label={t('common.remark')} />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.rdProjects.systemArchive.missingTitle', {
          name: activeItem?.archive_type_name ?? '',
        })}
        open={missingOpen}
        onClose={() => {
          setMissingOpen(false);
          setActiveItem(null);
        }}
        formRef={missingFormRef}
        onFinish={async (values) => {
          await markSystemArchiveMissing(projectId, activeItem!.id!, values);
          messageApi.success(t('common.success'));
          setMissingOpen(false);
          setActiveItem(null);
          onChanged();
        }}
      >
        <ProFormTextArea
          name="missing_notes"
          label={t('app.kuaiplm.rdProjects.systemArchive.missingNotes')}
          rules={[{ required: true }]}
        />
      </FormModalTemplate>

      <FormModalTemplate
        title={t('app.kuaiplm.rdProjects.systemArchive.rejectTitle')}
        open={rejectOpen}
        onClose={() => {
          setRejectOpen(false);
          setActiveItem(null);
        }}
        formRef={rejectFormRef}
        onFinish={async (values) => {
          await rejectSystemArchiveItem(projectId, activeItem!.id!, values);
          messageApi.success(t('common.success'));
          setRejectOpen(false);
          setActiveItem(null);
          onChanged();
        }}
      >
        <ProFormTextArea
          name="acceptance_notes"
          label={t('app.kuaiplm.rdProjects.systemArchive.rejectNotes')}
          rules={[{ required: true }]}
        />
      </FormModalTemplate>
    </>
  );
};
