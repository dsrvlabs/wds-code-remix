/**
 * @group unit
 */

// @ts-ignore

import { parseSuiVectorType } from './sui-parser';

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
});
