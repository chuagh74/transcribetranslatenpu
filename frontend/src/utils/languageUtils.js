// utils/languageUtils.js

import { Converter } from 'opencc-js';

// Create converters (each returns a Promise resolving to a conversion function)
export const toTraditional = Converter({ from: 'cn', to: 'tw' });
export const toSimplified  = Converter({ from: 'tw', to: 'cn' });

/**
 * Convert Chinese text into the regional variant for display.
 * @param {string} text
 * @param {'zh_CN'|'zh_TW'|string} region
 * @returns {Promise<string>}
 */
export async function convertRegional(text, region) {
  if (region === 'zh_CN') {
    const conv = await toSimplified;
    return conv(text);
  }
  if (region === 'zh_TW') {
    const conv = await toTraditional;
    return conv(text);
  }
  return text;
}

/**
 * Map UI language codes to what the server expects.
 * @param {'zh_CN'|'zh_TW'|string} region
 * @returns {string}
 */
export function mapLangForServer(region) {
  if (region.startsWith('zh')) return 'zh';
  return region;
}
