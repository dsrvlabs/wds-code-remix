import React, { Dispatch, useEffect, useState } from 'react';
import { Button, Form as ReactForm, InputGroup } from 'react-bootstrap';
import { Contract } from './Contract';
import { calculateFee, GasPrice, StargateClient } from '@cosmjs/stargate';
import { toBase64, toUtf8 } from '@cosmjs/encoding';
import { EncodeObject } from '@cosmjs/proto-signing';
import { log } from '../../utils/logger';
import { Decimal } from '@cosmjs/math';

import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { simulate } from './neutron-helper';

import { MsgInstantiateContract, MsgMigrateContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import axios from 'axios';

import { CustomTooltip } from '../common/CustomTooltip';
import { NEUTRON_COMPILER_CONSUMER_API_ENDPOINT } from '../../const/endpoint';

export interface MsgInstantiateContractEncodeObject extends EncodeObject {
  readonly typeUrl: '/cosmwasm.wasm.v1.MsgInstantiateContract';
  readonly value: Partial<MsgInstantiateContract>;
}

export interface MsgMigrateContractEncodeObject extends EncodeObject {
  readonly typeUrl: '/cosmwasm.wasm.v1.MsgMigrateContract';
  readonly value: Partial<MsgMigrateContract>;
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
  checksum: string;
}

export interface NeutronDeployHistoryCreateDto {
  chainId: string;
  account: string;
  codeId: string;
  contractAddress: string;
  checksum: string | null;
  compileTimestamp: number | null;
  deployTimestamp: number | null;
  txHash: string;
  isSrcUploaded: boolean;
  createdBy: string;
}

function convertToRealChainId(chainId: string) {
  if (chainId === 'testnet') {
    return 'pion-1';
  }

  if (chainId === 'mainnet') {
    return 'neutron-1';
  }

  throw new Error(`Invalid chainId=${chainId}`);
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
  checksum,
}) => {
  const [initMsgErr, setInitMsgErr] = useState('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [param, setParams] = useState({});
  const [callMsg, setCallMsg] = useState<string>('Instantiate');
  const [immutableChecked, setImmutableChecked] = useState(false);
  const [migrateContractAddress, setMigrateContractAddress] = useState<string>('');
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    setContractAddress('');
    setCallMsg('Instantiate');
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

          let rpcUrl = 'https://rpc-palvus.pion-1.ntrn.tech/';
          // let rpcUrl = 'https://neutron-node.welldonestudio.io/';

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
              admin: immutableChecked ? '' : result['neutron'].address,
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
          if (contract) {
            const neutronDeployHistoryCreateDto: NeutronDeployHistoryCreateDto = {
              chainId: convertToRealChainId(dapp.networks.neutron.chain),
              account: account,
              codeId: codeID,
              contractAddress: contract as string,
              compileTimestamp: Number(timestamp),
              deployTimestamp: null, //todo
              txHash: txHash,
              checksum: checksum,
              isSrcUploaded: true, // todo
              createdBy: 'REMIX',
            };
            try {
              const res = await axios.post(
                NEUTRON_COMPILER_CONSUMER_API_ENDPOINT + '/deploy-histories',
                neutronDeployHistoryCreateDto,
              );
              log.info(`deploy-histories api res`, res);
            } catch (e) {
              log.error(`deploy-histories api error`);
            }
          }

          log.debug('contract address', contract);
          setContractAddress(contract as any);
          setDisabled(true);
          await client.terminal.log({ type: 'info', value: `contract address is ${contract}` });
        } catch (error: any) {
          log.error(error);
          await client.terminal.log({ type: 'error', value: error?.message?.toString() });
        }
      });
  };

  const migrate = async () => {
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

          let rpcUrl = 'https://rpc-palvus.pion-1.ntrn.tech/';
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

          const migrateContractMsg: MsgMigrateContractEncodeObject = {
            typeUrl: '/cosmwasm.wasm.v1.MsgMigrateContract',
            value: {
              sender: result['neutron'].address,
              contract: migrateContractAddress,
              codeId: parseInt(codeID) as any,
              msg: toBase64(
                toUtf8(
                  JSON.stringify({
                    new_format: 'New Format Description',
                  }),
                ),
              ) as any,
            },
          };

          log.debug(`migrateContractMsg=${JSON.stringify(migrateContractMsg, null, 2)}`);

          const memo = undefined;
          const gasEstimation = await simulate(
            stargateClient,
            [migrateContractMsg],
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
            msgs: [migrateContractMsg],
          };

          log.debug(`rawTx=${JSON.stringify(rawTx, null, 2)}`);

          const res = await dapp.request('neutron', {
            method: 'dapp:signAndSendTransaction',
            params: [JSON.stringify(rawTx)],
          });

          log.debug(res);
          log.info('!!! migrateContractMsg', JSON.stringify(res, null, 2));
          const txHash = res[0];
          const contract = await waitGetContract(txHash);

          if (contract) {
            const neutronDeployHistoryCreateDto: NeutronDeployHistoryCreateDto = {
              chainId: convertToRealChainId(dapp.networks.neutron.chain),
              account: account,
              codeId: codeID,
              contractAddress: contract as string,
              compileTimestamp: Number(timestamp),
              deployTimestamp: null, //todo
              txHash: txHash,
              isSrcUploaded: true, // todo
              checksum: checksum,
              createdBy: 'REMIX',
            };
            try {
              const res = await axios.post(
                NEUTRON_COMPILER_CONSUMER_API_ENDPOINT + '/deploy-histories',
                neutronDeployHistoryCreateDto,
              );
              log.info(`deploy-histories api res`, res);
            } catch (e) {
              log.error(`deploy-histories api error`);
            }
          }

          log.debug('contract address', contract);
          setContractAddress(contract as any);
          setDisabled(true);
        } catch (e) {
          console.log(e);
        }
      });
  };

  const waitGetContract = async (hash: string) => {
    const cid = dapp.networks.neutron.chain;

    let rpcUrl = 'https://rpc-palvus.pion-1.ntrn.tech/';
    // let rpcUrl = 'https://neutron-node.welldonestudio.io/';

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
        console.log('!!! waitGetContract', result);

        if (result.code !== 0) {
          log.info(`rawLog=${JSON.stringify(result.events, null, 2)}`);
          setInitMsgErr(JSON.stringify(result.events, null, 2));
          clearInterval(id);
          resolve('');
          return;
        }

        let contractAddress;

        if (callMsg === 'Instantiate') {
          const instantiateEvent = result.events.find((e: any) => e.type === 'instantiate');
          const attr = instantiateEvent?.attributes.find((a: any) => a.key === '_contract_address');
          contractAddress = attr?.value || '';
        } else if (callMsg === 'Migrate') {
          const migrateEvent = result.events.find((e: any) => e.type === 'migrate');
          const attr = migrateEvent?.attributes.find((a: any) => a.key === '_contract_address');
          contractAddress = attr?.value || '';
        }
        resolve(contractAddress);
        clearInterval(id);
      }, 2000);
    });
  };

  const changeCodeID = (e: { target: { value: any } }) => {
    setCodeID(e.target.value);
  };

  const changeMigrateContractAddress = (e: { target: { value: any } }) => {
    setMigrateContractAddress(e.target.value);
  };

  const handleChange = ({ formData }: any) => {
    setParams(formData);
  };

  const handleCallMsg = (e: { target: { value: React.SetStateAction<string> } }) => {
    setCallMsg(e.target.value);
  };

  const handleCheckboxChange = (event: {
    target: { checked: boolean | ((prevState: boolean) => boolean) };
  }) => {
    setImmutableChecked(event.target.checked);
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
        <div style={{ marginRight: '1em', fontSize: '11px' }} className="mb-1">
          Method
        </div>
        <ReactForm.Control
          className="custom-select"
          as="select"
          value={callMsg}
          onChange={handleCallMsg}
          style={{ marginBottom: '10px' }}
          disabled={disabled}
        >
          <option value={'Instantiate'} key={1}>
            {'instantiate'}
          </option>
          <option value={'Migrate'} key={2}>
            {'migrate'}
          </option>
        </ReactForm.Control>
        {callMsg === 'Instantiate' ? (
          <div className="mb-2 form-check" style={{ marginTop: '10px' }}>
            <input
              type="checkbox"
              className="form-check-input"
              id="uploadCodeCheckbox"
              checked={immutableChecked}
              onChange={handleCheckboxChange}
            />
            <CustomTooltip
              placement="top"
              tooltipId="overlay-ataddresss"
              tooltipText="By checking here, this contract becomes immutable."
            >
              <label
                className="form-check-label"
                htmlFor="immutableCheckbox"
                style={{ verticalAlign: 'top' }}
              >
                Immutable
              </label>
            </CustomTooltip>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'start',
              marginTop: '10px',
            }}
          >
            <div style={{ marginRight: '1em', fontSize: '11px' }} className="mb-1">
              Target Contract Address
            </div>
            <ReactForm.Control
              placeholder=""
              size="sm"
              value={migrateContractAddress}
              onChange={changeMigrateContractAddress}
            />
          </div>
        )}

        {codeID && callMsg === 'Instantiate' ? (
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
        ) : (
          <>
            <div style={{ padding: '0.2em' }}>
              <div>
                {codeID && (
                  <Button
                    type="submit"
                    variant="warning"
                    onClick={migrate}
                    className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
                    disabled={!codeID}
                  >
                    <span>Migrate</span>
                  </Button>
                )}
              </div>
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
