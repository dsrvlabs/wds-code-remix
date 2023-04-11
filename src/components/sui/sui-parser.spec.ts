/**
 * @group unit
 */

// @ts-ignore

import { stringifySuiVectorElementType, stringifySuiVectorType } from './sui-parser';

describe('Sui Parser', () => {
  it('stringifySuiVectorType', () => {
    const t = {
      Vector: {
        Vector: 'U8',
      },
    };

    const str = stringifySuiVectorType(t);

    expect(str).toBe('Vector<Vector<U8>>');
  });

  it('stringifySuiVectorType Vector<Vector<0x1::string::String>>', () => {
    const t = {
      Vector: {
        Vector: {
          Struct: {
            address: '0x1',
            module: 'string',
            name: 'String',
            typeArguments: [],
          },
        },
      },
    };

    const str = stringifySuiVectorType(t);

    expect(str).toBe('Vector<Vector<0x1::string::String>>');
  });

  it('stringifySuiVectorElementType', () => {
    const t = {
      Vector: {
        Vector: 'U8',
      },
    };

    const str = stringifySuiVectorElementType(t);

    expect(str).toBe('U8');
  });

  it('stringifySuiVectorElementType Vector<Vector<0x1::string::String>>', () => {
    const t = {
      Vector: {
        Vector: {
          Struct: {
            address: '0x1',
            module: 'string',
            name: 'String',
            typeArguments: [],
          },
        },
      },
    };

    const str = stringifySuiVectorElementType(t);

    expect(str).toBe('0x1::string::String');
  });
});
