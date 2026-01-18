import { GuildMemberSettingsSchema, type GuildMemberSettings } from '../guild/member-settings.js';

/**
 * メンバー設定を保存用に正規化する。
 * @param settings - 入力された設定。
 * @returns 空の場合は null、そうでなければ正規化済み設定。
 */
export const canonicalizeGuildMemberSettings = (
  settings: GuildMemberSettings,
): GuildMemberSettings | null => {
  // TODO(test): 空オブジェクトや inherit の削除が行われることを検証する。
  const parsed = GuildMemberSettingsSchema.parse(settings);
  const next: GuildMemberSettings = {};

  if (parsed.voice) {
    const voice: NonNullable<GuildMemberSettings['voice']> = {};
    if (parsed.voice.speakerId !== undefined) {
      voice.speakerId = parsed.voice.speakerId;
    }
    if (parsed.voice.volume !== undefined) {
      voice.volume = parsed.voice.volume;
    }
    if (parsed.voice.speed !== undefined) {
      voice.speed = parsed.voice.speed;
    }
    if (parsed.voice.pitch !== undefined) {
      voice.pitch = parsed.voice.pitch;
    }
    if (parsed.voice.intonation !== undefined) {
      voice.intonation = parsed.voice.intonation;
    }
    if (Object.keys(voice).length > 0) {
      next.voice = voice;
    }
  }

  if (parsed.nameRead) {
    if (parsed.nameRead.normalize !== 'inherit') {
      next.nameRead = { normalize: parsed.nameRead.normalize };
    }
  }

  if (Object.keys(next).length === 0) {
    return null;
  }

  return next;
};
