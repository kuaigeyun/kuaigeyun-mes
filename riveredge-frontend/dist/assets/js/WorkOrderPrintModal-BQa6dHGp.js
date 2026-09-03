import{r as n,j as e,M as E,D as v,a8 as z,V as x,b3 as $,a2 as C,ag as s}from"./vendor-ChObXcz2.js";import{g as L,b as W}from"./printTemplateSchemas-D0NPax91.js";import{b as M,aX as w,D as O}from"./clientRelease-B3oOsym6.js";import{_ as D}from"./main-BqjhZ57B.js";import"./LinkedDocumentDetailContext-CJc5bwWz.js";import"./detailDrawerTimeFields-B2_wymy4.js";import"./index.es-Bhfv7CkF.js";import"./sessionCurrentUser-BWpybcrw.js";import"./globalStore-0wYt6pVJ.js";import"./restoredUser-bY9n8i_b.js";import"./tokenRefresh-Bed0j2wV.js";import"./building-2-CZA_rwKU.js";import"./clearSessionQueries-Db_KN_8V.js";import"./index-BvSiBDQv.js";import"./statusBadges-BWXN4Rcq.js";/* empty css                            */import"./UniLifecycleStepper-Db4b-8vI.js";import"./globalLifecycleI18n-DwIKnxFP.js";import"./send-CiOeyhGQ.js";import"./package-check-F4o--i0Y.js";import"./japanese-yen-DZDWJd0b.js";import"./file-DfNcwOy3.js";import"./documentLifecycleStatusTag-CphO8An4.js";import"./documentStatusColors-sOHqPHBM.js";import"./operationColumn-DSrhUnYG.js";import"./listLifecycleStage-BIJOhOUg.js";import"./permissionContract-wTt5dYlE.js";import"./permissionResource-C4537ZA2.js";import"./approvalInstance-Pa5aB67K.js";import"./index-BgZXYPMy.js";import"./timer-haTt7V0m.js";import"./user-DmkTNZ-w.js";import"./userDisplay-C0Z0yA8S.js";import"./QuantityWithUnitDisplay-DQ05NWpD.js";import"./materialUnitDisplay-Fhcz12kp.js";import"./material-unit-Brf2F50e.js";import"./formDate-BR-sQo01.js";import"./index-BR10_Ppv.js";import"./kuaireportSharedFilePreview-BwrbAhie.js";import"./customFieldJsonUtils-DpNbUP6i.js";import"./index-roD9D8Fo.js";import"./index-CU8QPlP8.js";import"./index-BuuWMady.js";import"./index-D8WVuwkG.js";import"./createForOfIteratorHelper-BtZtYzNd.js";import"./index-DhuZn3ck.js";import"./vendor-libredwg-C7W61Q0z.js";import"./vendor-three-BPXNOO5B.js";import"./index-Dcu4XcRl.js";import"./index-DZh8i5Kx.js";import"./index-B3WynI_Z.js";import"./isObject-QOnpBG9w.js";import"./_baseIsEqual-l73f-xqi.js";import"./debounce-BJo-epLv.js";import"./throttle-wWvYLUhP.js";import"./routes-BB6gW3_s.js";import"./workOrderLifecycle-CreYNZ-D.js";import"./useResourcePermissions-Dt2eSLL8.js";import"./documentStatus-0-2lKcaY.js";import"./purchase-DMmcdB5N.js";import"./fieldPermissionResources-MC4nu-zm.js";import"./demandType-B433e_FJ.js";import"./quotation-CmLpcOf5.js";import"./warehouseMarkerTags-BCrsCTgk.js";import"./warehouse-execution-DSbni4Zc.js";import"./sales-order-e6HWYz8-.js";import"./dataDictionary-Bnpjl_0n.js";import"./material-CGJduThF.js";import"./purchase-requisition-Baf0rTlN.js";import"./demand-computation-B3IwII2P.js";import"./availableInventoryCell-BYJYJKaL.js";import"./MrpMaterialPlanPanel-YqQpBaAN.js";import"./workOrderReporting-DhdlRPTS.js";import"./documentAttachments-DQaobS1n.js";import"./WorkOrderMaterialMovementsPanel-Clo7U3Iq.js";import"./work-order-CtSCwU6P.js";import"./logisticsListPresentation-APxnaIY1.js";import"./reporting-adhug2MB.js";import"./afterSalesListPresentation-CY7wvpUf.js";import"./modalEventIsolation-Cy-kpAMJ.js";import"./after-sales-service-CePtrFo7.js";import"./index-CGYsPuVW.js";import"./index-BT-PEjsd.js";import"./index-BedvOOHD.js";import"./LineAttachmentsUpload-DfUN3bEP.js";import"./AuditPhaseBadge-CRSOWL0_.js";import"./formListItems-DcSxpq1Y.js";const kr=({visible:m,onCancel:f,workOrderData:T,workOrderId:j})=>{const{t}=M(),[b,P]=n.useState([]),[k,g]=n.useState(!1),[y,d]=n.useState(!1),[a,u]=n.useState(),[h,l]=n.useState(""),c=n.useRef({}),p=j??T?.id;c.current={selectedTemplateId:a,effectiveWorkOrderId:p},n.useEffect(()=>{m&&(_(),u(void 0),l(""))},[m]),n.useEffect(()=>{m&&a&&p?I():l("")},[m,a,p]);const _=async()=>{g(!0);try{const r=await L({is_active:!0,document_type:"work_order"});P(r);const i=r.find(o=>o.is_default)??r.find(o=>o.code===W.work_order)??r[0];i&&u(i.uuid)}catch(r){w(r,t("app.kuaizhizao.workOrder.msgLoadPrintTemplateFailed"))}finally{g(!1)}},I=async()=>{if(!p||!a)return;const r=`${a}-${p}`;d(!0);try{const i=await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}),o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;l(i?.content??"")}catch(i){const o=c.current;if(r!==`${o.selectedTemplateId}-${o.effectiveWorkOrderId}`)return;w(i,t("app.kuaizhizao.workOrder.msgLoadPreviewFailed")),l("")}finally{const i=c.current;r===`${i.selectedTemplateId}-${i.effectiveWorkOrderId}`&&d(!1)}},S=async()=>{if(!p){s.warning(t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPrint"));return}if(!a){s.warning(t("app.kuaizhizao.workOrder.msgSelectPrintTemplate"));return}d(!0);try{const i=(await O(`/apps/kuaizhizao/work-orders/${p}/print`,{method:"GET",params:{template_uuid:a,output_format:"html",response_format:"json"}}))?.content??"";if(!i){s.error(t("app.kuaizhizao.workOrder.msgPrintContentEmpty"));return}const o=window.open("","_blank");o?(o.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t("common.print")}</title></head><body>${i}</body></html>`),o.document.close(),o.focus(),o.print(),o.close(),s.success(t("app.kuaizhizao.workOrder.msgPrintSent"))):s.error(t("app.kuaizhizao.workOrder.msgPrintPopupBlocked"))}catch(r){w(r,t("app.kuaizhizao.workOrder.msgPrintFailed"))}finally{d(!1)}};return e.jsxs(E,{title:e.jsxs("div",{className:"no-print",style:{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",gap:16},children:[e.jsx("span",{style:{fontWeight:600,fontSize:16},children:t("app.kuaizhizao.workOrder.modalPrintTitle")}),e.jsx(C,{style:{width:260,flexShrink:0},placeholder:t("app.kuaizhizao.workOrder.msgSelectPrintTemplatePlaceholder"),value:a,onChange:u,loading:k,options:b.map(r=>({label:r.name,value:r.uuid}))})]}),open:m,onCancel:f,width:D.LARGE_WIDTH,wrapClassName:"work-order-print-modal-wrap",styles:{body:{padding:0,overflow:"hidden",height:"70vh",minHeight:500}},footer:[e.jsx(x,{onClick:f,children:t("common.cancel")},"cancel"),e.jsx(x,{type:"primary",icon:e.jsx($,{}),onClick:S,loading:y,disabled:!a||!p,children:t("common.print")},"print")],className:"work-order-print-modal",children:[e.jsx(v,{spinning:k,children:e.jsx("div",{className:"work-order-print-preview",style:{height:"100%",overflow:"auto"},children:p?y&&!h?e.jsx("div",{style:{display:"flex",justifyContent:"center",alignItems:"center",height:"100%",minHeight:400},children:e.jsx(v,{description:t("app.kuaizhizao.workOrder.msgLoadingPreview"),children:e.jsx("div",{style:{minHeight:24}})})}):h?e.jsx("div",{dangerouslySetInnerHTML:{__html:h},style:{height:"100%",overflow:"auto",padding:16}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgSelectValidPrintTemplate"),style:{paddingTop:100}}):e.jsx(z,{description:t("app.kuaizhizao.workOrder.msgWorkOrderIdMissingPreview"),style:{paddingTop:100}})})}),e.jsx("style",{children:`
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
      `})]})};export{kr as default};
