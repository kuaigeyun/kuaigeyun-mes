import{r as l,ae as t,j as r,M as j,D as T,T as S,aS as v,at as h,Z as P,aA as O,V as x,aT as L}from"./vendor-BHGbh8FE.js";import{ar as _,a5 as R}from"./main-C-1u3C5k.js";import{b as $}from"./clientRelease-ByYGAEmB.js";import"./index.es-DwPz6UBk.js";import"./sessionCurrentUser-Dl6PPhx4.js";import"./globalStore-Df4oDubl.js";import"./restoredUser-CvqFNJxX.js";import"./tokenRefresh-Ckw-jMkT.js";import"./building-2-DfzK-KLq.js";import"./index-u2j0MMOh.js";import"./vendor-libredwg-y8aVcRqm.js";import"./vendor-three-BPXNOO5B.js";import"./clearSessionQueries-Db_KN_8V.js";const{Title:M}=S,Y=({visible:d,onCancel:p,workOrderId:m,operationId:i,level:o="operation"})=>{const{t:a}=$(),[b,g]=l.useState(!1),[f,u]=l.useState(!1),[c,z]=l.useState([]),[n,k]=l.useState(null);l.useEffect(()=>{d&&w()},[d,o]);const w=async()=>{try{g(!0);const s=await _({type:o==="work_order"?"work_order":"operation"});z(s||[]),s&&s.length>0&&k(s[0].uuid)}catch(e){console.error("Failed to load print templates",e),t.error(a("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},y=async()=>{if(!n){t.warning(a("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"));return}if(o==="operation"&&(i==null||i==="")){t.warning(a("app.kuaizhizao.workOrder.msgSelectOperationFirst",{defaultValue:"请先选择工序"}));return}try{u(!0);const e=o==="work_order"?`/api/v1/apps/kuaizhizao/work-orders/${m}/print?template_uuid=${n}`:`/api/v1/apps/kuaizhizao/work-orders/${m}/operations/${i}/print?template_uuid=${n}`;if(!window.open(e,"_blank")){t.error(a("app.kuaizhizao.workOrder.msgPrintPopupBlocked"));return}t.success(a("app.kuaizhizao.workOrder.msgPrintRequestSent")),p()}catch(e){console.error("Print failed",e),t.error(a("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{u(!1)}};return r.jsxs(j,{title:r.jsxs("span",{style:{color:"#fff",fontSize:20},children:["条码打印 - ",o==="work_order"?"工单级":"工序级"]}),open:d,onCancel:p,footer:null,width:R.SMALL_WIDTH,centered:!0,rootClassName:"kiosk-modal-terminal-bg",styles:{mask:{backgroundColor:"rgba(0, 0, 0, 0.5)"},body:{padding:"24px",background:"#1a1a1a"}},children:[r.jsx("style",{children:`
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
      `}),b&&c.length===0?r.jsxs("div",{style:{textAlign:"center",padding:"40px 0"},children:[r.jsx(T,{size:"large"}),r.jsx("div",{style:{marginTop:16,color:"rgba(255,255,255,0.45)"},children:a("app.kuaizhizao.workOrder.msgLoadingTemplates")})]}):r.jsxs("div",{style:{minHeight:300},children:[r.jsx(M,{level:4,style:{color:"rgba(255,255,255,0.65)",marginBottom:16},children:a("app.kuaizhizao.workOrder.kioskSelectTemplate")}),c.length===0?r.jsxs("div",{style:{padding:"40px 0",textAlign:"center",background:"rgba(255,255,255,0.02)",borderRadius:8},children:[r.jsx(v,{style:{fontSize:48,color:"rgba(255,255,255,0.1)",marginBottom:16}}),r.jsx("div",{style:{color:"rgba(255,255,255,0.45)"},children:a("app.kuaizhizao.workOrder.msgNoPrintTemplates")})]}):r.jsx(h.Group,{onChange:e=>k(e.target.value),value:n,style:{width:"100%",maxHeight:400,overflowY:"auto"},children:c.map(e=>r.jsx(h,{value:e.uuid,children:r.jsxs(P,{size:12,children:[r.jsx(O,{}),e.name]})},e.uuid))}),r.jsxs("div",{style:{marginTop:40,display:"flex",gap:16},children:[r.jsx(x,{size:"large",onClick:p,style:{flex:1,height:60,fontSize:20,background:"transparent",color:"rgba(255, 255, 255, 0.65)",border:"1px solid rgba(255, 255, 255, 0.2)"},children:"取消"}),r.jsx(x,{type:"primary",size:"large",loading:f,onClick:y,icon:r.jsx(L,{}),disabled:!n||o==="operation"&&(i==null||i===""),style:{flex:2,height:60,fontSize:20,fontWeight:600},children:"立即打印"})]})]})]})};export{Y as default};
