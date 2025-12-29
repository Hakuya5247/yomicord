import Fastify from 'fastify';
import {
  UpsertDictionaryEntryRequestSchema,
  UpdateVoiceSettingsRequestSchema,
  OkResponseSchema,
} from '@yomicord/contracts';

const app = Fastify({ logger: true });

// In-memory stores (DB導入前の仮)
// key: `${guildId}:${key}`
const dictionary = new Map<string, string>();
// key: guildId
const voiceSettings = new Map<string, { speakerId: number; speed: number; volume: number }>();

app.get('/health', async () => ({ ok: true }));

app.post('/v1/dictionary/entry', async (req, reply) => {
  const parsed = UpsertDictionaryEntryRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const { guildId, word, yomi } = parsed.data;
  dictionary.set(`${guildId}:${word}`, yomi);

  return reply.send(OkResponseSchema.parse({ ok: true }));
});

app.post('/v1/voice/settings', async (req, reply) => {
  const parsed = UpdateVoiceSettingsRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
  }

  const { guildId, speakerId, speed, volume } = parsed.data;
  voiceSettings.set(guildId, { speakerId, speed, volume });

  return reply.send(OkResponseSchema.parse({ ok: true }));
});

// ここから起動処理を関数化（top-level await を避ける）
async function start() {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen({ port, host });
}

start().catch((err) => {
  app.log.error({ err }, 'API の起動に失敗しました');
  process.exit(1);
});
