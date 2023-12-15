import { defaultRegistryTypes } from '@cosmjs/stargate';
import { GeneratedType, Registry } from '@cosmjs/proto-signing';

import {
  MsgClearAdmin,
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgMigrateContract,
  MsgStoreCode,
  MsgUpdateAdmin,
} from 'cosmjs-types/cosmwasm/wasm/v1/tx';

export const wasmTypes: ReadonlyArray<[string, GeneratedType]> = [
  ['/cosmwasm.wasm.v1.MsgClearAdmin', MsgClearAdmin],
  ['/cosmwasm.wasm.v1.MsgExecuteContract', MsgExecuteContract],
  ['/cosmwasm.wasm.v1.MsgMigrateContract', MsgMigrateContract],
  ['/cosmwasm.wasm.v1.MsgStoreCode', MsgStoreCode],
  ['/cosmwasm.wasm.v1.MsgInstantiateContract', MsgInstantiateContract],
  ['/cosmwasm.wasm.v1.MsgUpdateAdmin', MsgUpdateAdmin],
];

export async function simulate(
  client: any,
  messages: readonly any[],
  memo: string | undefined,
  pubKey: string,
  sequence: number,
) {
  const registry = new Registry([...defaultRegistryTypes, ...wasmTypes]);
  const anyMsgs = messages.map((m) => registry.encodeAsAny(m));
  const simulateResult = await client.queryClient.tx.simulate(
    anyMsgs,
    memo,
    {
      type: 'tendermint/PubKeySecp256k1',
      value: pubKey,
    },
    `${sequence}`,
  );
  return simulateResult.gasInfo.gasUsed;
}

export function convertToRealChainId(chainId: string) {
  if (chainId === 'testnet') {
    return 'pion-1';
  }

  if (chainId === 'mainnet') {
    return 'neutron-1';
  }

  throw new Error(`Invalid chainId=${chainId}`);
}
