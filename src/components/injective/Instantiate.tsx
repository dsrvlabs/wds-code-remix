import React, { Dispatch, useEffect, useState } from 'react';
import { TxRestClient, MsgInstantiateContract, MsgMigrateContract } from '@injectivelabs/sdk-ts';
import { ChainId } from '@injectivelabs/ts-types';
import { Network, getNetworkEndpoints } from '@injectivelabs/networks';
import { log } from '../../utils/logger';
import { Button, Form as ReactForm } from 'react-bootstrap';
import { CustomTooltip } from '../common/CustomTooltip';

import Form from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Contract } from './Contract';
import { useWalletStore } from './WalletContextProvider';
import axios from 'axios';
import { INJECTIVE_COMPILER_CONSUMER_API_ENDPOINT } from '../../const/endpoint';
import { BigNumberInBase } from '@injectivelabs/utils';

interface InterfaceProps {
  compileTarget: string;
  codeID: string;
  client: any;
  setCodeID: Dispatch<React.SetStateAction<string>>;
  fund: number;
  schemaInit: { [key: string]: any };
  schemaExec: { [key: string]: any };
  schemaQuery: { [key: string]: any };
  timestamp: string;
  checksum: string;
}

export interface InjectiveDeployHistoryCreateDto {
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
  compileTarget,
  client,
  codeID,
  setCodeID,
  fund,
  schemaInit,
  schemaExec,
  schemaQuery,
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
  const { injectiveAddress, chainId, injectiveBroadcastMsg } = useWalletStore();
  useEffect(() => {
    setContractAddress('');
    setCallMsg('Instantiate');
  }, [codeID]);

  useEffect(() => {
    setParams({});
  }, [schemaInit]);

  const getContract = async (hash: string) => {
    const endPoint = getNetworkEndpoints(
      chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
    );

    const txRestClient = new TxRestClient(endPoint.rest);
    return new Promise(async function (resolve) {
      const result = await txRestClient.fetchTxPoll(hash, 30000);
      if (result.code !== 0) {
        log.info(`rawLog=${JSON.stringify(result.events, null, 2)}`);
        setInitMsgErr(JSON.stringify(result.events, null, 2));
        resolve('');
        return;
      }
      let contractAddress;
      if (callMsg === 'Instantiate') {
        const instantiateEvent = result.events!.find((e: any) => e.type === 'instantiate');
        const attr = instantiateEvent?.attributes.find((a: any) => a.key === '_contract_address');
        contractAddress = attr?.value || '';
      } else if (callMsg === 'Migrate') {
        const migrateEvent = result.events!.find((e: any) => e.type === 'migrate');
        const attr = migrateEvent?.attributes.find((a: any) => a.key === '_contract_address');
        contractAddress = attr?.value || '';
      }
      resolve(contractAddress);
    });
  };
  
  const instantiateKeplr = async () => {
    try {
      const funds =
        fund === 0
          ? undefined
          : { denom: 'inj', amount: new BigNumberInBase(fund).toWei().toFixed() };
      const msg = MsgInstantiateContract.fromJSON({
        sender: injectiveAddress,
        admin: immutableChecked ? '' : injectiveAddress,
        codeId: parseInt(codeID),
        label: 'contract init',
        msg: param,
        amount: funds,
      });
      const txResult = await injectiveBroadcastMsg(msg, injectiveAddress);
      const contract = await getContract(txResult!.txHash);
      if (contract) {
        const injectiveDeployHistoryCreateDto: InjectiveDeployHistoryCreateDto = {
          chainId: chainId,
          account: injectiveAddress,
          codeId: codeID,
          contractAddress: contract as string,
          compileTimestamp: Number(timestamp),
          deployTimestamp: null,
          txHash: txResult!.txHash,
          checksum: checksum,
          isSrcUploaded: true,
          createdBy: 'REMIX',
        };
        try {
          const res = await axios.post(
            INJECTIVE_COMPILER_CONSUMER_API_ENDPOINT + '/injective/deploy-histories',
            injectiveDeployHistoryCreateDto,
          );
          log.info(`deploy-histories api res`, res);
        } catch (e) {
          log.error(`deploy-histories api error`);
        }
      }
      log.debug('Contract address:', contract);
      setContractAddress(contract as any);
      setDisabled(true);
      await client.terminal.log({ type: 'info', value: `Contract address is ${contract}` });
    } catch (error: any) {
      await client.terminal.log({ type: 'error', value: error?.message?.toString() });
    }
  };

  const migrateKeplr = async () => {
    try {
      const msg = MsgMigrateContract.fromJSON({
        sender: injectiveAddress,
        contract: migrateContractAddress,
        codeId: parseInt(codeID),
        msg: { new_format: 'new format description' },
      });
      const txResult = await injectiveBroadcastMsg(msg, injectiveAddress);
      await getContract(txResult!.txHash);
    } catch (error: any) {
      await client.terminal.log({ type: 'error', value: error?.message?.toString() });
    }
  };

  const changeCodeID = (e: { target: { value: any } }) => {
    setCodeID(e.target.value);
  };

  const changeMigrateContractAddress = (e: { target: { value: any } }) => {
    console.log(e.target.value);
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
                      onClick={instantiateKeplr}
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
                    onClick={migrateKeplr}
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
          compileTarget={compileTarget}
          contractAddress={contractAddress || ''}
          client={client}
          fund={fund}
          schemaExec={schemaExec}
          schemaQuery={schemaQuery}
        />
      ) : (
        <></>
      )}
    </div>
  );
};
