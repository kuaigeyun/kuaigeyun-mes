/**
 * 研发知识库 — 空间与文章
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ActionType, ProColumns, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { App, Button, Card, Col, List, Row, Typography } from 'antd';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { UniTable } from '../../../../components/uni-table';
import { ListPageTemplate, FormModalTemplate } from '../../../../components/layout-templates';
import {
  listKbSpaces,
  listKbArticles,
  createKbArticle,
  type KbSpace,
  type KbArticle,
} from '../../services/knowledge-base';
import { renderRowActionsOverflow } from '../../../../utils/renderRowActionsOverflow';
import { useNewShortcut } from '../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';

const KnowledgeBasePage: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const navigate = useNavigate();
  const actionRef = useRef<ActionType>(null);
  const [spaces, setSpaces] = useState<KbSpace[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | undefined>();
  const [createOpen, setCreateOpen] = useState(false);

  const handleCreate = useCallback(() => setCreateOpen(true), []);
  useNewShortcut(handleCreate);

  useEffect(() => {
    listKbSpaces({ limit: 100 })
      .then((res) => setSpaces(res.items))
      .catch(() => setSpaces([]));
  }, []);

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
      render: (_, row) =>
        renderRowActionsOverflow(
          [
            <Button
              key="edit"
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/apps/kuaiplm/knowledge-base/detail/${row.id}`)}
            >
              编辑
            </Button>,
          ],
          `kb-${row.id}`,
        ),
    },
  ];

  return (
    <ListPageTemplate>
      <Row gutter={16}>
        <Col xs={24} md={6}>
          <Card title="知识空间" size="small">
            <List
              size="small"
              dataSource={[{ id: undefined, space_name: '全部' } as KbSpace, ...spaces]}
              renderItem={(item) => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    background: selectedSpaceId === item.id ? 'var(--ant-color-fill-secondary)' : undefined,
                    padding: '8px 12px',
                    borderRadius: 6,
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
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} md={18}>
          <UniTable<KbArticle>
            headerTitle="知识文章"
            actionRef={actionRef}
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
            toolBarRender={() => [
              <Button key="new" type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                {'新建文章' + NEW_SHORTCUT_HINT}
              </Button>,
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
