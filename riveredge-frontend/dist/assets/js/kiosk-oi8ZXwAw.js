import{F as K,r as o,j as t,G as M,ai as N,Q as w,a0 as _,ad as R,U as O,bh as v,av as G,au as V,a_ as W,ch as Y}from"./vendor-BpC5dbqE.js";import{T as q}from"./PremiumTerminalTemplate-BqBoxNrD.js";import{ac as Q}from"./main-bCpedxva.js";import{H as L}from"./clearSessionQueries-D9c6YA9j.js";import"./design-B_8Sx7jg.js";import"./touch-CzJ4Jti_.js";import"./index.es-SKZRCHJ3.js";import"./sessionCurrentUser-D6KI1tOS.js";import"./tokenRefresh-JeJ5ptxX.js";import"./building-2-Co5vsZIQ.js";import"./index-D3TI4B4O.js";const{Search:X}=O,ie=()=>{const{message:l}=K.useApp(),j=Q(),[I,k]=o.useState(!1),[i,m]=o.useState(""),[f,x]=o.useState(""),[b,E]=o.useState(""),[n,C]=o.useState([]),[c,u]=o.useState(-1),y=o.useRef(null),S=o.useRef(null);o.useEffect(()=>{const e=new URLSearchParams(window.location.search),s=e.get("code"),r=e.get("programCode"),d=e.get("programUrl"),h=e.get("name")||e.get("programName");s?(m(s),x(h||"加工程序")):r?(m(r),x(h||"加工程序")):d?U(d):l.warning("请提供程序代码或程序URL")},[]);const U=async e=>{k(!0);try{const s=await fetch(e);if(!s.ok)throw new Error("加载程序失败");const r=await s.text();m(r),x("加工程序")}catch(s){l.error(s.message||"加载程序失败")}finally{k(!1)}},T=o.useCallback(e=>{if(!e||!i){C([]),u(-1);return}const s=i.split(`
`),r=[],d=e.toLowerCase();s.forEach((h,g)=>{h.toLowerCase().includes(d)&&r.push(g)}),C(r),u(r.length>0?0:-1),r.length>0?(p(r[0]),l.success(`找到 ${r.length} 个匹配项`)):l.warning("未找到匹配项")},[i,l]),p=o.useCallback(e=>{if(y.current){const s=y.current.querySelector(`[data-line="${e}"]`);s&&(s.scrollIntoView({behavior:"smooth",block:"center"}),s.classList.add("highlighted-line"),setTimeout(()=>{s.classList.remove("highlighted-line")},2e3))}},[]),F=o.useCallback(()=>{if(n.length===0)return;const e=(c+1)%n.length;u(e),p(n[e])},[n,c,p]),z=o.useCallback(()=>{if(n.length===0)return;const e=(c-1+n.length)%n.length;u(e),p(n[e])},[n,c,p]),B=o.useCallback((e,s="")=>{if(!e)return"";const r=e.split(`
`),d=s.toLowerCase();return r.map((h,g)=>{let a=h;if(s&&d){const H=new RegExp(`(${s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")})`,"gi");a=a.replace(H,"<mark>$1</mark>")}a=a.replace(/\b(G\d{1,2})\b/gi,'<span class="g-code">$1</span>'),a=a.replace(/\b(M\d{1,2})\b/gi,'<span class="m-code">$1</span>'),a=a.replace(/\b([XYZUVW])(-?\d+\.?\d*)\b/gi,'<span class="coordinate">$1$2</span>'),a=a.replace(/(;.*$|\(.*?\))/g,'<span class="comment">$1</span>'),a=a.replace(/\b(\d+\.?\d*)\b/g,'<span class="number">$1</span>');const D=s&&h.toLowerCase().includes(d),$=n.length>0&&c>=0&&n[c]===g;return t.jsxs("div",{"data-line":g,style:{display:"flex",minHeight:"40px",lineHeight:"40px",fontSize:"24px",fontFamily:L,backgroundColor:$?"#fff3cd":D?"#f0f0f0":"transparent",padding:"4px 8px",borderLeft:$?"4px solid #ffc107":"4px solid transparent"},children:[t.jsx("span",{style:{display:"inline-block",minWidth:"60px",textAlign:"right",color:"#999",marginRight:"16px",userSelect:"none"},children:g+1}),t.jsx("span",{style:{flex:1,whiteSpace:"pre-wrap",wordBreak:"break-all"},dangerouslySetInnerHTML:{__html:a||" "}})]},g)})},[b,n,c]),P=o.useCallback(()=>{if(!i){l.warning("没有程序可下载");return}try{const e=new Blob([i],{type:"text/plain"}),s=URL.createObjectURL(e),r=document.createElement("a");r.href=s,r.download=`${f||"program"}-${Date.now()}.txt`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(s),l.success("程序下载成功")}catch(e){l.error(`下载程序失败: ${e.message||"未知错误"}`)}},[i,f,l]),A=o.useCallback(async()=>{try{await j.enterFullscreen(),l.success("已进入全屏模式")}catch(e){l.error(`进入全屏失败: ${e.message||"未知错误"}`)}},[j,l]);return t.jsxs(q,{title:f||"加工程序查看",fullscreen:!0,footerButtons:[{title:"上一个",type:"default",icon:t.jsx(G,{}),onClick:z,disabled:n.length===0||c<0,block:!1},{title:`搜索 (${n.length>0?`${c+1}/${n.length}`:"0"})`,type:"default",icon:t.jsx(v,{}),onClick:()=>S.current?.focus(),block:!1},{title:"下一个",type:"default",icon:t.jsx(V,{}),onClick:F,disabled:n.length===0||c<0,block:!1},{title:"下载",type:"default",icon:t.jsx(W,{}),onClick:P,block:!1},{title:"全屏",type:"primary",icon:t.jsx(Y,{}),onClick:A,block:!1}],children:[t.jsx(M,{spinning:I,children:i?t.jsxs("div",{style:{width:"100%",height:"100%",display:"flex",flexDirection:"column"},children:[t.jsx(w,{size:"small",style:{marginBottom:24,backgroundColor:"#f5f5f5"},children:t.jsxs(_,{orientation:"vertical",size:"small",style:{width:"100%"},children:[t.jsxs("div",{children:[t.jsx("strong",{children:"程序名称："}),t.jsx("span",{children:f||"加工程序"})]}),t.jsxs("div",{children:[t.jsx("strong",{children:"总行数："}),t.jsx(R,{color:"blue",children:i.split(`
`).length})]}),n.length>0&&t.jsxs("div",{children:[t.jsx("strong",{children:"搜索结果："}),t.jsxs(R,{color:"green",children:[n.length," 个匹配项"]})]})]})}),t.jsx(w,{size:"small",style:{marginBottom:24},children:t.jsx(X,{ref:S,placeholder:"搜索程序内容（支持G代码、M代码、坐标等）",size:"large",value:b,onChange:e=>E(e.target.value),onSearch:T,enterButton:t.jsx(v,{}),style:{fontSize:24},allowClear:!0})}),t.jsx(w,{title:"程序代码",style:{flex:1,display:"flex",flexDirection:"column",marginBottom:24},styles:{body:{flex:1,overflow:"auto",padding:0}},children:t.jsx("div",{ref:y,style:{width:"100%",height:"100%",overflow:"auto",backgroundColor:"#fafafa",fontFamily:L,fontSize:"24px",lineHeight:"40px"},children:B(i,b)})})]}):t.jsx(N,{description:"未找到程序数据"})}),t.jsx("style",{children:`
        .g-code {
          color: #1890ff;
          font-weight: 600;
        }
        .m-code {
          color: #52c41a;
          font-weight: 600;
        }
        .coordinate {
          color: #fa8c16;
          font-weight: 500;
        }
        .comment {
          color: #8c8c8c;
          font-style: italic;
        }
        .number {
          color: #722ed1;
        }
        mark {
          background-color: #fff3cd;
          color: #856404;
          padding: 2px 4px;
          border-radius: 2px;
        }
        .highlighted-line {
          animation: highlight 0.5s ease;
        }
        @keyframes highlight {
          0% { background-color: #fff3cd; }
          100% { background-color: transparent; }
        }
      `})]})};export{ie as default};
