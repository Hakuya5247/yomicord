/**
 * 辞書の表記キーを正規化する。
 * @param surface - 入力された表記。
 * @returns 正規化後の表記キー。
 */
export const normalizeSurface = (surface: string): string => {
  // TODO(test): 正規化の順序と空白圧縮の挙動を検証する。
  const normalized = surface.normalize('NFKC').trim();
  const lowercased = normalized.toLowerCase();
  return lowercased.replace(/\s+/g, ' ');
};
