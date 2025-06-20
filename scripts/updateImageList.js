// scripts/updateImageList.js
const fs   = require('fs');
const path = require('path');

const PREFIX = '20250409_3_Glut_1mM';
const RAW_DIR    = path.join(__dirname, '../assets/roi/raw_crops');
const ZOOM_DIR   = path.join(__dirname, '../assets/roi/raw_crops_zoomed_out');
const OUT_SRC    = path.join(__dirname, '../src/images');

// helper to strip extension
function stripExt(fn) {
  return fn.replace(/\.(png|jpe?g)$/, '');
}

// 1) read both folders
const raws   = fs.readdirSync(RAW_DIR).filter(f => /^component_\d+\.(png|jpe?g)$/.test(f));
const zooms  = fs.readdirSync(ZOOM_DIR).filter(f => /^component_\d+_zoomed\.(png|jpe?g)$/.test(f));

// 2) build image list
const images = raws.map(fn => {
  const base   = stripExt(fn);
  const id       = `${PREFIX}_${base}`;                   // e.g. "component_42"
  const zoomFile = `${base}_zoomed.png`;
  return {
    id,
    rawPath:  `../../assets/roi/raw_crops/${fn}`,
    zoomPath: `../../assets/roi/raw_crops_zoomed_out/${zoomFile}`
  };
});

// 3) emit rawCrops.ts
const rawTs = `// auto-generated by updateImageList.js
export const IMAGES_RAW = [
${images.map(img => `  { id: '${img.id}', img: require('${img.rawPath}') }`).join(',\n')}
];
`;
fs.writeFileSync(path.join(OUT_SRC, 'rawCrops.ts'), rawTs);

// 4) emit zoomedCrops.ts
const zoomTs = `// auto-generated by updateImageList.js
export const IMAGES_ZOOMED = [
${images.map(img => `  { id: '${img.id}', img: require('${img.zoomPath}') }`).join(',\n')}
];
`;
fs.writeFileSync(path.join(OUT_SRC, 'zoomedCrops.ts'), zoomTs);

// 5) emit index.ts that pairs them
const idxTs = `// auto-generated by updateImageList.js
import { IMAGES_RAW }    from './rawCrops';
import { IMAGES_ZOOMED } from './zoomedCrops';

export const IMAGES = IMAGES_RAW.map(raw => ({
  id: raw.id,
  raw: raw.img,
  zoomed: IMAGES_ZOOMED.find(z => z.id === raw.id)!.img,
}));
`;
fs.writeFileSync(path.join(OUT_SRC, 'index.ts'), idxTs);

console.log('✅ src/images/{rawCrops.ts,zoomedCrops.ts,index.ts} updated!');
