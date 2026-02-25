export type TagMode = 'text' | 'icon';

export interface IconDef {
  id: string;
  label: string;
  svgContent: string;
  viewBox: string;
}

export interface TagConfig {
  label: string;
  bgHex: string;
  mode: TagMode;
  text: string;
  iconId: string;
  uploadedIcon?: IconDef | null;
}

export interface ContrastWarning {
  type: 'low-fg-contrast' | 'low-bg-visibility';
  message: string;
  ratio: number;
}
