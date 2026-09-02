/**
 * BOM 正查（成品→原料）/ 反查（原料→成品）询查抽屉
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { App, Button, Checkbox, Drawer, Empty, Form, Space, Spin, Table, Tabs, Tree, Typography } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { SearchOutlined } from '@ant-design/icons';
import { UniMaterialSelect } from '../../../../../components/uni-material-select';
import { DRAWER_CONFIG } from '../../../../../components/layout-templates';
import { bomApi } from '../../../services/material';
import type {
  BOMHierarchy,
  BOMHierarchyItem,
  BOMWhereUsedItem,
  BOMWhereUsedResult,
} from '../../../types/material';

export type BomInquiryDrawerProps = {
  open: boolean;
  onClose: () => void;
};

function hierarchyToTreeNodes(items: BOMHierarchyItem[]): DataNode[] {
  return items.map((item) => {
    const title = `${item.componentCode || ''} ${item.componentName || ''}`.trim()
      || String(item.componentId);
    const qty = `${item.quantity ?? ''}${item.unit ? ` ${item.unit}` : ''}`.trim();
    return {
      key: `${item.path || item.componentId}-${item.level}`,
      title: (
        <span>
          {title}
          {qty ? (
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              × {qty}
            </Typography.Text>
          ) : null}
          {item.level != null ? (
            <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
              L{item.level}
            </Typography.Text>
          ) : null}
        </span>
      ),
      children: item.children?.length ? hierarchyToTreeNodes(item.children) : undefined,
    };
  });
}

const BomInquiryDrawer: React.FC<BomInquiryDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [materialId, setMaterialId] = useState<number | undefined>();
  const [activeTab, setActiveTab] = useState<'forward' | 'reverse'>('forward');
  const [loading, setLoading] = useState(false);
  const [hierarchy, setHierarchy] = useState<BOMHierarchy | null>(null);
  const [whereUsed, setWhereUsed] = useState<BOMWhereUsedResult | null>(null);
  const [recursive, setRecursive] = useState(true);
  const [topLevelOnly, setTopLevelOnly] = useState(false);
  const [form] = Form.useForm<{ materialId?: number }>();

  const resetResults = () => {
    setHierarchy(null);
    setWhereUsed(null);
  };

  const loadForward = useCallback(async (mid: number) => {
    setLoading(true);
    try {
      const data = await bomApi.getHierarchy(mid);
      setHierarchy(data);
    } catch (error: any) {
      message.error(error?.message || t('app.master-data.bom.getFailed'));
      setHierarchy(null);
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  const loadReverse = useCallback(
    async (mid: number, opts: { recursive: boolean; topLevelOnly: boolean }) => {
      setLoading(true);
      try {
        const data = await bomApi.whereUsed(mid, {
          recursive: opts.recursive,
          topLevelOnly: opts.topLevelOnly,
        });
        setWhereUsed(data);
      } catch (error: any) {
        message.error(error?.message || t('app.master-data.bom.getFailed'));
        setWhereUsed(null);
      } finally {
        setLoading(false);
      }
    },
    [message, t],
  );

  const runQuery = useCallback(async () => {
    if (materialId == null || !(materialId > 0)) {
      message.warning(t('app.master-data.bom.inquirySelectMaterial'));
      return;
    }
    if (activeTab === 'forward') {
      await loadForward(materialId);
    } else {
      await loadReverse(materialId, { recursive, topLevelOnly });
    }
  }, [materialId, activeTab, recursive, topLevelOnly, loadForward, loadReverse, message, t]);

  const treeData = useMemo(
    () => (hierarchy?.items?.length ? hierarchyToTreeNodes(hierarchy.items) : []),
    [hierarchy],
  );

  const openParentBom = (item: BOMWhereUsedItem) => {
    const p = new URLSearchParams();
    p.set('materialId', String(item.materialId));
    if (item.version) p.set('version', item.version);
    navigate(`/apps/master-data/process/engineering-bom/designer?${p}`);
    onClose();
  };

  return (
    <Drawer
      title={t('app.master-data.bom.inquiryTitle')}
      open={open}
      onClose={onClose}
      size={DRAWER_CONFIG.HALF_WIDTH}
      destroyOnHidden
      extra={
        <Button type="primary" icon={<SearchOutlined />} onClick={() => void runQuery()}>
          {t('common.query')}
        </Button>
      }
    >
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, all) => {
            const mid = all.materialId != null ? Number(all.materialId) : undefined;
            setMaterialId(Number.isFinite(mid as number) && (mid as number) > 0 ? mid : undefined);
            resetResults();
          }}
        >
          <UniMaterialSelect
            name="materialId"
            label={t('app.master-data.bom.inquiryMaterial')}
            placeholder={t('app.master-data.bom.inquirySelectMaterial')}
            showQuickCreate={false}
            onChange={(v) => {
              setMaterialId(v);
              resetResults();
            }}
          />
        </Form>

        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as 'forward' | 'reverse');
            resetResults();
          }}
          items={[
            {
              key: 'forward',
              label: t('app.master-data.bom.inquiryForward'),
              children: (
                <Spin spinning={loading && activeTab === 'forward'}>
                  {!hierarchy && !loading ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('app.master-data.bom.inquiryHintForward')}
                    />
                  ) : hierarchy && treeData.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('app.master-data.bom.inquiryForwardEmpty')}
                    />
                  ) : (
                    <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                      {hierarchy ? (
                        <Typography.Text>
                          {hierarchy.materialCode && hierarchy.materialName
                            ? `${hierarchy.materialCode} - ${hierarchy.materialName}`
                            : hierarchy.materialCode || hierarchy.materialName}
                          {hierarchy.version ? ` (${hierarchy.version})` : ''}
                        </Typography.Text>
                      ) : null}
                      <Tree defaultExpandAll treeData={treeData} />
                    </Space>
                  )}
                </Spin>
              ),
            },
            {
              key: 'reverse',
              label: t('app.master-data.bom.inquiryReverse'),
              children: (
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  <Space wrap>
                    <Checkbox
                      checked={recursive}
                      onChange={(e) => {
                        setRecursive(e.target.checked);
                        if (!e.target.checked) setTopLevelOnly(false);
                      }}
                    >
                      {t('app.master-data.bom.whereUsedRecursive')}
                    </Checkbox>
                    <Checkbox
                      checked={topLevelOnly}
                      disabled={!recursive}
                      onChange={(e) => setTopLevelOnly(e.target.checked)}
                    >
                      {t('app.master-data.bom.whereUsedTopLevelOnly')}
                    </Checkbox>
                  </Space>
                  <Spin spinning={loading && activeTab === 'reverse'}>
                    {!whereUsed && !loading ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('app.master-data.bom.inquiryHintReverse')}
                      />
                    ) : !loading && (!whereUsed?.items || whereUsed.items.length === 0) ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={t('app.master-data.bom.whereUsedEmpty')}
                      />
                    ) : (
                      <Table
                        size="small"
                        pagination={false}
                        scroll={{ x: 720 }}
                        rowKey={(row) => `${row.bomUuid}-${row.materialId}-${row.level}-${row.path}`}
                        dataSource={whereUsed?.items ?? []}
                        columns={[
                          {
                            title: t('app.master-data.bom.hierarchyLevelLabel'),
                            dataIndex: 'level',
                            width: 64,
                          },
                          {
                            title: t('app.master-data.bom.whereUsedPath'),
                            dataIndex: 'path',
                            ellipsis: true,
                            width: 240,
                            render: (v: string | null | undefined) => v || '—',
                          },
                          {
                            title: t('app.master-data.bom.mainMaterialTitle'),
                            ellipsis: true,
                            render: (_: unknown, row: BOMWhereUsedItem) =>
                              row.materialCode && row.materialName
                                ? `${row.materialCode} - ${row.materialName}`
                                : row.materialCode || row.materialName || row.materialId,
                          },
                          {
                            title: t('app.master-data.bom.versionTitle'),
                            dataIndex: 'version',
                            width: 88,
                          },
                          {
                            title: t('app.master-data.bom.quantityTitle'),
                            width: 100,
                            render: (_: unknown, row: BOMWhereUsedItem) =>
                              `${row.quantity} ${row.unit || ''}`.trim(),
                          },
                          {
                            title: t('common.actions'),
                            width: 80,
                            fixed: 'right',
                            render: (_: unknown, row: BOMWhereUsedItem) => (
                              <Button type="link" size="small" onClick={() => openParentBom(row)}>
                                {t('app.master-data.bom.design')}
                              </Button>
                            ),
                          },
                        ]}
                      />
                    )}
                  </Spin>
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </Drawer>
  );
};

export default BomInquiryDrawer;
