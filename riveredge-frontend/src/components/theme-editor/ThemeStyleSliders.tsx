/**
 * 主题圆角 / 字号滑块（与主题编辑器、偏好设置共用，保证刻度与范围一致）
 */

import React from 'react';
import { Form, Slider, Typography } from 'antd';
import type { NamePath } from 'antd/es/form/interface';
import { useTranslation } from 'react-i18next';
import {
  readBorderRadius,
  THEME_BORDER_RADIUS_MARKS,
  THEME_BORDER_RADIUS_MAX,
  THEME_BORDER_RADIUS_MIN,
} from '../../utils/themeBorderRadius';
import {
  readFontSize,
  THEME_FONT_SIZE_MARKS,
  THEME_FONT_SIZE_MAX,
  THEME_FONT_SIZE_MIN,
} from '../../utils/themeFontSize';
import { buildEdgeAlignedSliderMarks } from '../../utils/themeSliderMarks';

const { Text } = Typography;

export interface ThemeFontSizeSliderProps {
  name?: NamePath;
}

export const ThemeFontSizeSlider: React.FC<ThemeFontSizeSliderProps> = ({ name = 'fontSize' }) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const fontSize = Form.useWatch(name, form);

  return (
    <Form.Item
      name={name}
      label={
        <div>
          <div>{t('components.themeEditor.fontSize.label')}</div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
            {t('components.themeEditor.fontSize.desc', {
              value: readFontSize(fontSize),
            })}
          </Text>
        </div>
      }
    >
      <Slider
        min={THEME_FONT_SIZE_MIN}
        max={THEME_FONT_SIZE_MAX}
        step={1}
        marks={buildEdgeAlignedSliderMarks([...THEME_FONT_SIZE_MARKS], (value) =>
          t(`components.themeEditor.fontSize.mark.${value}`),
        )}
      />
    </Form.Item>
  );
};

export interface ThemeBorderRadiusSliderProps {
  name?: NamePath;
}

export const ThemeBorderRadiusSlider: React.FC<ThemeBorderRadiusSliderProps> = ({
  name = 'borderRadius',
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const borderRadius = Form.useWatch(name, form);

  return (
    <Form.Item
      name={name}
      label={
        <div>
          <div>{t('components.themeEditor.borderRadius.label')}</div>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 'normal' }}>
            {t('components.themeEditor.borderRadius.desc', {
              value: readBorderRadius(borderRadius),
            })}
          </Text>
        </div>
      }
    >
      <Slider
        min={THEME_BORDER_RADIUS_MIN}
        max={THEME_BORDER_RADIUS_MAX}
        step={1}
        marks={buildEdgeAlignedSliderMarks([...THEME_BORDER_RADIUS_MARKS], (value) =>
          t(`components.themeEditor.borderRadius.mark.${value}`),
        )}
      />
    </Form.Item>
  );
};

export interface ThemeStyleSlidersProps {
  borderRadiusName?: NamePath;
  fontSizeName?: NamePath;
  gap?: number;
}

/** 偏好设置等单区块：字号在上、圆角在下 */
export const ThemeStyleSliders: React.FC<ThemeStyleSlidersProps> = ({
  borderRadiusName = 'borderRadius',
  fontSizeName = 'fontSize',
  gap = 24,
}) => (
  <>
    <ThemeFontSizeSlider name={fontSizeName} />
    <div style={{ marginTop: gap }}>
      <ThemeBorderRadiusSlider name={borderRadiusName} />
    </div>
  </>
);
