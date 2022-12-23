import React, { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import { Near, providers, utils } from 'near-api-js';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import wrapPromise from '../../utils/wrapPromise';
import { AddArguments, RowData } from './DeployOption';
import { Provider } from './WalletRpcProvider';
import { viewMethod } from './utils/viewMethod';
import { callMethod } from './utils/callMethod';
import { log } from '../../utils/logger';

interface InterfaceProps {
  walletRpcProvider: providers.WalletRpcProvider | undefined;
  providerProxy: Provider | undefined;
  nearConfig: Near | undefined;
  deployedContract: string;
  methods: Array<string>;
  client: Client<Api, Readonly<IRemixApi>>;
  account: { address: string; pubKey: string };
}

export const Contract: React.FunctionComponent<InterfaceProps> = ({
  client,
  walletRpcProvider,
  providerProxy,
  nearConfig,
  deployedContract,
  methods,
  account,
}) => {
  const [method, setMethods] = useState<string>(methods[0]);
  const [units, setUnits] = useState<string>('NEAR');
  const [deposit, setDeposit] = useState<number>(0);
  const [gasLimit, setGasLimit] = useState<number>(30000000000000);
  const [rowsData, setRowsData] = useState<RowData[]>([]);

  const view = async (methodName: string) => {
    try {
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
      if (!nearConfig) {
        throw new Error('NEAR Connect Error');
      }
      await viewMethod(nearConfig, deployedContract, methodName, params, client);
    } catch (e: any) {
      log.error(e);
      await client.terminal.log({ type: 'error', value: e.message });
    }
  };

  const wrappedView = (methodName: string) => wrapPromise(view(methodName), client);
  const sendTx = async (methodName: string) => {
    if (!walletRpcProvider || !nearConfig || !providerProxy) {
      return;
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

    let amount = deposit.toString();
    if (units === 'NEAR') {
      const parseNearAmount = utils.format.parseNearAmount(amount);
      if (!parseNearAmount) {
        amount = '';
      } else {
        amount = parseNearAmount;
      }
    }

    const rpcUrl = nearConfig.config.nodeUrl;
    await callMethod(
      rpcUrl,
      account,
      walletRpcProvider,
      deployedContract,
      methodName,
      params,
      amount,
      gasLimit,
      client,
    );
  };

  return (
    <Form>
      <Form.Group>
        <Form.Text className="text-muted" style={mb4}>
          <small>Methods</small>
        </Form.Text>

        <InputGroup>
          <Form.Control
            className="custom-select"
            as="select"
            value={method}
            onChange={(e) => {
              setMethods(e.target.value);
            }}
          >
            {methods.map((methodName, idx) => {
              return (
                <option value={methodName} key={idx}>
                  {methodName}
                </option>
              );
            })}
          </Form.Control>
        </InputGroup>
      </Form.Group>
      <Form.Group style={mt8}>
        <Form.Text className="text-muted" style={mb4}>
          <small>Agruments</small>
        </Form.Text>
        <AddArguments setRowsData={setRowsData} rowsData={rowsData} />
        <hr />
        <InputGroup style={{ marginBottom: '3px' }}>
          <Form.Control
            type="number"
            placeholder="Deposit"
            size="sm"
            onChange={(e) => {
              setDeposit(Number(e.target.value));
            }}
            style={{ top: '1px', height: '32px' }}
          />
          <Form.Control
            className="custom-select"
            type="text"
            as="select"
            placeholder="Units"
            size="sm"
            onChange={(e) => {
              setUnits(e.target.value);
            }}
            style={{ margin: '0 5px', height: '32px', padding: '4px 8px' }}
          >
            <option value={'NEAR'} key={'1'}>
              {'NEAR'}
            </option>
            <option value={'yoctoNEAR'} key={'2'}>
              {'yoctoNEAR'}
            </option>
          </Form.Control>
          <Button
            variant="warning"
            onClick={() => {
              sendTx(method);
            }}
            size="sm"
            style={{ width: '50px', height: '32px' }}
          >
            <small>Call</small>
          </Button>
        </InputGroup>
        <InputGroup>
          <div style={{ flex: '1 1 auto', marginRight: '5px' }}>
            <Form.Control
              type="text"
              size="sm"
              defaultValue="30000000000000"
              aria-describedby="gasLimitHelp"
              onChange={(e) => {
                setGasLimit(Number(e.target.value));
              }}
            />
            <Form.Text id="gasLimitHelp" muted>
              Max amount of gas this call can use.
              <br /> Default value is 30TGas.
            </Form.Text>
          </div>
          <Button
            className="ml-auto"
            variant="success"
            onClick={() => {
              wrappedView(method);
            }}
            size="sm"
            style={{ width: '50px', height: '32px' }}
          >
            <small>View</small>
          </Button>
        </InputGroup>
      </Form.Group>
    </Form>
  );
};

const mt8 = {
  marginTop: '8px',
};

const mb4 = {
  marginBottom: '4px',
};
