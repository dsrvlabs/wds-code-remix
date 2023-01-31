/**
 * @group unit
 */

// @ts-ignore
// import {ArgsAbi} from './ArgsAbi';
import {AptosClient, Types,} from 'aptos';
import {aptosNodeUrl} from './aptos-helper';

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
      function: '0x61a6c5dfe2d61907e2daf4bc843590561873cadf36f091414239b9b1933fbe1f::message::get_message',
      type_arguments: [],
      arguments: ["0x61a6c5dfe2d61907e2daf4bc843590561873cadf36f091414239b9b1933fbe1f"],
    };

    const aptosClient = new AptosClient(aptosNodeUrl('testnet'));
    const results = await aptosClient.view(payload);

    console.log(results);
  });
});
