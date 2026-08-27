const fs = require('fs'), path = require('path');
const GB = process.argv[2];
const SITE = 'https://www.aridane.org/city';
const PEND = '2026/08'; // carpeta que usará WordPress al subir hoy (agosto 2026)

let html = fs.readFileSync(path.join(GB, 'home-1b-generateblocks.html'), 'utf8');
const before = html;
const log = [];
function rep(from, to, why) {
  const n = html.split(from).length - 1;
  if (n) { html = html.split(from).join(to); log.push({ n, why, from, to }); }
  else log.push({ n: 0, why, from, to });
}

// 1. El asset entregado se llama banner-infraestructuras-viales.png
rep('consulta-reconstruccion-infraestructuras-viales.png',
    'banner-infraestructuras-viales.png',
    'nombre de archivo no coincidía con el asset entregado');

// 2. Las 4 imágenes pendientes de subir → carpeta YYYY/MM que usará WordPress
for (const f of ['banner-cortonaos.png', 'banner-plan-edil.jpeg',
                 'banner-infraestructuras-viales.png', 'promocion-deportiva.jpg',
                 'servicios-sociales.jpg']) {
  rep('/wp-content/uploads/' + f, '/wp-content/uploads/' + PEND + '/' + f,
      'imagen pendiente de subir → carpeta ' + PEND);
}

// 3. Rutas relativas → absolutas con el prefijo /city/ (sin él dan 404)
rep('"src":"/wp-content/uploads/', '"src":"' + SITE + '/wp-content/uploads/', 'src relativo → absoluto /city/');
rep('src="/wp-content/uploads/',   'src="' + SITE + '/wp-content/uploads/',   'src del cuerpo → absoluto /city/');
rep('url(/wp-content/uploads/',    'url(' + SITE + '/wp-content/uploads/',    'background-image → absoluto /city/');

fs.writeFileSync(path.join(GB, 'home-1b-generateblocks-v2.html'), html);

// ---- CSS ----
let css = fs.readFileSync(path.join(GB, 'home-1b-gb-extra.css'), 'utf8');
const cssLog = [];

// 4. Breakpoint 768 → 781 (el JS del carrusel usa 781; a 769-781px iban desincronizados)
if (css.includes('@media (max-width:768px)')) {
  css = css.split('@media (max-width:768px)').join('@media (max-width:781px)');
  cssLog.push('breakpoint 768px → 781px (sincronizado con MOBILE=781 del carrusel)');
}

// 5. Accesibilidad: devolver el indicador de foco al buscador (WCAG 2.4.7)
css = css.replace(
  '.ar-hero-search .wp-block-search__input:focus{ outline:none; }',
  `.ar-hero-search .wp-block-search__input:focus{ outline:none; }
.ar-hero-search .wp-block-search__inside-wrapper:focus-within{
  box-shadow:0 20px 25px -5px rgba(0,0,0,.3), 0 0 0 3px #EE743B;
}`);
cssLog.push('foco visible en el buscador (WCAG 2.4.7 / EN 301 549)');

// 6. Foco visible en flechas y puntos del carrusel
css += `
/* ── Foco visible en los controles del carrusel (WCAG 2.4.7) ── */
.ar-slider__nav:focus-visible,
.ar-slider__dot:focus-visible{
  outline:3px solid #EE743B; outline-offset:3px;
}
`;
cssLog.push('foco visible en flechas y puntos del carrusel');

fs.writeFileSync(path.join(GB, 'home-1b-gb-extra-v2.css'), css);

console.log('=== HTML ===');
for (const l of log) console.log(`  ${String(l.n).padStart(2)}×  ${l.why}\n        ${l.from}\n     →  ${l.to}`);
console.log('  bytes:', before.length, '→', html.length);
console.log('=== CSS ===');
for (const l of cssLog) console.log('  ·', l);
