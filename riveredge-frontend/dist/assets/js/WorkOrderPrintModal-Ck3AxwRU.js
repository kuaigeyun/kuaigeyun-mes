import{r as p,j as o,M as E,D as v,aa as z,V as x,aR as $,a4 as C,ai as s}from"./vendor-CgY5G-T_.js";import{g as L,b as M}from"./printTemplateSchemas-BB3Yr-RU.js";import{b as W,aF as w,C as O}from"./clientRelease-C_Y2oW1v.js";import{M as H}from"./main-BtwhP0Ou.js";import"./LinkedDocumentDetailContext-DHf_6TUM.js";import"./detailDrawerTimeFields-DVvichbB.js";import"./index.es-SmHApiWZ.js";import"./sessionCurrentUser-DvcPsXaT.js";import"./globalStore-DhEGI7qb.js";import"./restoredUser-DVJwY8Qs.js";import"./tokenRefresh-B228CYaV.js";import"./building-2-B6pze4Aa.js";import"./clearSessionQueries-ClXPQXoH.js";import"./index-BkySOVDp.js";import"./statusBadges-BcLuAqfm.js";/* empty css                            */import"./UniLifecycleStepper-1CevKswn.js";import"./globalLifecycleI18n-BvA_ppAf.js";import"./send-CgwnnXHV.js";import"./package-check-2EtAF6hX.js";import"./japanese-yen-BPyrRUv3.js";import"./file-C1cC6gHm.js";import"./documentLifecycleStatusTag-BYckJ5yF.js";import"./documentStatusColors-DG8brxl9.js";import"./actionCatalog-BcmCGSBm.js";import"./normalize-BzZRxjV6.js";import"./permissionContract-DOa6QecD.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-DqZNzbxU.js";import"./index-BoyM8Px1.js";import"./timer-haTt7V0m.js";import"./user-mrK6EIPl.js";import"./userDisplay-54ZDjeKO.js";import"./demandType-D5u9zARy.js";import"./index-B0II1qlI.js";import"./kuaireportSharedFilePreview-CoNFXNxJ.js";import"./index-C7R3G4vS.js";import"./index-sYIKGDNV.js";import"./index-CvCmYW7D.js";import"./index-CF5Ubxyy.js";import"./createForOfIteratorHelper-BwkDZhxK.js";import"./index-hYZ51eGT.js";import"./vendor-libredwg-GUjXGrcw.js";import"./vendor-three-BPXNOO5B.js";import"./index-BGCmnWur.js";import"./index-bQL5DT4j.js";import"./index-M3IkZR45.js";import"./debounce-CBIYhAA8.js";import"./throttle-BXAC1lvh.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-DKuHCXsh.js";import"./listLifecycleStage-BIJOhOUg.js";import"./useResourcePermissions-CW4a2asM.js";import"./documentStatus--fSJ1OFf.js";import"./QualityInspectionDetailAttachments-DsSpvXIf.js";import"./documentAttachments-BhgE63cT.js";import"./purchase-DsdnBtNm.js";import"./fieldPermissionResources-B-AAuPLt.js";import"./quotation-CSzI04L_.js";import"./warehouseMarkerTags-UyMaczAu.js";import"./warehouse-execution-B0Gpqoq7.js";import"./material-D22zTFXe.js";import"./purchase-requisition-_mpTha67.js";import"./demand-computation-BzQAH893.js";import"./availableInventoryCell-Dz8tExmj.js";import"./MrpMaterialPlanPanel-LPsOWUDF.js";import"./workOrderReporting-uA4QAVbY.js";import"./WorkOrderMaterialMovementsPanel-DMvUmYck.js";import"./work-order-BgtmZKF1.js";import"./logisticsListPresentation-DihJoapE.js";import"./reporting-CevtqmN7.js";import"./AuditPhaseBadge-z0e6mf62.js";const er=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=W(),[P,b]=p.useState([]),[k,g]=p.useState(!1),[y,d]=p.useState(!1),[a,u]=p.useState(),[h,l]=p.useState(""),c=p.useRef({}),n=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:n},p.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),p.useEffect(()=>{m&&a&&n?I():l("")},[m,a,n]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});b(r);const i=r.find(e=>e.is_default)??r.find(e=>e.code===M.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!n||!a)return;const r=`${a}-${n}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const e=c.current;if(r!==`${e.selectedTemplateId}-${e.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!n){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${n}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const e=window.open("","_blank");e?(e.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),e.document.close(),e.focus(),e.print(),e.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return o.jsxs(E,{title:o.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[o.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),o.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:P.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:H.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[o.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),o.jsx(x,{type:"primary",icon:o.jsx($,{}),onClick:S,loading:y,disabled:!a||!n,children:t("common.print")},"print")],className:"work-order-print-modal",children:[o.jsx(v,{spinning:k,children:o.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:n?y&&!h?o.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:o.jsx(v,{tip:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:o.jsx("div",{style:{minHeight:24}})})}):h?o.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):o.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),o.jsx("style",{children:`
        .work-order-print-modal-wrap .ant-modal {
          max-width: calc(100vw - 32px) !important;
        }
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-nested-loading,
        .work-order-print-modal-wrap .ant-modal-body .ant-spin-container,
        .work-order-print-modal-wrap .work-order-print-preview {
          height: 100% !important;
        }
        .work-order-print-modal-wrap .work-order-print-iframe {
          width: 100% !important;
          height: 100% !important;
          min-height: 500px !important;
          border: none !important;
          display: block !important;
          background: #fff !important;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .ant-modal-wrap,
          .ant-modal-wrap *,
          .ant-modal-content,
          .ant-modal-content *,
          .work-order-print-preview,
          .work-order-print-preview * {
            visibility: visible !important;
          }
          .ant-modal-wrap {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            height: auto;
            overflow: visible;
          }
          .ant-modal-content {
            position: absolute !important;
            left: 0;
            top: 0;
            width: 100%;
            border: none;
            box-shadow: none;
            background: white;
          }
          .work-order-print-preview {
            width: 100% !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print, .ant-modal-footer, .ant-modal-header, .ant-modal-close {
            display: none !important;
          }
        }
      `})]})};export{er as default};
