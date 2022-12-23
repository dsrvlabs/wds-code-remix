import React from 'react';
import {
  Alert,
  Accordion,
  Button,
  Card,
  Form,
  InputGroup,
  useAccordionButton,
} from 'react-bootstrap';
import copy from 'copy-to-clipboard';
import { CSSTransition } from 'react-transition-group';
import { AbiInput, AbiItem } from 'web3-utils';
import { InterfaceContract } from '../../utils/Types';
import Method from './Method';
import '../common/animation.css';
import Web3 from 'web3';
import { CallResult, RenderTransactions } from './RenderTransactions';
import { renderToString } from 'react-dom/server';
import { getConfig } from './config';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';
import { isEmptyList } from '../../utils/ListUtil';

const EMPTYLIST = 'Currently you have no contract instances to interact with.';

interface InterfaceDrawMethodProps {
  dapp: any;
  account: string;
  busy: boolean;
  setBusy: (state: boolean) => void;
  abi: AbiItem;
  address: string;
  client: any;
}

const DrawMethod: React.FunctionComponent<InterfaceDrawMethodProps> = (props) => {
  const [error, setError] = React.useState<string>('');
  // const [success, setSuccess] = React.useState<string>('');
  const [value, setValue] = React.useState<string>('');
  const [args, setArgs] = React.useState<{ [key: string]: string }>({});
  const [result, setResult] = React.useState<{ [key: string]: string }>({});
  const { dapp, account, busy, /* setBusy, */ abi, address, client } = props;

  let web3 = new Web3();

  try {
    web3 = new Web3(getConfig(dapp?.networks?.klaytn.chain).rpcUrl);
  } catch (e) {
    log.error(e);
  }

  React.useEffect(() => {
    const temp: { [key: string]: string } = {};
    abi.inputs?.forEach((element: AbiInput) => {
      temp[element.name] = '';
    });
    setArgs(temp);
  }, [abi.inputs]);

  async function waitGetTxReceipt(hash: string) {
    return new Promise(function (resolve) {
      const id = setInterval(async function () {
        const receipt = await web3.eth.getTransactionReceipt(hash);
        if (receipt) {
          clearInterval(id);
          resolve(receipt);
        }
      }, 4000);
    });
  }

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
        setArgs={(name: string, value2: string) => {
          args[name] = value2;
        }}
      />
      <Alert variant="danger" hidden={error === ''}>
        <AlertCloseButton onClick={() => setError('')} />
        <small>{error}</small>
      </Alert>
      {/* <Alert variant="success" onClose={() => setSuccess('')} dismissible hidden={success === ''}>
        <small>{success}</small>
      </Alert> */}
      <br />
      <InputGroup className="mb-3">
        <Button
          variant={buttonVariant(abi.stateMutability)}
          size="sm"
          disabled={busy || !dapp}
          onClick={async () => {
            // setBusy(true)
            setResult({});
            const parms: string[] = [];
            abi.inputs?.forEach((item: AbiInput) => {
              parms.push(args[item.name]);
            });
            const newContract = new web3.eth.Contract(JSON.parse(JSON.stringify([abi])), address);
            if (abi.stateMutability === 'view' || abi.stateMutability === 'pure') {
              try {
                const txReceipt = abi.name
                  ? await newContract.methods[abi.name](...parms).call({ from: account })
                  : null;

                if (Array.isArray(txReceipt) || typeof txReceipt !== 'object') {
                  abi.outputs?.forEach((output, index) => {
                    const res = output.type + ': ' + output.name + ': ' + txReceipt;
                    result[index.toString()] = res;
                  });
                  setValue(txReceipt);
                } else {
                  abi.outputs?.forEach((output, index) => {
                    const res =
                      output.type + ': ' + output.name + ': ' + txReceipt[index.toString()];
                    result[index.toString()] = res;
                  });

                  // setSuccess(JSON.stringify(txReceipt, null, 4));
                }
                const html = (
                  <CallResult
                    result={result}
                    from={address}
                    to={abi.name === undefined ? '' : abi.name}
                    hash="asdf"
                  />
                );
                await client.call('terminal', 'logHtml', {
                  type: 'html',
                  value: renderToString(html),
                });
              } catch (e: any) {
                log.error(e);
                await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
                // setError(e.message ? e.message : e.toString());
              }
            } else {
              try {
                if (!abi.name) {
                  client?.terminal.log({
                    type: 'error',
                    value: 'abi name is empty',
                  });
                  return;
                }

                const hashes: string[] = await dapp.request('klaytn', {
                  method: 'dapp:sendTransaction',
                  // method: 'dapp:signAndSendTransaction',
                  params: [
                    JSON.stringify({
                      from: account,
                      to: address,
                      data: newContract.methods[abi.name](...parms).encodeABI(),
                    }),
                    // {
                    //   from: account,
                    //   to: address,
                    //   data: newContract.methods[abi.name](...parms).encodeABI(),
                    // },
                  ],
                });

                if (isEmptyList(hashes)) {
                  client?.terminal.log({
                    type: 'error',
                    value: 'Failed to send transaction',
                  });
                  return;
                }

                const receipt = await waitGetTxReceipt(hashes[0]);

                const transaction = await web3.eth.getTransaction(hashes[0]);

                const html = (
                  <RenderTransactions
                    status={(receipt as any).status}
                    nonce={transaction.nonce}
                    from={(receipt as any).from}
                    to={
                      (receipt as any).to === null
                        ? 'Conract ' + (receipt as any).contractAddress + ' Created'
                        : (receipt as any).to
                    }
                    value={transaction.value}
                    logs={(receipt as any).logs.toString()}
                    hash={(receipt as any).transactionHash}
                    gasUsed={(receipt as any).gasUsed}
                  />
                );
                await client.call('terminal', 'logHtml', {
                  type: 'html',
                  value: renderToString(html),
                });
                setError('');
                // setSuccess(JSON.stringify(receipt, null, 2));
              } catch (e: any) {
                log.error(e);
                await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
                // setError(e.message ? e.message : e.toString());
              }
            }
            // setBusy(false)
          }}
        >
          <small>
            {abi.stateMutability === 'view' || abi.stateMutability === 'pure' ? 'call' : 'transact'}
          </small>
        </Button>
        <Button
          variant={buttonVariant(abi.stateMutability)}
          size="sm"
          className="mt-0 pt-0 float-right"
          onClick={async () => {
            if (abi.name) {
              try {
                const parms: string[] = [];
                abi.inputs?.forEach((item: AbiInput) => {
                  if (args[item.name]) {
                    parms.push(args[item.name]);
                  }
                });
                const newContract = new web3.eth.Contract(
                  JSON.parse(JSON.stringify([abi])),
                  address,
                );
                copy(newContract.methods[abi.name](...parms).encodeABI());
              } catch (e: any) {
                // log.debug(e.toString());
                log.error(e);
                await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
              }
            }
          }}
        >
          <i className="far fa-copy" />
        </Button>
        <Form.Control
          value={value}
          size="sm"
          readOnly
          hidden={!(abi.stateMutability === 'view' || abi.stateMutability === 'pure')}
        />
      </InputGroup>
    </>
  );
};

