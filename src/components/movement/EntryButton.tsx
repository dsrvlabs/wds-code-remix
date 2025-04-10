import React, { useEffect, useRef, useState } from 'react';
import {
  movementNodeUrl,
  ArgTypeValuePair,
  dappTxn,
  getEstimateGas,
  genPayload,
  serializedArgs,
} from './movement-helper';
import { AptosClient, HexString, TxnBuilderTypes, Types } from 'aptos';
import { Button } from 'react-bootstrap';
import { log } from '../../utils/logger';

interface Props {
  accountId: string;
  dapp: any;
  atAddress: string;
  targetModule: string;
  moveFunction: Types.MoveFunction | undefined;
  genericParameters: string[];
  parameters: ArgTypeValuePair[];
  entryEstimatedGas?: string;
  setEntryEstimatedGas: Function;
  entryGasUnitPrice: string;
  setEntryGasUnitPrice: Function;
  entryMaxGasAmount: string;
  setEntryMaxGasAmount: Function;
}

type Arg = string | Arg[];

const EntryButton: React.FunctionComponent<Props> = ({
  accountId,
  dapp,
  atAddress,
  targetModule,
  moveFunction,
  genericParameters,
  parameters,
  entryEstimatedGas,
  setEntryEstimatedGas,
  entryGasUnitPrice,
  setEntryGasUnitPrice,
  entryMaxGasAmount,
  setEntryMaxGasAmount,
}) => {
  const gasRef = useRef<{
    entryEstimatedGas: string | undefined;
    entryGasUnitPrice: string;
    entryMaxGasAmount: string;
  }>({ entryEstimatedGas: undefined, entryGasUnitPrice: '0', entryMaxGasAmount: '0' });
  const [entryEstimatedGas_, setEntryEstimatedGas_] = useState<string | undefined>(
    entryEstimatedGas,
  );
  const [entryGasUnitPrice_, setEntryGasUnitPrice_] = useState<string>(entryGasUnitPrice);
  const [entryMaxGasAmount_, setEntryMaxGasAmount_] = useState<string>(entryMaxGasAmount);

  useEffect(() => {
    setEntryEstimatedGas_(entryEstimatedGas);
    setEntryGasUnitPrice_(entryGasUnitPrice);
    setEntryMaxGasAmount_(entryMaxGasAmount);
    setEntryEstimatedGas(entryEstimatedGas);
    setEntryGasUnitPrice(entryGasUnitPrice);
    setEntryMaxGasAmount(entryMaxGasAmount);
    gasRef.current = {
      entryEstimatedGas: undefined,
      entryGasUnitPrice: '0',
      entryMaxGasAmount: '0',
    };
  }, [moveFunction]);

  const entry = async (gasUnitPrice: string, maxGasAmount: string) => {
    log.info('parameters', JSON.stringify(parameters, null, 2));
    const refinedParameters = parameters.map((p) => {
      if (p.type !== 'vector<u8>') {
        return p;
      }

      return {
        type: p.type,
        val: Buffer.from(p.val, 'hex'),
      };
    });
    log.info('refinedParameters', JSON.stringify(refinedParameters, null, 2));

    const serializedArgs_ = serializedArgs(refinedParameters);
    log.info('serializedArgs_', JSON.stringify(serializedArgs_, null, 2));
    const dappTxn_ = await dappTxn(
      accountId,
      dapp.networks.movement.chain,
      atAddress + '::' + targetModule,
      moveFunction?.name || '',
      genericParameters.map((typeTag) => TxnBuilderTypes.StructTag.fromString(typeTag)),
      serializedArgs_, // serializedArgs_,
      dapp,
      gasUnitPrice,
      maxGasAmount,
    );

    const txHash = await dapp.request('movement', {
      method: 'dapp:signAndSendTransaction',
      params: [dappTxn_],
    });
    log.debug(`@@@ txHash=${txHash}`);
  };

  return (
    <Button
      style={{ marginTop: '10px', minWidth: '70px' }}
      variant="primary"
      size="sm"
      onClick={async () => {
        if (!gasRef.current.entryEstimatedGas) {
          const movementClient = new AptosClient(movementNodeUrl(dapp.networks.movement.chain));
          // pubKey가 없는 경우 기본값 사용
          const pubKey =
            dapp.networks.movement.account?.pubKey ||
            '0x0000000000000000000000000000000000000000000000000000000000000000';

          const rawTransaction = await movementClient.generateRawTransaction(
            new HexString(accountId),
            genPayload(
              atAddress + '::' + targetModule,
              moveFunction?.name || '',
              genericParameters.map((typeTag) => TxnBuilderTypes.StructTag.fromString(typeTag)),
              serializedArgs(parameters),
            ),
          );
          const estimatedGas = await getEstimateGas(
            movementNodeUrl(dapp.networks.movement.chain),
            pubKey,
            rawTransaction,
          );
          setEntryEstimatedGas_(estimatedGas.gas_used);
          setEntryGasUnitPrice_(estimatedGas.gas_unit_price);
          setEntryMaxGasAmount_(estimatedGas.gas_used);

          setEntryEstimatedGas(estimatedGas.gas_used);
          setEntryGasUnitPrice(estimatedGas.gas_unit_price);
          setEntryMaxGasAmount(estimatedGas.gas_used);
          gasRef.current = {
            entryEstimatedGas: estimatedGas.gas_used,
            entryGasUnitPrice: estimatedGas.gas_unit_price,
            entryMaxGasAmount: estimatedGas.gas_used,
          };
          await entry(gasRef.current.entryGasUnitPrice, gasRef.current.entryMaxGasAmount);
          return;
        }

        await entry(entryGasUnitPrice, entryMaxGasAmount);
      }}
    >
      <small>{moveFunction?.name}</small>
    </Button>
  );
};

export default EntryButton;
