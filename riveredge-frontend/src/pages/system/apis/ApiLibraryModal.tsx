/**
 * 接口库加载弹窗（主从布局：搜索筛选 + 包列表 + 详情）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  App,
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import {
  installApiLibraryPack,
  listApiLibrary,
  type ApiLibraryPack,
} from '../../../services/apiManagement';
import { getBusinessSystemConnectionsForApi, type IntegrationConfig } from '../../../services/integrationConfig';
import './apiLibraryModal.css';

const { Text, Paragraph } = Typography;

const ALL_CATEGORY_KEY = '__all__';

function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

function packMatchesSearch(pack: ApiLibraryPack, keyword: string): boolean {
  if (!keyword) {
    return true;
  }
  const haystacks = [
    pack.name,
    pack.description,
    pack.category_name,
    pack.connector_type,
    ...pack.items.map((item) => `${item.name} ${item.description}`),
  ];
  return haystacks.some((text) => normalizeSearchText(text).includes(keyword));
}

export interface ApiLibraryModalProps {
  open: boolean;
  onClose: () => void;
  onInstalled?: () => void;
}

export const ApiLibraryModal: React.FC<ApiLibraryModalProps> = ({
  open,
  onClose,
  onInstalled,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [packs, setPacks] = useState<ApiLibraryPack[]>([]);
  const [connections, setConnections] = useState<IntegrationConfig[]>([]);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);
  const [connectionUuid, setConnectionUuid] = useState<string | undefined>();
  const [searchValue, setSearchValue] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORY_KEY);

  const selectedPack = useMemo(
    () => packs.find((pack) => pack.pack_id === selectedPackId) ?? null,
    [packs, selectedPackId],
  );

  const categoryOptions = useMemo(() => {
    const categories = [...new Set(packs.map((pack) => pack.category_name).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'zh-CN'),
    );
    return [
      { label: t('pages.system.apis.libraryCategoryAll'), value: ALL_CATEGORY_KEY },
      ...categories.map((name) => ({ label: name, value: name })),
    ];
  }, [packs, t]);

  const filteredPacks = useMemo(() => {
    const keyword = normalizeSearchText(searchValue);
    return packs.filter((pack) => {
      if (categoryFilter !== ALL_CATEGORY_KEY && pack.category_name !== categoryFilter) {
        return false;
      }
      return packMatchesSearch(pack, keyword);
    });
  }, [categoryFilter, packs, searchValue]);

  const connectorOptions = useMemo(
    () =>
      connections
        .filter((item) => !selectedPack || item.type === selectedPack.connector_type)
        .map((item) => ({
          label: `${item.name} (${item.code})`,
          value: item.uuid,
        })),
    [connections, selectedPack],
  );

  const allItemKeys = useMemo(
    () => selectedPack?.items.map((item) => item.item_key) ?? [],
    [selectedPack],
  );

  const loadCatalog = useCallback(async () => {
    try {
      setLoading(true);
      const [libraryResult, connectionsResult] = await Promise.all([
        listApiLibrary(),
        getBusinessSystemConnectionsForApi(),
      ]);
      setPacks(libraryResult.items);
      setConnections(connectionsResult.items);
      setSelectedPackId(libraryResult.items[0]?.pack_id ?? null);
      setSearchValue('');
      setCategoryFilter(ALL_CATEGORY_KEY);
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.system.apis.libraryLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [messageApi, t]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadCatalog();
  }, [loadCatalog, open]);

  useEffect(() => {
    if (!open || filteredPacks.length === 0) {
      setSelectedPackId(null);
      return;
    }
    if (!filteredPacks.some((pack) => pack.pack_id === selectedPackId)) {
      setSelectedPackId(filteredPacks[0]?.pack_id ?? null);
    }
  }, [filteredPacks, open, selectedPackId]);

  useEffect(() => {
    setSelectedItemKeys(allItemKeys);
  }, [allItemKeys, selectedPackId]);

  useEffect(() => {
    if (!open) {
      setConnectionUuid(undefined);
      return;
    }
    if (connectorOptions.length === 1) {
      setConnectionUuid(connectorOptions[0]?.value);
    } else {
      setConnectionUuid(undefined);
    }
  }, [connectorOptions, open, selectedPackId]);

  const toggleItemKey = (itemKey: string) => {
    setSelectedItemKeys((current) =>
      current.includes(itemKey) ? current.filter((key) => key !== itemKey) : [...current, itemKey],
    );
  };

  const handleSelectAllItems = () => {
    setSelectedItemKeys(allItemKeys);
  };

  const handleClearItemSelection = () => {
    setSelectedItemKeys([]);
  };

  const handleInstall = async () => {
    if (!selectedPack) {
      return;
    }
    if (selectedItemKeys.length === 0) {
      messageApi.warning(t('pages.system.apis.librarySelectAtLeastOne'));
      return;
    }
    if (!connectionUuid) {
      messageApi.warning(t('pages.system.apis.librarySelectConnector'));
      return;
    }
    try {
      setInstalling(true);
      const result = await installApiLibraryPack(
        selectedPack.pack_id,
        connectionUuid,
        selectedItemKeys,
      );
      messageApi.success(
        t('pages.system.apis.libraryInstallSuccess', {
          created: result.created_count,
          skipped: result.skipped_count,
          categorized: result.categorized_count,
        }),
      );
      onInstalled?.();
      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.system.apis.libraryInstallFailed'));
    } finally {
      setInstalling(false);
    }
  };

  const allItemsSelected =
    allItemKeys.length > 0 && selectedItemKeys.length === allItemKeys.length;
  const someItemsSelected =
    selectedItemKeys.length > 0 && selectedItemKeys.length < allItemKeys.length;

  return (
    <Modal
      title={t('pages.system.apis.libraryTitle')}
      open={open}
      onCancel={onClose}
      destroyOnHidden
      width={960}
      footer={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            type="primary"
            loading={installing}
            disabled={
              !selectedPack || connectorOptions.length === 0 || selectedItemKeys.length === 0
            }
            onClick={() => void handleInstall()}
          >
            {t('pages.system.apis.libraryInstall')}
          </Button>
        </Space>
      }
    >
      <Paragraph type="secondary" style={{ marginBottom: 12 }}>
        {t('pages.system.apis.libraryHint')}
      </Paragraph>

      <div className="api-library-modal-toolbar">
        <Input.Search
          allowClear
          className="api-library-search"
          placeholder={t('pages.system.apis.librarySearchPlaceholder')}
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
        <Select
          className="api-library-category"
          value={categoryFilter}
          options={categoryOptions}
          onChange={setCategoryFilter}
        />
      </div>

      <Spin spinning={loading}>
        <div className="api-library-modal-body">
          <div className="api-library-list-panel">
            <div className="api-library-list-header">
              {t('pages.system.apis.libraryPackListSummary', {
                shown: filteredPacks.length,
                total: packs.length,
              })}
            </div>
            <div className="api-library-list-scroll">
              {filteredPacks.length === 0 ? (
                <div className="api-library-empty">
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t('pages.system.apis.libraryEmptySearch')}
                  />
                </div>
              ) : (
                filteredPacks.map((pack) => {
                  const active = selectedPackId === pack.pack_id;
                  return (
                    <div
                      key={pack.pack_id}
                      className={`api-library-pack-item${active ? ' is-active' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedPackId(pack.pack_id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedPackId(pack.pack_id);
                        }
                      }}
                    >
                      <div className="api-library-pack-item-title">{pack.name}</div>
                      <div className="api-library-pack-item-meta">
                        <span>{t('pages.system.apis.libraryApiCount', { count: pack.api_count })}</span>
                        <Tag variant="filled">{pack.category_name}</Tag>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="api-library-detail-panel">
            {selectedPack ? (
              <>
                <div className="api-library-detail-content">
                  <Space align="start" size={12} style={{ marginBottom: 12 }}>
                    <DatabaseOutlined style={{ fontSize: 22, marginTop: 2, color: 'var(--ant-color-primary)' }} />
                    <div style={{ minWidth: 0 }}>
                      <Text strong style={{ fontSize: 16 }}>
                        {selectedPack.name}
                      </Text>
                      <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                        {selectedPack.description}
                      </Paragraph>
                      <Space wrap size={8}>
                        <Tag>{selectedPack.category_name}</Tag>
                        <Text type="secondary">
                          {t('pages.system.apis.libraryConnectorType', {
                            type: selectedPack.connector_type,
                          })}
                        </Text>
                      </Space>
                    </div>
                  </Space>

                  <div className="api-library-item-toolbar">
                    <Checkbox
                      indeterminate={someItemsSelected}
                      checked={allItemsSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          handleSelectAllItems();
                        } else {
                          handleClearItemSelection();
                        }
                      }}
                    >
                      {t('pages.system.apis.librarySelectAll')}
                    </Checkbox>
                    <Text type="secondary">
                      {t('pages.system.apis.librarySelectedCount', { count: selectedItemKeys.length })}
                    </Text>
                  </div>

                  <div className="api-library-item-list">
                    {selectedPack.items.map((item) => {
                      const checked = selectedItemKeys.includes(item.item_key);
                      return (
                        <div
                          key={item.item_key}
                          className={`api-library-item-row${checked ? ' is-selected' : ''}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleItemKey(item.item_key)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              toggleItemKey(item.item_key);
                            }
                          }}
                        >
                          <Checkbox
                            checked={checked}
                            onClick={(event) => event.stopPropagation()}
                            onChange={() => toggleItemKey(item.item_key)}
                          />
                          <div className="api-library-item-body">
                            <div className="api-library-item-name">{item.name}</div>
                            <div className="api-library-item-desc">{item.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="api-library-detail-footer">
                  <Text>{t('pages.system.apis.libraryConnectorLabel')}</Text>
                  <Select
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder={t('pages.system.apis.libraryConnectorPlaceholderGeneric')}
                    options={connectorOptions}
                    value={connectionUuid}
                    onChange={setConnectionUuid}
                    notFoundContent={t('pages.system.apis.libraryNoConnectorGeneric')}
                  />
                </div>
              </>
            ) : (
              <div className="api-library-empty">
                <Empty description={t('pages.system.apis.librarySelectPack')} />
              </div>
            )}
          </div>
        </div>
      </Spin>
    </Modal>
  );
};
