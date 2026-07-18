/**
 * engine-audio 浏览器版操作测试
 *
 * 浏览器版所有操作为 stub(避免加载 lamejs + Web Audio 解码器),
 * 每个操作应抛出 "not implemented in stub" 错误。
 *
 * 测试覆盖 4 个导出函数:trimAudio / mergeAudios / transcodeAudio / normalizeAudio
 * 每个 operation ≥2 个测试用例(参数校验 + stub 抛错)。
 */
import { describe, it, expect } from 'vitest';

/** 构造一个最小输入 Blob(内容不重要,stub 永远抛错) */
function makeBlob(): Blob {
  return new Blob([new Uint8Array([0])], { type: 'audio/mpeg' });
}

describe('engine-audio browser stub operations', () => {
  describe('trimAudio', () => {
    it('无参数时应抛 "not implemented in stub"', async () => {
      const { trimAudio } = await import('../operations.js');
      await expect(trimAudio(makeBlob())).rejects.toThrow(
        /trimAudio not implemented in stub/
      );
    });

    it('带 start/end 参数时应抛 "not implemented in stub"', async () => {
      const { trimAudio } = await import('../operations.js');
      await expect(
        trimAudio(makeBlob(), { start: 0, end: 30 })
      ).rejects.toThrow(/not implemented in stub/);
    });

    it('错误消息应提示使用 Node 子路径', async () => {
      const { trimAudio } = await import('../operations.js');
      await expect(trimAudio(makeBlob())).rejects.toThrow(
        /@lokvis\/engine-audio\/node/
      );
    });
  });

  describe('mergeAudios', () => {
    it('空数组输入应抛 "not implemented in stub"', async () => {
      const { mergeAudios } = await import('../operations.js');
      await expect(mergeAudios([])).rejects.toThrow(
        /mergeAudios not implemented in stub/
      );
    });

    it('多输入应抛 "not implemented in stub"', async () => {
      const { mergeAudios } = await import('../operations.js');
      await expect(
        mergeAudios([makeBlob(), makeBlob()], { format: 'mp3' })
      ).rejects.toThrow(/not implemented in stub/);
    });
  });

  describe('transcodeAudio', () => {
    it('无参数时应抛 "not implemented in stub"', async () => {
      const { transcodeAudio } = await import('../operations.js');
      await expect(transcodeAudio(makeBlob())).rejects.toThrow(
        /transcodeAudio not implemented in stub/
      );
    });

    it('带 format 参数时应抛 "not implemented in stub"', async () => {
      const { transcodeAudio } = await import('../operations.js');
      await expect(
        transcodeAudio(makeBlob(), { format: 'mp3', bitrate: 128000 })
      ).rejects.toThrow(/not implemented in stub/);
    });
  });

  describe('normalizeAudio', () => {
    it('无参数时应抛 "not implemented in stub"', async () => {
      const { normalizeAudio } = await import('../operations.js');
      await expect(normalizeAudio(makeBlob())).rejects.toThrow(
        /normalizeAudio not implemented in stub/
      );
    });

    it('带 level 参数时应抛 "not implemented in stub"', async () => {
      const { normalizeAudio } = await import('../operations.js');
      await expect(
        normalizeAudio(makeBlob(), { level: -16 })
      ).rejects.toThrow(/not implemented in stub/);
    });
  });
});

describe('engine-audio browser operations 类型导出', () => {
  it('应能 import 类型(编译期检查,运行时无操作)', async () => {
    // 类型 only import,验证 types.ts 导出完整性
    type _Check =
      | import('../types.js').AudioOutputFormat
      | import('../types.js').AudioTrimParams
      | import('../types.js').AudioMergeParams
      | import('../types.js').AudioTranscodeParams
      | import('../types.js').AudioNormalizeParams;
    // 引用一次避免"未使用"告警
    const _check: _Check | null = null;
    expect(_check).toBeNull();
  });
});
