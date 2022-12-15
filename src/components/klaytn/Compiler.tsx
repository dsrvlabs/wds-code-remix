import React from 'react';
import { Alert, Button, Card, Form, InputGroup } from 'react-bootstrap';
import copy from 'copy-to-clipboard';
import { AbiInput, AbiItem } from 'web3-utils';
import { InterfaceContract } from '../../utils/Types';
import Method from './Method';
import Web3 from 'web3';
import wrapPromise from '../../utils/wrapPromise';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { RenderTransactions } from './RenderTransactions';
import { renderToString } from 'react-dom/server';
import { getConfig } from './config';
import AlertCloseButton from '../common/AlertCloseButton';
import { log } from '../../utils/logger';

const MAX_COUNT = 3;

function getFunctions(abi: AbiItem[]): AbiItem[] {
  const temp: AbiItem[] = [];
  abi.forEach((element: AbiItem) => {
    if (element.type === 'function') {
      temp.push(element);
    }
  });
  return temp;
}

function getArguments(abi: AbiItem | null, args: { [key: string]: string }) {
  const temp: string[] = [];
  if (abi) {
    abi.inputs?.forEach((item: AbiInput) => {
      temp.push(args[item.name]);
    });
  }
  return temp;
}

interface InterfaceProps {
  dapp: any;
  account: string;
  busy: boolean;
  setBusy: (state: boolean) => void;
  addNewContract: (contract: InterfaceContract) => void; // for SmartContracts
  setSelected: (select: InterfaceContract) => void; // for At Address
  client: any;
}

