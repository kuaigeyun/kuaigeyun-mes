/**
 * 研发知识库 Notion 化单页（左树右文档）
 */

import React, { useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Input, Select, Space, Spin, Tag, Tree, Typography } from 'antd';
import type { DataNode, TreeProps } from 'antd/es/tree';
import dayjs from 'dayjs';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { getKuaiplmKnowledgeStatusOptions, getKuaiplmKnowledgeStatusText } from '../../components/kuaiplmMeta';
import { formatDateTime } from '../../../../utils/format';

const KB_QUERY_LIMIT = 100;

const KnowledgeBasePage: React.FC = () => {
  const { t } = useTranslation();
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

  const articleStatusOptions = useMemo(() => getKuaiplmKnowledgeStatusOptions(t), [t]);
  const unnamedDocument = t('app.kuaiplm.knowledgeBase.unnamedDocument');

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
      messageApi.error(error?.message || t('app.kuaiplm.knowledgeBase.messages.loadSpacesFailed'));
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
      messageApi.error(error?.message || t('app.kuaiplm.knowledgeBase.messages.loadArticlesFailed'));
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
        messageApi.error(error?.message || t('app.kuaiplm.knowledgeBase.messages.loadArticleFailed'));
        setActiveArticle(null);
      })
      .finally(() => setDocLoading(false));
  }, [selectedArticleId, selectedSpaceId, messageApi, articles, setSearchParams, t]);

  const handleCreateArticle = async () => {
    const targetSpaceId = selectedSpaceId ?? spaces[0]?.id;
    if (!targetSpaceId) {
      messageApi.warning(t('app.kuaiplm.knowledgeBase.messages.createSpaceFirst'));
      return;
    }
    try {
      const created = await createKbArticle({
        space_id: targetSpaceId,
        title: unnamedDocument,
        content: '',
        status: 'DRAFT',
        tags: [],
      });
      messageApi.success(t('app.kuaiplm.knowledgeBase.messages.createDocumentSuccess'));
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
      messageApi.error(error?.message || t('app.kuaiplm.knowledgeBase.messages.createDocumentFailed'));
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
      title: t('app.kuaiplm.knowledgeBase.modal.createSpaceTitle'),
      content: (
        <Input
          autoFocus
          placeholder={t('app.kuaiplm.knowledgeBase.form.spaceNamePlaceholder')}
          maxLength={100}
          onChange={(e) => {
            inputValue = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        const name = inputValue.trim();
        if (!name) {
          messageApi.warning(t('app.kuaiplm.knowledgeBase.form.spaceNameRequired'));
          throw new Error('space_name_required');
        }
        if (name.length > 100) {
          messageApi.warning(t('app.kuaiplm.knowledgeBase.form.spaceNameMax'));
          throw new Error('space_name_too_long');
        }
        const created = await createKbSpace({
          space_code: `KB-${Date.now()}`,
          space_name: name,
          parent_space_id: selectedSpaceId ?? null,
          sort_order: 0,
          is_active: true,
        });
        messageApi.success(t('app.kuaiplm.knowledgeBase.messages.createSpaceSuccess'));
        await loadSpaces();
        if (created.id) {
          setSelectedSpaceId(created.id);
        }
      },
    });
  };

  const handleRenameSpace = () => {
    if (!selectedSpace?.id) {
      messageApi.warning(t('app.kuaiplm.knowledgeBase.messages.selectSpaceFirst'));
      return;
    }
    let inputValue = selectedSpace.space_name || '';
    modal.confirm({
      title: t('app.kuaiplm.knowledgeBase.modal.renameSpaceTitle'),
      content: (
        <Input
          autoFocus
          defaultValue={selectedSpace.space_name}
          placeholder={t('app.kuaiplm.knowledgeBase.form.spaceNamePlaceholder')}
          maxLength={100}
          onChange={(e) => {
            inputValue = e.target.value;
          }}
        />
      ),
      onOk: async () => {
        const name = inputValue.trim();
        if (!name) {
          messageApi.warning(t('app.kuaiplm.knowledgeBase.form.spaceNameRequired'));
          throw new Error('space_name_required');
        }
        if (name.length > 100) {
          messageApi.warning(t('app.kuaiplm.knowledgeBase.form.spaceNameMax'));
          throw new Error('space_name_too_long');
        }
        await updateKbSpace(selectedSpace.id!, { space_name: name });
        messageApi.success(t('app.kuaiplm.knowledgeBase.messages.renameSpaceSuccess'));
        await loadSpaces();
      },
    });
  };

  const handleDeleteSpace = () => {
    if (!selectedSpace?.id) {
      messageApi.warning(t('app.kuaiplm.knowledgeBase.messages.selectSpaceFirst'));
      return;
    }
    modal.confirm({
      title: t('app.kuaiplm.knowledgeBase.modal.deleteSpaceTitle'),
      content: selectedSpace.space_name || String(selectedSpace.id),
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteKbSpace(selectedSpace.id!);
        messageApi.success(t('app.kuaiplm.knowledgeBase.messages.deleteSpaceSuccess'));
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
        title: activeArticle.title?.trim() || unnamedDocument,
        content: activeArticle.content ?? '',
        status: activeArticle.status ?? 'DRAFT',
        space_id: activeArticle.space_id,
        tags: Array.isArray(activeArticle.tags) ? activeArticle.tags : [],
      });
      messageApi.success(t('app.kuaiplm.knowledgeBase.messages.saveSuccess'));
      await loadArticles(selectedSpaceId, searchKeyword);
    } catch (error: any) {
      messageApi.error(error?.message || t('app.kuaiplm.common.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCurrent = async () => {
    if (!activeArticle?.id) return;
    modal.confirm({
      title: t('app.kuaiplm.knowledgeBase.modal.deleteArticleTitle'),
      content: activeArticle.title || String(activeArticle.id),
      okButtonProps: { danger: true },
      onOk: async () => {
        await deleteKbArticle(activeArticle.id!);
        messageApi.success(t('app.kuaiplm.common.messages.deleteSuccess'));
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
          title: space.space_name || t('app.kuaiplm.knowledgeBase.unnamedSpace'),
          children: build(space.id as number),
        }));
    return build('root');
  }, [spaces, t]);

  const spaceSelectOptions = useMemo(
    () =>
      spaces.map((space) => ({
        label: space.space_name || t('app.kuaiplm.knowledgeBase.unnamedSpace'),
        value: space.id,
      })),
    [spaces, t],
  );

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
            placeholder: t('app.kuaiplm.knowledgeBase.searchPlaceholder'),
            value: searchKeyword,
            onChange: setSearchKeyword,
            allowClear: true,
          },
          actions: [
            <Space size={4} key="space-actions">
              <Button
                type="text"
                size="small"
                icon={<PlusOutlined />}
                onClick={handleCreateSpace}
                title={t('app.kuaiplm.knowledgeBase.createSpace')}
              />
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={handleRenameSpace}
                disabled={!selectedSpace?.id}
                title={t('app.kuaiplm.knowledgeBase.renameSpace')}
              />
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={handleDeleteSpace}
                disabled={!selectedSpace?.id}
                title={t('app.kuaiplm.knowledgeBase.deleteSpace')}
              />
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => void loadSpaces()}
                title={t('app.kuaiplm.knowledgeBase.refreshSpaces')}
              />
            </Space>,
          ],
          leftContent: (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: 10, gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 500 }}>
                  {t('app.kuaiplm.knowledgeBase.sections.spaces')}
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
                  {t('app.kuaiplm.knowledgeBase.sections.documents')}
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
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('app.kuaiplm.knowledgeBase.empty.documents')} />
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
                          {item.title || unnamedDocument}
                        </Typography.Text>
                        <div style={{ fontSize: 11, color: 'var(--ant-color-text-secondary)', marginTop: 2 }}>
                          {item.updated_at ? formatDateTime(item.updated_at, 'YYYY-MM-DD HH:mm') : '-'}
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
                {t('app.kuaiplm.knowledgeBase.createDocument')}
                {NEW_SHORTCUT_HINT}
              </Button>
            ),
            center: (
              <Typography.Text type="secondary">
                {activeArticle?.space_name ||
                  spaces.find((s) => s.id === activeArticle?.space_id)?.space_name ||
                  t('app.kuaiplm.knowledgeBase.unnamedSpace')}
              </Typography.Text>
            ),
            right: (
              <>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => void handleDeleteCurrent()}
                  disabled={!activeArticle?.id}
                >
                  {t('app.kuaiplm.common.actions.delete')}
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={() => void handleSave()}
                  disabled={!activeArticle?.id}
                >
                  {t('app.kuaiplm.common.actions.save')}
                </Button>
              </>
            ),
          },
          content: docLoading ? (
            <div style={{ textAlign: 'center', padding: 80 }}>
              <Spin size="large" />
            </div>
          ) : !activeArticle ? (
            <Empty description={t('app.kuaiplm.knowledgeBase.empty.selectDocument')} />
          ) : (
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Input
                size="large"
                bordered={false}
                value={activeArticle.title ?? ''}
                onChange={(e) => setActiveArticle({ ...activeArticle, title: e.target.value })}
                placeholder={t('app.kuaiplm.knowledgeBase.form.articleTitlePlaceholder')}
                style={{ fontSize: 28, fontWeight: 600, paddingInline: 0 }}
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                <Select
                  value={activeArticle.status ?? 'DRAFT'}
                  options={articleStatusOptions}
                  onChange={(status) => setActiveArticle({ ...activeArticle, status })}
                />
                <Select
                  value={activeArticle.space_id}
                  options={spaceSelectOptions}
                  onChange={(space_id) => setActiveArticle({ ...activeArticle, space_id })}
                />
                <Select
                  mode="tags"
                  allowClear
                  placeholder={t('app.kuaiplm.knowledgeBase.form.addTags')}
                  value={Array.isArray(activeArticle.tags) ? activeArticle.tags : []}
                  onChange={(tags) => setActiveArticle({ ...activeArticle, tags })}
                />
              </div>
              <Space size={8}>
                <Tag>{getKuaiplmKnowledgeStatusText(t, activeArticle.status)}</Tag>
                <Tag>{activeArticle.author_name || t('app.kuaiplm.knowledgeBase.unknownAuthor')}</Tag>
                <Typography.Text type="secondary">
                  {t('app.kuaiplm.common.columns.updatedAt')}{' '}
                  {activeArticle.updated_at ? formatDateTime(activeArticle.updated_at, 'YYYY-MM-DD HH:mm:ss') : '-'}
                </Typography.Text>
              </Space>
              <Input.TextArea
                value={activeArticle.content ?? ''}
                onChange={(e) => setActiveArticle({ ...activeArticle, content: e.target.value })}
                placeholder={t('app.kuaiplm.knowledgeBase.form.contentPlaceholder')}
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
