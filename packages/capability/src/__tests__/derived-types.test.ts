import { describe, it, expect } from 'vitest';
import { IMAGE_WATERMARK } from '../presets/image.generated.js';
import type { ImageWatermarkPosition } from '../derived-types.js';

/**
 * 校验 derived-types.ts 中手写的联合类型与 manifest 的 values 数组一致。
 * 若 manifest 更新了 position.values 而类型未同步,此测试会失败。
 */
describe('derived-types 与 manifest 一致性', () => {
  it('ImageWatermarkPosition 与 IMAGE_WATERMARK.params.position.values 完全一致', () => {
    const positionParam = IMAGE_WATERMARK.params.find((p) => p.name === 'position');
    expect(positionParam).toBeDefined();
    expect(positionParam?.type).toBe('enum');

    const manifestValues: string[] = (positionParam?.values ?? []).slice().sort();
    // 把联合类型编译期信息转成运行时数组
    const typeValues: ImageWatermarkPosition[] = [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
      'center',
      'tile',
    ];
    const sortedTypeValues: string[] = typeValues.slice().sort();

    expect(manifestValues).toEqual(sortedTypeValues);
  });
});
