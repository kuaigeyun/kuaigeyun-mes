/**
 * 知识文章查看 / 编辑
 */

import React, { useEffect, useState } from 'react';
import { App, Button, Card, Input, Select, Space, Spin, Typography } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { ListPageTemplate } from '../../../../components/layout-templates';
import { getKbArticle, updateKbArticle, listKbSpaces, type KbArticle, type KbSpace } from '../../services/knowledge-base';

const KnowledgeArticleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [spaces, setSpaces] = useState<KbSpace[]>([]);
  const [article, setArticle] = useState<KbArticle | null>(null);

  useEffect(() => {
    listKbSpaces({ limit: 100 })
      .then((r) => setSpaces(r.items))
      .catch(() => setSpaces([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getKbArticle(id)
      .then(setArticle)
      .catch((e) => messageApi.error(e?.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [id, messageApi]);

  const handleSave = async () => {
    if (!id || !article) return;
    setSaving(true);
    try {
      await updateKbArticle(id, article);
      messageApi.success('已保存');
    } catch (e: any) {
      messageApi.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ListPageTemplate>
        <div style={{ padding: 80, textAlign: 'center' }}>
          <Spin size="large" />
        </div>
      </ListPageTemplate>
    );
  }

  if (!article) {
    return (
      <ListPageTemplate>
        <Button onClick={() => navigate('/apps/kuaiplm/knowledge-base')}>返回知识中心</Button>
      </ListPageTemplate>
    );
  }

  return (
    <ListPageTemplate>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/apps/kuaiplm/knowledge-base')}>
            返回
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            保存
          </Button>
        </Space>

        <Card>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Typography.Text type="secondary">标题</Typography.Text>
              <Input
                value={article.title ?? ''}
                onChange={(e) => setArticle({ ...article, title: e.target.value })}
                style={{ marginTop: 8 }}
              />
            </div>
            <div>
              <Typography.Text type="secondary">空间</Typography.Text>
              <Select
                style={{ width: '100%', marginTop: 8 }}
                value={article.space_id}
                options={spaces.map((s) => ({ value: s.id, label: s.space_name }))}
                onChange={(space_id) => setArticle({ ...article, space_id })}
              />
            </div>
            <div>
              <Typography.Text type="secondary">摘要</Typography.Text>
              <Input
                value={article.summary ?? ''}
                onChange={(e) => setArticle({ ...article, summary: e.target.value })}
                style={{ marginTop: 8 }}
              />
            </div>
            <div>
              <Typography.Text type="secondary">正文</Typography.Text>
              <Input.TextArea
                rows={16}
                value={article.content ?? ''}
                onChange={(e) => setArticle({ ...article, content: e.target.value })}
                style={{ marginTop: 8 }}
              />
            </div>
          </Space>
        </Card>
      </Space>
    </ListPageTemplate>
  );
};

export default KnowledgeArticleDetailPage;
