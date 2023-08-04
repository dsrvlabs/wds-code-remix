/**
 * @group unit
 */

// @ts-ignore
// import {ArgsAbi} from './ArgsAbi';
import {
  AptosClient,
  BCS,
  HexString,
  TransactionBuilder,
  TxnBuilderTypes,
  Types,
  TypeTagParser,
} from 'aptos';
import {
  aptosNodeUrl,
  extractVectorElementTypeTag,
  getVectorArgTypeStr,
  shortHex,
} from './aptos-helper';
import { TextEncoder } from 'util';
import { serializeArg } from './transaction_builder/builder_utils';
global.TextEncoder = TextEncoder;
// require('../../../jest.config');

describe('Aptos Helper', () => {
  // it('argsParams', () => {
  //   const CREATE_TICKET_ABI =
  //     '010D6372656174655F7469636B6574B1CD6D72F73F4B38EBE108CE6A7E47FDD86C983CE34709283F19ED34AB135719075469636B65747300000403726F7707000000000000000000000000000000000000000000000000000000000000000106737472696E6706537472696E67000B736561745F6E756D626572020B7469636B65745F636F646507000000000000000000000000000000000000000000000000000000000000000106737472696E6706537472696E670005707269636502';
  //   const argsAbi = new ArgsAbi(CREATE_TICKET_ABI);
  //   console.log(argsAbi.argsParams());
  // });

  it('view balance', async () => {
    const payload: Types.ViewRequest = {
      function: '0x1::coin::balance',
      type_arguments: ['0x1::aptos_coin::AptosCoin'],
      arguments: ['0x61a6c5dfe2d61907e2daf4bc843590561873cadf36f091414239b9b1933fbe1f'],
    };

    const aptosClient = new AptosClient(aptosNodeUrl('testnet'));
    const balance = await aptosClient.view(payload);

    console.log(balance[0]);
  });

  it('view get_message', async () => {
    const payload: Types.ViewRequest = {
      function:
        '0x61a6c5dfe2d61907e2daf4bc843590561873cadf36f091414239b9b1933fbe1f::message::get_message',
      type_arguments: [],
      arguments: ['0x61a6c5dfe2d61907e2daf4bc843590561873cadf36f091414239b9b1933fbe1f'],
    };

    const aptosClient = new AptosClient(aptosNodeUrl('testnet'));
    const results = await aptosClient.view(payload);

    console.log(results);
  });

  it('serialize vector', async () => {
    const el1 = HexString.fromUint8Array(BCS.bcsSerializeStr('abc')).hex();
    const el2 = HexString.fromUint8Array(BCS.bcsSerializeUint64(23)).hex();
    const el3 = HexString.fromUint8Array(
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex('0x2')),
    ).hex();

    console.log(el1);
    console.log(el2);
    console.log(el3);
    const vector = [el1, el2, el3];
    const serializer = new BCS.Serializer();
    serializer.serializeU32AsUleb128(vector.length);
    vector.forEach((hexStr) => {
      const uint8Arr = new HexString(hexStr).toUint8Array();
      serializer.serializeBytes(uint8Arr);
    });

    const vectorArg = serializer.getBytes();
    console.log(HexString.fromUint8Array(vectorArg).hex());

    // 03
    // 04 03616263
    // 08 1700000000000000
    // 20 0000000000000000000000000000000000000000000000000000000000000002
  });

  it('typetag', async () => {
    const vectorU64: any = new TypeTagParser(' vector < vector<u8> > ').parseTypeTag();
    // console.log(vectorU64.value.value.constructor.name);
    console.log(vectorU64.value.constructor.name);
    console.log(vectorU64.value.value.value);
  });

  it('extractVectorTypeTagName', async () => {
    const tagName = extractVectorElementTypeTag(' vector < vector<u8> > ');
    console.log(tagName);
  });

  it('parseTypeTag', async () => {
    const parser = new TypeTagParser(' vector < vector<u8> > ');
    console.log(parser.parseTypeTag());
  });

  it('getVectorArgTypeStr vector < vector<u8> >', async () => {
    const vecElTypeName = getVectorArgTypeStr(' vector < vector<u8> > ');
    console.log(vecElTypeName);
    expect(vecElTypeName).toBe('u8');
  });

  it('serial vector<vector<u8>>', async () => {
    console.log(`@@@ vector<vector<u8>>`);
    const arg = '61,62,63';
    const hexStrs = arg.split(',');
    const serializer = new BCS.Serializer();
    serializer.serializeU32AsUleb128(hexStrs.length);
    hexStrs.forEach((hexStr: string) => {
      const uint8Arr = new HexString(hexStr).toUint8Array();
      serializer.serializeBytes(uint8Arr);
    });
    console.log(serializer.getBytes());
  });

  it('serializeArg vector<vector<u8>>', async () => {
    console.log(`@@@ vector<vector<u8>>`);
    const ser = new BCS.Serializer();

    const argVal = [[97, 98, 99]];
    const typeTag = new TxnBuilderTypes.TypeTagVector(
      new TxnBuilderTypes.TypeTagVector(new TxnBuilderTypes.TypeTagU8()),
    );
    console.log(typeTag);
    serializeArg(argVal, typeTag, ser);
    console.log(ser.getBytes());
  });

  it('serializeArg 0x1::string:String', async () => {
    const ser = new BCS.Serializer();
    const argVal = 'abc';
    const typeTag = new TxnBuilderTypes.TypeTagStruct(
      new TxnBuilderTypes.StructTag(
        TxnBuilderTypes.AccountAddress.fromHex('0x1'),
        new TxnBuilderTypes.Identifier('string'),
        new TxnBuilderTypes.Identifier('String'),
        [],
      ),
    );
    console.log(typeTag);
    serializeArg(argVal, typeTag, ser);
    console.log(ser.getBytes());
  });

  it('serializeArg address', async () => {
    const ser = new BCS.Serializer();
    const argVal = '1';
    const typeTag = new TxnBuilderTypes.TypeTagAddress();
    console.log(typeTag);
    serializeArg(argVal, typeTag, ser);
    console.log(ser.getBytes());
  });

  it('bcsSerializeStr abc', async () => {
    console.log(BCS.bcsSerializeStr('abc'));
  });

  it('getVectorArgTypeStr vector < vector<0x1::string::String> >', async () => {
    const vecElTypeName = getVectorArgTypeStr(' vector < vector<0x1::string::String> > ');
    console.log(vecElTypeName);
    expect(vecElTypeName).toBe('0x1::string::String');
  });

  it('serializeArg', async () => {
    const arg = [
      [1, 1],
      [2, 2, 2],
    ];
    const vectorU64: any = new TypeTagParser(' vector < vector<u8> > ').parseTypeTag();
    console.log(vectorU64.value.value.constructor.name);
  });

  it('isArray', async () => {
    console.log(Array.isArray('abc'));
  });

  it('split', async () => {
    const id = 'vec-arg-add-';
    console.log(`id`, id);
    const indices = id
      .slice('vec-arg-add-'.length)
      .split('-')
      .filter((str) => str.trim() !== '')
      .map((i) => Number(i));

    console.log('indices', indices);
  });

  it('shortHex 0 prefix', async () => {
    const addr = '0x0c64dfb1957dcf3ef7538b88816c0b0fdb212bf71ad09b3eed277bf788f9394d';
    const result = shortHex(addr);
    console.log(result);
  });

  it('shortHex 0 prefix without 0x', async () => {
    const addr = '0c64dfb1957dcf3ef7538b88816c0b0fdb212bf71ad09b3eed277bf788f9394d';
    const result = shortHex(addr);
    console.log(result);
  });

  it('shortHex full', async () => {
    const addr = '0xac64dfb1957dcf3ef7538b88816c0b0fdb212bf71ad09b3eed277bf788f9394d';
    const result = shortHex(addr);
    console.log(result);
  });

  it('shortHex without 0x', async () => {
    const addr = 'ac64dfb1957dcf3ef7538b88816c0b0fdb212bf71ad09b3eed277bf788f9394d';
    const result = shortHex(addr);
    console.log(result);
  });
});
