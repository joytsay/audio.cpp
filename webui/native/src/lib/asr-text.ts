import * as OpenCC from 'opencc-js/cn2t';

// Taiwan Traditional characters, without regional vocabulary substitutions.
const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' });

export function traditionalAsrText(text: string): string {
  // Keep the project's canonical semiconductor/company spellings.
  return toTraditional(text).replace(/大臺/g, '大台').replace(/機臺/g, '機台').replace(/臺積電/g, '台積電').trim();
}
