import React from 'react';
import { Alert, Accordion, Button, Card, InputGroup, useAccordionButton } from 'react-bootstrap';
import { CSSTransition } from 'react-transition-group';
import { AbiInput, AbiItem } from 'web3-utils';
import { InterfaceContract } from '../../utils/Types';
import Method from './Method';
import '../common/animation.css';
import { Near, utils, providers } from 'near-api-js';
import AlertCloseButton from '../common/AlertCloseButton';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { viewMethod } from './utils/viewMethod';
import { callMethod } from './utils/callMethod';
import { Provider } from './WalletRpcProvider';
import { log } from '../../utils/logger';

interface InterfaceDrawMethodProps {
  abi: AbiItem;
  client: Client<Api, Readonly<IRemixApi>>;
  nearConfig: Near | undefined;
  walletRpcProvider: providers.WalletRpcProvider | undefined;
  providerProxy: Provider | undefined;
  deployedContract: string;
  account: { address: string; pubKey: string };
}

const DrawMethod: React.FunctionComponent<InterfaceDrawMethodProps> = (props) => {
  const [error, setError] = React.useState<string>('');
  const [args, setArgs] = React.useState<{ [key: string]: any }>({});
  const [gasLimit, setGasLimit] = React.useState<number>(30000000000000); // 30TGas
  const [deposit, setDeposit] = React.useState<number>(0);
  const [units, setUnits] = React.useState<string>('NEAR');
  const [disable, setDisable] = React.useState<boolean>(false);
  const { abi, client, nearConfig, walletRpcProvider, providerProxy, deployedContract, account } =
    props;

  React.useEffect(() => {
    const temp: { [key: string]: null } = {};
    abi.inputs?.forEach((element: AbiInput) => {
      temp[element.name] = null;
    });
    setArgs(temp);
  }, [abi.inputs]);

  function buttonVariant(stateMutability: string | undefined): string {
    switch (stateMutability) {
      case 'view':
      case 'pure':
        return 'primary';
      case 'nonpayable':
        return 'warning';
      case 'payable':
        return 'danger';
      default:
        break;
    }
    return '';
  }

  return (
    <>
      <Method
        abi={abi}
        setArgs={(name: string, value: any) => {
          args[name] = value;
        }}
        setObjArgs={(name: string, value: any, componentName: string) => {
          const temp: { [key: string]: any } = args[name] === null ? {} : args[name];
          if (value === null) {
            delete temp[componentName];
          } else {
            temp[componentName] = value;
          }
          args[name] = Object.keys(temp).length === 0 ? null : temp;
        }}
        setDeposit={setDeposit}
        setUnits={setUnits}
        setDisable={setDisable}
        setGasLimit={setGasLimit}
      />
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <small>{error}</small>
      </Alert>
      <br />
      <InputGroup className="mb-3">
        <Button
          variant={buttonVariant(abi.stateMutability)}
          size="sm"
          disabled={!walletRpcProvider || disable}
          onClick={async (event) => {
            if (!nearConfig || !walletRpcProvider || !providerProxy) {
              return;
            }
            // TODO: check parameter and throw error before sending transaction.
            const params = {} as any;
            abi.inputs?.forEach((item: AbiInput) => {
              if (args[item.name] === null) {
                delete params[item.name];
              } else {
                params[item.name] = args[item.name];
              }
            });

            const rpcUrl = nearConfig.config.nodeUrl;

            if (abi.stateMutability === 'view') {
              try {
                await viewMethod(
                  nearConfig,
                  deployedContract,
                  abi.name ? abi.name : '',
                  params,
                  client,
                );
              } catch (e: any) {
                log.error(e);
                await client.terminal.log({ type: 'error', value: e?.message?.toString() });
              }
            } else {
              try {
                let amount = deposit.toString();
                if (units === 'NEAR') {
                  const parseNearAmount = utils.format.parseNearAmount(amount);
                  if (!parseNearAmount) {
                    amount = '';
                  } else {
                    amount = parseNearAmount;
                  }
                }
                await callMethod(
                  rpcUrl,
                  account,
                  walletRpcProvider,
                  deployedContract,
                  abi.name ? abi.name : '',
                  params,
                  amount,
                  gasLimit,
                  client,
                );
              } catch (e: any) {
                log.error(e);
                await client.terminal.log({ type: 'error', value: e?.message?.toString() });
              }
            }
          }}
        >
          <small>{abi.stateMutability === 'view' ? 'view' : 'call'}</small>
        </Button>
      </InputGroup>
    </>
  );
};

const ContractCard: React.FunctionComponent<{
  contract: InterfaceContract;
  client: Client<Api, Readonly<IRemixApi>>;
  nearConfig: Near | undefined;
  walletRpcProvider: providers.WalletRpcProvider | undefined;
  providerProxy: Provider | undefined;
  account: { address: string; pubKey: string };
}> = ({ contract, client, nearConfig, walletRpcProvider, providerProxy, account }) => {
  // TODO: show multiple contracts cards
  function CustomToggle({ children, eventKey }: any) {
    const decoratedOnClick = useAccordionButton(eventKey, () => {});

    return (
      <div
        className="card-header"
        style={{ padding: '5px', borderBottom: '0.1px' }}
        onClick={decoratedOnClick}
      >
        <small>{children}</small>
      </div>
    );
  }

  function DrawMethods() {
    const list = contract.abi ? contract.abi : [];
    const items = list.map((abi: AbiItem, id: number) => (
      <Accordion key={`Methods_A_${id}`}>
        <Accordion.Item as={Card.Header} eventKey={`Methods_${id}`} style={{ padding: '0' }}>
          <CustomToggle eventKey={`Methods_${id}`}>{abi.name}</CustomToggle>
          <Accordion.Body>
            <Card.Body className="py-1 px-2">
              <DrawMethod
                account={account}
                abi={abi}
                client={client}
                nearConfig={nearConfig}
                walletRpcProvider={walletRpcProvider}
                providerProxy={providerProxy}
                deployedContract={contract.address}
              />
            </Card.Body>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    ));
    return <>{items}</>;
  }

  return (
    <CSSTransition in={true} timeout={300} classNames="zoom" unmountOnExit>
      <Card className="mb-2">
        <Card.Header className="px-2 py-1">
          <strong className="align-middle">{contract.name}</strong>
          &nbsp;
          <Button
            className="float-right align-middle"
            size="sm"
            variant="link"
            onClick={() => {
              if (!nearConfig) {
                return;
              }
              const explorerUrl = nearConfig.config.explorerUrl;
              window.open(`${explorerUrl}/accounts/${contract.address}`);
            }}
          >
            <i className="fas fa-external-link-alt" />
          </Button>
        </Card.Header>
        {DrawMethods()}
      </Card>
    </CSSTransition>
  );
};

interface InterfaceSmartContractsProps {
  client: Client<Api, Readonly<IRemixApi>>;
  contract: InterfaceContract;
  nearConfig: Near | undefined;
  walletRpcProvider: providers.WalletRpcProvider | undefined;
  providerProxy: Provider | undefined;
  account: { address: string; pubKey: string };
}

const SmartContracts: React.FunctionComponent<InterfaceSmartContractsProps> = ({
  client,
  contract,
  nearConfig,
  walletRpcProvider,
  providerProxy,
  account,
}) => {
  function DrawContracts(client: any) {
    return (
      <ContractCard
        client={client}
        contract={contract}
        nearConfig={nearConfig}
        walletRpcProvider={walletRpcProvider}
        providerProxy={providerProxy}
        account={account}
      />
    );
  }

  return <div className="SmartContracts">{DrawContracts(client)}</div>;
};

export default SmartContracts;
