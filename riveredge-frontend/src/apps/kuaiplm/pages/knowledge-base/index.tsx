import { rowActionKind } from '../../../../components/uni-action';
/**
 * 研发知识库 — 空间与文章
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Card, Col, Row, Typography } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../components/uni-table';
import { UniBatchMenuButton } from '../../../../components/uni-batch';
import { ListPageTemplate, FormModalTemplate } from '../../../../components/layout-templates';
import {
  listKbSpaces,
  listKbArticles,
  createKbArticle,
  deleteKbArticle,
  updateKbArticle,
  type KbSpace,
  type KbArticle,
} from '../../services/knowledge-base';
import { useNewShortcut } from '../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';

const KnowledgeBasePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [spaces, setSpaces] = useState<KbSpace[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | undefined>();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  useEffect(() => {
    listKbSpaces({ limit: 100 })
      .then((res) => setSpaces(res.items))
      .catch(() => setSpaces([]));
  }, []);

  const toArticleIds = (keys: React.Key[]) =>
    keys.map((key) => Number(key)).filter((id) => Number.isFinite(id) && id > 0);

  const handleBatchDelete = async (keys: React.Key[]) => {
    const ids = toArticleIds(keys);
    if (!ids.length) {
      messageApi.warning('请先选择文章');
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await deleteKbArticle(id);
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(`已删除 ${successCount} 篇文章`);
      setSelectedRowKeys([]);
      actionRef.current?.reload();
      return;
    }
    messageApi.error('批量删除失败');
  };

  const handleBatchSetStatus = async (status: 'PUBLISHED' | 'ARCHIVED', label: string) => {
    const ids = toArticleIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning('请先选择文章');
      return;
    }
    let successCount = 0;
    for (const id of ids) {
      try {
        await updateKbArticle(id, { status });
        successCount += 1;
      } catch {
        // continue processing remaining rows
      }
    }
    if (successCount > 0) {
      messageApi.success(`已将 ${successCount} 篇文章设置为${label}`);
      actionRef.current?.reload();
      return;
    }
    messageApi.error('批量更新状态失败');
  };

  const handleBatchOpenDetail = () => {
    const ids = toArticleIds(selectedRowKeys);
    if (!ids.length) {
      messageApi.warning('请先选择文章');
      return;
    }
    ids.forEach((id) => {
      window.open(`/apps/kuaiplm/knowledge-base/detail/${id}`, '_blank');
    });
  };

  const columns: ProColumns<KbArticle>[] = [
    {
      title: '标题',
      dataIndex: 'title',
      render: (_, row) => (
        <a onClick={() => navigate(`/apps/kuaiplm/knowledge-base/detail/${row.id}`)}>{row.title}</a>
      ),
    },
    { title: '空间', dataIndex: 'space_name', width: 120, hideInSearch: true },
    { title: '状态', dataIndex: 'status', width: 90 },
    { title: '作者', dataIndex: 'author_name', width: 100, hideInSearch: true },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 168,
      hideInSearch: true,
      render: (_, row) => (row.updated_at ? dayjs(row.updated_at).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 100,
      render: (_, row) => [
            <Button {...rowActionKind('update')}
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/apps/kuaiplm/knowledge-base/detail/${row.id}`)}
            >
              编辑
            </Button>,
          ],
    },
  ];

  return (
    <ListPageTemplate>
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Card title="知识空间" size="small">
            <div>
              {[{ id: undefined, space_name: '全部' } as KbSpace, ...spaces].map((item) => (
                <div
                  key={item.id ?? 'all'}
                  style={{
                    cursor: 'pointer',
                    background: selectedSpaceId === item.id ? 'var(--ant-color-fill-secondary)' : undefined,
                    padding: '8px 12px',
                    borderRadius: 6,
                    marginBottom: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onClick={() => {
                    setSelectedSpaceId(item.id);
                    actionRef.current?.reload();
                  }}
                >
                  <Typography.Text strong={selectedSpaceId === item.id}>
                    {item.space_name}
                  </Typography.Text>
                  {item.article_count != null ? (
                    <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                      ({item.article_count})
                    </Typography.Text>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </Col>
        <Col xs={24} md={18}>
          <UniTable<KbArticle>
            headerTitle="知识文章"
            actionRef={actionRef}
            rowKey="id"
            enableRowSelection
            selectedRowKeys={selectedRowKeys}
            onRowSelectionChange={setSelectedRowKeys}
            columns={columns}
            columnPersistenceId="apps.kuaiplm.pages.knowledge-base"
            search={false}
            request={async (params) => {
              const { current, pageSize } = params;
              try {
                const res = await listKbArticles({
                  skip: ((current || 1) - 1) * (pageSize || 20),
                  limit: pageSize || 20,
                  space_id: selectedSpaceId,
                });
                return { data: res.items, total: res.total, success: true };
              } catch (e: any) {
                messageApi.error(e?.message || '加载失败');
                return { data: [], total: 0, success: false };
              }
            }}
            showCreateButton
            createButtonText={'新建文章' + NEW_SHORTCUT_HINT}
            onCreate={handleCreate}
            showDeleteButton
            onDelete={handleBatchDelete}
            deleteConfirmTitle={(count) => `确定要删除选中的 ${count} 篇知识文章吗？`}
            toolBarActionsAfterDelete={[
              <UniBatchMenuButton
                key="kb-batch-actions"
                selectedRowKeys={selectedRowKeys}
                buttonText="批量操作"
                menuItems={[
                  {
                    key: 'batch-publish',
                    label: '批量发布',
                    onClick: () => {
                      void handleBatchSetStatus('PUBLISHED', '已发布');
                    },
                  },
                  {
                    key: 'batch-archive',
                    label: '批量归档',
                    onClick: () => {
                      void handleBatchSetStatus('ARCHIVED', '已归档');
                    },
                  },
                  {
                    key: 'batch-open-detail',
                    label: '批量打开详情',
                    onClick: () => {
                      handleBatchOpenDetail();
                    },
                  },
                ]}
              />,
            ]}
          />
        </Col>
      </Row>

      <FormModalTemplate
        title="新建知识文章"
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onFinish={async (values) => {
          const article = await createKbArticle(values);
          messageApi.success('创建成功');
          setCreateOpen(false);
          if (article.id) navigate(`/apps/kuaiplm/knowledge-base/detail/${article.id}`);
          else actionRef.current?.reload();
        }}
      >
        <ProFormSelect
          name="space_id"
          label="知识空间"
          options={spaces.map((s) => ({ value: s.id, label: s.space_name }))}
          rules={[{ required: true }]}
        />
        <ProFormText name="title" label="标题" rules={[{ required: true }]} />
        <ProFormText name="summary" label="摘要" />
        <ProFormTextArea name="content" label="正文" fieldProps={{ rows: 6 }} />
      </FormModalTemplate>
    </ListPageTemplate>
  );
};

export default KnowledgeBasePage;
