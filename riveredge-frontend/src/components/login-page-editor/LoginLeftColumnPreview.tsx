import React, { useMemo } from 'react';

import { AppstoreOutlined } from '@ant-design/icons';

import { sanitizeHtml, looksLikeHtml } from '../../utils/sanitizeHtml';

import { isLoginVisualLayerEnabled } from '../../utils/loginVisualLayers';

import './login-page-editor.less';



export interface LoginLeftColumnPreviewProps {

  themeColor?: string;

  platformName?: string;

  loginTitle?: string;

  loginContent?: string;

  logoUrl?: string;

  decorationUrl?: string;

  backgroundUrl?: string;

  decorationEnabled?: boolean;

  backgroundEnabled?: boolean;

  locale?: 'zh-CN' | 'en-US';

  /** 站点设置左栏预览：宽高铺满预览容器 */
  variant?: 'default' | 'editor-fill';

}



const LoginLeftColumnPreview: React.FC<LoginLeftColumnPreviewProps> = ({

  themeColor = '#1890ff',

  platformName,

  loginTitle,

  loginContent,

  logoUrl,

  decorationUrl,

  backgroundUrl,

  decorationEnabled = true,

  backgroundEnabled = true,

  locale = 'zh-CN',

  variant = 'default',

}) => {

  const showDecoration = isLoginVisualLayerEnabled(decorationEnabled);

  const showBackground = isLoginVisualLayerEnabled(backgroundEnabled);



  const contentHtml = useMemo(() => {

    const raw = (loginContent || '').trim();

    if (!raw) return '';

    if (looksLikeHtml(raw)) {

      return sanitizeHtml(raw);

    }

    return sanitizeHtml(`<p>${raw.replace(/\n/g, '<br>')}</p>`);

  }, [loginContent]);



  const displayTitle = loginTitle || platformName || (locale === 'en-US' ? 'Platform Name' : '平台名称');

  const displayPlatformName = platformName || (locale === 'en-US' ? 'Platform' : '平台');



  return (

    <div

      className={`login-left-column-preview${locale === 'en-US' ? ' lang-en' : ''}${variant === 'editor-fill' ? ' login-left-column-preview--editor-fill' : ''}`}

      style={{ background: showBackground && !backgroundUrl ? themeColor : themeColor }}

    >

      {showBackground && backgroundUrl ? (

        <div className="login-left-column-preview-bg" aria-hidden>

          <img src={backgroundUrl} alt="" />

        </div>

      ) : null}

      {showBackground ? <div className="login-left-column-preview-bg-overlay" aria-hidden /> : null}



      <div className="login-left-column-preview-logo">

        {logoUrl ? (

          <img src={logoUrl} alt={displayPlatformName} />

        ) : (

          <div className="login-left-column-preview-logo-fallback" aria-hidden>

            <AppstoreOutlined />

          </div>

        )}

        <p className="login-left-column-preview-platform-name">{displayPlatformName}</p>

      </div>



      <div className="login-left-column-preview-body">

        {showDecoration ? (

          <div className="login-left-column-preview-decoration">

            {decorationUrl ? (

              <img src={decorationUrl} alt="" />

            ) : (

              <div className="login-left-column-preview-decoration-placeholder" />

            )}

          </div>

        ) : null}



        <h3 className="login-left-column-preview-title">{displayTitle}</h3>



        {contentHtml ? (

          <div

            className="login-left-column-preview-content"

            dangerouslySetInnerHTML={{ __html: contentHtml }}

          />

        ) : (

          <div className="login-left-column-preview-content" style={{ opacity: 0.55 }}>

            {locale === 'en-US'

              ? 'Login page content will appear here.'

              : '登录页内容将显示在此处。'}

          </div>

        )}

      </div>

    </div>

  );

};



export default LoginLeftColumnPreview;


