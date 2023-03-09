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
import { aptosNodeUrl } from './aptos-helper';
import { TextEncoder } from 'util';
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
    console.log(vectorU64.value.value.constructor.name);
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
});
