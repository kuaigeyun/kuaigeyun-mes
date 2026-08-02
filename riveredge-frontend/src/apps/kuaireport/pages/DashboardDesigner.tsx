import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Space, Tooltip, message } from 'antd';
import {
  ArrowLeftOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  EyeOutlined,
  RedoOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Puck, usePuck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import '../puck/puck-dashboard.css';
import { createDashboardPuckConfig } from '../puck/config';
import { EMPTY_PUCK_DATA, normalizePuckData } from '../puck/types';
import { createDashboard, getDashboard, updateDashboard } from '../services/kuaireport';

type DesignerHeaderProps = {
  name: string;
  onNameChange: (value: string) => void;
  saving: boolean;
  canPreview: boolean;
  onBack: () => void;
  onPreview: () => void;
  onSave: () => void;
};

/** 合并后的单行顶栏（须在 Puck 内部渲染以便 usePuck） */
const DesignerHeader: React.FC<DesignerHeaderProps> = ({
  name,
  onNameChange,
  saving,
  canPreview,
  onBack,
  onPreview,
  onSave,
}) => {
  const { t } = useTranslation();
  const { history } = usePuck();

  return (
    <header className="dashboard-designer-toolbar">
      <div className="dashboard-designer-toolbar__left">
        <Tooltip title={t('app.kuaireport.designer.back', { defaultValue: '返回列表' })}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} className="dashboard-designer-toolbar__icon-btn" />
        </Tooltip>
        <Input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          variant="borderless"
          className="dashboard-designer-toolbar__name"
          placeholder={t('app.kuaireport.designer.namePlaceholder', { defaultValue: '看板名称' })}
        />
      </div>

      <div className="dashboard-designer-toolbar__right">
        <Space size={8}>
          <Tooltip title={t('app.kuaireport.designer.undo', { defaultValue: '撤销' })}>
            <Button
              type="text"
              icon={<UndoOutlined />}
              disabled={!history.hasPast}
              onClick={() => history.back()}
              className="dashboard-designer-toolbar__icon-btn"
            />
          </Tooltip>
          <Tooltip title={t('app.kuaireport.designer.redo', { defaultValue: '重做' })}>
            <Button
              type="text"
              icon={<RedoOutlined />}
              disabled={!history.hasFuture}
              onClick={() => history.forward()}
              className="dashboard-designer-toolbar__icon-btn"
            />
          </Tooltip>
          <Button
            icon={<EyeOutlined />}
            onClick={onPreview}
            disabled={!canPreview}
            className="dashboard-designer-toolbar__ghost-btn"
          >
            {t('app.kuaireport.designer.preview', { defaultValue: '预览' })}
          </Button>
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
            {t('app.kuaireport.designer.save', { defaultValue: '保存设计' })}
          </Button>
        </Space>
      </div>
    </header>
  );
};

/** 将 Puck 内置英文标题替换为当前语言 */
const PuckChromeI18n: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { selectedItem, appState } = usePuck();
  const leftVisible = appState.ui.leftSideBarVisible;
  const rightVisible = appState.ui.rightSideBarVisible;

  useLayoutEffect(() => {
    const root = document.querySelector('.dashboard-designer');
    if (!root) return undefined;

    const componentsLabel = t('app.kuaireport.designer.components', { defaultValue: '组件' });
    const outlineLabel = t('app.kuaireport.designer.outline', { defaultValue: '大纲' });
    const pageLabel = t('app.kuaireport.designer.page', { defaultValue: '页面' });

    const setText = (el: Element | null | undefined, text: string) => {
      if (!el || el.textContent === text) return;
      el.textContent = text;
    };

    const apply = () => {
      const leftHeadings = root.querySelectorAll(
        '[class*="Sidebar--left"] [class*="SidebarSection-heading"]',
      );
      setText(leftHeadings[0], componentsLabel);
      setText(leftHeadings[1], outlineLabel);

      root
        .querySelectorAll('[class*="Sidebar--right"] [class*="SidebarSection-breadcrumbLabel"]')
        .forEach((el) => {
          const raw = el.textContent?.trim();
          if (raw === 'Page' || raw === pageLabel) {
            el.textContent = pageLabel;
          }
        });

      if (!selectedItem) {
        const rightHeading = root.querySelector(
          '[class*="Sidebar--right"] [class*="SidebarSection-heading"]',
        );
        const raw = rightHeading?.textContent?.trim();
        if (raw === 'Page' || raw === pageLabel || !raw) {
          setText(rightHeading, pageLabel);
        }
      }
    };

    apply();
    const mo = new MutationObserver(apply);
    mo.observe(root, { childList: true, subtree: true, characterData: true });
    return () => mo.disconnect();
  }, [t, i18n.language, selectedItem, leftVisible, rightVisible]);

  return null;
};