const Compiler: React.FunctionComponent<InterfaceProps> = ({
  dapp,
  account,
  busy,
  setBusy,
  addNewContract,
  setSelected,
  client,
}) => {
  const [initialised, setInitialised] = React.useState<boolean>(false);
  const [fileName, setFileName] = React.useState<string>('');
  const [iconSpin, setIconSpin] = React.useState<string>('');
  const [contracts, setContracts] = React.useState<{
    fileName: string;
    data: { [key: string]: any };
  }>({
    fileName: '',
    data: {},
  });
  const [contractName, setContractName] = React.useState<string>('');
  const [constructor, setConstructor] = React.useState<AbiItem | null>(null);
  const [args, setArgs] = React.useState<{ [key: string]: string }>({});
  const [address, setAddress] = React.useState<string>('');
  const [error, setError] = React.useState<string>('');

  let web3 = new Web3();

  try {
    web3 = new Web3(getConfig(dapp?.networks?.klaytn.chain).rpcUrl);
  } catch (e) {
    log.error(e);
  }
  // const web3 = new Web3('https://public-node-api.klaytnapi.com/v1/baobab');

  React.useEffect(() => {
    async function init() {
      setInitialised(true);
      client.solidity.on(
        'compilationFinished',
        (fn: string, source: any, languageVersion: string, data: any) => {
          // log.debug(fn, source, languageVersion, data);
          setContracts({ fileName: fn, data: data.contracts[fn] });
          // eslint-disable-next-line
          select(
            Object.keys(data.contracts[fn]).length > 0 ? Object.keys(data.contracts[fn])[0] : '',
            data.contracts[fn],
          );
        },
      );
      client.on('fileManager', 'currentFileChanged', (fn: string) => {
        setFileName(fn);
      });
      try {
        setFileName(await client.fileManager.getCurrentFile());
      } catch (e: any) {
        // eslint-disable-next-line no-console
        log.debug('Error from IDE : No such file or directory No file selected');
        await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
      }
    }
    setAddress('');
    if (!initialised) {
      // setCompilerConfig(version, optimize);
      init();
    }
    // eslint-disable-next-line
  }, []);

  async function compile() {
    sendCustomEvent('compile', {
      event_category: 'klaytn',
      method: 'compile',
    });
    setBusy(true);
    setIconSpin('fa-spin');
    await client?.solidity.compile(fileName);
    setIconSpin('');
    setBusy(false);
  }

  const wrappedCompile = () => wrapPromise(compile(), client);

  function select(name: string, newContracts: { [key: string]: any } | null = null) {
    const abi = newContracts ? newContracts[name].abi : contracts.data[name].abi;
    setContractName(name);
    setConstructor(null);
    setArgs({});
    abi.forEach((element0: AbiItem) => {
      if (element0.type === 'constructor') {
        const temp: { [key: string]: string } = {};
        element0.inputs?.forEach((element1: AbiInput) => {
          temp[element1.name] = '';
        });
        setArgs(temp);
        setConstructor(element0);
      }
    });
    setSelected({ name, address: '', abi: getFunctions(abi) });
  }

  async function waitGetTxReceipt(hash: string) {
    let count = 0;
    return new Promise(function (resolve, reject) {
      const id = setInterval(async function () {
        const receipt = await web3.eth.getTransactionReceipt(hash);
        count += 1;
        if (receipt) {
          clearInterval(id);
          resolve(receipt);
        }
        if (count > MAX_COUNT) {
          clearInterval(id);
          reject(new Error(`Waiting for transaction ${hash} timed out!`));
        }
      }, 4000);
    });
  }

  async function onDeploy() {
    sendCustomEvent('deploy', {
      event_category: 'klaytn',
      method: 'deploy',
    });
    if (!busy) {
      setBusy(true);
      setAddress('');
      try {
        const newContract = new web3.eth.Contract(
          JSON.parse(JSON.stringify(contracts.data[contractName].abi)),
        );

        const parms: string[] = getArguments(constructor, args);

        const rawTx = {
          from: account,
          data: newContract
            .deploy({
              data: `0x${contracts.data[contractName].evm.bytecode.object}`,
              arguments: parms,
            })
            .encodeABI(),
        };

        const hash = await dapp.request('klaytn', {
          method: 'dapp:sendTransaction',
          params: [JSON.stringify(rawTx)],
        });

        const receipt = await waitGetTxReceipt(hash[0]);

        if ((receipt as any).contractAddress) {
          setAddress((receipt as any).contractAddress);
          addNewContract({
            name: contractName,
            address: (receipt as any).contractAddress,
            abi: getFunctions(contracts.data[contractName].abi),
          });

          const transaction = await web3.eth.getTransaction(hash[0]);

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
        } else {
          setError('contractAddress error');
          await client?.terminal.log({ type: 'error', value: 'contractAddress error' });
        }
      } catch (e: any) {
        // eslint-disable-next-line
        log.error(e);
        setError('deploy error');
        await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
      }
      setBusy(false);
    }
  }

  const wrappedOnDeploy = () => wrapPromise(onDeploy(), client);

  function Contracts() {
    const { data } = contracts;
    const value = contracts.fileName.split('/')[contracts.fileName.split('/').length - 1];
    const items = Object.keys(data).map((key) => (
      <option key={key} value={key}>{`${key} - ${value}`}</option>
    ));
    return (
      <Form>
        <Form.Group>
          <Form.Text className="text-muted">
            <small>CONTRACT</small>
            <Button
              variant="link"
              size="sm"
              className="mt-0 pt-0 float-right"
              disabled={!contracts.data[contractName]}
              onClick={() => {
                if (contracts.data[contractName]) {
                  copy(JSON.stringify(contracts.data[contractName].abi, null, 4));
                }
              }}
            >
              <i className="far fa-copy" />
            </Button>
          </Form.Text>
          <InputGroup>
            <Form.Control
              as="select"
              value={contractName}
              onChange={(e) => {
                select(e.target.value);
              }}
            >
              {items}
            </Form.Control>
          </InputGroup>
        </Form.Group>
      </Form>
    );
  }

  return (
    <div className="Compiler">
      <Button
        variant="primary"
        onClick={async () => {
          await wrappedCompile();
        }}
        className="w-100"
        disabled={fileName === '' || iconSpin !== ''}
      >
        <i className={`fas fa-sync ${iconSpin}`} style={{ marginRight: '0.3em' }} />
        <span>
          Compile&nbsp;
          {`${
            fileName === ''
              ? '<no file selected>'
              : fileName.split('/')[fileName.split('/').length - 1]
          }`}
        </span>
      </Button>
      <hr />
      <Contracts />
      <Card>
        <Card.Header className="p-2">Deploy</Card.Header>
        <Card.Body className="py-1 px-2">
          <Method
            abi={constructor}
            setArgs={(name: string, value: string) => {
              args[name] = value;
            }}
          />
          <Alert variant="danger" hidden={error === ''}>
            <AlertCloseButton onClick={() => setError('')} />
            <small style={{ marginTop: '20px' }}>{error}</small>
          </Alert>
          <br />
          <InputGroup className="mb-3">
            <Form.Control value={address} placeholder="contract address" size="sm" readOnly />
            <Button
              variant="warning"
              size="sm"
              disabled={busy || account === '' || fileName === ''}
              onClick={wrappedOnDeploy}
            >
              <small>Deploy</small>
            </Button>
          </InputGroup>
        </Card.Body>
      </Card>
    </div>
  );
};

export default Compiler;