const ContractCard: React.FunctionComponent<{
  dapp: any;
  account: string;
  busy: boolean;
  setBusy: (state: boolean) => void;
  contract: InterfaceContract;
  index: number;
  remove: () => void;
  client: any;
}> = ({ dapp, account, busy, setBusy, contract, index, remove, client }) => {
  const [enable, setEnable] = React.useState<boolean>(true);

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

  function DrawMathods() {
    const list = contract.abi ? contract.abi : [];
    const items = list.map((abi: AbiItem, id: number) => (
      <Accordion key={`Methods_A_${id}`}>
        <Accordion.Item as={Card.Header} eventKey={`Methods_${id}`} style={{ padding: '0' }}>
          <CustomToggle eventKey={`Methods_${id}`}>{abi.name}</CustomToggle>
          <Accordion.Body>
            <Card.Body className="py-1 px-2">
              <DrawMethod
                dapp={dapp}
                account={account}
                busy={busy}
                setBusy={setBusy}
                abi={abi}
                address={contract.address}
                client={client}
              />
            </Card.Body>
          </Accordion.Body>
        </Accordion.Item>
      </Accordion>
    ));
    return <>{items}</>;
  }

  return (
    <CSSTransition in={enable} timeout={300} classNames="zoom" unmountOnExit onExited={remove}>
      <Card className="mb-2">
        <Card.Header className="px-2 py-1">
          <strong className="align-middle">{contract.name}</strong>
          &nbsp;
          <small className="align-middle">{`${contract.address.substring(
            0,
            6,
          )}...${contract.address.substring(38)}`}</small>
          <Button
            className="float-right align-middle"
            size="sm"
            variant="link"
            onClick={() => {
              const network = getConfig(dapp?.networks?.klaytn.chain);
              window.open(`${network.explorerUrl}/account/${contract.address}`);
            }}
          >
            <i className="fas fa-external-link-alt" />
          </Button>
          <Button
            className="float-right align-middle"
            size="sm"
            variant="link"
            onClick={() => {
              setEnable(false);
            }}
          >
            <i className="fas fa-trash-alt" />
          </Button>
        </Card.Header>
        {DrawMathods()}
      </Card>
    </CSSTransition>
  );
};

interface InterfaceSmartContractsProps {
  dapp: any;
  account: string;
  busy: boolean;
  setBusy: (state: boolean) => void;
  contracts: InterfaceContract[];
  client: any;
}

const SmartContracts: React.FunctionComponent<InterfaceSmartContractsProps> = ({
  dapp,
  account,
  busy,
  setBusy,
  contracts,
  client,
}) => {
  const [error, setError] = React.useState<string>('');
  const [count, setCount] = React.useState<number>(0);

  React.useEffect(() => {
    setCount(0);
    setError(EMPTYLIST);
  }, [contracts, busy]);

  function DrawContracts(client: any) {
    const items = contracts.map((data: InterfaceContract, index: number) => (
      <ContractCard
        dapp={dapp}
        account={account}
        busy={busy}
        setBusy={setBusy}
        contract={data}
        index={index}
        remove={() => {
          setCount(count + 1);
          setError(EMPTYLIST);
        }}
        client={client}
        key={`Contract_${index.toString()}`}
      />
    ));
    return <>{items}</>;
  }

  return (
    <div className="SmartContracts">
      <Alert variant="warning" className="text-center" hidden={contracts.length !== count}>
        <small>{error}</small>
      </Alert>
      {DrawContracts(client)}
    </div>
  );
};

export default SmartContracts;
