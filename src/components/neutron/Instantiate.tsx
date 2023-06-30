import React, { Dispatch, useEffect, useState } from 'react';
import { Button, Form as ReactForm } from 'react-bootstrap';
import { Contract } from './Contract';
import { calculateFee, GasPrice, StargateClient } from '@cosmjs/stargate';
import { toBase64, toUtf8 } from '@cosmjs/encoding';
import { EncodeObject } from '@cosmjs/proto-signing';
import { log } from '../../utils/logger';
import { Decimal } from '@cosmjs/math';

import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { simulate } from './neutron-helper';

import { MsgInstantiateContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';

export interface MsgInstantiateContractEncodeObject extends EncodeObject {
  readonly typeUrl: '/cosmwasm.wasm.v1.MsgInstantiateContract';
  readonly value: Partial<MsgInstantiateContract>;
}

interface InterfaceProps {
  dapp: any;
  wallet: string;
  codeID: string;
  client: any;
  setCodeID: Dispatch<React.SetStateAction<string>>;
  fund: number;
  gasPrice: number;
  schemaInit: { [key: string]: any };
  schemaExec: { [key: string]: any };
  schemaQuery: { [key: string]: any };
  account: string;
  timestamp: string;
}

export interface NeutronDeployHistoryCreateDto {
  chainId: string;
  account: string;
  codeId: string;
  contractAddress: string;
  isImmutable: boolean;
  compileTimestamp: number | null;
  deployTimestamp: number | null;
  txHash: string;
  isSrcUploaded: boolean;
  isRemix: boolean;
  oldVersion: string | null;
  currentVersion: string | null;
  verificationStatus: string | null;
  createdBy: string;
}

export const Instantiate: React.FunctionComponent<InterfaceProps> = ({
  client,
  dapp,
  codeID,
  setCodeID,
  fund,
  gasPrice,
  schemaInit,
  schemaExec,
  schemaQuery,
  account,
  timestamp,
}) => {
  const [initMsgErr, setInitMsgErr] = useState('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [param, setParams] = useState({});

  useEffect(() => {
    setContractAddress('');
  }, [codeID]);

  useEffect(() => {
    setParams({});
  }, [schemaInit]);

  const instantiate = async () => {
    setContractAddress('');

    if (!dapp) {
      return;
    }

    dapp
      .request('neutron', {
        method: 'dapp:accounts',
      })
      .then(async (result: any) => {
        log.debug(result);
        log.debug('account', result['neutron'].address);
        log.debug('publicKey', result['neutron'].pubKey);

        log.debug('sendTx');
        try {
          // mainnet or testnet
          const cid = dapp.networks.neutron.chain;

          let rpcUrl = 'https://neutron-node.welldonestudio.io/';
          let denom = 'untrn';
          if (cid === 'mainnet') {
            rpcUrl = 'https://rpc-kralum.neutron-1.neutron.org';
            denom = 'untrn';
          }

          const stargateClient = await StargateClient.connect(rpcUrl);
          log.debug(stargateClient);

          const response = await stargateClient.getSequence(result['neutron'].address);
          log.debug(`@@@ response=${JSON.stringify(response, null, 2)}`);
          log.debug(`@@@ sequence=${response.sequence}, accountNumber=${response.accountNumber}`);

          const chainId = await stargateClient.getChainId();
          log.debug('chainId: ' + chainId);
          log.debug('fund: ' + fund);

          const funds = fund ? [{ denom, amount: fund.toString() }] : [];

          const instantiateContractMsg: MsgInstantiateContractEncodeObject = {
            typeUrl: '/cosmwasm.wasm.v1.MsgInstantiateContract',
            value: {
              sender: result['neutron'].address,
              admin: result['neutron'].address,
              codeId: parseInt(codeID) as any,
              label: 'contract init',
              msg: toBase64(toUtf8(JSON.stringify(param))) as any,
              funds,
            },
          };

          log.debug(`instantiateContractMsg=${JSON.stringify(instantiateContractMsg, null, 2)}`);

          const memo = undefined;
          const gasEstimation = await simulate(
            stargateClient,
            [instantiateContractMsg],
            memo,
            result['neutron'].pubKey,
            response.sequence,
          );
          log.debug('@@@ gasEstimation', gasEstimation);
          log.debug('@@@ gasPrice', gasPrice);
          log.debug('@@@ denom', gasEstimation);

          const gas = new GasPrice(Decimal.fromUserInput(gasPrice.toString(), 18), denom);

          // const multiplier = 1.3;
          // const usedFee = calculateFee(Math.round(gasEstimation * multiplier), gas);
          const usedFee = calculateFee(Number(gasEstimation), gas);
          log.debug('@@@ usedFee', usedFee);

          const rawTx = {
            account_number: response.accountNumber,
            chain_id: chainId,
            sequence: response.sequence,
            fee: usedFee,
            msgs: [instantiateContractMsg],
          };

          log.debug(`rawTx=${JSON.stringify(rawTx, null, 2)}`);

          const res = await dapp.request('neutron', {
            method: 'dapp:signAndSendTransaction',
            params: [JSON.stringify(rawTx)],
          });

          log.debug(res);
          log.info('!!! instantiate', JSON.stringify(res, null, 2));
          const txHash = res[0];
          const contract = await waitGetContract(txHash);
          const admin = instantiateContractMsg.value.admin;
          if (contract) {
            const neutronDeployHistoryCreateDto: NeutronDeployHistoryCreateDto = {
              chainId: dapp.networks.neutron.chain,
              account: account,
              codeId: codeID,
              contractAddress: contract as string,
              isImmutable: admin === undefined || admin === null || admin.trim().length === 0,
              compileTimestamp: Number(timestamp),
              deployTimestamp: null, //todo
              txHash: txHash,
              isSrcUploaded: true, // todo
              isRemix: true,
              oldVersion: '', // todo
              currentVersion: '', // todo
              verificationStatus: null,
              createdBy: 'REMIX',
            };
            try {
              const res = await axios.post(
                COMPILER_API_ENDPOINT + '/neutron-deploy-histories',
                neutronDeployHistoryCreateDto,
              );
              log.info(`neutron-deploy-histories api res`, res);
            } catch (e) {
              log.error(`neutron-deploy-histories api error`);
            }
          }

          log.debug('contract address', contract);
          setContractAddress(contract as any);
          await client.terminal.log({ type: 'info', value: `contract address is ${contract}` });
        } catch (error: any) {
          log.error(error);
          await client.terminal.log({ type: 'error', value: error?.message?.toString() });
        }
      });
  };

  const waitGetContract = async (hash: string) => {
    const cid = dapp.networks.neutron.chain;

    let rpcUrl = 'https://neutron-node.welldonestudio.io/';
    if (cid === 'mainnet') {
      rpcUrl = 'https://rpc-kralum.neutron-1.neutron.org';
    }

    const stargateClient = await StargateClient.connect(rpcUrl);

    return new Promise(function (resolve) {
      const id = setInterval(async function () {
        const result = await stargateClient.getTx(hash);
        if (!result) {
          // setInitMsgErr(`Not found transaction ${hash}`);
          // clearInterval(id);
          // resolve('');
          waitGetContract(hash);
          return;
        }
        log.info('!!! waitGetContract', JSON.stringify(result, null, 2));

        if (result.code !== 0) {
          log.debug(`rawLog=${result?.rawLog}`);
          setInitMsgErr(result?.rawLog || '');
          clearInterval(id);
          resolve('');
          return;
        }

        const contractAddress = JSON.parse(result.rawLog)[0].events[0].attributes[0].value;
        resolve(contractAddress);
        clearInterval(id);
      }, 2000);
    });
  };

  const changeCodeID = (e: { target: { value: any } }) => {
    setCodeID(e.target.value);
  };

  const handleChange = ({ formData }: any) => {
    setParams(formData);
  };

  return (
    <div>
      <ReactForm.Group>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'start',
            margin: '0.3em 0.3em',
          }}
        >
          <div style={{ marginRight: '1em', fontSize: '11px' }} className="mb-1">
            Code ID
          </div>
          <ReactForm.Control
            type="number"
            placeholder="code_id"
            size="sm"
            value={codeID}
            onChange={changeCodeID}
            readOnly
          />
        </div>
        <hr />
        {codeID && (
          <>
            <div style={{ padding: '0.2em' }}>
              <Form
                schema={schemaInit}
                validator={validator}
                onChange={handleChange}
                formData={param || {}}
              >
                <div>
                  {codeID && (
                    <Button
                      type="submit"
                      variant="warning"
                      onClick={instantiate}
                      className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
                      disabled={!codeID}
                    >
                      <span>Instantiate</span>
                    </Button>
                  )}
                </div>
              </Form>
              {initMsgErr && (
                <span
                  style={{
                    marginRight: '1em',
                    fontSize: '11px',
                    color: 'red',
                    wordBreak: 'break-all',
                  }}
                  className="mb-1"
                >
                  {initMsgErr}
                </span>
              )}
            </div>
          </>
        )}
      </ReactForm.Group>
      <ReactForm.Group>
        {contractAddress && (
          <ReactForm.Label style={{ wordBreak: 'break-all' }} className="my-1">
            Contract Address : {contractAddress}
          </ReactForm.Label>
        )}
      </ReactForm.Group>
      {contractAddress ? (
        <Contract
          contractAddress={contractAddress || ''}
          dapp={dapp}
          client={client}
          fund={fund}
          gasPrice={gasPrice}
          schemaExec={schemaExec}
          schemaQuery={schemaQuery}
        />
      ) : (
        <></>
      )}
    </div>
  );
};
