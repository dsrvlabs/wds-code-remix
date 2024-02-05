/**
 * @group unit
 */

// @ts-ignore

import {
  isHexadecimal,
  stringifySuiVectorElementType,
  stringifySuiVectorType,
  suiTypeName,
} from './sui-parser';
import { SuiMoveAbilitySet, SuiMoveNormalizedType } from '@mysten/sui.js/client';

describe('Sui Parser', () => {
  it('isHexadecimal', async () => {
    console.log(isHexadecimal('abcd'));
  });

  it('suiTypeName', () => {
    const t: SuiMoveNormalizedType = {
      Vector: {
        Vector: 'U8',
      },
    };

    const str = suiTypeName(t);

    expect(str).toBe('Vector<Vector<U8>>');
  });

  it('suiTypeName Vector<Vector<0x1::string::String>>', () => {
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

    const str = suiTypeName(t);

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

  it('stringifySuiVectorElementType Vector<Vector<0x2::coin::TreasuryCap<0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED>>>', () => {
    const t = {
      Vector: {
        Vector: {
          Struct: {
            address: '0x2',
            module: 'coin',
            name: 'TreasuryCap',
            typeArguments: [
              {
                Struct: {
                  address: '0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7',
                  module: 'managed',
                  name: 'MANAGED',
                  typeArguments: [],
                },
              },
            ],
          },
        },
      },
    };

    const str = stringifySuiVectorElementType(t);

    expect(str).toBe(
      '0x2::coin::TreasuryCap<0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED>',
    );
  });

  it('suiTypeName type parameter', () => {
    const t = {
      MutableReference: {
        Struct: {
          address: '0x2',
          module: 'coin',
          name: 'TreasuryCap',
          typeArguments: [
            {
              Struct: {
                address: '0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7',
                module: 'managed',
                name: 'MANAGED',
                typeArguments: [],
              },
            },
          ],
        },
      },
    };

    const str = suiTypeName(t);
    expect(str).toBe(
      '0x2::coin::TreasuryCap<0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED>',
    );
  });

  it('suiTypeName vector with type parameter', () => {
    const t = {
      Vector: {
        Struct: {
          address: '0x2',
          module: 'coin',
          name: 'TreasuryCap',
          typeArguments: [
            {
              Struct: {
                address: '0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7',
                module: 'managed',
                name: 'MANAGED',
                typeArguments: [],
              },
            },
          ],
        },
      },
    };

    const str = suiTypeName(t);
    expect(str).toBe(
      'Vector<0x2::coin::TreasuryCap<0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED>>',
    );

    const str2 = stringifySuiVectorType(t);
    expect(str2).toBe(
      'Vector<0x2::coin::TreasuryCap<0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED>>',
    );
  });

  it('suiTypeName vector vector with type parameter', () => {
    const t = {
      Vector: {
        Vector: {
          Struct: {
            address: '0x2',
            module: 'coin',
            name: 'TreasuryCap',
            typeArguments: [
              {
                Struct: {
                  address: '0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7',
                  module: 'managed',
                  name: 'MANAGED',
                  typeArguments: [],
                },
              },
            ],
          },
        },
      },
    };
    const str = suiTypeName(t);
    expect(str).toBe(
      'Vector<Vector<0x2::coin::TreasuryCap<0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED>>>',
    );

    const str2 = stringifySuiVectorType(t);
    expect(str2).toBe(
      'Vector<Vector<0x2::coin::TreasuryCap<0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED>>>',
    );
  });

  it('suiTypeName vector with type parameter list', () => {
    const t = {
      Vector: {
        Vector: {
          Struct: {
            address: '0x2',
            module: 'coin',
            name: 'TreasuryCap',
            typeArguments: [
              {
                Struct: {
                  address: '0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7',
                  module: 'managed',
                  name: 'MANAGED',
                  typeArguments: [],
                },
              },
              {
                Struct: {
                  address: '0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7',
                  module: 'managed',
                  name: 'MANAGED2',
                  typeArguments: [],
                },
              },
            ],
          },
        },
      },
    };
    const str = suiTypeName(t);
    expect(str).toBe(
      'Vector<Vector<0x2::coin::TreasuryCap<0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED, 0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED2>>>',
    );

    const str2 = stringifySuiVectorType(t);
    expect(str2).toBe(
      'Vector<Vector<0x2::coin::TreasuryCap<0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED, 0x9f375eded10883abdb3e93073335f4078397cdc456dd766f8baddc0fc1a6b6e7::managed::MANAGED2>>>',
    );
  });

  it('suiTypeName typeParameters', () => {
    const t = {
      Struct: {
        address: '0x9db36de17260e18c279bf13ffbc4eb5535ff9b58eba2b64c3322652f86975b85',
        module: 'auction_lib',
        name: 'Auction',
        typeArguments: [
          {
            TypeParameter: 0,
          },
        ],
      },
    };
    const typeParameters: SuiMoveAbilitySet[] = [
      {
        abilities: ['Store', 'Key'],
      },
    ];

    const str = suiTypeName(t, typeParameters);
    expect(str).toBe(
      '0x9db36de17260e18c279bf13ffbc4eb5535ff9b58eba2b64c3322652f86975b85::auction_lib::Auction<T0: Store + Key>',
    );
  });
});