/** 面板标题栏收起按钮 + 收起后的边缘展开条 */
const PanelCollapseControls: React.FC = () => {
  const { t } = useTranslation();
  const { dispatch, appState } = usePuck();
  const leftVisible = appState.ui.leftSideBarVisible;
  const rightVisible = appState.ui.rightSideBarVisible;

  const [leftTitleEl, setLeftTitleEl] = useState<HTMLElement | null>(null);
  const [rightTitleEl, setRightTitleEl] = useState<HTMLElement | null>(null);
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const root = document.querySelector('.dashboard-designer') as HTMLElement | null;
    setShellEl(root);

    const sync = () => {
      setLeftTitleEl(
        (root?.querySelector(
          '[class*="Sidebar--left"] [class*="SidebarSection"]:first-of-type [class*="SidebarSection-title"]',
        ) as HTMLElement | null) ?? null,
      );
      setRightTitleEl(
        (root?.querySelector('[class*="Sidebar--right"] [class*="SidebarSection-title"]') as HTMLElement | null) ??
          null,
      );
    };

    sync();
    if (!root) return undefined;
    const mo = new MutationObserver(sync);
    mo.observe(root, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [leftVisible, rightVisible]);

  const setSidebarVisible = (side: 'left' | 'right', visible: boolean) => {
    const widerViewport = window.matchMedia('(min-width: 638px)').matches;
    const opposite = side === 'left' ? 'rightSideBarVisible' : 'leftSideBarVisible';
    dispatch({
      type: 'setUi',
      ui: {
        [`${side}SideBarVisible`]: visible,
        ...(!widerViewport && visible ? { [opposite]: false } : {}),
      },
    });
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      window.dispatchEvent(new CustomEvent('viewportchange', { bubbles: true }));
    });
  };

  const collapseComponents = t('app.kuaireport.designer.collapseComponents', { defaultValue: '收起组件面板' });
  const collapseProperties = t('app.kuaireport.designer.collapseProperties', { defaultValue: '收起属性面板' });
  const expandComponents = t('app.kuaireport.designer.expandComponents', { defaultValue: '展开组件面板' });
  const expandProperties = t('app.kuaireport.designer.expandProperties', { defaultValue: '展开属性面板' });
  const componentsShort = t('app.kuaireport.designer.componentsShort', { defaultValue: '组件' });
  const propertiesShort = t('app.kuaireport.designer.propertiesShort', { defaultValue: '属性' });

  return (
    <>
      {leftTitleEl &&
        createPortal(
          <Tooltip title={collapseComponents}>
            <button
              type="button"
              className="dashboard-panel-collapse-btn"
              aria-label={collapseComponents}
              onClick={() => setSidebarVisible('left', false)}
            >
              <DoubleLeftOutlined />
            </button>
          </Tooltip>,
          leftTitleEl,
        )}
      {rightTitleEl &&
        createPortal(
          <Tooltip title={collapseProperties}>
            <button
              type="button"
              className="dashboard-panel-collapse-btn"
              aria-label={collapseProperties}
              onClick={() => setSidebarVisible('right', false)}
            >
              <DoubleRightOutlined />
            </button>
          </Tooltip>,
          rightTitleEl,
        )}
      {shellEl &&
        !leftVisible &&
        createPortal(
          <Tooltip title={expandComponents} placement="right">
            <button
              type="button"
              className="dashboard-panel-expand-tab dashboard-panel-expand-tab--left"
              aria-label={expandComponents}
              onClick={() => setSidebarVisible('left', true)}
            >
              <DoubleRightOutlined />
              <span>{componentsShort}</span>
            </button>
          </Tooltip>,
          shellEl,
        )}
      {shellEl &&
        !rightVisible &&
        createPortal(
          <Tooltip title={expandProperties} placement="left">
            <button
              type="button"
              className="dashboard-panel-expand-tab dashboard-panel-expand-tab--right"
              aria-label={expandProperties}
              onClick={() => setSidebarVisible('right', true)}
            >
              <span>{propertiesShort}</span>
              <DoubleLeftOutlined />
            </button>
          </Tooltip>,
          shellEl,
        )}
    </>
  );
};

