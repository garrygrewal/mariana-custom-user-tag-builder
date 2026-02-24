export const TAG_DIAMETER = 30;
export const TAG_RADIUS = TAG_DIAMETER / 2;

export const TEXT_MAX_LENGTH = 3;
export const TEXT_PATTERN = /^[A-Z0-9]{0,3}$/;

export const LABEL_MAX_LENGTH = 100;

export const FONT_FAMILY = 'Proxima Nova';
export const FONT_WEIGHT = 800;
export const FONT_SIZE_MIN = 9;
export const FONT_SIZE_1_CHAR = 18.5;
export const FONT_SIZE_2_CHAR = 16.5;
export const FONT_SIZE_3_CHAR = 12.5;

/** WCAG AA minimum for normal text against its background */
export const CONTRAST_THRESHOLD_TEXT = 4.5;
/** Minimum ratio of tag circle against a white page background */
export const CONTRAST_THRESHOLD_BG_WHITE = 2.0;

/** Both SVG viewBox and PNG raster target are 30x30 */
export const EXPORT_SIZE = 30;
/** Target max icon box size as a fraction of the 30x30 canvas */
export const ICON_FIT_RATIO = 0.6;

export const FONT_FALLBACK_STACK = '"Proxima Nova", "Arial", sans-serif';
export const FONT_ASSET_PATH = '/fonts/proxima-nova-extrabold.ttf';
