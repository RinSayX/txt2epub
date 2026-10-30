import type { Encoding } from './types';

const COMMON_CHINESE = new Set(
  '的一是在不了有和人这中大为上个国我以要他时来用们生到作地于出就分对成会可主发年动同工也能下过子说产种面而方后多定行学法所民得经之进着等部度家里如水化高自二理起小物现实加量都两体制机当使点从业本去性好应开它合还因由其些然前外天日那社事平形相全表间样与关各重新线内数正心反你明看原利比或但质气第向道命此变条只没结解问意建月公无军很情者最立代想通并提直题党程展五果料象员位入常文总次品式活设及管特件长求老头基资边流路级少图山统接知较将组见计别她手角期根论运指几九区强放决西被干做必战先回则任取据处理世车走更白传位名身光门声风夜雨卷章册番外楔尾序',
);

function quality(text: string): number {
  let score = 0;
  const sample = [...text.slice(0, 40000)];
  for (const char of sample) {
    if (COMMON_CHINESE.has(char)) score += 3;
    else if (/[\u3400-\u9fff]/u.test(char)) score += 0.25;
    if (char === '\uFFFD') score -= 30;
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/u.test(char)) score -= 20;
  }
  return score / Math.max(1, sample.length);
}

export function decodeText(bytes: Uint8Array, requested: Encoding = 'auto') {
  if (!bytes.length) throw new Error('这个文件是空的，请选择包含正文的 TXT 文件。');
  let encoding: string = requested;
  let uncertain = false;
  if (requested === 'auto') {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    else {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        encoding = 'utf-8';
      } catch {
        const candidates = ['gb18030', 'big5']
          .flatMap((candidate) => {
            try {
              const text = new TextDecoder(candidate, { fatal: true }).decode(bytes);
              return [{ encoding: candidate, score: quality(text) }];
            } catch {
              return [];
            }
          })
          .sort((a, b) => b.score - a.score);
        if (!candidates.length)
          throw new Error('无法确定文件编码，请在编码选项中手动选择后重新导入。');
        encoding = candidates[0].encoding;
        uncertain = true;
      }
    }
  }
  try {
    const decoded = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    if (!decoded.trim()) throw new Error('文件只有空白字符，请选择包含正文的文件。');
    // This view changes line endings only. Match-time normalization never mutates it.
    return { text: decoded.replace(/\r\n?/g, '\n'), encoding, uncertain };
  } catch (error) {
    if (error instanceof TypeError)
      throw new Error(`无法以 ${encoding.toUpperCase()} 完整解码，请切换编码后重试。`);
    throw error;
  }
}