const DashboardDesigner: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');

  const [name, setName] = useState(() =>
    t('app.kuaireport.designer.defaultName', { defaultValue: '新建看板' }),
  );
  const [data, setData] = useState<Data>(EMPTY_PUCK_DATA);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);

  const puckConfig = useMemo(() => createDashboardPuckConfig(t), [t, i18n.language]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await getDashboard(id);
        if (!res) return;
        setName(res.name || t('app.kuaireport.designer.defaultName', { defaultValue: '新建看板' }));
        setNameTouched(true);
        setData(normalizePuckData(res.layout_config));
      } catch {
        message.error(t('app.kuaireport.designer.loadFailed', { defaultValue: '加载看板失败' }));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  useEffect(() => {
    if (!id && !nameTouched) {
      setName(t('app.kuaireport.designer.defaultName', { defaultValue: '新建看板' }));
    }
  }, [id, nameTouched, t, i18n.language]);

  const themeConfig = useMemo(
    () => ({
      accent: (data.root as any)?.props?.accent || (data.root as any)?.accent || '#00d4ff',
      backgroundVariant:
        (data.root as any)?.props?.backgroundVariant ||
        (data.root as any)?.backgroundVariant ||
        'radialGrid',
    }),
    [data],
  );

  const saveDashboard = useCallback(
    async (nextData?: Data) => {
      const payloadData = nextData || data;
      setSaving(true);
      try {
        const body = {
          name,
          code: id ? undefined : `DB_${Date.now()}`,
          layout_config: payloadData,
          widgets_config: null,
          theme_config: themeConfig,
          status: 'PUBLISHED',
        };
        if (id) {
          await updateDashboard(id, body);
          message.success(t('app.kuaireport.designer.updateSuccess', { defaultValue: '更新成功' }));
        } else {
          const res = await createDashboard(body);
          message.success(t('app.kuaireport.designer.saveSuccess', { defaultValue: '保存成功' }));
          if (res?.id) navigate(`?id=${res.id}`, { replace: true });
        }
      } catch {
        message.error(t('app.kuaireport.designer.saveFailed', { defaultValue: '保存失败' }));
      } finally {
        setSaving(false);
      }
    },
    [data, id, name, navigate, themeConfig, t],
  );

  const overrides = useMemo(
    () => ({
      header: () => (
        <DesignerHeader
          name={name}
          onNameChange={(value) => {
            setNameTouched(true);
            setName(value);
          }}
          saving={saving}
          canPreview={!!id}
          onBack={() => navigate('../dashboards')}
          onPreview={() => id && navigate(`../dashboards/${id}`)}
          onSave={() => saveDashboard()}
        />
      ),
      puck: ({ children }: { children: React.ReactNode }) => (
        <>
          {children}
          <PuckChromeI18n />
          <PanelCollapseControls />
        </>
      ),
    }),
    [name, saving, id, navigate, saveDashboard],
  );

  if (loading) {
    return (
      <div
        className="dashboard-designer"
        style={{
          background: '#0a1120',
          color: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {t('app.kuaireport.designer.loading', { defaultValue: '加载中...' })}
      </div>
    );
  }

  return (
    <div className="dashboard-designer" style={{ background: '#0a1120', color: '#fff' }}>
      <div style={{ position: 'relative' }}>
        <Puck
          key={i18n.language}
          config={puckConfig}
          data={data}
          onChange={setData}
          onPublish={async (published) => {
            setData(published);
            await saveDashboard(published);
          }}
          overrides={overrides}
          iframe={{ enabled: false }}
          viewports={[{ width: 1920, height: 'auto', label: 'Desktop' }]}
          ui={{
            viewports: {
              controlsVisible: false,
              current: { width: 1920, height: 'auto' },
            },
          }}
        />
      </div>
    </div>
  );
};

export default DashboardDesigner;
