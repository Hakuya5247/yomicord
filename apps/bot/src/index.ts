import { Client, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';

import {
  UpsertDictionaryEntryRequestSchema,
  UpdateVoiceSettingsRequestSchema,
  ApiErrorResponseSchema,
} from '@yomicord/contracts';

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error('DISCORD_TOKEN is required');

const apiBaseUrl = (process.env.YOMICORD_API_BASEURL ?? 'http://localhost:8787').replace(
  /\/+$/,
  '',
);

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // とりあえず疎通用に API を叩いてみる（ギルドIDは仮）
  const guildId = 'test-guild';

  const dictBody = UpsertDictionaryEntryRequestSchema.parse({
    guildId,
    word: 'よみこーど',
    yomi: 'Yomicord',
  });

  const dictRes = await fetch(`${apiBaseUrl}/v1/dictionary/entry`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(dictBody),
  });

  if (!dictRes.ok) {
    await logApiError('辞書の更新', dictRes);
  }

  const voiceBody = UpdateVoiceSettingsRequestSchema.parse({
    guildId,
    speakerId: 1,
    speed: 1.0,
    volume: 1.0,
  });

  const voiceRes = await fetch(`${apiBaseUrl}/v1/voice/settings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(voiceBody),
  });

  if (!voiceRes.ok) {
    await logApiError('読み上げ設定の更新', voiceRes);
  }

  console.log('API calls done');
});

async function logApiError(actionName: string, res: Response) {
  // 失敗時でも、レスポンス形式を信頼しすぎない（安全第一）
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    console.error(`API の${actionName}に失敗しました (HTTP ${res.status})`);
    return;
  }

  try {
    const body: unknown = await res.json();
    const parsed = ApiErrorResponseSchema.safeParse(body);
    if (parsed.success) {
      console.error(
        `API の${actionName}に失敗しました: code=${parsed.data.error.code} message=${parsed.data.error.message} (HTTP ${res.status})`,
      );
      return;
    }
  } catch {
    // JSON 解析に失敗しても、詳細は出さずにフォールバックする
  }

  console.error(`API の${actionName}に失敗しました (HTTP ${res.status})`);
}

async function main() {
  try {
    await client.login(token);
  } catch (err) {
    console.error('Discord へのログインに失敗しました', err);
    process.exitCode = 1;
  }
}

void main().catch((err) => {
  console.error('起動に失敗しました', err);
  process.exitCode = 1;
});
