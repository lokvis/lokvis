/**
 * engine-video 浏览器版操作测试
 *
 * 浏览器版所有操作为 stub(避免加载 ffmpeg.wasm ~30MB),
 * 每个操作应抛出 "not implemented in stub" 错误。
 *
 * 测试覆盖 8 个导出函数:
 * - compressVideo / transcodeVideo / trimVideo / mergeVideos
 * - extractAudio / toGif / screenshotVideo / getVideoInfo
 *
 * 每个 operation ≥2 个测试用例(参数校验 + stub 抛错)。
 */
import { describe, it, expect } from 'vitest';

/** 构造一个最小输入 Blob(内容不重要,stub 永远抛错) */
function makeBlob(): Blob {
  return new Blob([new Uint8Array([0])], { type: 'video/mp4' });
}

describe('engine-video browser stub operations', () => {
  describe('compressVideo', () => {
    it('无参数时应抛 "not implemented in stub"', async () => {
      const { compressVideo } = await import('../operations.js');
      await expect(compressVideo(makeBlob())).rejects.toThrow(
        /compressVideo not implemented in stub/
      );
    });

    it('带参数时应抛 "not implemented in stub"', async () => {
      const { compressVideo } = await import('../operations.js');
      await expect(
        compressVideo(makeBlob(), { crf: 23, bitrate: 1000000, scale: 0.5 })
      ).rejects.toThrow(/not implemented in stub/);
    });

    it('错误消息应提示使用 Node 子路径', async () => {
      const { compressVideo } = await import('../operations.js');
      await expect(compressVideo(makeBlob())).rejects.toThrow(
        /@lokvis\/engine-video\/node/
      );
    });
  });

  describe('transcodeVideo', () => {
    it('无参数时应抛 "not implemented in stub"', async () => {
      const { transcodeVideo } = await import('../operations.js');
      await expect(transcodeVideo(makeBlob())).rejects.toThrow(
        /transcodeVideo not implemented in stub/
      );
    });

    it('带 format 参数时应抛 "not implemented in stub"', async () => {
      const { transcodeVideo } = await import('../operations.js');
      await expect(
        transcodeVideo(makeBlob(), { format: 'webm', codec: 'vp9' })
      ).rejects.toThrow(/not implemented in stub/);
    });
  });

  describe('trimVideo', () => {
    it('无参数时应抛 "not implemented in stub"', async () => {
      const { trimVideo } = await import('../operations.js');
      await expect(trimVideo(makeBlob())).rejects.toThrow(
        /trimVideo not implemented in stub/
      );
    });

    it('带 start/end 参数时应抛 "not implemented in stub"', async () => {
      const { trimVideo } = await import('../operations.js');
      await expect(
        trimVideo(makeBlob(), { start: 0, end: 5 })
      ).rejects.toThrow(/not implemented in stub/);
    });
  });

  describe('mergeVideos', () => {
    it('空数组输入应抛 "not implemented in stub"', async () => {
      const { mergeVideos } = await import('../operations.js');
      await expect(mergeVideos([])).rejects.toThrow(
        /mergeVideos not implemented in stub/
      );
    });

    it('多输入应抛 "not implemented in stub"', async () => {
      const { mergeVideos } = await import('../operations.js');
      await expect(
        mergeVideos([makeBlob(), makeBlob()], { format: 'mp4' })
      ).rejects.toThrow(/not implemented in stub/);
    });
  });

  describe('extractAudio', () => {
    it('无参数时应抛 "not implemented in stub"', async () => {
      const { extractAudio } = await import('../operations.js');
      await expect(extractAudio(makeBlob())).rejects.toThrow(
        /extractAudio not implemented in stub/
      );
    });

    it('带 format 参数时应抛 "not implemented in stub"', async () => {
      const { extractAudio } = await import('../operations.js');
      await expect(
        extractAudio(makeBlob(), { format: 'mp3', bitrate: 128000 })
      ).rejects.toThrow(/not implemented in stub/);
    });
  });

  describe('toGif', () => {
    it('无参数时应抛 "not implemented in stub"', async () => {
      const { toGif } = await import('../operations.js');
      await expect(toGif(makeBlob())).rejects.toThrow(
        /toGif not implemented in stub/
      );
    });

    it('带 fps/width 参数时应抛 "not implemented in stub"', async () => {
      const { toGif } = await import('../operations.js');
      await expect(
        toGif(makeBlob(), { fps: 15, width: 480, start: 0, end: 3 })
      ).rejects.toThrow(/not implemented in stub/);
    });
  });

  describe('screenshotVideo', () => {
    it('无参数时应抛 "not implemented in stub"', async () => {
      const { screenshotVideo } = await import('../operations.js');
      await expect(screenshotVideo(makeBlob())).rejects.toThrow(
        /screenshotVideo not implemented in stub/
      );
    });

    it('带 time 参数时应抛 "not implemented in stub"', async () => {
      const { screenshotVideo } = await import('../operations.js');
      await expect(
        screenshotVideo(makeBlob(), { time: 2.5, format: 'png' })
      ).rejects.toThrow(/not implemented in stub/);
    });
  });

  describe('getVideoInfo', () => {
    it('应抛 "not implemented in stub"', async () => {
      const { getVideoInfo } = await import('../operations.js');
      await expect(getVideoInfo(makeBlob())).rejects.toThrow(
        /getVideoInfo not implemented in stub/
      );
    });

    it('错误消息应提示使用 Node 子路径', async () => {
      const { getVideoInfo } = await import('../operations.js');
      await expect(getVideoInfo(makeBlob())).rejects.toThrow(
        /@lokvis\/engine-video\/node/
      );
    });
  });
});

describe('engine-video browser operations 类型导出', () => {
  it('应能 import 类型(编译期检查,运行时无操作)', async () => {
    // 类型 only import,验证 types.ts 导出完整性
    type _Check =
      | import('../types.js').VideoOutputFormat
      | import('../types.js').VideoTranscodeParams
      | import('../types.js').VideoTrimParams
      | import('../types.js').VideoCompressParams
      | import('../types.js').VideoMergeParams
      | import('../types.js').VideoExtractAudioParams
      | import('../types.js').VideoToGifParams
      | import('../types.js').VideoScreenshotParams
      | import('../types.js').VideoInfo;
    // 引用一次避免"未使用"告警
    const _check: _Check | null = null;
    expect(_check).toBeNull();
  });
});
