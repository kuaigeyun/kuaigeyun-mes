import{r as l,j as e}from"./vendor-Lat98Smq.js";const r={info:"rgba(56, 189, 248, 0.55)",warn:"rgba(251, 191, 36, 0.55)",risk:"rgba(244, 63, 94, 0.55)"},p=({items:t,t:a})=>{const i=`event-scroll-${l.useId().replace(/:/g,"")}`,s=[...t,...t];return e.jsxs("div",{style:{flex:1,minHeight:0,overflow:"hidden",position:"relative",maskImage:"linear-gradient(to bottom, transparent, black 12%, black 88%, transparent)"},children:[e.jsx("style",{children:`
          @keyframes ${i} {
            0% { transform: translateY(0); }
            100% { transform: translateY(-50%); }
          }
          .event-feed-container {
            animation: ${i} 48s linear infinite;
          }
          .event-feed-container:hover {
            animation-play-state: paused;
          }
          @media (prefers-reduced-motion: reduce) {
            .event-feed-container {
              animation: none !important;
            }
          }
        `}),e.jsx("div",{className:"event-feed-container",style:{display:"flex",flexDirection:"column",gap:6,paddingTop:8,paddingBottom:8},children:s.map((n,o)=>e.jsx("div",{style:{padding:"6px 10px",borderRadius:6,background:"rgba(15, 23, 42, 0.45)",border:"1px solid rgba(148, 163, 184, 0.12)",boxShadow:"inset 0 1px 0 rgba(255,255,255,0.03)",flexShrink:0},children:e.jsxs("div",{style:{display:"flex",alignItems:"flex-start",gap:10},children:[e.jsx("span",{"aria-hidden":!0,style:{width:6,height:6,borderRadius:"50%",marginTop:6,flexShrink:0,background:r[n.level],boxShadow:`0 0 6px ${r[n.level]}`}}),e.jsxs("div",{style:{flex:1,minWidth:0},children:[e.jsxs("div",{style:{display:"flex",justifyContent:"space-between",gap:8,marginBottom:2},children:[e.jsx("span",{style:{fontSize:11,fontWeight:700,color:"#f1f5f9"},children:a(n.titleKey)}),e.jsx("span",{style:{fontSize:10,color:"#64748b",fontFamily:'"JetBrains Mono", ui-monospace, monospace',flexShrink:0},children:n.time})]}),e.jsx("div",{style:{fontSize:10,color:"#94a3b8",lineHeight:1.45,letterSpacing:.1},children:a(n.detailKey)})]})]})},`${n.id}-${o}`))})]})};export{p as EventFeed};
