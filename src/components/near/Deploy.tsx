import React, { useState } from 'react';
import { Form, InputGroup, Button, Card } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';
import { Near, utils, providers } from 'near-api-js';
import { AccountView } from 'near-api-js/lib/providers/provider';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import ConfirmModal from './Modal';
import { DeployOption, RowData } from './DeployOption';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { Provider } from './WalletRpcProvider';
import { deployContract } from './utils/deployContract';
import { log } from '../../utils/logger';

interface InterfaceProps {
  wasm: string;
  walletRpcProvider: providers.WalletRpcProvider | undefined;
  providerProxy: Provider | undefined;
  nearConfig: Near | undefined;
  parser: Function;
  client: Client<Api, Readonly<IRemixApi>>;
  json?: string;
  account: { address: string; pubKey: string };
}

export const Deploy: React.FunctionComponent<InterfaceProps> = ({
  client,
  wasm,
  walletRpcProvider,
  providerProxy,
  nearConfig,
  parser,
  json,
  account,
}) => {
  const [receiverID, setReceiverID] = useState<string>('');
  const [inProgress, setInProgress] = useState<boolean>(false);
  const [check, setCheck] = useState<boolean>(false);
  const [deployIconSpin, setDeployIconSpin] = useState<string>('');
  const [rowsData, setRowsData] = useState<RowData[]>([]);
  const [initFunction, setInitFunction] = useState<string>('');
  const [initDeposit, setInitDeposit] = useState<number>(0);
  const [units, setUnits] = useState<string>('NEAR');

  const checkExistContract = async () => {
    if (!walletRpcProvider) {
      throw new Error('Wallet is not installed');
    }
    if (!providerProxy) {
      throw new Error('Wallet Connect failed. Please click reload button');
    }

    const network =
      nearConfig?.config.networkId === 'mainnet' ? 'near' : nearConfig?.config.networkId;

    if (receiverID.trim().split('.')[receiverID.split('.').length - 1] !== network) {
      await client.terminal.log({ type: 'error', value: 'Invalidate Account ID' });
      setInProgress(false);
      throw new Error('Invalidate Account ID');
    }

    const state = await walletRpcProvider.query<AccountView>({
      request_type: 'view_account',
      account_id: receiverID,
      finality: 'optimistic',
    });

    if (state.code_hash !== '11111111111111111111111111111111') {
      setCheck(true);
    } else {
      await dsrvProceed();
    }
  };

  const dsrvProceed = async () => {
    setInProgress(true);
    sendCustomEvent('deploy', {
      event_category: 'near',
      method: 'deploy',
    });
    try {
      if (!nearConfig) {
        throw new Error('NEAR Connect Error');
      }
      if (!providerProxy || !walletRpcProvider) {
        throw new Error('Wallet Connect failed. Please click reload button');
      }
      setDeployIconSpin('fa-spin');
      const rpcUrl = nearConfig.config.nodeUrl;
      let receipt: providers.FinalExecutionOutcome | undefined;

      if (initFunction) {
        if (rowsData.length === 0) {
          throw new Error('Must add initialization arguments');
        }
        const params = {} as any;
        rowsData.forEach((row: RowData) => {
          switch (row.type) {
            case 'String':
              params[row.field] = String(row.value);
              break;
            case 'Number':
              params[row.field] = Number(row.value);
              break;
            case 'Boolean':
              params[row.field] = Boolean(row.value);
              break;
            case 'JSON':
              params[row.field] = JSON.parse(row.value);
              break;
          }
        });

        let deposit = initDeposit.toString();
        if (units === 'NEAR') {
          const parseNearAmount = utils.format.parseNearAmount(deposit);
          if (!parseNearAmount) {
            deposit = '';
          } else {
            deposit = parseNearAmount;
          }
        }
        receipt = await deployContract(
          rpcUrl,
          account,
          walletRpcProvider,
          wasm,
          receiverID,
          client,
          nearConfig,
          initFunction,
          params,
          deposit,
        );
      } else {
        receipt = await deployContract(
          rpcUrl,
          account,
          walletRpcProvider,
          wasm,
          receiverID,
          client,
          nearConfig,
        );
      }
      if (receipt) {
        parser(receipt.transaction.receiver_id, json);
      }
      setInProgress(false);
      setDeployIconSpin('');
    } catch (e: any) {
      setInProgress(false);
      setDeployIconSpin('');
      log.error(e);
      await client.terminal.log({ type: 'error', value: e?.message?.toString() });
    }
  };

  return (
    <>
      <Card>
        <Card.Header className="p-2">
          Deploy <FaSyncAlt className={deployIconSpin} />
        </Card.Header>
        <Card.Body className="py-1 px-2">
          {check ? (
            <>
              <ConfirmModal setCheck={setCheck} dsrvProceed={dsrvProceed} />
            </>
          ) : (
            false
          )}
          <DeployOption
            setRowsData={setRowsData}
            rowsData={rowsData}
            setInitFunction={setInitFunction}
            setInitDeposit={setInitDeposit}
            setUnits={setUnits}
          />
          <InputGroup className="mb-3">
            <Form.Control
              type="text"
              placeholder="receiver_id"
              size="sm"
              onChange={(e) => {
                setReceiverID(e.target.value.trim());
              }}
            />

            <Button
              variant="warning"
              size="sm"
              onClick={async () => {
                await checkExistContract();
              }}
              disabled={inProgress}
            >
              <small>Deploy</small>
            </Button>
          </InputGroup>
        </Card.Body>
      </Card>
    </>
  );
};
