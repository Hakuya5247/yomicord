export const normalizeSurface = (surface: string): string => {
  // TODO(test): 正規化の順序と空白圧縮の挙動を検証する。
  const normalized = surface.normalize('NFKC').trim();
  const lowercased = normalized.toLowerCase();
  return lowercased.replace(/\s+/g, ' ');
};
