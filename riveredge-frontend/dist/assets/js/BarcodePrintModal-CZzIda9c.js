import{r as n,ad as l,j as r,M as z,G as w,T as j,bh as v,aL as k,a1 as T,ag as S,X as h,aQ as P}from"./vendor-DAiJhq0I.js";import{g as _}from"./printTemplate-Bwmt-fPk.js";import{M as L}from"./main-BDyVbCJq.js";import"./listPageStatCardsContext-BqrIjGET.js";import{u as O}from"./clearSessionQueries-DxAZP1Vs.js";import"./TwoColumnLayout-DHZetwYS.js";import"./index.es-BoMgfVi5.js";import"./sessionCurrentUser-DKzXZA97.js";import"./tokenRefresh-DKWnWtSR.js";import"./building-2-D8__RYuV.js";import"./index-B6B67PEs.js";const{Title:M}=j,D=({visible:d,onCancel:p,workOrderId:m,operationId:x,level:t="operation"})=>{const{t:a}=O(),[g,i]=n.useState(!1),[c,b]=n.useState([]),[o,u]=n.useState(null);n.useEffect(()=>{d&&f()},[d,t]);const f=async()=>{try{i(!0);const s=await _({type:t==="work_order"?"work_order":"operation"});b(s||[]),s&&s.length>0&&u(s[0].uuid)}catch(e){console.error("Failed to load print templates",e),l.error(a("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{i(!1)}},y=async()=>{if(!o){l.warning(a("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"));return}try{i(!0);const e=t==="work_order"?`/api/v1/apps/kuaizhizao/work-orders/${m}/print?template_uuid=${o}`:`/api/v1/apps/kuaizhizao/work-orders/${m}/operations/${x}/print?template_uuid=${o}`;window.open(e,"_blank"),l.success(a("app.kuaizhizao.workOrder.msgPrintRequestSent")),p()}catch(e){console.error("Print failed",e),l.error(a("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{i(!1)}};return r.jsxs(z,{title:r.jsxs("span",{style:{color:"#fff",fontSize:20},children:["条码打印 - ",t==="work_order"?"工单级":"工序级"]}),open:d,onCancel:p,footer:null,width:L.SMALL_WIDTH,centered:!0,rootClassName:"kiosk-modal-terminal-bg",styles:{mask:{backgroundColor:"rgba(0, 0, 0, 0.5)"},body:{padding:"24px",background:"#1a1a1a"}},children:[r.jsx("style",{children:`
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
      `}),g&&c.length===0?r.jsxs("div",{style:{textAlign:"center",padding:"40px 0"},children:[r.jsx(w,{size:"large"}),r.jsx("div",{style:{marginTop:16,color:"rgba(255,255,255,0.45)"},children:a("app.kuaizhizao.workOrder.msgLoadingTemplates")})]}):r.jsxs("div",{style:{minHeight:300},children:[r.jsx(M,{level:4,style:{color:"rgba(255,255,255,0.65)",marginBottom:16},children:a("app.kuaizhizao.workOrder.kioskSelectTemplate")}),c.length===0?r.jsxs("div",{style:{padding:"40px 0",textAlign:"center",background:"rgba(255,255,255,0.02)",borderRadius:8},children:[r.jsx(v,{style:{fontSize:48,color:"rgba(255,255,255,0.1)",marginBottom:16}}),r.jsx("div",{style:{color:"rgba(255,255,255,0.45)"},children:a("app.kuaizhizao.workOrder.msgNoPrintTemplates")})]}):r.jsx(k.Group,{onChange:e=>u(e.target.value),value:o,style:{width:"100%",maxHeight:400,overflowY:"auto"},children:c.map(e=>r.jsx(k,{value:e.uuid,children:r.jsxs(T,{size:12,children:[r.jsx(S,{}),e.name]})},e.uuid))}),r.jsxs("div",{style:{marginTop:40,display:"flex",gap:16},children:[r.jsx(h,{size:"large",onClick:p,style:{flex:1,height:60,fontSize:20,background:"transparent",color:"rgba(255, 255, 255, 0.65)",border:"1px solid rgba(255, 255, 255, 0.2)"},children:"取消"}),r.jsx(h,{type:"primary",size:"large",loading:g,onClick:y,icon:r.jsx(P,{}),disabled:!o,style:{flex:2,height:60,fontSize:20,fontWeight:600},children:"立即打印"})]})]})]})};export{D as default};
