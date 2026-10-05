const extensionDigits = '零一二三四伍六七八九';

export function spokenExtensionText(text: string): string {
  return text.replace(/(分機\s*)([0-9０-９零〇一二三四五伍六七八九]+)/g, (_match, label: string, extension: string) =>
    label + Array.from(extension, (digit) => {
      if (digit === '五') return '伍';
      if (digit === '〇') return '零';
      const code = digit.charCodeAt(0);
      if (code >= 48 && code <= 57) return extensionDigits[code - 48];
      if (code >= 0xff10 && code <= 0xff19) return extensionDigits[code - 0xff10];
      return digit;
    }).join(''));
}
