import{d}from"./fileDownload-BZa2wwvy.js";function m(t){return t==null?"":String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}function s(t){const e=t.match(/@page\s*\{([^}]+)\}/i)?.[1]??"",n=e.match(/\bmargin\s*:\s*([^;]+)/i)?.[1]?.trim()||"10mm 10mm 10mm 10mm",i=(e.match(/\bsize\s*:\s*([^;]+)/i)?.[1]?.trim()||"210mm 297mm").split(/\s+/).filter(r=>/\d/.test(r));return{width:i[0]||"210mm",minHeight:i[1]||"297mm",margin:n}}function l(t,e){const{width:n,minHeight:o,margin:i}=s(t),r=e?.borderRadius??8,a=`<style id="uni-print-preview-screen">
@media screen{
  html{margin:0;padding:16px;background:#e2e8f0;box-sizing:border-box;}
  body{
    width:${n}!important;
    min-height:${o}!important;
    max-width:100%;
    margin:0 auto!important;
    padding:${i}!important;
    box-sizing:border-box!important;
    background:#fff!important;
    border-radius:${r}px!important;
    box-shadow:0 1px 4px rgba(15,23,42,.08);
  }
}
</style>`;return/<\/body>/i.test(t)?t.replace(/<\/body>/i,`${a}</body>`):`${t}${a}`}function b(t,e="打印"){const n=window.open("","_blank");if(!n)return null;const o=t.trimStart().toLowerCase();return o.startsWith("<!doctype")||o.startsWith("<html")?n.document.write(t):n.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${m(e)}</title></head><body>${t}</body></html>`),n.document.close(),n.onload=()=>{try{n.focus(),n.print()}catch{}},n}function c(t){const e=t.content;if(!e)return null;if(t.content_encoding==="base64"){const n=atob(e),o=new Uint8Array(n.length);for(let i=0;i<n.length;i+=1)o[i]=n.charCodeAt(i);return new Blob([o],{type:t.mime_type||"application/pdf"})}return new Blob([e],{type:t.mime_type||"application/pdf"})}function u(t,e){const n=c(t);if(!n)throw new Error("PDF content is empty");d(n,e.endsWith(".pdf")?e:`${e}.pdf`)}export{u as d,b as o,l as w};
