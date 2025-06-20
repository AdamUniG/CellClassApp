// auto-generated by updateImageList.js
import { IMAGES_RAW }    from './rawCrops';
import { IMAGES_ZOOMED } from './zoomedCrops';

export const IMAGES = IMAGES_RAW.map(raw => ({
  id: raw.id,
  raw: raw.img,
  zoomed: IMAGES_ZOOMED.find(z => z.id === raw.id)!.img,
}));
