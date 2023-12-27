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
import { simulate } from './juno-helper';

import { MsgInstantiateContract, MsgMigrateContract } from 'cosmjs-types/cosmwasm/wasm/v1/tx';
import axios from 'axios';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';

import { CustomTooltip } from '../common/CustomTooltip';

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

export interface JunoDeployHistoryCreateDto {
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
      .request('juno', {
        method: 'dapp:accounts',
      })
      .then(async (result: any) => {
        log.debug(result);
        log.debug('account', result['juno'].address);
        log.debug('publicKey', result['juno'].pubKey);

        log.debug('sendTx');
        try {
          // mainnet or testnet
          const cid = dapp.networks.juno.chain;

          let rpcUrl = 'https://uni-rpc.reece.sh/';
          let denom = 'ujunox';
          if (cid === 'juno') {
            rpcUrl = 'https://rpc-juno.itastakers.com';
            denom = 'ujuno';
          }

          const stargateClient = await StargateClient.connect(rpcUrl);
          log.debug(stargateClient);

          const response = await stargateClient.getSequence(result['juno'].address);
          log.debug(`@@@ response=${JSON.stringify(response, null, 2)}`);
          log.debug(`@@@ sequence=${response.sequence}, accountNumber=${response.accountNumber}`);

          const chainId = await stargateClient.getChainId();
          log.debug('chainId: ' + chainId);
          log.debug('fund: ' + fund);

          const funds = fund ? [{ denom, amount: fund.toString() }] : [];

          const instantiateContractMsg: MsgInstantiateContractEncodeObject = {
            typeUrl: '/cosmwasm.wasm.v1.MsgInstantiateContract',
            value: {
              sender: result['juno'].address,
              admin: immutableChecked ? '' : result['juno'].address,
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
            result['juno'].pubKey,
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

          const res = await dapp.request('juno', {
            method: 'dapp:signAndSendTransaction',
            params: [JSON.stringify(rawTx)],
          });

          log.debug(res);
          log.info('!!! instantiate', JSON.stringify(res, null, 2));
          const txHash = res[0];
          const contract = await waitGetContract(txHash);
          if (contract) {
            const junoDeployHistoryCreateDto: JunoDeployHistoryCreateDto = {
              chainId: dapp.networks.juno.chain,
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
                COMPILER_API_ENDPOINT + '/juno-deploy-histories',
                junoDeployHistoryCreateDto,
              );
              log.info(`juno-deploy-histories api res`, res);
            } catch (e) {
              log.error(`juno-deploy-histories api error`);
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
      .request('juno', {
        method: 'dapp:accounts',
      })
      .then(async (result: any) => {
        log.debug(result);
        log.debug('account', result['juno'].address);
        log.debug('publicKey', result['juno'].pubKey);

        log.debug('sendTx');
        try {
          // mainnet or testnet
          const cid = dapp.networks.juno.chain;

          let rpcUrl = 'https://uni-rpc.reece.sh/';
          let denom = 'ujunox';
          if (cid === 'juno') {
            rpcUrl = 'https://rpc-juno.itastakers.com';
            denom = 'ujuno';
          }

          const stargateClient = await StargateClient.connect(rpcUrl);
          log.debug(stargateClient);

          const response = await stargateClient.getSequence(result['juno'].address);
          log.debug(`@@@ response=${JSON.stringify(response, null, 2)}`);
          log.debug(`@@@ sequence=${response.sequence}, accountNumber=${response.accountNumber}`);

          const chainId = await stargateClient.getChainId();
          log.debug('chainId: ' + chainId);
          log.debug('fund: ' + fund);

          const funds = fund ? [{ denom, amount: fund.toString() }] : [];

          const migrateContractMsg: MsgMigrateContractEncodeObject = {
            typeUrl: '/cosmwasm.wasm.v1.MsgMigrateContract',
            value: {
              sender: result['juno'].address,
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
            result['juno'].pubKey,
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

          const res = await dapp.request('juno', {
            method: 'dapp:signAndSendTransaction',
            params: [JSON.stringify(rawTx)],
          });

          log.debug(res);
          log.info('!!! migrateContractMsg', JSON.stringify(res, null, 2));
          const txHash = res[0];
          const contract = await waitGetContract(txHash);

          if (contract) {
            const junoDeployHistoryCreateDto: JunoDeployHistoryCreateDto = {
              chainId: dapp.networks.juno.chain,
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
                COMPILER_API_ENDPOINT + '/juno-deploy-histories',
                junoDeployHistoryCreateDto,
              );
              log.info(`juno-deploy-histories api res`, res);
            } catch (e) {
              log.error(`juno-deploy-histories api error`);
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
    const cid = dapp.networks.juno.chain;

    let rpcUrl = 'https://uni-rpc.reece.sh/';
    if (cid === 'juno') {
      rpcUrl = 'https://rpc-juno.itastakers.com';
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
          log.debug(`rawLog=${result?.rawLog}`);
          setInitMsgErr(result?.rawLog || '');
          clearInterval(id);
          resolve('');
          return;
        }

        let contractAddress;

        if (callMsg === 'Instantiate') {
          contractAddress = JSON.parse(result.rawLog)[0].events[0].attributes[0].value;
        } else if (callMsg === 'Migrate') {
          contractAddress = JSON.parse(result.rawLog)[0].events[1].attributes[1].value;
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
