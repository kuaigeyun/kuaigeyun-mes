import{N as Y,r as c,j as t,M as F,al as G,V as W,bf as U,F as H,$ as S,T as J,aJ as A,aB as Q,U as X,b2 as M,bg as q,bh as Z,aV as ee,bi as te,bj as oe,bk as ae,bl as ne,bm as re,aX as ie,bd as se,bn as ce,bo as le}from"./vendor-CLZ3qlnH.js";import{B as pe,M as C}from"./main-Br-dja2J.js";import{APP_CONNECTOR_DEFINITIONS as h,isLlmConnectionType as $,isKuaiaiOcrConnectionType as _,isKuaiaiWorkbuddyConnectionType as b,ERP_VENDOR_GROUP_ORDER as de,resolveErpVendorGroup as me,ERP_DEPLOYMENT_KIND_ORDER as ge,resolveErpDeploymentKind as ye}from"./connectors-CAsxhF0Z.js";import{g as fe,a as he}from"./applicationConnection-BVrFioAL.js";import{resolveConnectorMarketCardAccent as xe,AppConnectorBrandIcon as ue}from"./connectorBrandPresentation-BpWVhX5O.js";import{b as be}from"./clientRelease-DauGGp4Q.js";import"./index.es-DE4KmYsR.js";import"./sessionCurrentUser-CViAEm0Z.js";import"./globalStore--FYxG_vZ.js";import"./restoredUser-D4F2HO73.js";import"./tokenRefresh-TJ9rewTA.js";import"./building-2-D2SyL2Rw.js";import"./clearSessionQueries-Db_KN_8V.js";import"./index-8kyfTvv-.js";const{Text:w}=J,ke={collaboration:"#2BA245",erp:"#1677ff",plm:"#531dab",crm:"#eb2f96",oa:"#13c2c2",iot:"#fa8c16",wms:"#597ef7",storage:"#722ed1",ai:"#722ed1",other:"#1677ff"},Ce={MessageOutlined:t.jsx(le,{}),CloudOutlined:t.jsx(ce,{}),DatabaseOutlined:t.jsx(se,{}),AppstoreOutlined:t.jsx(M,{}),TeamOutlined:t.jsx(ie,{}),RobotOutlined:t.jsx(re,{}),CloudServerOutlined:t.jsx(ne,{}),HddOutlined:t.jsx(ae,{}),RocketOutlined:t.jsx(oe,{}),InteractionOutlined:t.jsx(te,{}),ApartmentOutlined:t.jsx(ee,{}),EnvironmentOutlined:t.jsx(Z,{}),CarOutlined:t.jsx(q,{})},D={collaboration:"categoryCollaboration",erp:"categoryErp",plm:"categoryPlm",crm:"categoryCrm",oa:"categoryOa",iot:"categoryIot",wms:"categoryWms",storage:"categoryStorage",ai:"categoryAi",other:"categoryOther"},we={kingdee:"erpVendorKingdee",yonyou:"erpVendorYonyou",digiwin:"erpVendorDigiwin",sap:"erpVendorSap",other:"erpVendorOther"},ve={cloud:"erpDeploymentCloud",traditional:"erpDeploymentTraditional"};function je(r){return{id:r.id,name:r.name,type:r.type,category:r.category,description:r.description,icon:r.icon&&Ce[r.icon]||t.jsx(M,{}),defaultConfig:r.default_config||{}}}function Oe(r){const l=new Map;for(const o of h)l.set(o.id,o);for(const o of r.map(je))l.has(o.id)||l.set(o.id,o);const f=[],p=new Set;for(const o of h){const n=l.get(o.id);n&&(f.push(n),p.add(o.id))}for(const[o,n]of l)p.has(o)||f.push(n);return f}const Ve=({open:r,onClose:l,onSelect:f,initialCategory:p="all"})=>{const{t:o}=be(),{token:n}=Y.useToken(),[m,v]=c.useState(p),[x,j]=c.useState(""),[O,k]=c.useState(h),[P,T]=c.useState(()=>new Set),B=c.useMemo(()=>[{key:"all",label:o("pages.system.applicationConnections.categoryAll")},{key:"collaboration",label:o("pages.system.applicationConnections.categoryCollaboration")},{key:"erp",label:o("pages.system.applicationConnections.categoryErp")},{key:"plm",label:o("pages.system.applicationConnections.categoryPlm")},{key:"crm",label:o("pages.system.applicationConnections.categoryCrm")},{key:"oa",label:o("pages.system.applicationConnections.categoryOa")},{key:"iot",label:o("pages.system.applicationConnections.categoryIot")},{key:"wms",label:o("pages.system.applicationConnections.categoryWms")},{key:"storage",label:o("pages.system.applicationConnections.categoryStorage")},{key:"ai",label:o("pages.system.applicationConnections.categoryAi")},{key:"other",label:o("pages.system.applicationConnections.categoryOther")}],[o]),[R,I]=c.useState(!1);c.useEffect(()=>{if(!r)return;const e=typeof p=="string"&&p.startsWith("erp_")?"erp":p;v(e),j(""),I(!0);let a=!1;const s=fe().then(i=>{a||(i?.items?.length?k(Oe(i.items)):k(h))}).catch(()=>{a||k(h)}),y=he().then(i=>{if(a)return;const g=new Set;for(const d of i)($(d.type)||_(d.type)||b(d.type))&&g.add(d.type);T(g)}).catch(()=>{a||T(new Set)});return Promise.all([s,y]).finally(()=>{a||I(!1)}),()=>{a=!0}},[r,p]);const u=c.useMemo(()=>{let e=O;if(m!=="all"&&(e=e.filter(a=>a.category===m)),x.trim()){const a=x.trim().toLowerCase();e=e.filter(s=>s.name.toLowerCase().includes(a)||s.type.toLowerCase().includes(a)||(s.description||"").toLowerCase().includes(a))}return e},[O,m,x]),E=c.useMemo(()=>{if(m!=="erp")return null;const e=[];for(const a of de){const s=u.filter(i=>(me(i)||"other")===a);if(!s.length)continue;const y=ge.map(i=>({kind:i,items:s.filter(g=>(ye(g)||"traditional")===i)})).filter(i=>i.items.length>0);y.length&&e.push({group:a,deployments:y})}return e},[m,u]),L=e=>{f(e),l()},V=e=>`type${e.charAt(0).toUpperCase()}${e.slice(1)}`,K=e=>`desc${e.charAt(0).toUpperCase()}${e.slice(1)}`,N=(e,a)=>{const s=($(e.type)||_(e.type)||b(e.type))&&P.has(e.type),y=D[e.category]?o(`pages.system.applicationConnections.${D[e.category]}`):e.category,i=!!e.category&&!a?.hideCategoryTag,g=o(`pages.system.applicationConnections.${V(e.id)}`,{defaultValue:e.name}),d=e.description?o(`pages.system.applicationConnections.${K(e.id)}`,{defaultValue:e.description}):"",z=xe(e.id)??ke[e.category]??n.colorPrimary;return t.jsx(Q,{xs:24,sm:12,md:8,children:t.jsx(X,{className:"app-connector-market-card",hoverable:!0,size:"small",onClick:()=>L(e),style:{height:"100%",position:"relative","--connector-card-accent":z},children:t.jsxs("div",{className:"app-connector-market-card-inner",children:[t.jsx(ue,{connectorId:e.id,fallbackIcon:e.icon}),t.jsxs("div",{className:"app-connector-market-card-main",children:[t.jsxs("div",{className:"app-connector-market-card-title-row",children:[t.jsx("div",{className:"app-connector-market-card-title",children:t.jsx(w,{strong:!0,ellipsis:{tooltip:g},children:g})}),(e.marketLabBadge||b(e.type)||i||s)&&t.jsxs("div",{className:"app-connector-market-card-tags",children:[e.marketLabBadge||b(e.type)?t.jsx(C,{color:"default",children:o("app.kuaiai.hub.labBadge")}):null,i?t.jsx(C,{color:e.category==="ai"?"purple":"blue",children:y}):null,s?t.jsx(C,{color:"success",children:o("pages.system.applicationConnections.marketConfigured")}):null]})]}),d?t.jsx("div",{className:"app-connector-market-card-desc",style:{color:n.colorTextSecondary},title:d,children:d}):null]})]})})},e.id)};return t.jsx(F,{title:o("pages.system.applicationConnections.marketTitle"),open:r,onCancel:l,footer:null,width:pe.CONNECTOR_MARKET_WIDTH,destroyOnHidden:!0,styles:{body:{paddingTop:n.paddingSM,overflow:"hidden",display:"flex",flexDirection:"column"}},children:t.jsxs("div",{className:"app-connector-market-shell",style:{"--connector-tag-idle-bg":n.colorFillTertiary,"--connector-tag-idle-color":n.colorText,"--connector-market-toolbar-bg":n.colorBgContainer,"--connector-market-toolbar-border":n.colorBorderSecondary},children:[t.jsx("style",{children:`
        .app-connector-market-shell {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-height: min(72vh, 720px);
          min-height: 280px;
        }
        .app-connector-market-toolbar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px 16px;
          width: 100%;
          flex-shrink: 0;
          padding-bottom: 12px;
          background: var(--connector-market-toolbar-bg);
          border-bottom: 1px solid var(--connector-market-toolbar-border);
        }
        .app-connector-market-scroll {
          flex: 1 1 auto;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding-top: 16px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .app-connector-market-scroll::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
        .app-connector-market-category-tags {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-start;
          align-items: center;
          gap: 8px;
          flex: 1 1 auto;
          min-width: 0;
        }
        .app-connector-market-category-tags .ant-tag {
          margin-inline-end: 0;
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding-inline: 12px;
          padding-block: 5px;
          font-size: 14px;
          line-height: 22px;
          border-radius: 6px;
        }
        .app-connector-market-category-tags .ant-tag-checkable:not(.ant-tag-checkable-checked) {
          background: var(--connector-tag-idle-bg);
          color: var(--connector-tag-idle-color);
        }
        .app-connector-market-search {
          width: 272px;
          max-width: 100%;
          flex: 0 0 auto;
          margin-inline-start: auto;
        }
      `}),t.jsxs("div",{className:"app-connector-market-toolbar",children:[t.jsx("div",{className:"app-connector-market-category-tags",children:B.map(e=>t.jsx(G.CheckableTag,{checked:m===e.key,onChange:a=>{a&&v(e.key)},children:e.label},e.key))}),t.jsx(W,{className:"app-connector-market-search",placeholder:o("pages.system.applicationConnections.searchPlaceholder"),prefix:t.jsx(U,{}),value:x,onChange:e=>j(e.target.value),allowClear:!0})]}),t.jsx("div",{className:"app-connector-market-scroll",children:t.jsx(H,{spinning:R,children:t.jsxs("div",{style:{"--connector-primary":n.colorPrimary,"--connector-border":n.colorBorderSecondary,"--connector-fill":n.colorFillQuaternary,"--connector-card-bg":n.colorBgContainer},children:[t.jsx("style",{children:`
            .app-connector-market-card {
              border-radius: 10px;
              border: 1px solid var(--connector-border);
              box-shadow: none;
              overflow: hidden;
              background: var(--connector-card-bg, #ffffff);
            }
            .app-connector-market-card::before {
              content: '';
              position: absolute;
              left: 0;
              right: 0;
              top: 0;
              height: 72px;
              pointer-events: none;
              z-index: 2;
              background: var(--connector-card-accent, var(--connector-primary));
              opacity: 0.065;
              -webkit-mask-image: linear-gradient(180deg, #000 0%, transparent 100%);
              mask-image: linear-gradient(180deg, #000 0%, transparent 100%);
            }
            .app-connector-market-card .ant-card-body {
              padding: 18px 16px 17px;
              position: relative;
              z-index: 1;
              background: transparent !important;
            }
            .app-connector-market-card.ant-card-hoverable:hover {
              box-shadow: none !important;
              border-color: var(--connector-primary) !important;
              background: var(--connector-fill);
            }
            .app-connector-market-card.ant-card-hoverable:hover::before {
              opacity: 0.09;
            }
            .app-connector-market-card-inner {
              display: flex;
              gap: 12px;
              align-items: flex-start;
              min-height: 58px;
            }
            .app-connector-market-card-main {
              flex: 1;
              min-width: 0;
            }
            .app-connector-market-card-title-row {
              display: flex;
              align-items: center;
              flex-wrap: wrap;
              gap: 4px 6px;
              margin-bottom: 6px;
              line-height: 1.35;
            }
            .app-connector-market-card-title {
              flex: 1 1 auto;
              min-width: 0;
            }
            .app-connector-market-card-tags {
              display: inline-flex;
              flex-wrap: wrap;
              align-items: center;
              gap: 4px;
              flex-shrink: 0;
            }
            .app-connector-market-card-desc {
              font-size: 12px;
              line-height: 1.55;
              min-height: 2.85em;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }
            .app-connector-brand-icon--fallback {
              background: var(--connector-fill);
              color: var(--connector-primary);
              border: 1px solid var(--connector-border);
            }
          `}),E?t.jsx(S,{orientation:"vertical",size:"large",style:{width:"100%"},children:E.map(e=>t.jsxs("div",{children:[t.jsx(w,{strong:!0,style:{display:"block",marginBottom:12,fontSize:15},children:o(`pages.system.applicationConnections.${we[e.group]}`)}),t.jsx(S,{orientation:"vertical",size:"medium",style:{width:"100%"},children:e.deployments.map(a=>t.jsxs("div",{children:[t.jsx(w,{type:"secondary",style:{display:"block",marginBottom:8,fontSize:13},children:o(`pages.system.applicationConnections.${ve[a.kind]}`)}),t.jsx(A,{gutter:[16,16],children:a.items.map(s=>N(s,{hideCategoryTag:!0}))})]},`${e.group}-${a.kind}`))})]},e.group))}):t.jsx(A,{gutter:[16,16],children:u.map(e=>N(e,{hideCategoryTag:m!=="all"}))}),u.length===0&&!R&&t.jsx("div",{style:{textAlign:"center",padding:40,color:"#999"},children:o("pages.system.applicationConnections.noMatch")})]})})})]})})};export{Ve as default};
