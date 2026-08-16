import React, { useCallback, useMemo, useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { RedoOutlined, UndoOutlined } from '@ant-design/icons';
import { Puck, createUsePuck, type Data } from '@measured/puck';
import '@measured/puck/puck.css';
import { useTranslation } from 'react-i18next';
import { createOaFormPuckConfig } from '../puck/config';
import { fieldsSchemaToPuckData } from '../puck/mapFields';
import { usePuckChrome } from '../../../components/puck-chrome/usePuckChrome';
import '../puck/oa-form-puck.css';

type Props = {
  value?: unknown;
  onChange?: (value: Data) => void;
};

const useOaFormPuck = createUsePuck();

const OaFormPuckHeader: React.FC = () => {
  const { t } = useTranslation();
  const hasPast = useOaFormPuck((s) => s.history.hasPast);
  const hasFuture = useOaFormPuck((s) => s.history.hasFuture);
  const historyBack = useOaFormPuck((s) => s.history.back);
  const historyForward = useOaFormPuck((s) => s.history.forward);

  return (
    <div className="oa-form-puck-editor__toolbar">
      <span>{t('app.kuaioa.formSchema.puckHint')}</span>
      <Space size={4}>
        <Tooltip title={t('app.kuaioa.formSchema.undo')}>
          <Button
            type="text"
            size="small"
            icon={<UndoOutlined />}
            disabled={!hasPast}
            htmlType="button"
            onClick={historyBack}
          />
        </Tooltip>
        <Tooltip title={t('app.kuaioa.formSchema.redo')}>
          <Button
            type="text"
            size="small"
            icon={<RedoOutlined />}
            disabled={!hasFuture}
            htmlType="button"
            onClick={historyForward}
          />
        </Tooltip>
      </Space>
    </div>
  );
};

const OaFormSchemaPuckEditor: React.FC<Props> = ({ value, onChange }) => {
  const { t, i18n } = useTranslation();
  const { rootProps: puckChromeRoot, chromeOverrides } = usePuckChrome();
  const [data, setData] = useState<Data>(() => fieldsSchemaToPuckData(value));
  const puckConfig = useMemo(() => createOaFormPuckConfig(t), [t, i18n.language]);

  const handleChange = useCallback(
    (next: Data) => {
      setData((prev) => {
        try {
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
        } catch {
          return next;
        }
        return next;
      });
      onChange?.(next);
    },
    [onChange],
  );

  const overrides = useMemo(
    () => ({
      ...chromeOverrides,
      header: () => <OaFormPuckHeader />,
    }),
    [chromeOverrides],
  );

  return (
    <div className={`oa-form-puck-editor ${puckChromeRoot.className}`} style={puckChromeRoot.style}>
      <Puck
        key={i18n.language}
        config={puckConfig}
        data={data}
        onChange={handleChange}
        overrides={overrides}
        iframe={{ enabled: false }}
        viewports={[{ width: 720, height: 480, label: 'Form' }]}
        ui={{
          viewports: {
            controlsVisible: false,
            current: { width: 720, height: 480 },
          },
        }}
      />
    </div>
  );
};

export default OaFormSchemaPuckEditor;
