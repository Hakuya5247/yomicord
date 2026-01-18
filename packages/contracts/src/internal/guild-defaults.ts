import type { GuildSettings } from '../guild/settings.js';

export const createDefaultGuildSettings = (): GuildSettings => ({
  voice: {
    engine: 'voicevox',
    speakerId: 1,
    volume: 1.0,
    speed: 1.0,
    pitch: 0.0,
    intonation: 1.0,
  },
  nameRead: {
    nameSource: 'NICKNAME',
    prefix: '',
    suffix: 'さん',
    repeatMode: 'ON_CHANGE',
    cooldownSec: 120,
    normalizeDefault: true,
  },
  filters: {
    mentionMode: 'EXPAND',
    urlMode: 'DOMAIN_ONLY',
    emojiMode: 'IGNORE',
    codeBlockMode: 'SAY_CODE',
    attachmentMode: 'TYPE_ONLY',
    newlineMode: 'JOIN',
  },
  limits: {
    maxHiraganaLength: 120,
    overLimitAction: 'SAY_IKARYAKU',
  },
  announce: {
    onConnect: true,
    onStartStop: false,
    customText: null,
  },
  permissions: {
    manageMode: 'ADMIN_ONLY',
    allowedRoleIds: [],
  },
  opsNotify: {
    channelId: null,
    levelMin: 'NOTICE',
  },
});
