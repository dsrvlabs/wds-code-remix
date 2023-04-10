/**
 * @group unit
 */

// @ts-ignore

import { parseSuiVectorInnerType, parseSuiVectorType } from './sui-parser';

describe('Sui Parser', () => {
  it('parseVectorType', () => {
    const t = {
      Vector: {
        Vector: 'U8',
      },
    };

    const str = parseSuiVectorType(t);

    expect(str).toBe('Vector<Vector<U8>>');
  });

  it('parseSuiVectorInnerType', () => {
    const t = {
      Vector: {
        Vector: 'U8',
      },
    };

    const str = parseSuiVectorInnerType(t);

    expect(str).toBe('U8');
  });
});
