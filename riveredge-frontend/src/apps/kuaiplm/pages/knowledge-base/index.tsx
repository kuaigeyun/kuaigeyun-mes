/**
 * 研发知识库 Notion 化单页（左树右文档）
 */

import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Input, Select, Space, Spin, Tag, Tree, Typography } from 'antd';
import type { DataNode, TreeProps } from 'antd/es/tree';
import dayjs from 'dayjs';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { ListPageTemplate, TwoColumnLayout } from '../../../../components/layout-templates';
import {
  createKbArticle,
  createKbSpace,
  deleteKbArticle,
  deleteKbSpace,
  getKbArticle,
  listKbArticles,
  listKbSpaces,
  searchKbArticles,
  updateKbSpace,
  updateKbArticle,
  type KbArticle,
  type KbSpace,
} from '../../services/knowledge-base';
import { useNewShortcut } from '../../../../hooks/useNewShortcut';
import { NEW_SHORTCUT_HINT } from '../../../../utils/globalNewShortcut';

const ARTICLE_STATUS_OPTIONS = [
  { label: '草稿', value: 'DRAFT' },
  { label: '已发布', value: 'PUBLISHED' },
  { label: '已归档', value: 'ARCHIVED' },
];
const KB_QUERY_LIMIT = 100;

const KnowledgeBasePage: React.FC = () => {
  const { message: messageApi, modal } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const [spaces, setSpaces] = useState<KbSpace[]>([]);
  const [spaceLoading, setSpaceLoading] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | undefined>();
  const [selectedArticleId, setSelectedArticleId] = useState<number | undefined>();
  const [expandedSpaceKeys, setExpandedSpaceKeys] = useState<React.Key[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [activeArticle, setActiveArticle] = useState<KbArticle | null>(null);

  const articleIdFromQuery = Number(searchParams.get('articleId'));

  const loadSpaces = async () => {
    setSpaceLoading(true);
    try {
      const res = await listKbSpaces({ limit: KB_QUERY_LIMIT });
      setSpaces(res.items);
      if (!selectedSpaceId && res.items.length > 0) {
        setSelectedSpaceId(res.items[0].id);
      }
    } catch (error: any) {
      messageApi.error(error?.message || '加载知识空间失败');
      setSpaces([]);
    } finally {
      setSpaceLoading(false);
    }
  };

  const loadArticles = async (spaceId?: number, keyword?: string) => {
    setArticleLoading(true);
    try {
      if (keyword?.trim()) {
        const res = await searchKbArticles({
          keyword: keyword.trim(),
          space_id: spaceId,
          limit: KB_QUERY_LIMIT,
        });
        setArticles(res.items);
        return;
      }
      const res = await listKbArticles({
        space_id: spaceId,
        skip: 0,
        limit: KB_QUERY_LIMIT,
      });
      setArticles(res.items);
    } catch (error: any) {
      messageApi.error(error?.message || '加载文章失败');
      setArticles([]);
    } finally {
      setArticleLoading(false);
    }
  };

  useEffect(() => {
    void loadSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadArticles(selectedSpaceId, searchKeyword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpaceId, searchKeyword]);

  useEffect(() => {
    if (Number.isFinite(articleIdFromQuery) && articleIdFromQuery > 0) {
      setSelectedArticleId(articleIdFromQuery);
    }
  }, [articleIdFromQuery]);

  useEffect(() => {
    if (articles.length === 0) {
      setActiveArticle(null);
      setSelectedArticleId(undefined);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('articleId');
        return next;
      });
      return;
    }
    if (selectedArticleId && articles.some((item) => item.id === selectedArticleId)) {
      return;
    }
    const firstId = articles[0]?.id;
    if (firstId) {
      setSelectedArticleId(firstId);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('articleId', String(firstId));
        return next;
      });
    }
  }, [articles, selectedArticleId, setSearchParams]);

  useEffect(() => {
    if (!selectedArticleId) return;
    setDocLoading(true);
    getKbArticle(selectedArticleId)
      .then((article) => {
        setActiveArticle({
          ...article,
          tags: Array.isArray(article.tags) ? article.tags : [],
        });
        if (article.space_id && article.space_id !== selectedSpaceId) {
          setSelectedSpaceId(article.space_id);
        }
      })
      .catch((error: any) => {
        const status = error?.response?.status;
        if (status === 404) {
          const fallbackId = articles[0]?.id;
          if (fallbackId && fallbackId !== selectedArticleId) {
            setSelectedArticleId(fallbackId);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.set('articleId', String(fallbackId));
              return next;
            });
          } else {
            setSelectedArticleId(undefined);
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              next.delete('articleId');
              return next;
            });
          }
          setActiveArticle(null);
          return;
        }
        messageApi.error(error?.message || '加载文章详情失败');
        setActiveArticle(null);
      })
      .finally(() => setDocLoading(false));
  }, [selectedArticleId, selectedSpaceId, messageApi, articles, setSearchParams]);

  const handleCreateArticle = async () => {
    const targetSpaceId = selectedSpaceId ?? spaces[0]?.id;
    if (!targetSpaceId) {
      messageApi.warning('请先创建知识空间');
      return;
    }
    try {
      const created = await createKbArticle({
        space_id: targetSpaceId,
        title: '未命名文档',
        content: '',
        status: 'DRAFT',
        tags: [],
      });
      messageApi.success('已创建新文档');
      await loadArticles(targetSpaceId, searchKeyword);
      if (created.id) {
        setSelectedArticleId(created.id);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('articleId', String(created.id));
          return next;
        });
      }
    } catch (error: any) {
      messageApi.error(error?.message || '创建文档失败');
    }
  };

  useNewShortcut(() => {
    void handleCreateArticle();
  });

  const selectedSpace = useMemo(
    () => spaces.find((space) => space.id === selectedSpaceId),
    [spaces, selectedSpaceId],
  );

  const handleCreateSpace = () => {
    let inputValue = '';
    modal.confirm({
      title: '新建知识空间',
      content: (
        <Input
          autoFocus
          placeholder="请输入空间名称"
          maxLength={100}
          onChange={(e) => {
            inputValue = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        const name = inputValue.trim();
        if (!name) {
          messageApi.warning('请输入空间名称');
          throw new Error('space_name_required');
        }
        if (name.length > 100) {
          messageApi.warning('空间名称不能超过 100 个字符');
          throw new Error('space_name_too_long');
        }
        const created = await createKbSpace({
          space_code: `KB-${Date.now()}`,
          space_name: name,
          parent_space_id: selectedSpaceId ?? null,
          sort_order: 0,
          is_active: true,
        });
        messageApi.success('空间创建成功');
        await loadSpaces();
        if (created.id) {
          setSelectedSpaceId(created.id);
        }
      },
    });
  };

  const handleRenameSpace = () => {
    if (!selectedSpace?.id) {
      messageApi.warning('请先选择一个空间');
      return;
    }
    let inputValue = selectedSpace.space_name || '';
    modal.confirm({
      title: '重命名知识空间',
      content: (
        <Input
          autoFocus
          defaultValue={selectedSpace.space_name}
          placeholder="请输入空间名称"
          maxLength={100}
          onChange={(e) => {
            inputValue = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        const name = inputValue.trim();
        if (!name) {
          messageApi.warning('请输入空间名称');
          throw new Error('space_name_required');
        }
        if (name.length > 100) {
          messageApi.warning('空间名称不能超过 100 个字符');
          throw new Error('space_name_too_long');
        }
        await updateKbSpace(selectedSpace.id!, { space_name: name });
        messageApi.success('空间重命名成功');
        await loadSpaces();
      },
    });
  };

  const handleDeleteSpace = () => {
    if (!selectedSpace?.id) {
      messageApi.warning('请先选择一个空间');
      return;
    }
    modal.confirm({
      title: '确认删除空间',
      content: `确定删除空间「${selectedSpace.space_name || selectedSpace.id}」吗？`,
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteKbSpace(selectedSpace.id!);
        messageApi.success('空间删除成功');
        if (selectedSpaceId === selectedSpace.id) {
          setSelectedSpaceId(undefined);
        }
        await loadSpaces();
      },
    });
  };

  const handleSave = async () => {
    if (!activeArticle?.id) return;
    setSaving(true);
    try {
      await updateKbArticle(activeArticle.id, {
        title: activeArticle.title?.trim() || '未命名文档',
        content: activeArticle.content ?? '',
        status: activeArticle.status ?? 'DRAFT',
        space_id: activeArticle.space_id,
        tags: Array.isArray(activeArticle.tags) ? activeArticle.tags : [],
      });
      messageApi.success('已保存');
      await loadArticles(selectedSpaceId, searchKeyword);
    } catch (error: any) {
      messageApi.error(error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCurrent = async () => {
    if (!activeArticle?.id) return;
    modal.confirm({
      title: '确认删除',
      content: `确定删除文档「${activeArticle.title || activeArticle.id}」吗？`,
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteKbArticle(activeArticle.id!);
        messageApi.success('删除成功');
        setActiveArticle(null);
        setSelectedArticleId(undefined);
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.delete('articleId');
          return next;
        });
        await loadArticles(selectedSpaceId, searchKeyword);
      },
    });
  };

  const spaceTreeData = useMemo<DataNode[]>(() => {
    const byParent = new Map<number | 'root', KbSpace[]>();
    spaces.forEach((space) => {
      const parentKey = space.parent_space_id ?? 'root';
      const list = byParent.get(parentKey) ?? [];
      list.push(space);
      byParent.set(parentKey, list);
    });
    const build = (parent: number | 'root'): DataNode[] =>
      (byParent.get(parent) ?? [])
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((space) => ({
          key: String(space.id),
          title: space.space_name || `空间 ${space.id}`,
          children: build(space.id as number),
        }));
    return build('root');
  }, [spaces]);

  useEffect(() => {
    if (expandedSpaceKeys.length > 0) return;
    const rootKeys = spaceTreeData.map((item) => item.key).filter(Boolean) as React.Key[];
    if (rootKeys.length) {
      setExpandedSpaceKeys(rootKeys);
    }
  }, [expandedSpaceKeys.length, spaceTreeData]);

  const handleSpaceTreeSelect: TreeProps['onSelect'] = (keys) => {
    const key = keys[0];
    const nextSpaceId = key ? Number(key) : undefined;
    setSelectedSpaceId(Number.isFinite(nextSpaceId) ? nextSpaceId : undefined);
  };

  return (
    <ListPageTemplate fillMain>
      <TwoColumnLayout
        style={{ flex: 1, minHeight: 0 }}
        leftPanel={{
          width: 320,
          minWidth: 260,
          search: {
            placeholder: '搜索文档',
            value: searchKeyword,
            onChange: setSearchKeyword,
            allowClear: true,
          },
          actions: [
            <Space size={4} key="space-actions">
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleCreateSpace} title="新建空间" />
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={handleRenameSpace}
                disabled={!selectedSpace?.id}
                title="重命名空间"
              />
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={handleDeleteSpace}
                disabled={!selectedSpace?.id}
                title="删除空间"
              />
              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => void loadSpaces()} title="刷新空间" />
            </Space>,
          ],
          leftContent: (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 10, gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                  知识空间
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {spaces.length}
                </Typography.Text>
              </div>
              <div
                style={{
                  border: '1px solid var(--ant-color-border-secondary)',
                  borderRadius: 8,
                  background: 'var(--ant-color-bg-container)',
                  padding: 6,
                  maxHeight: 220,
                  minHeight: 84,
                  overflow: 'auto',
                }}
              >
                {spaceLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin />
                  </div>
                ) : (
                  <Tree
                    blockNode
                    showLine={{ showLeafIcon: false }}
                    selectedKeys={selectedSpaceId ? [String(selectedSpaceId)] : []}
                    expandedKeys={expandedSpaceKeys}
                    onExpand={(keys) => setExpandedSpaceKeys(keys)}
                    treeData={spaceTreeData}
                    onSelect={handleSpaceTreeSelect}
                    style={{ margin: 0 }}
                    titleRender={(node) => (
                      <span
                        style={{
                          display: 'inline-block',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          verticalAlign: 'bottom',
                        }}
                        title={String(node.title || '')}
                      >
                        {node.title as React.ReactNode}
                      </span>
                    )}
                  />
                )}
              </div>
              <div
                style={{
                  borderTop: '1px solid var(--ant-color-border-secondary)',
                  paddingTop: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                  文档
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {articles.length}
                </Typography.Text>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                {articleLoading ? (
                  <div style={{ textAlign: 'center', padding: 12 }}>
                    <Spin />
                  </div>
                ) : articles.length === 0 ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文档" />
                ) : (
                  articles.map((item) => {
                    const active = item.id === selectedArticleId;
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!item.id) return;
                          setSelectedArticleId(item.id);
                          setSearchParams((prev) => {
                            const next = new URLSearchParams(prev);
                            next.set('articleId', String(item.id));
                            return next;
                          });
                        }}
                        style={{
                          borderRadius: 6,
                          padding: '8px 10px',
                          cursor: 'pointer',
                          marginBottom: 6,
                          background: active ? 'var(--ant-color-fill-secondary)' : undefined,
                        }}
                      >
                        <Typography.Text strong={active} ellipsis style={{ width: '100%' }}>
                          {item.title || '未命名文档'}
                        </Typography.Text>
                        <div style={{ fontSize: 11, color: 'var(--ant-color-text-secondary)', marginTop: 2 }}>
                          {item.updated_at ? dayjs(item.updated_at).format('YYYY-MM-DD HH:mm') : '-'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ),
        }}
        rightPanel={{
          header: {
            left: (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => void handleCreateArticle()}>
                新建文档{NEW_SHORTCUT_HINT}
              </Button>
            ),
            center: (
              <Typography.Text type="secondary">
                {activeArticle?.space_name ||
                  spaces.find((s) => s.id === activeArticle?.space_id)?.space_name ||
                  '未归类空间'}
              </Typography.Text>
            ),
            right: (
              <>
                <Button danger icon={<DeleteOutlined />} onClick={() => void handleDeleteCurrent()} disabled={!activeArticle?.id}>
                  删除
                </Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void handleSave()} disabled={!activeArticle?.id}>
                  保存
                </Button>
              </>
            ),
          },
          content: docLoading ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <Spin size="large" />
            </div>
          ) : !activeArticle ? (
            <Empty description="请选择或创建文档" />
          ) : (
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Input
                size="large"
                bordered={false}
                value={activeArticle.title ?? ''}
                onChange={(e) => setActiveArticle({ ...activeArticle, title: e.target.value })}
                placeholder="请输入文档标题"
                style={{ fontSize: 28, fontWeight: 600, paddingInline: 0 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                <Select
                  value={activeArticle.status ?? 'DRAFT'}
                  options={ARTICLE_STATUS_OPTIONS}
                  onChange={(status) => setActiveArticle({ ...activeArticle, status })}
                />
                <Select
                  value={activeArticle.space_id}
                  options={spaces.map((space) => ({
                    label: space.space_name || `空间 ${space.id}`,
                    value: space.id,
                  }))}
                  onChange={(space_id) => setActiveArticle({ ...activeArticle, space_id })}
                />
                <Select
                  mode="tags"
                  allowClear
                  placeholder="添加标签"
                  value={Array.isArray(activeArticle.tags) ? activeArticle.tags : []}
                  onChange={(tags) => setActiveArticle({ ...activeArticle, tags })}
                />
              </div>
              <Space size={8}>
                <Tag>{activeArticle.author_name || '未知作者'}</Tag>
                <Typography.Text type="secondary">
                  更新于 {activeArticle.updated_at ? dayjs(activeArticle.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </Typography.Text>
              </Space>
              <Input.TextArea
                value={activeArticle.content ?? ''}
                onChange={(e) => setActiveArticle({ ...activeArticle, content: e.target.value })}
                placeholder="在这里开始记录知识..."
                autoSize={{ minRows: 20, maxRows: 40 }}
              />
            </Space>
          ),
        }}
      />
    </ListPageTemplate>
  );
};

export default KnowledgeBasePage;
