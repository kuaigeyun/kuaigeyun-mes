import{L as I,j as e,N as T,a5 as M,a6 as O,V as E,b5 as J,Z as z,as as ee,c_ as te,r as b,T as V,bg as ie,dn as q,K as ne,ay as re,Q as ae,aw as oe,dd as le,cf as se,a as me}from"./vendor-CgY5G-T_.js";import{ad as B,cg as r,ch as h,aN as pe,e as X}from"./main-ClD4dskw.js";import{b as U}from"./clientRelease-fU18Sq7C.js";import{H as t}from"./design-B_8Sx7jg.js";import{H as _,T as W}from"./touch-CzJ4Jti_.js";const Z={HEADER_HEIGHT:64,METRICS_HEIGHT:80,LEFT_PANEL_WIDTH:320,RIGHT_PANEL_WIDTH:360},de={colorPrimary:t.STATUS_INFO,colorSuccess:t.STATUS_OK,colorWarning:t.STATUS_WARNING,colorError:t.STATUS_ALARM,colorBgLayout:t.BG_PRIMARY,colorBgContainer:t.BG_PANEL,colorBorder:t.BORDER,colorText:t.TEXT_PRIMARY,colorTextSecondary:t.TEXT_SECONDARY,colorTextTertiary:t.TEXT_TERTIARY,borderRadius:t.PANEL_RADIUS,fontSize:t.FONT_BODY,fontSizeLG:20,fontSizeXL:24,fontSizeHeading1:t.FONT_TITLE_MIN,fontSizeHeading2:t.FONT_FIGURE,fontSizeHeading3:t.FONT_BODY_MIN},{useToken:ce}=I,Ee=({quickActions:o=[],todos:n=[],stats:a=[],quickEntries:m=[],children:d,className:u,style:c,showConfigButton:l=!1,onConfigClick:y})=>{const{t:x}=U(),{token:f}=ce(),S=n.length>0||a.length>0||m.length>0;return e.jsxs("div",{className:u,style:{padding:0,flex:1,minHeight:0,width:"100%",display:"flex",flexDirection:"column",backgroundColor:"transparent",boxSizing:"border-box",...c},children:[o.length>0&&e.jsx(T,{title:x("components.layoutTemplates.dashboard.quickActions"),style:{marginBottom:B.BLOCK_GAP},extra:l&&y?e.jsx(E,{type:"text",size:"small",icon:e.jsx(J,{}),onClick:i=>{i.stopPropagation(),y()},children:x("components.layoutTemplates.dashboard.configure")}):void 0,children:e.jsx(M,{gutter:r.SPACING.MD,children:o.map((i,p)=>e.jsx(O,{xs:12,sm:8,md:6,lg:4,xl:4,xxl:3,children:e.jsxs(T,{hoverable:!i.disabled,onClick:()=>{i.disabled||i.onClick?.()},style:{cursor:i.disabled?"not-allowed":"pointer",textAlign:"center",padding:`${r.SPACING.MD}px`,opacity:i.disabled?.5:1},children:[e.jsx("div",{style:{fontSize:r.FONT_SIZE.XXL*1.5,marginBottom:r.SPACING.SM,color:i.type==="primary"?f.colorPrimary:f.colorText,display:"flex",justifyContent:"center",alignItems:"center"},children:i.icon}),e.jsx("div",{style:{fontSize:r.FONT_SIZE.SM,color:f.colorText,fontWeight:500},children:i.title})]})},p))})}),S&&e.jsxs(M,{gutter:r.SPACING.MD,children:[e.jsxs(O,{xs:24,lg:16,children:[n.length>0&&e.jsx(T,{title:x("components.layoutTemplates.dashboard.todos"),style:{marginBottom:B.BLOCK_GAP},children:e.jsx(M,{gutter:r.SPACING.MD,children:n.map((i,p)=>e.jsx(O,{xs:h.TODO_COLUMNS.xs*24,sm:h.TODO_COLUMNS.sm*24,md:h.TODO_COLUMNS.md*12,lg:h.TODO_COLUMNS.lg*12,xl:h.TODO_COLUMNS.xl*12,xxl:h.TODO_COLUMNS.xxl*12,children:e.jsx(T,{hoverable:!0,onClick:i.onClick,style:{cursor:"pointer"},children:e.jsxs(z,{children:[e.jsx(ee,{count:i.count,showZero:!0,style:{backgroundColor:f.colorPrimary}}),e.jsx("span",{children:i.title})]})})},p))})}),a.length>0&&e.jsx(T,{title:x("components.layoutTemplates.dashboard.statsBoard"),children:e.jsx(M,{gutter:r.SPACING.MD,children:a.map((i,p)=>e.jsx(O,{xs:h.STAT_COLUMNS.xs*24,sm:h.STAT_COLUMNS.sm*12,md:h.STAT_COLUMNS.md*12,lg:h.STAT_COLUMNS.lg*8,xl:h.STAT_COLUMNS.xl*8,xxl:h.STAT_COLUMNS.xxl*8,children:e.jsx(T,{hoverable:!!i.onClick,onClick:i.onClick,style:{cursor:i.onClick?"pointer":"default"},children:e.jsxs("div",{style:{textAlign:"center"},children:[e.jsxs("div",{style:{fontSize:r.FONT_SIZE.XXL,fontWeight:600,color:i.valueStyle?.color||f.colorPrimary,marginBottom:r.SPACING.XS},children:[i.prefix,i.value,i.suffix&&e.jsx("span",{style:{fontSize:r.FONT_SIZE.MD},children:i.suffix})]}),e.jsx("div",{style:{fontSize:r.FONT_SIZE.SM,color:f.colorTextSecondary},children:i.title})]})})},p))})})]}),e.jsx(O,{xs:24,lg:8,children:m.length>0&&e.jsx(T,{title:x("components.layoutTemplates.dashboard.quickEntries"),children:e.jsx(M,{gutter:r.SPACING.MD,children:m.map((i,p)=>e.jsx(O,{xs:12,sm:8,md:8,lg:12,xl:12,xxl:12,children:e.jsxs(T,{hoverable:!0,onClick:i.onClick,style:{cursor:"pointer",textAlign:"center",padding:r.SPACING.MD},children:[e.jsx("div",{style:{fontSize:r.FONT_SIZE.XXL,marginBottom:r.SPACING.SM},children:i.icon}),e.jsx("div",{style:{fontSize:r.FONT_SIZE.SM},children:i.title})]})},p))})})})]}),d&&e.jsx("div",{style:{flex:1,minHeight:0,display:"flex",flexDirection:"column",marginTop:0},children:d})]})},{useToken:he}=I,Se=({steps:o,current:n,onStepChange:a,onPrev:m,onNext:d,onFinish:u,showPrev:c=!0,showNext:l=!0,showFinish:y=!0,prevText:x,nextText:f,finishText:S,nextDisabled:i=!1,finishDisabled:p=!1,onSkip:v,skipText:k,className:L,style:G})=>{const{t:A}=U(),{token:j}=he(),w=x??A("common.previous"),H=f??A("common.next"),C=S??A("components.layoutTemplates.wizard.finish"),$=k??A("components.layoutTemplates.wizard.skipLater"),N=n===0,R=n===o.length-1,D=()=>{if(n>0){const g=n-1;a?.(g),m?.()}},F=()=>{if(n<o.length-1){const g=n+1;a?.(g),d?.()}},Y=()=>{u?.()};return e.jsxs("div",{className:L,style:{...pe(),...G},children:[e.jsx(T,{style:{marginBottom:B.BLOCK_GAP},children:e.jsx(te,{current:n,onChange:a,items:o.map(g=>({title:g.title,...g.description&&{content:g.description}}))})}),e.jsx(T,{style:{minHeight:"400px",marginBottom:B.BLOCK_GAP},children:o[n]?.content}),e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",paddingTop:r.SPACING.MD,borderTop:`1px solid ${j.colorBorder}`},children:[e.jsxs(z,{children:[c&&!N&&e.jsx(E,{onClick:D,children:w}),v&&e.jsx(E,{onClick:v,children:$})]}),e.jsxs(z,{children:[l&&!R&&e.jsx(E,{type:"primary",onClick:F,disabled:i,children:H}),y&&R&&e.jsx(E,{type:"primary",onClick:Y,disabled:p,children:C})]})]})]})},{useToken:Ae}=I,xe={primary:{minHeight:_.PRIMARY_BTN_HEIGHT,minWidth:_.PRIMARY_BTN_MIN_WIDTH,fontSize:_.ACTION_FONT_SIZE,fontWeight:600,paddingInline:t.BUTTON_PADDING_PRIMARY},action:{minHeight:_.ACTION_BTN_HEIGHT,minWidth:_.ACTION_BTN_MIN_WIDTH,fontSize:_.ACTION_FONT_SIZE,fontWeight:500,paddingInline:t.BUTTON_PADDING_SECONDARY},header:{minHeight:_.HEADER_BTN_HEIGHT,minWidth:_.HEADER_BTN_MIN_WIDTH,fontSize:16,paddingInline:16},chip:{minHeight:_.OP_CHIP_HEIGHT,minWidth:100,fontSize:17,fontWeight:500,paddingInline:16}};function ue({variant:o="default",size:n="action",iconSize:a=24,className:m,style:d,disabled:u,loading:c}={}){const l=o==="primary"||o==="success",x=u||c?{}:o==="success"?{background:t.STATUS_OK,borderColor:t.STATUS_OK}:{};return{type:l?"primary":"default",danger:o==="danger",className:["hmi-btn",`hmi-btn--${o}`,`hmi-btn--${n}`,m].filter(Boolean).join(" "),style:{borderRadius:t.PANEL_RADIUS,"--hmi-btn-icon-size":`${a}px`,...xe[n],...x,...d}}}const{useToken:fe}=I,je=({title:o,children:n,footerButtons:a=[],fullscreen:m=!0,className:d,style:u})=>{const{token:c}=fe();return b.useEffect(()=>{if(m)return()=>{document.exitFullscreen&&document.exitFullscreen().catch(()=>{})}},[m]),e.jsxs("div",{className:["hmi-root",d].filter(Boolean).join(" "),style:{width:"100%",height:m?"100vh":"auto",padding:`${r.SPACING.LG}px`,backgroundColor:c.colorBgLayout,display:"flex",flexDirection:"column",fontSize:W.FONT_MIN_SIZE,...u},children:[o&&e.jsx("div",{style:{fontSize:Math.max(W.TITLE_FONT_SIZE,t.FONT_TITLE_MIN),fontWeight:600,marginBottom:r.SPACING.LG,textAlign:"center",color:c.colorTextHeading},children:o}),e.jsx("div",{style:{flex:1,overflowY:"auto",marginBottom:a.length>0?r.SPACING.LG:0},children:n}),a.length>0&&e.jsx("div",{style:{display:"flex",flexDirection:"column",gap:r.SPACING.MD,paddingTop:r.SPACING.MD,borderTop:`1px solid ${c.colorBorder}`},children:a.map((l,y)=>e.jsx(E,{size:"large",...ue({variant:l.type==="primary"?"primary":"default",size:"action"}),icon:l.icon,onClick:l.onClick,disabled:l.disabled,block:l.block!==!1,children:l.title},y))})]})},{useToken:Re}=I,{useToken:Oe}=I,{Title:ve,Text:ke}=V,{useToken:Ce}=I,{Title:De,Text:Pe,Paragraph:Me}=V,{Panel:Be}=ie;function K(o){if(!o?.trim())return!1;const n=o.trim(),a=n.toLowerCase();return n==="管理员"||a==="admin"||a==="administrator"||a==="root"}const{Header:ge,Content:Te}=q,Le=({operatorName:o,operatorAvatar:n,operatorRole:a,operatorEmail:m,stationName:d,stationArea:u,stationWorkshop:c,stationLine:l,children:y,headerExtra:x,headerCenter:f,headerAfterClock:S,modeBadge:i,headerLeftExtra:p,hideStationBreadcrumb:v=!1,clockFormat:k="full",hideFullscreenToggle:L=!1,hideOperatorBlock:G=!1,contentPadding:A=24})=>{const{t:j}=U(),w=o??j("components.layoutTemplates.premiumTerminal.notLoggedIn"),H=d??j("components.layoutTemplates.premiumTerminal.notBound"),[C,$]=b.useState(X(new Date,"YYYY-MM-DD HH:mm:ss")),[N,R]=b.useState(!1),D=b.useRef(null);b.useEffect(()=>{const s=setInterval(()=>{$(X(new Date,"YYYY-MM-DD HH:mm:ss"))},1e3);return()=>clearInterval(s)},[]),b.useEffect(()=>{if(!N||!D.current)return;const s=D.current,P=s.requestFullscreen??s.webkitRequestFullscreen;return P&&P.call(s).catch(()=>R(!1)),()=>{(document.fullscreenElement??document.webkitFullscreenElement)&&(document.exitFullscreen??document.webkitExitFullscreen)?.call(document)}},[N]),b.useEffect(()=>{const s=()=>{!document.fullscreenElement&&!document.webkitFullscreenElement&&R(!1)};return document.addEventListener("fullscreenchange",s),document.addEventListener("webkitfullscreenchange",s),()=>{document.removeEventListener("fullscreenchange",s),document.removeEventListener("webkitfullscreenchange",s)}},[]);const F=()=>{if(N){const s=document.exitFullscreen??document.webkitExitFullscreen;s&&s.call(document)}else R(!0)},Y={position:"fixed",top:0,left:0,right:0,bottom:0,width:"100vw",height:"100vh",zIndex:9999,background:t.BG_PRIMARY,display:"flex",flexDirection:"column",overflow:"hidden"},g=e.jsx(ne,{theme:{algorithm:I.darkAlgorithm,token:{...de,colorBgBase:t.BG_PRIMARY}},children:e.jsxs(q,{id:"premium-terminal-layout",className:"hmi-root",style:{height:"100%",minHeight:0,width:"100%",maxWidth:"100%",overflow:"hidden",background:t.BG_PRIMARY,position:"relative",boxSizing:"border-box",display:"flex",flexDirection:"column",fontFamily:t.FONT_FAMILY},children:[e.jsx("style",{children:`
          #premium-terminal-layout .ant-layout-header {
            background: ${t.BG_PANEL} !important;
            color: #ffffff !important;
          }
          #premium-terminal-layout .ant-layout-header .ant-typography,
          #premium-terminal-layout .ant-layout-header .ant-btn {
            color: #ffffff !important;
          }
          #premium-terminal-layout .ant-layout-header .ant-btn-primary {
            color: ${t.TEXT_PRIMARY} !important;
            background: ${t.BG_ELEVATED} !important;
            border-color: ${t.BORDER} !important;
          }
          #premium-terminal-layout .premium-header-extra-item {
            display: inline-flex;
            align-items: center;
            margin-left: 20px;
          }
        `}),e.jsxs(ge,{style:{backgroundColor:t.BG_PANEL,background:t.BG_PANEL,borderBottom:`1px solid ${t.BORDER}`,padding:"0 24px",height:Z.HEADER_HEIGHT,minHeight:Z.HEADER_HEIGHT,display:"flex",alignItems:"center",zIndex:100,color:t.TEXT_PRIMARY,overflowX:"auto",overflowY:"hidden",flexShrink:0},children:[e.jsxs("div",{className:"header-left-block",children:[i||!v||p?e.jsxs("div",{className:"header-station-cluster",children:[i?e.jsx("div",{className:"header-mode-badge",children:typeof i=="string"?e.jsx("span",{className:"header-mode-badge__label",children:i}):i}):null,v?null:e.jsx("div",{className:"header-station-breadcrumb",children:[u,c,l,d].filter(Boolean).length>0?[u,c,l,d].filter(Boolean).map((s,P,Q)=>e.jsx("span",{className:`header-station-segment ${P===Q.length-1?"header-station-segment-current":""}`,children:s},P)):e.jsx("span",{className:"header-station-segment header-station-segment-current",children:H})}),p?e.jsx("div",{className:"header-station-cluster__action",children:p}):null]}):null,G?null:e.jsxs(e.Fragment,{children:[e.jsx(re,{orientation:"vertical",className:"header-divider-v"}),e.jsxs("div",{className:"header-operator-block",children:[e.jsx("span",{className:"header-operator-avatar",children:n?e.jsx("img",{src:n,alt:""}):e.jsx(ae,{style:{fontSize:20,color:t.TEXT_TERTIARY}})}),e.jsxs("div",{className:"header-operator-info",children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:8},children:[e.jsx("span",{className:"header-operator-name",children:w}),a&&e.jsx(oe,{variant:"filled",style:{margin:0,background:K(a)?"rgba(255, 179, 0, 0.35)":"rgba(255,255,255,0.12)",color:K(a)?"#ffe58f":"#fff",border:"1px solid rgba(255,255,255,0.2)",fontSize:12,lineHeight:"18px",padding:"0 6px",borderRadius:t.RADIUS_CHIP},children:a})]}),m&&e.jsx("span",{className:"header-operator-email",children:m})]})]})]})]}),e.jsx("div",{className:"header-center-slot",children:f}),e.jsxs("div",{className:"header-right-group",children:[e.jsxs("div",{className:"header-extra-container",children:[L?null:e.jsx(E,{type:"default",icon:N?e.jsx(le,{}):e.jsx(se,{}),onClick:F,children:j(N?"components.layoutTemplates.premiumTerminal.exitFullscreen":"components.layoutTemplates.premiumTerminal.fullscreen")}),x]}),e.jsxs("div",{className:"header-controls",children:[e.jsx("div",{className:`time-display${k==="hm"?" time-display--hm":""}`,children:e.jsxs("div",{className:"time-display-text",children:[e.jsx("span",{className:"time-display-time",children:k==="hm"?(C.split(" ")[1]||"").slice(0,5):C.split(" ")[1]}),k==="full"?e.jsx("span",{className:"time-display-date",children:C.split(" ")[0]}):null]})}),S?e.jsx("div",{className:"header-after-clock",children:S}):null]})]}),e.jsx("style",{children:`
            #premium-terminal-layout .header-tags-group {
              display: flex;
              gap: 8px;
            }
            #premium-terminal-layout .adaptive-tag {
              display: inline-flex !important;
              align-items: center !important;
              min-height: ${t.TOUCH_MIN_SIZE}px !important;
              padding: 2px 12px !important;
              background: ${t.BG_ELEVATED} !important;
              color: ${t.TEXT_PRIMARY} !important;
              border-radius: ${t.RADIUS_CHIP}px !important;
              white-space: nowrap !important;
              font-size: ${t.FONT_BODY_MIN}px !important;
            }
            
            #premium-terminal-layout .header-center-slot {
              flex: 1 1 auto !important;
              min-width: 20px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: flex-start !important;
              padding: 0 12px !important;
              overflow: hidden !important;
            }
            #premium-terminal-layout .header-right-group {
              display: flex !important;
              align-items: center !important;
              gap: ${t.BUTTON_GAP}px !important;
              flex-shrink: 0 !important;
              min-width: 0 !important;
            }
            #premium-terminal-layout .header-extra-container {
              display: flex !important;
              align-items: center !important;
              gap: ${t.BUTTON_GAP}px !important;
              flex-shrink: 0 !important;
              min-width: 0 !important;
              overflow: visible !important;
            }
            #premium-terminal-layout .header-extra-container > * {
              display: flex !important;
              align-items: center !important;
              gap: ${t.BUTTON_GAP}px !important;
              flex-shrink: 0 !important;
            }
            /* 刷新 / 切换工位 / 全屏 / 时钟后按钮：统一顶栏次级按钮样式 */
            #premium-terminal-layout .header-extra-container .ant-btn,
            #premium-terminal-layout .header-after-clock .ant-btn {
              flex-shrink: 0 !important;
              white-space: nowrap !important;
              width: auto !important;
              min-width: auto !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              border-radius: ${t.PANEL_RADIUS}px !important;
              min-height: 36px !important;
              height: 36px !important;
              padding: 0 18px !important;
              font-size: 14px !important;
              font-weight: 600 !important;
              line-height: 1.4 !important;
              gap: 8px !important;
              background: ${t.BG_ELEVATED} !important;
              border: 1px solid var(--river-border-color) !important;
              color: ${t.TEXT_PRIMARY} !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn:hover,
            #premium-terminal-layout .header-after-clock .ant-btn:hover {
              background: rgba(255,255,255,0.12) !important;
              border-color: ${t.BORDER} !important;
              color: ${t.TEXT_PRIMARY} !important;
            }
            /* 刷新、切换工位、全屏：统一使用 BG_ELEVATED 配色 */
            #premium-terminal-layout .header-extra-buttons {
              gap: ${t.BUTTON_GAP}px !important;
            }
            #premium-terminal-layout .header-extra-buttons .ant-btn {
              flex-shrink: 0 !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn .anticon,
            #premium-terminal-layout .header-after-clock .ant-btn .anticon {
              color: #fff !important;
            }
            #premium-terminal-layout .header-extra-container .ant-btn .anticon svg,
            #premium-terminal-layout .header-after-clock .ant-btn .anticon svg {
              fill: #fff !important;
              stroke: #fff !important;
              color: #fff !important;
            }

            #premium-terminal-layout .header-controls {
              display: flex !important;
              align-items: center !important;
              gap: ${t.BUTTON_GAP}px !important;
              flex-shrink: 0 !important;
            }
            #premium-terminal-layout .header-after-clock {
              display: flex !important;
              align-items: center !important;
              gap: ${t.BUTTON_GAP}px !important;
              flex-shrink: 0 !important;
            }

            
            #premium-terminal-layout .header-left-block {
              display: flex !important;
              align-items: center !important;
              flex-shrink: 0 !important;
              gap: 0 !important;
              min-width: 800px !important;
            }
            #premium-terminal-layout .header-divider-v {
              border-color: ${t.BORDER} !important;
              height: 28px !important;
              margin: 0 12px !important;
            }
            /* 工位信息：| A> >B > >C | 形，段间有 gap，箭头方向正确 */
            #premium-terminal-layout .header-station-breadcrumb {
              display: inline-flex !important;
              align-items: stretch !important;
              min-width: 0 !important;
              margin-left: 0 !important;
              border-radius: ${t.PANEL_RADIUS}px !important;
              overflow: hidden !important;
              box-shadow: 0 1px 2px rgba(0,0,0,0.25) !important;
              gap: 4px !important;
              isolation: isolate !important;
            }
            #premium-terminal-layout .header-station-segment {
              position: relative !important;
              padding: 8px 18px !important;
              font-size: 14px !important;
              font-weight: 600 !important;
              letter-spacing: 0.02em !important;
              line-height: 1.4 !important;
              white-space: nowrap !important;
              background: ${t.BG_ELEVATED} !important;
              color: ${t.TEXT_PRIMARY} !important;
              margin-left: 0 !important;
            }
            /* 首段：左直 | 右箭头 >（尖朝右），略亮于普通段 */
            #premium-terminal-layout .header-station-segment:first-child {
              padding-left: 18px !important;
              background: rgba(255,255,255,0.1) !important;
              color: ${t.TEXT_PRIMARY} !important;
              clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%) !important;
            }
            /* 中间段：左 >（尖朝右） 右 > */
            #premium-terminal-layout .header-station-segment + .header-station-segment:not(.header-station-segment-current) {
              padding-left: 20px !important;
              clip-path: polygon(0 0, 10px 50%, 0 100%, calc(100% - 10px) 100%, 100% 50%, calc(100% - 10px) 0) !important;
            }
            /* 末段：左 >（尖朝右） 右直 | */
            #premium-terminal-layout .header-station-segment + .header-station-segment.header-station-segment-current {
              padding-left: 20px !important;
              background: ${t.BG_ELEVATED} !important;
              color: ${t.TEXT_PRIMARY} !important;
              clip-path: polygon(0 0, 10px 50%, 0 100%, 100% 100%, 100% 0) !important;
            }
            #premium-terminal-layout .header-station-segment:only-child {
              margin-left: 0 !important;
              clip-path: none !important;
              border-radius: ${t.PANEL_RADIUS}px !important;
            }
            #premium-terminal-layout .header-operator-block {
              display: flex !important;
              align-items: center !important;
              gap: 10px !important;
            }
            #premium-terminal-layout .header-operator-avatar {
              width: 36px !important;
              height: 36px !important;
              border-radius: 50% !important;
              overflow: hidden !important;
              background: ${t.BG_ELEVATED} !important;
              display: flex !important;
              align-items: center !important;
              justify-content: center !important;
              flex-shrink: 0 !important;
            }
            #premium-terminal-layout .header-operator-avatar img {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
            #premium-terminal-layout .header-operator-info {
              display: flex !important;
              flex-direction: column !important;
              align-items: flex-start !important;
              justify-content: center !important;
              gap: 2px !important;
            }
            #premium-terminal-layout .header-operator-name {
              font-size: 14px !important;
              font-weight: 500 !important;
              color: ${t.TEXT_PRIMARY} !important;
              line-height: 1.3 !important;
            }
            #premium-terminal-layout .header-operator-role {
              font-size: 11px !important;
              color: ${t.TEXT_TERTIARY} !important;
              margin-top: 1px !important;
            }
            
            #premium-terminal-layout .time-display {
              background: transparent !important;
              border: none !important;
              padding: 8px 0 !important;
              min-height: auto !important;
              min-width: 96px !important;
              display: flex !important;
              align-items: center !important;
              justify-content: flex-end !important;
              color: ${t.TEXT_PRIMARY} !important;
              flex-shrink: 0 !important;
              box-shadow: none !important;
            }
            #premium-terminal-layout .time-display-text {
              display: flex !important;
              flex-direction: column !important;
              align-items: flex-end !important;
              line-height: 1.3 !important;
            }
            #premium-terminal-layout .time-display-text {
              min-width: 96px !important;
              text-align: right !important;
            }
            #premium-terminal-layout .time-display-time {
              font-family: ${t.FONT_FAMILY} !important;
              font-size: 22px !important;
              font-weight: 600 !important;
              font-variant-numeric: tabular-nums !important;
              letter-spacing: 0.08em !important;
              color: ${t.TEXT_PRIMARY} !important;
            }
            #premium-terminal-layout .time-display-date {
              font-size: 12px !important;
              font-variant-numeric: tabular-nums !important;
              color: ${t.TEXT_TERTIARY} !important;
              margin-top: 2px !important;
            }
            
            @media (max-width: 1200px) {
              #premium-terminal-layout .adaptive-tag span { display: none; }
              #premium-terminal-layout .hidden-mobile { display: none; }
            }

            @media (max-width: 1400px) {
              #premium-terminal-layout .hidden-tablet { display: none; }
            }
            
          `})]}),e.jsx(Te,{style:{padding:A,flex:1,minHeight:0,overflow:"hidden",display:"flex",flexDirection:"column",boxSizing:"border-box"},children:y})]})});return N?me.createPortal(e.jsx("div",{ref:D,className:"premium-terminal-fullscreen-wrap",style:Y,children:g}),document.body):e.jsx("div",{style:{height:"100%",minHeight:0,display:"flex",flexDirection:"column"},children:g})};export{Ee as D,Z as H,Le as P,je as T,Se as W,ue as t};
