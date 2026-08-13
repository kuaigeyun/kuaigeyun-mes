/**
 * CAD 预览 SVG 契约。
 *
 * 线宽必须在视口坐标（vector-effect: non-scaling-stroke + stroke-width=1），
 * 禁止 CSS `1px`（SVG 内嵌 HTML 时 1px = 1 图纸单位），禁止按图幅写用户单位线宽
 * （INSERT/scale 会把线宽一起放大，尖角 miter 会拉成星形色块）。
 */

function parseSvgViewBox(svg: string): { x: number; y: number; width: number; height: number } | null {
  const match = svg.match(/viewBox=["']([^"']+)["']/i);
  if (!match) return null;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4 || parts[2] <= 0 || parts[3] <= 0) return null;
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

const CAD_STROKE_TAGS = 'line,polyline,polygon,path,circle,ellipse';

export function applyCadPreviewHairline(root: SVGSVGElement): void {
  root.setAttribute('width', '100%');
  root.setAttribute('height', '100%');
  root.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  root.querySelectorAll(CAD_STROKE_TAGS).forEach((el) => {
    el.setAttribute('fill', 'none');
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    el.setAttribute('stroke-width', '1');
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-miterlimit', '1');
  });
}

/** `<use>` 的 shadow tree 不应用 vector-effect；展开后描边才是视口发丝线。 */
export function inlineSvgUseReferences(root: SVGSVGElement): void {
  const doc = root.ownerDocument;
  for (let pass = 0; pass < 32; pass += 1) {
    const uses = Array.from(root.querySelectorAll('use'));
    if (!uses.length) return;
    let replaced = 0;
    for (const useEl of uses) {
      const href =
        useEl.getAttribute('href') ||
        useEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href') ||
        '';
      const id = href.startsWith('#') ? href.slice(1) : '';
      if (!id) continue;
      const target = root.getElementById(id);
      if (!target || target.contains(useEl)) continue;
      const g = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
      const transform = useEl.getAttribute('transform');
      const x = useEl.getAttribute('x');
      const y = useEl.getAttribute('y');
      const translate = x || y ? `translate(${x || 0},${y || 0})` : '';
      if (translate && transform) g.setAttribute('transform', `${translate} ${transform}`);
      else if (transform) g.setAttribute('transform', transform);
      else if (translate) g.setAttribute('transform', translate);
      for (const child of Array.from(target.childNodes)) {
        g.appendChild(child.cloneNode(true));
      }
      useEl.replaceWith(g);
      replaced += 1;
    }
    if (!replaced) return;
  }
}

function stampCadPreviewStroke(svg: string): string {
  return svg.replace(
    /<(line|polyline|polygon|path|circle|ellipse)\b([^>]*?)(\/?)>/gi,
    (_full, tag: string, attrs: string, selfClose: string) => {
      const cleaned = attrs
        .replace(/\sfill=["'][^"']*["']/gi, '')
        .replace(/\svector-effect=["'][^"']*["']/gi, '')
        .replace(/\sstroke-width=["'][^"']*["']/gi, '')
        .replace(/\sstroke-linejoin=["'][^"']*["']/gi, '')
        .replace(/\sstroke-linecap=["'][^"']*["']/gi, '')
        .replace(/\sstroke-miterlimit=["'][^"']*["']/gi, '');
      const end = selfClose === '/' ? ' /' : '';
      return `<${tag}${cleaned} fill="none" vector-effect="non-scaling-stroke" stroke-width="1" stroke-linejoin="round" stroke-linecap="round" stroke-miterlimit="1"${end}>`;
    },
  );
}

function enhanceCadSvgForPreview(svg: string): string {
  const vb = parseSvgViewBox(svg);

  let out = svg
    .replace(/stroke=["']rgb\(\s*undefined\s*,\s*undefined\s*,\s*undefined\s*\)["']/gi, 'stroke="#222222"')
    .replace(/stroke=["']rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)["']/gi, (match, r, g, b) => {
      const ri = Number(r);
      const gi = Number(g);
      const bi = Number(b);
      if (ri > 210 && gi > 210 && bi > 210) return 'stroke="#333333"';
      return match;
    })
    .replace(/stroke=["']#fff(?:fff)?["']/gi, 'stroke="#333333"')
    .replace(/fill=["']rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)["']/gi, 'fill="none"')
    .replace(/\sstroke-width=["'][^"']*["']/gi, '');

  out = out.replace(/<svg\b[^>]*>/i, (tag) => {
    const inner = tag
      .slice(0, -1)
      .replace(/\s(width|height)=["'][^"']*["']/gi, '')
      .replace(/\spreserveAspectRatio=["'][^"']*["']/gi, '');
    return `${inner} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">`;
  });

  out = out.replace(
    /(<g[^>]*transform="matrix\(1,0,0,-1,0,0\)"[^>]*)(>)/gi,
    `$1 fill="none" stroke-linejoin="round" stroke-linecap="round"$2`,
  );

  if (vb && !out.includes('cad2d-paper')) {
    const paperBg = `<rect class="cad2d-paper" x="${vb.x}" y="${vb.y}" width="${vb.width}" height="${vb.height}" fill="#fffef5"/>`;
    out = out.replace(/(<svg\b[^>]*>)/i, `$1${paperBg}`);
  }

  return stampCadPreviewStroke(out);
}

export function hasValidSvgViewBox(svg: string): boolean {
  const match = svg.match(/viewBox=["']([^"']+)["']/i);
  if (!match) return true;
  const parts = match[1].trim().split(/[\s,]+/).map(Number);
  if (parts.length < 4) return false;
  return parts[2] > 0 && parts[3] > 0;
}

function repairSvgViewBox(svg: string): string {
  if (hasValidSvgViewBox(svg)) return svg;
  const nums = svg.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)?.map(Number) ?? [];
  const finite = nums.filter((n) => Number.isFinite(n));
  if (finite.length < 2) return svg;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of finite) {
    minX = Math.min(minX, n);
    maxX = Math.max(maxX, n);
    minY = Math.min(minY, n);
    maxY = Math.max(maxY, n);
  }
  const pad = Math.max(maxX - minX, maxY - minY) * 0.05 || 10;
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
  if (/viewBox=/i.test(svg)) {
    return svg.replace(/viewBox=["'][^"']*["']/i, `viewBox="${vb}"`);
  }
  return svg.replace(/<svg\b/i, `<svg viewBox="${vb}"`);
}

export function normalizeCadSvg(svg: string): string {
  let out = svg.replace(/^\s*<\?xml[^?]+\?>\s*/i, '');
  if (!/<svg[\s>]/i.test(out)) {
    out = `<svg xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
  }
  out = repairSvgViewBox(out);
  return enhanceCadSvgForPreview(out);
}

export function mountCadPreviewSvg(host: HTMLElement, svg: string): void {
  host.replaceChildren();
  host.innerHTML = svg;
  const svgEl = host.querySelector('svg');
  if (!svgEl) return;
  inlineSvgUseReferences(svgEl);
  applyCadPreviewHairline(svgEl);
}
