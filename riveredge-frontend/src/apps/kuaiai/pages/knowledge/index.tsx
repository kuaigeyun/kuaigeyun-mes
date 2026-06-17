/**
 * KU-AI 知识库管理
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Upload,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { useResourcePermissions } from '../../../../hooks/useResourcePermissions';
import { uploadFile } from '../../../../services/file';
import {
  createFaqKnowledge,
  createFileKnowledge,
  createTextKnowledge,
  deleteKnowledgeDocument,
  exportTrainingJsonl,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
  seedDefaultFaqs,
  type KnowledgeDocument,
} from '../../services/knowledge';

const SOURCE_LABEL: Record<string, string> = {
  text: '文本',
  file: '文件',
  faq: 'FAQ',
};

const STATUS_COLOR: Record<string, string> = {
  indexed: 'success',
  pending: 'processing',
  failed: 'error',
};

const KnowledgePage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const perms = useResourcePermissions('kuaiai:knowledge');
  const trainingPerms = useResourcePermissions('kuaiai:training');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<KnowledgeDocument[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'text' | 'faq' | 'file'>('faq');
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listKnowledgeDocuments({ page, page_size: pageSize });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('app.kuaiai.knowledge.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize, t]);

  useEffect(() => {
    if (perms.canRead) void load();
  }, [load, perms.canRead]);

  const openModal = (type: 'text' | 'faq' | 'file') => {
    setModalType(type);
    form.resetFields();
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      if (modalType === 'faq') {
        await createFaqKnowledge(values.question, values.answer, values.title);
      } else if (modalType === 'text') {
        await createTextKnowledge(values.title, values.content);
      } else {
        const fileList = values.upload as { uuid?: string }[] | undefined;
        const uuid = fileList?.[0]?.uuid || values.file_uuid;
        if (!uuid) {
          message.error(t('app.kuaiai.knowledge.fileRequired'));
          return;
        }
        await createFileKnowledge(values.title, uuid);
      }
      message.success(t('app.kuaiai.knowledge.createSuccess'));
      setModalOpen(false);
      await load();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('app.kuaiai.knowledge.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSeedDefaults = async () => {
    try {
      const res = await seedDefaultFaqs();
      message.success(
        res.created > 0
          ? t('app.kuaiai.knowledge.seedSuccess', { count: res.created })
          : t('app.kuaiai.knowledge.seedAlready'),
      );
      await load();
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('app.kuaiai.knowledge.seedFailed'));
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportTrainingJsonl();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'kuaiai-training.jsonl';
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('app.kuaiai.knowledge.exportSuccess'));
    } catch (e: unknown) {
      message.error(e instanceof Error ? e.message : t('app.kuaiai.knowledge.exportFailed'));
    }
  };

  const columns: ColumnsType<KnowledgeDocument> = [
    { title: t('app.kuaiai.knowledge.colTitle'), dataIndex: 'title', ellipsis: true },
    {
      title: t('app.kuaiai.knowledge.colType'),
      dataIndex: 'source_type',
      width: 90,
      render: (v: string) => SOURCE_LABEL[v] || v,
    },
    {
      title: t('app.kuaiai.knowledge.colStatus'),
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <Tag color={STATUS_COLOR[v] || 'default'}>{v}</Tag>,
    },
    { title: t('app.kuaiai.knowledge.colChunks'), dataIndex: 'chunk_count', width: 80 },
    {
      title: t('app.kuaiai.knowledge.colActions'),
      key: 'actions',
      width: 200,
      render: (_, row) => (
        <Space>
          {perms.canUpdate ? (
            <Button type="link" size="small" onClick={() => void reindexKnowledgeDocument(row.id).then(load)}>
              {t('app.kuaiai.knowledge.reindex')}
            </Button>
          ) : null}
          {perms.canDelete ? (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => {
                Modal.confirm({
                  title: t('app.kuaiai.knowledge.deleteConfirm'),
                  onOk: async () => {
                    await deleteKnowledgeDocument(row.id);
                    message.success(t('app.kuaiai.knowledge.deleteSuccess'));
                    await load();
                  },
                });
              }}
            >
              {t('common.delete')}
            </Button>
          ) : null}
        </Space>
      ),
    },
  ];

  if (!perms.canRead) {
    return <Card>{t('pages.infra.operation.noPermission')}</Card>;
  }

  return (
    <div style={{ padding: 16 }}>
      <Card
        title={t('app.kuaiai.menu.knowledge')}
        extra={
          <Space wrap>
            {perms.canCreate ? (
              <Button onClick={() => void handleSeedDefaults()}>
                {t('app.kuaiai.knowledge.seedDefaults')}
              </Button>
            ) : null}
            {perms.canCreate ? (
              <>
                <Button onClick={() => openModal('faq')}>{t('app.kuaiai.knowledge.addFaq')}</Button>
                <Button onClick={() => openModal('text')}>{t('app.kuaiai.knowledge.addText')}</Button>
                <Button onClick={() => openModal('file')}>{t('app.kuaiai.knowledge.addFile')}</Button>
              </>
            ) : null}
            <Button
              disabled={!trainingPerms.canExport}
              onClick={() => void handleExport()}
            >
              {t('app.kuaiai.knowledge.exportTraining')}
            </Button>
          </Space>
        }
      >
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={items}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>

      <Modal
        title={
          modalType === 'faq'
            ? t('app.kuaiai.knowledge.addFaq')
            : modalType === 'text'
              ? t('app.kuaiai.knowledge.addText')
              : t('app.kuaiai.knowledge.addFile')
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label={t('app.kuaiai.knowledge.colTitle')}>
            <Input placeholder={t('app.kuaiai.knowledge.titlePlaceholder')} />
          </Form.Item>
          {modalType === 'faq' ? (
            <>
              <Form.Item
                name="question"
                label={t('app.kuaiai.knowledge.faqQuestion')}
                rules={[{ required: true }]}
              >
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item
                name="answer"
                label={t('app.kuaiai.knowledge.faqAnswer')}
                rules={[{ required: true }]}
              >
                <Input.TextArea rows={4} />
              </Form.Item>
            </>
          ) : null}
          {modalType === 'text' ? (
            <>
              <Form.Item name="title" label={t('app.kuaiai.knowledge.colTitle')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="content" label={t('app.kuaiai.knowledge.textContent')} rules={[{ required: true }]}>
                <Input.TextArea rows={8} />
              </Form.Item>
            </>
          ) : null}
          {modalType === 'file' ? (
            <>
              <Form.Item name="title" label={t('app.kuaiai.knowledge.colTitle')} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label={t('app.kuaiai.knowledge.uploadFile')} required>
                <Upload
                  maxCount={1}
                  beforeUpload={async file => {
                    try {
                      const res = await uploadFile(file);
                      form.setFieldValue('upload', [{ uuid: res.uuid, name: file.name }]);
                    } catch (e: unknown) {
                      message.error(e instanceof Error ? e.message : t('app.kuaiai.knowledge.uploadFailed'));
                    }
                    return false;
                  }}
                  onRemove={() => {
                    form.setFieldValue('upload', []);
                  }}
                >
                  <Button>{t('app.kuaiai.knowledge.selectFile')}</Button>
                </Upload>
              </Form.Item>
              <Form.Item name="upload" hidden>
                <Input />
              </Form.Item>
            </>
          ) : null}
        </Form>
      </Modal>
    </div>
  );
};

export default KnowledgePage;
