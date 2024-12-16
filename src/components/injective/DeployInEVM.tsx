import React, { useEffect, useState } from 'react';
import { ethers, InterfaceAbi } from 'ethers';
import { getConstructorInterface } from './injective-helper';
import { ABIDescription, FunctionDescription, IRemixApi } from '@remixproject/plugin-api';
import {
  Accordion,
  Alert,
  Button,
  Card,
  Form,
  InputGroup,
  useAccordionButton,
} from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';
import { AbiInput, AbiItem } from 'web3-utils';
import copy from 'copy-to-clipboard';
import { renderToString } from 'react-dom/server';
import { CallResult } from '../celo/RenderTransactions';
import AlertCloseButton from '../common/AlertCloseButton';
import { RenderTransactions } from '../near/RenderTransactions';
import { useWalletStore } from './WalletContextProvider';
import { log } from '../../utils/logger';
import { CSSTransition } from 'react-transition-group';

interface DeployInEVMProps {
  client: any;
  abi: ABIDescription[];
  bytecode: string;
}

interface ConstructorInput {
  name: string;
  type: string;
}

const DeployInEVM: React.FC<DeployInEVMProps> = ({ client, abi, bytecode }) => {
  const [constructorFields, setConstructorFields] = useState<ConstructorInput[]>([]);
  const [constructorInputs, setConstructorInputs] = useState<{ [key: string]: string }>({});
  //Literally sorted making abi looks nice when renedered :D
  const [sortedAbi, setSortedAbi] = useState<ABIDescription[]>([]);
  const [deploymentResult, setDeploymentResult] = useState<{
    address?: string;
    txHash?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [enable, setEnable] = React.useState<boolean>(true);

  useEffect(() => {
    try {
      const constructorInterface = getConstructorInterface(abi);
      setConstructorFields(constructorInterface.inputs);
      setSortedAbi(abi);
    } catch (err) {
      setError('Failed to parse constructor interface');
    }
  }, [abi]);

  const handleInputChange = (name: string, value: string) => {
    setConstructorInputs((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const renderInput = (input: ConstructorInput) => {
    const { name, type } = input;
    const value = constructorInputs[name] || '';

    switch (type) {
      case 'bool':
        return (
          <Form.Control
            value={value}
            onChange={(e) => handleInputChange(name, e.target.value)}
            as="select"
          >
            <option value="">Select {name}</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </Form.Control>
        );

      case 'uint256':
        return (
          <Form.Control
            type="number"
            value={value}
            onChange={(e) => handleInputChange(name, e.target.value)}
            placeholder={`Enter ${name}`}
          ></Form.Control>
        );

      default:
        return (
          <Form.Control
            type="text"
            value={value}
            onChange={(e) => handleInputChange(name, e.target.value)}
            placeholder={`Enter ${name}`}
          ></Form.Control>
        );
    }
  };

  const deployContract = async () => {
    setIsLoading(true);
    setError(null);
    setDeploymentResult(null);

    if (typeof window.ethereum === 'undefined') {
      setError('Web3 provider not found');
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const constructorArgs = constructorFields.map((input) => {
        const value = constructorInputs[input.name];

        switch (input.type) {
          case 'uint256':
            return BigInt(value);
          case 'bool':
            return value === 'true';
          default:
            return value;
        }
      });

      const contractFactory = new ethers.ContractFactory(abi, bytecode, signer);
      const contract = await contractFactory.deploy(...constructorArgs);
      const deployedContract = await contract.waitForDeployment();
      setDeploymentResult({
        address: await deployedContract.getAddress(),
        txHash: deployedContract.deploymentTransaction()?.hash,
      });
      setIsLoading(false);
    } catch (deployError: any) {
      setError(deployError.message || 'Deployment failed');
    }
  };

  return (
    <div>
      <Form.Text className="text-muted">Constructors</Form.Text>
      {error && (
        <div>
          <Form.Text className="text-danger">{error}</Form.Text>
        </div>
      )}
      <div>
        {constructorFields.map((input, idx) => (
          <div key={idx}>
            <Form.Text>
              {input.name} ({input.type})
            </Form.Text>
            {renderInput(input)}
          </div>
        ))}

        <Button
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
          disabled={isLoading ? true : false}
          onClick={deployContract}
        >
          {isLoading ? <FaSyncAlt className={'fa-spin'} /> : <></>} Deploy Contract
        </Button>
      </div>

      {deploymentResult && (
        <div>
          <Form.Group className="mb-4">
            <Form.Text className="text-success">Deployment Successful!</Form.Text>
            <Form.Text>Address</Form.Text>
            <Form.Control value={deploymentResult.address} type="text" readOnly></Form.Control>
            <Form.Text>Transaction Hash</Form.Text>
            <Form.Control value={deploymentResult.txHash} type="text" readOnly></Form.Control>
          </Form.Group>
          {/* Contract Interaction */}
          <CSSTransition in={enable} timeout={300} classNames="zoom" unmountOnExit>
            <Card className="mb-2">
              <Card.Header className="px-2 py-1">
                <small className="align-middle">{`${deploymentResult.address!.substring(
                  0,
                  6,
                )}...${deploymentResult.address!.substring(38)}`}</small>
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
              {sortedAbi.map((abiItem, id) => (
                <Accordion key={`Methods_A_${id}`}>
                  <Accordion.Item
                    as={Card.Header}
                    eventKey={`Methods_${id}`}
                    style={{ padding: '0' }}
                  >
                    <CustomToggle eventKey={`Methods_${id}`}>{abiItem.name}</CustomToggle>
                    <Accordion.Body>
                      <Card.Body className="py-1 px-2">
                        <DrawMethod
                          abi={abiItem}
                          contractAddr={deploymentResult.address!}
                          client={client}
                        />
                      </Card.Body>
                    </Accordion.Body>
                  </Accordion.Item>
                </Accordion>
              ))}
            </Card>
          </CSSTransition>
        </div>
      )}
    </div>
  );
};

const DrawMethod = ({
  abi,
  contractAddr,
  client,
}: {
  abi: any;
  contractAddr: string;
  client: any;
}) => {
  const [error, setError] = React.useState<string>('');
  const [value, setValue] = React.useState<string>('');
  const [args, setArgs] = React.useState<{ [key: string]: string }>({});
  const [result, setResult] = React.useState<{ [key: string]: string }>({});

  const { ethAddress, chainId } = useWalletStore();

  const buttonVariant = (stateMutability: string | undefined): string => {
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
  };

  useEffect(() => {
    const temp: { [key: string]: string } = {};
    abi.inputs?.forEach((element: { name: string | number }) => {
      temp[element.name] = '';
    });
    setArgs(temp);
  }, [abi.inputs]);

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
          onClick={async (event) => {
            // setBusy(true)
            setResult({});
            const parms: string[] = [];
            abi.inputs?.forEach((item: AbiInput) => {
              parms.push(args[item.name]);
            });
            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const contract = new ethers.Contract(contractAddr, [abi], signer);
            if (abi.stateMutability === 'view' || abi.stateMutability === 'pure') {
              try {
                const txReceipt = abi.name ? await contract[abi.name](...parms) : null;
                if (Array.isArray(txReceipt) || typeof txReceipt !== 'object') {
                  abi.outputs?.forEach(
                    (
                      output: { type: string; name: string },
                      index: { toString: () => string | number },
                    ) => {
                      const res = output.type + ': ' + output.name + ': ' + txReceipt;
                      result[index.toString()] = res;
                    },
                  );
                  setValue(txReceipt);
                } else {
                  abi.outputs?.forEach(
                    (
                      output: { type: string; name: string },
                      index: { toString: () => string | number },
                    ) => {
                      const res =
                        output.type + ': ' + output.name + ': ' + txReceipt[index.toString()];
                      result[index.toString()] = res;
                    },
                  );
                  await client.terminal.log({ type: 'log', value: result });
                }
                const html = (
                  <CallResult
                    result={result}
                    from={contractAddr}
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
                await client?.terminal.log({
                  type: 'error',
                  value: e?.message?.toString(),
                });
                // setError(e.message ? e.message : e.toString());
              }
            } else {
              try {
                let transaction: ethers.TransactionResponse | null;
                const result = abi.name ? await contract[abi.name](...parms) : null;
                setTimeout(async () => {
                  transaction = await new ethers.JsonRpcProvider(
                    chainId === '2525'
                      ? 'https://mainnet.rpc.inevm.com/http'
                      : 'https://testnet.rpc.inevm.com/http',
                  ).getTransaction(result.hash);
                  const html = (
                    <CallResult
                      result={result}
                      from={contractAddr}
                      to={abi.name === undefined ? '' : abi.name}
                      hash={transaction!.hash}
                    />
                  );
                  await client.call('terminal', 'logHtml', {
                    type: 'html',
                    value: renderToString(html),
                  });
                }, 1000);

                setError('');

                // setSuccess(JSON.stringify(receipt, null, 2));
              } catch (e: any) {
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
            if (!window.ethereum) {
              throw new Error('Web3 object is undefined');
            }
            if (abi.name) {
              try {
                const parms: string[] = [];
                abi.inputs?.forEach((item: AbiInput) => {
                  if (args[item.name]) {
                    parms.push(args[item.name]);
                  }
                });
                const provider = new ethers.BrowserProvider(window.ethereum);
                const signer = await provider.getSigner();
                const contract = new ethers.Contract(contractAddr, [abi], signer);
                copy(await contract[abi.name](...parms));
              } catch (e: any) {
                log.error(e);
                await client?.terminal.log({ type: 'error', value: e?.message?.toString() });
              }
            }
          }}
        >
          <i className="far fa-copy" />
        </Button>
        <Form.Control
          value={value.toString()}
          size="sm"
          readOnly
          hidden={!(abi.stateMutability === 'view' || abi.stateMutability === 'pure')}
        />
      </InputGroup>
    </>
  );
};

const Method = ({ abi, setArgs }: any) => {
  const [inputs, setInputs] = useState<AbiInput[]>([]);
  useEffect(() => {
    setInputs(abi && abi.inputs ? abi.inputs : []);
  }, [abi]);
  function DrawInputs() {
    const items = inputs.map((item: AbiInput, index: number) => (
      <React.Fragment key={index.toString()}>
        <Form.Text className="text-muted">
          <small>{item.name}</small>
        </Form.Text>
        <Form.Control
          type="text"
          size="sm"
          name={item.name}
          placeholder={item.type}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            if (event.target.value[0] === '[') {
              setArgs(event.target.name, JSON.parse(event.target.value));
            } else {
              setArgs(event.target.name, event.target.value);
            }
          }}
        />
      </React.Fragment>
    ));
    return <Form.Group>{items}</Form.Group>;
  }

  return <Form className="Method">{DrawInputs()}</Form>;
};

const CustomToggle = ({ children, eventKey }: any) => {
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
};

export default DeployInEVM;
