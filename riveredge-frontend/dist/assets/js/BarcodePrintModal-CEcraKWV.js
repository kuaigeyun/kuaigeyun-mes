import{r as n,ad as p,j as r,M as z,G as w,T as j,bh as v,aL as k,a1 as T,ag as S,X as h,aQ as P}from"./vendor-dNOsShwb.js";import{g as _}from"./printTemplate-C-zcSnBJ.js";import{M as L}from"./main-BFSUsNEg.js";import"./listPageStatCardsContext-QT397YJs.js";import{u as O}from"./clearSessionQueries-BZmFX7j8.js";import"./PremiumTerminalTemplate-Csd0tTQx.js";import"./index.es-B9abiHwy.js";import"./sessionCurrentUser-DoJy3dAN.js";import"./tokenRefresh-BbXnGrlo.js";import"./building-2-DDdrxoyB.js";import"./index-DSl_4b7U.js";import"./useRequest-CCrRV3kT.js";import"./index-DxnoYc00.js";import"./debounce-Bq6RgqOU.js";import"./throttle-BGcZD0B5.js";import"./lodash-BYfiGPed.js";import"./createForOfIteratorHelper-Du84i_Wo.js";import"./timer-DWAvo6M8.js";import"./vendor-xlsx-OYweDRhJ.js";import"./each-CtesJ7l3.js";import"./quotation-Dc6EVEvR.js";import"./sales-order-DugV61oT.js";import"./work-order-CaiKdx8l.js";import"./warehouse-execution-BMx2Rht6.js";import"./purchase-CN1N_jqs.js";import"./purchase-requisition-D-cRKQ9I.js";import"./fieldPermissionResources-D7_Ka_zi.js";import"./materialUnitDisplay-BOi5rAQw.js";import"./documentStatus-CKzFmNhD.js";import"./statusBadges-Bu4h6JJl.js";import"./backendLifecycle-DVdlPVyL.js";import"./lifecycleI18n-BE5ECl-N.js";import"./globalLifecycleI18n-YKQvqC18.js";import"./listLifecycleStage-CZKWm3oh.js";const{Title:M}=j,cr=({visible:l,onCancel:d,workOrderId:c,operationId:x,level:a="operation"})=>{const{t}=O(),[g,i]=n.useState(!1),[m,b]=n.useState([]),[e,u]=n.useState(null);n.useEffect(()=>{l&&f()},[l,a]);const f=async()=>{try{i(!0);const s=await _({type:a==="work_order"?"work_order":"operation"});b(s||[]),s&&s.length>0&&u(s[0].uuid)}catch(o){console.error("Failed to load print templates",o),p.error(t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{i(!1)}},y=async()=>{if(!e){p.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"));return}try{i(!0);const o=a==="work_order"?`/api/v1/apps/kuaizhizao/work-orders/${c}/print?template_uuid=${e}`:`/api/v1/apps/kuaizhizao/work-orders/${c}/operations/${x}/print?template_uuid=${e}`;window.open(o,"_blank"),p.success(t("app.kuaizhizao.workOrder.msgPrintRequestSent")),d()}catch(o){console.error("Print failed",o),p.error(t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{i(!1)}};return r.jsxs(z,{title:r.jsxs("span",{style:{color:"#fff",fontSize:20},children:["条码打印 - ",a==="work_order"?"工单级":"工序级"]}),open:l,onCancel:d,footer:null,width:L.SMALL_WIDTH,centered:!0,rootClassName:"kiosk-modal-terminal-bg",styles:{mask:{backgroundColor:"rgba(0, 0, 0, 0.5)"},body:{padding:"24px",background:"#1a1a1a"}},children:[r.jsx("style",{children:`
        .kiosk-modal-terminal-bg .ant-modal-content {
          background: #141414 !important;
          border: 1px solid var(--river-border-color);
          border-radius: 12px;
        }
        .kiosk-modal-terminal-bg .ant-modal-header {
          background: transparent !important;
          border-bottom: 1px solid var(--river-divider-color);
          padding-bottom: 16px;
        }
        .kiosk-modal-terminal-bg .ant-radio-wrapper {
          color: rgba(255, 255, 255, 0.85) !important;
          font-size: 18px !important;
          width: 100%;
          padding: 16px;
          margin: 0;
          border-bottom: 1px solid var(--river-divider-color);
          transition: background 0.2s;
        }
        .kiosk-modal-terminal-bg .ant-radio-wrapper:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .kiosk-modal-terminal-bg .ant-radio-wrapper-checked {
          background: rgba(22, 119, 255, 0.1);
        }
      `}),g&&m.length===0?r.jsxs("div",{style:{textAlign:"center",padding:"40px 0"},children:[r.jsx(w,{size:"large"}),r.jsx("div",{style:{marginTop:16,color:"rgba(255,255,255,0.45)"},children:t("app.kuaizhizao.workOrder.msgLoadingTemplates")})]}):r.jsxs("div",{style:{minHeight:300},children:[r.jsx(M,{level:4,style:{color:"rgba(255,255,255,0.65)",marginBottom:16},children:t("app.kuaizhizao.workOrder.kioskSelectTemplate")}),m.length===0?r.jsxs("div",{style:{padding:"40px 0",textAlign:"center",background:"rgba(255,255,255,0.02)",borderRadius:8},children:[r.jsx(v,{style:{fontSize:48,color:"rgba(255,255,255,0.1)",marginBottom:16}}),r.jsx("div",{style:{color:"rgba(255,255,255,0.45)"},children:t("app.kuaizhizao.workOrder.msgNoPrintTemplates")})]}):r.jsx(k.Group,{onChange:o=>u(o.target.value),value:e,style:{width:"100%",maxHeight:400,overflowY:"auto"},children:m.map(o=>r.jsx(k,{value:o.uuid,children:r.jsxs(T,{size:12,children:[r.jsx(S,{}),o.name]})},o.uuid))}),r.jsxs("div",{style:{marginTop:40,display:"flex",gap:16},children:[r.jsx(h,{size:"large",onClick:d,style:{flex:1,height:60,fontSize:20,background:"transparent",color:"rgba(255, 255, 255, 0.65)",border:"1px solid rgba(255, 255, 255, 0.2)"},children:"取消"}),r.jsx(h,{type:"primary",size:"large",loading:g,onClick:y,icon:r.jsx(P,{}),disabled:!e,style:{flex:2,height:60,fontSize:20,fontWeight:600},children:"立即打印"})]})]})]})};export{cr as default};
