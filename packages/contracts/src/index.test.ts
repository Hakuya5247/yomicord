import { describe, expect, it } from 'vitest';

import { UpdateVoiceSettingsRequestSchema } from './index.js';

describe('contracts: UpdateVoiceSettingsRequestSchema', () => {
  it('デフォルト適用と境界値を満たす', () => {
    const withDefaults = UpdateVoiceSettingsRequestSchema.parse({
      guildId: 'g1',
      speakerId: 0,
    });

    expect(withDefaults.speed).toBe(1.0);
    expect(withDefaults.volume).toBe(1.0);

    // 境界値（OK）
    UpdateVoiceSettingsRequestSchema.parse({
      guildId: 'g1',
      speakerId: 1,
      speed: 0.5,
      volume: 0.0,
    });
    UpdateVoiceSettingsRequestSchema.parse({
      guildId: 'g1',
      speakerId: 1,
      speed: 2.0,
      volume: 2.0,
    });

    // 境界外（NG）
    expect(() =>
      UpdateVoiceSettingsRequestSchema.parse({
        guildId: 'g1',
        speakerId: 1,
        speed: 0.49,
        volume: 1.0,
      }),
    ).toThrow();

    expect(() =>
      UpdateVoiceSettingsRequestSchema.parse({
        guildId: 'g1',
        speakerId: 1,
        speed: 1.0,
        volume: -0.01,
      }),
    ).toThrow();

    // speakerId は int + nonnegative
    expect(() =>
      UpdateVoiceSettingsRequestSchema.parse({
        guildId: 'g1',
        speakerId: -1,
      }),
    ).toThrow();

    expect(() =>
      UpdateVoiceSettingsRequestSchema.parse({
        guildId: 'g1',
        speakerId: 1.5,
      }),
    ).toThrow();
  });
});
