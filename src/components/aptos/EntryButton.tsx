import React, { useEffect, useRef, useState } from 'react';
import {
  aptosNodeUrl,
  ArgTypeValuePair,
  dappTxn,
  getEstimateGas,
  genPayload,
  serializedArgs,
} from './aptos-helper';
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
      dapp.networks.aptos.chain,
      atAddress + '::' + targetModule,
      moveFunction?.name || '',
      genericParameters.map((typeTag) => TxnBuilderTypes.StructTag.fromString(typeTag)),
      serializedArgs_, // serializedArgs_,
      dapp,
      gasUnitPrice,
      maxGasAmount,
    );

    const txHash = await dapp.request('aptos', {
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
          console.log(`!!!!!!!!!!!!!!!!!!!`);
          const aptosClient = new AptosClient(aptosNodeUrl(dapp.networks.aptos.chain));
          const rawTransaction = await aptosClient.generateRawTransaction(
            new HexString(accountId),
            genPayload(
              atAddress + '::' + targetModule,
              moveFunction?.name || '',
              genericParameters.map((typeTag) => TxnBuilderTypes.StructTag.fromString(typeTag)),
              serializedArgs(parameters),
            ),
          );
          const estimatedGas = await getEstimateGas(
            `https://fullnode.${dapp.networks.aptos.chain}.aptoslabs.com/v1`,
            dapp.networks.aptos.account.pubKey,
            rawTransaction,
          );
          console.log(`estimatedGas${JSON.stringify(estimatedGas, null, 2)}`);

          console.log(`gasRef.current=${JSON.stringify(gasRef.current, null, 2)}`);
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
