import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Input, Space, Tooltip, theme } from 'antd';
import {
  ArrowLeftOutlined,
  RedoOutlined,
  SaveOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { Puck, createUsePuck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  SYSTEM_VIEWPORT_OFFSETS,
  getViewportHeightExpr,
} from '../../../../../components/layout-templates/constants';
import { createOaFormPuckConfig } from '../../../puck/config';
import {
  fieldsSchemaToPuckData,
  oaFormPuckDraftHasDuplicateName,
  oaFormPuckDraftHasIncomplete,
  puckDataToFields,
} from '../../../puck/mapFields';
import { getFormTemplate, updateFormTemplate } from '../../../services/forms';
import { useResourcePermissions } from '../../../../../hooks/useResourcePermissions';
import { usePuckChrome } from '../../../../../components/puck-chrome/usePuckChrome';
import '../../../puck/oa-form-puck.css';

const useOaFormDesignerPuck = createUsePuck();

const DesignerToolbar: React.FC<{
  templateName: string;
  onNameChange: (value: string) => void;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
}> = ({ templateName, onNameChange, onBack, onSave, saving }) => {
  const { t } = useTranslation();
  const hasPast = useOaFormDesignerPuck((s) => s.history.hasPast);
  const hasFuture = useOaFormDesignerPuck((s) => s.history.hasFuture);
  const historyBack = useOaFormDesignerPuck((s) => s.history.back);
  const historyForward = useOaFormDesignerPuck((s) => s.history.forward);

  return (
    <div className="oa-form-designer-toolbar">
      <div className="oa-form-designer-toolbar__left">
        <Tooltip title={t('app.kuaioa.formTemplate.designerBack')}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} />
        </Tooltip>
        <Input
          value={templateName}
          onChange={(e) => onNameChange(e.target.value)}
          variant="borderless"
          className="oa-form-designer-toolbar__name"
          placeholder={t('app.kuaioa.formTemplate.name')}
        />
      </div>
      <div className="oa-form-designer-toolbar__center">
        <Space size={4}>
          <Tooltip title={t('app.kuaioa.formSchema.undo')}>
            <Button type="text" size="small" icon={<UndoOutlined />} disabled={!hasPast} onClick={historyBack} />
          </Tooltip>
          <Tooltip title={t('app.kuaioa.formSchema.redo')}>
            <Button type="text" size="small" icon={<RedoOutlined />} disabled={!hasFuture} onClick={historyForward} />
          </Tooltip>
        </Space>
      </div>
      <div className="oa-form-designer-toolbar__right">
        <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={onSave}>
          {t('app.kuaioa.formTemplate.designerSave')}
        </Button>
      </div>
    </div>
  );
};

const FormTemplateDesignerPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { rootProps: puckChromeRoot, chromeOverrides } = usePuckChrome();
  const { message: messageApi } = App.useApp();
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const perms = useResourcePermissions('kuaioa:form-template');
  const templateId = Number(searchParams.get('id'));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<Data>(() => fieldsSchemaToPuckData([]));
  const [templateName, setTemplateName] = useState('');
  const templateNameRef = useRef('');
  const dataRef = useRef(data);
  dataRef.current = data;

  const shellStyle = useMemo<React.CSSProperties>(
    () => ({
      height: getViewportHeightExpr(SYSTEM_VIEWPORT_OFFSETS.DASHBOARD_DESIGNER_PX, {
        compensateHeaderInFullscreen: true,
      }),
      background: token.colorBgLayout,
      overflow: 'hidden',
    }),
    [token.colorBgLayout],
  );

  const puckConfig = useMemo(() => createOaFormPuckConfig(t), [t, i18n.language]);

  useEffect(() => {
    if (!Number.isFinite(templateId) || templateId <= 0) {
      setLoading(false);
      return;
    }
    void (async () => {
      try {
        const row = await getFormTemplate(templateId);
        setTemplateName(row.template_name || '');
        templateNameRef.current = row.template_name || '';
        setData(fieldsSchemaToPuckData(row.fields_schema));
      } catch (error: unknown) {
        const err = error as { message?: string };
        messageApi.error(err?.message || t('app.kuaioa.formTemplate.designerLoadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [messageApi, t, templateId]);

  const handlePuckChange = useCallback((next: Data) => {
    setData((prev) => {
      try {
        if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
      } catch {
        return next;
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!Number.isFinite(templateId) || templateId <= 0) return;
    if (!perms.canUpdate) {
      messageApi.error(t('app.kuaioa.common.noPermission'));
      return;
    }
    const nextData = dataRef.current;
    if (oaFormPuckDraftHasIncomplete(nextData)) {
      messageApi.error(t('app.kuaioa.formSchema.incomplete'));
      return;
    }
    if (oaFormPuckDraftHasDuplicateName(nextData)) {
      messageApi.error(t('app.kuaioa.formSchema.duplicateName'));
      return;
    }
    setSaving(true);
    try {
      await updateFormTemplate(templateId, {
        template_name: templateNameRef.current.trim() || templateName.trim(),
        fields_schema: puckDataToFields(nextData),
      });
      messageApi.success(t('app.kuaioa.formTemplate.designerSaveSuccess'));
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('app.kuaioa.common.operationFailed'));
    } finally {
      setSaving(false);
    }
  }, [messageApi, perms.canUpdate, t, templateId, templateName]);

  const overrides = useMemo(
    () => ({
      ...chromeOverrides,
      header: () => (
        <DesignerToolbar
          templateName={templateName}
          onNameChange={(value) => {
            setTemplateName(value);
            templateNameRef.current = value;
          }}
          onBack={() => navigate('/apps/kuaioa/approval/form-templates')}
          onSave={() => void handleSave()}
          saving={saving}
        />
      ),
    }),
    [chromeOverrides, handleSave, navigate, saving, templateName],
  );

  if (!Number.isFinite(templateId) || templateId <= 0) {
    return (
      <div style={{ ...shellStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {t('app.kuaioa.formTemplate.designerMissingId')}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ ...shellStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {t('app.kuaioa.common.loading')}
      </div>
    );
  }

  return (
    <div style={shellStyle}>
      <div className={`oa-form-puck-editor oa-form-puck-editor--page ${puckChromeRoot.className}`} style={puckChromeRoot.style}>
        <Puck
          key={i18n.language}
          config={puckConfig}
          data={data}
          onChange={handlePuckChange}
          overrides={overrides}
          iframe={{ enabled: false }}
          viewports={[{ width: 960, height: 640, label: 'Form' }]}
          ui={{
            viewports: {
              controlsVisible: false,
              current: { width: 960, height: 640 },
            },
          }}
        />
      </div>
    </div>
  );
};

export default FormTemplateDesignerPage;
