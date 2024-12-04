import {
  ChainGrpcWasmApi,
  toBase64,
  TxGrpcApi,
  MsgExecuteContractCompat,
  createTransaction,
  ChainRestAuthApi,
  BaseAccount,
  MsgExecuteContract,
  fromBase64,
} from '@injectivelabs/sdk-ts';
import { Dispatch, useRef, useState } from 'react';
import { getNetworkEndpoints, Network } from '@injectivelabs/networks';
import Spinner from 'react-bootstrap/Spinner';
import { ChainId } from '@injectivelabs/ts-types';

import { Form, InputGroup, Button } from 'react-bootstrap';
import { useWalletStore } from './WalletContextProvider';
import { log } from '../../utils/logger';

interface AtAddressProps {
  isAtAddr: boolean;
  setItAtAddr: Dispatch<React.SetStateAction<boolean>>;
}

const AtAddress = () => {
  // At Address
  const [queryFunctionNames, setQueryFunctionNames] = useState<string[]>([]);
  const [execFunctionNames, setExecFunctionNames] = useState<string[]>([]);
  const [contractAddr, setContractAddr] = useState('');
  const [isContract, setIsContract] = useState(false);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isExecLoading, setIsExecLoading] = useState(false);

  // select query & exec
  const [msgType, setMsgType] = useState('Query');
  const msgTypes = ['Query', 'Execute'];
  const [selectedMsg, setSelectedMsg] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [msgErr, setMsgErr] = useState('');
  const [msgResult, setMsgResult] = useState('');

  //Fund
  const [fundAmount, setFundAmount] = useState('0');
  const [fundDenom, setFundDenom] = useState('inj');

  const { chainId, injectiveAddress, injectiveBroadcastMsg } = useWalletStore();

  const handleContractAddrChange = (e: any) => {
    setContractAddr(e.target.value);
  };

  const wasmErrorToMessageArray = (error: any): string[] => {
    const messageSupportedRegex =
      /Messages supported by this contract: (.*?)(?=: query wasm contract failed: unknown request)/;
    const contentMatch = messageSupportedRegex.exec(error.message);

    if (contentMatch && contentMatch[1]) {
      const content = contentMatch[1].split(',');

      return content.map((each) => each.trim());
    }

    const matches = error.message.match(/`(.*?)`/g);

    return matches ? matches.slice(1).map((match: string) => match.replace(/`/g, '')) : [];
  };

  const searchContract = async () => {
    setIsSearchLoading(true);
    const network = chainId === 'injective-888' ? Network.Testnet : Network.Mainnet;
    const endpoints = getNetworkEndpoints(network);
    const grpcWasmApi = new ChainGrpcWasmApi(endpoints.grpc);
    const txService = new TxGrpcApi(endpoints.grpc);

    if (!(contractAddr.includes('inj') && contractAddr.length === 42)) {
      //TODO Error code here
      setIsSearchLoading(false);
      log.error('Invalid Contract Address');
      return;
    }

    try {
      const codeInfoByContractAddr = await grpcWasmApi.fetchContractInfo(contractAddr);
      if (!codeInfoByContractAddr) {
        throw new Error('No instaniated Contract!');
      }
      // Get Query Functions
      const queryToGetBackMessageList = { '': {} };
      const messageToBase64 = toBase64(queryToGetBackMessageList);
      try {
        await grpcWasmApi.fetchSmartContractState(contractAddr, messageToBase64);
      } catch (e) {
        const queryFunctions = wasmErrorToMessageArray(e);
        setQueryFunctionNames([...wasmErrorToMessageArray(e)]);
        const pretty = prettifyJson(`{"${queryFunctions[0]}":{}}`);
        setJsonInput(pretty);
      }

      // Get Exececute Functions
      const getAccountDetails = async (address: string, network: Network): Promise<BaseAccount> => {
        const endpoints = getNetworkEndpoints(network);
        const chainRestAuthApi = new ChainRestAuthApi(endpoints.rest);
        const accountDetailsResponse = await chainRestAuthApi.fetchAccount(address);

        return BaseAccount.fromRestApi(accountDetailsResponse);
      };

      const accountDetails = (
        await getAccountDetails(injectiveAddress, network)
      ).toAccountDetails();

      const initialMessageToGetBackMessageList = '{"": {}}';
      const msgs = MsgExecuteContractCompat.fromJSON({
        contractAddress: contractAddr,
        sender: injectiveAddress,
        msg: Buffer.from(initialMessageToGetBackMessageList),
        funds: [],
      });

      try {
        const { txRaw } = createTransaction({
          chainId: chainId,
          message: msgs,
          pubKey: accountDetails.pubKey.key,
          sequence: accountDetails.sequence,
          accountNumber: accountDetails.accountNumber,
        });

        await txService.simulate(txRaw);
      } catch (e) {
        const execFunctions = wasmErrorToMessageArray(e);
        setExecFunctionNames([...execFunctions]);
      }

      log.info(`✅✅✅ generateMessages ${network}`);
      setIsSearchLoading(false);
      setIsContract(true);
    } catch (e) {
      log.info('Error generating Wasm Messages', e);
      setIsSearchLoading(false);
    }
  };

  const executeKeplr = async () => {
    setIsExecLoading(true);
    try {
      const funds = [{ denom: fundDenom, amount: fundAmount.toString() }];

      const execMsg = JSON.parse(jsonInput);
      const execMsg_ = { ...execMsg };
      const msg = MsgExecuteContractCompat.fromJSON({
        contractAddress: contractAddr,
        sender: injectiveAddress,
        msg: execMsg_,
        funds: funds,
      });

      const txResult = await injectiveBroadcastMsg(msg, injectiveAddress);
      log.debug(txResult);
      setMsgResult('Transaction Hash: \n' + txResult!.txHash);
      setMsgErr('');
      setIsExecLoading(false);
    } catch (e: any) {
      log.error(e.message.toString());
      setMsgErr(e.message.toString());
      setMsgResult('');
      setIsExecLoading(false);
    }
  };

  const queryKeplr = async () => {
    setIsExecLoading(true);
    const grpcEndpoint = getNetworkEndpoints(
      chainId === ChainId.Mainnet ? Network.Mainnet : Network.Testnet,
    ).grpc;
    const queryMsg = JSON.parse(jsonInput);
    const queryMsg_ = { ...queryMsg };
    // recursiveValueChange(queryMsg_, stringToNumber);
    const chainGrpcWasmApiClient = new ChainGrpcWasmApi(grpcEndpoint);
    try {
      const response = (await chainGrpcWasmApiClient.fetchSmartContractState(
        contractAddr, // The address of the contract
        toBase64(queryMsg_),
      )) as unknown as { data: string };
      const queryResult = fromBase64(response.data);
      log.debug(queryResult);
      setMsgResult(JSON.stringify(queryResult));
      setMsgErr('');
      setIsExecLoading(false);
    } catch (e: any) {
      log.error(e.message.toString());
      setMsgErr(e.message.toString());
      setMsgResult('');
      setIsExecLoading(false);
    }
  };

  const handleFunctionNameChange = (e: any) => {
    setSelectedMsg(e.target.value);
    const pretty = prettifyJson(`{"${e.target.value}":{}}`);
    setJsonInput(pretty);
  };

  const handleJsonChange = (e: any) => {
    setJsonInput(e.target.value);
  };

  const handleFundAmountChange = (e: any) => {
    setFundAmount(e.target.value);
  };

  const handleFundDenomChange = (e: any) => {
    setFundDenom(e.target.value);
  };

  const handleMsgTypeChange = (e: any) => {
    setMsgType(e.target.value);
    const pretty = prettifyJson(
      `{"${e.target.value === 'Query' ? queryFunctionNames[0] : execFunctionNames[0]}":{}}`,
    );
    setMsgErr('');
    setMsgResult('');
    setJsonInput(pretty);
  };

  const handleSubmitPrettify = (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const jsonInputTextArea = formData.get('jsonInputTextArea') as string;
    const pretty = prettifyJson(jsonInputTextArea);
    setJsonInput(pretty);
  };

  const prettifyJson = (uglyJson: string) => {
    const obj = JSON.parse(uglyJson);
    const pretty = JSON.stringify(obj, undefined, 2);
    return pretty;
  };

  return (
    <div className="mt-4">
      {/* Search Contract via Address and CodeID */}
      {/* TODO: CodeID Search */}
      <Form.Group>
        <Form.Text>At Address</Form.Text>
        <InputGroup className="mt-2">
          <Form.Control
            value={contractAddr}
            onChange={handleContractAddrChange}
            type="text"
            placeholder="Contract Address or Code ID"
          ></Form.Control>
          <Button
            onClick={() => {
              searchContract();
            }}
          >
            {isSearchLoading && <Spinner className="mr-2" animation="border" size="sm"></Spinner>}
            Search
          </Button>
        </InputGroup>
      </Form.Group>
      {/* Contract Interaction */}
      {isContract && (
        // Select Query or Execute or Migrate
        // TODO: Migrate
        <div className="mt-2">
          <div>
            <Form.Text className="mb-2">Select Message Type</Form.Text>
            <Form.Control as="select" onChange={handleMsgTypeChange}>
              {msgTypes.map((msg) => (
                <option key={msg} value={msg}>
                  {msg}
                </option>
              ))}
            </Form.Control>

            <div className="mt-2">
              {msgType === 'Query' && (
                <Form.Group>
                  <Form.Text className="mb-2">Select Query</Form.Text>
                  <Form.Control as="select" onChange={handleFunctionNameChange}>
                    {queryFunctionNames.map((queryFunctionName, idx) => (
                      <option key={idx} value={queryFunctionName}>
                        {queryFunctionName}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              )}

              {msgType === 'Execute' && (
                <Form.Group>
                  <Form.Text className="mb-2">Select Execute</Form.Text>
                  <Form.Control as="select" onChange={handleFunctionNameChange}>
                    {execFunctionNames.map((execFunctionName, idx) => (
                      <option key={idx} value={execFunctionName}>
                        {execFunctionName}
                      </option>
                    ))}
                  </Form.Control>
                </Form.Group>
              )}
            </div>
          </div>
          {/* Fund */}
          {/* TODO: Funds array */}
          <Form.Group>
            <Form.Text>Fund Amount</Form.Text>
            <Form.Control
              className="mt-2"
              as="text"
              placeholder="Fund Amount"
              type="text"
              onChange={handleFundAmountChange}
            ></Form.Control>
            <Form.Text>Fund Denom</Form.Text>
            <Form.Control
              className="mt-2"
              as="text"
              placeholder="Fund Denom"
              type="text"
              onChange={handleFundDenomChange}
            ></Form.Control>
          </Form.Group>
          {/* JSON Message TextArea */}
          <Form onSubmit={handleSubmitPrettify}>
            <Form.Group className="mb-3">
              <div className="position-relative">
                <Form.Label>JSON Message</Form.Label>
                <Form.Control
                  name="jsonInputTextArea"
                  as="textarea"
                  rows={10} // Increased rows for larger textarea
                  value={jsonInput}
                  onChange={handleJsonChange}
                  style={{
                    fontFamily: 'monospace',
                    resize: 'vertical', // Allow vertical resizing
                    paddingRight: '80px',
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  style={{
                    position: 'absolute',
                    top: '30px',
                    right: '0rem',
                  }}
                  type="submit"
                >
                  pretty
                </Button>
              </div>
            </Form.Group>
          </Form>

          {/* Result */}
          <Form.Text>{`${msgType} Result`}</Form.Text>
          <Form.Text style={{ color: 'green', fontSize: '1rem' }}>{msgResult}</Form.Text>
          <Form.Text style={{ color: 'red', fontSize: '1rem' }}>{msgErr}</Form.Text>
          <Button
            className="mt-2"
            onClick={() => {
              msgType === 'Query' ? queryKeplr() : executeKeplr();
            }}
          >
            {isExecLoading && <Spinner className="mr-2" animation="border" size="sm"></Spinner>}
            {msgType}
          </Button>
        </div>
      )}
    </div>
  );
};

export default AtAddress;
