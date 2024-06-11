import React, { useState } from 'react';
import { Alert, Button, Form, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import JSZip from 'jszip';
import axios from 'axios';
import * as fzstd from 'fzstd';
import { FaSyncAlt } from 'react-icons/fa';
import { Deploy } from './Deploy';

import { io } from 'socket.io-client';
import { parseContract } from 'wds-near-contract-parser';
import { Contract } from './Contract';
import wrapPromise from '../../utils/wrapPromise';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import SmartContracts from './SmartContracts';
import { Converter } from './Converter';
import { CodeResult, ContractCodeView } from 'near-api-js/lib/providers/provider';
import { getPositionDetails, isRealError, readFile, stringify } from '../../utils/helper';
import { EditorClient } from '../../utils/editor';

import {
  compileId,
  COMPILER_NEAR_COMPILE_COMPLETED_V1,
  COMPILER_NEAR_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_NEAR_COMPILE_LOGGED_V1,
  CompilerNearCompileCompletedV1,
  CompilerNearCompileErrorOccurredV1,
  CompilerNearCompileLoggedV1,
  REMIX_NEAR_COMPILE_REQUESTED_V2,
  RemixNearCompileRequestedV2,
} from 'wds-event';

import { COMPILER_API_ENDPOINT, NEAR_COMPILER_CONSUMER_ENDPOINT } from '../../const/endpoint';
import AlertCloseButton from '../common/AlertCloseButton';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { Near, providers } from 'near-api-js';
import { Provider } from './WalletRpcProvider';
import { log } from '../../utils/logger';
import { PROD, STAGE } from '../../const/stage';
import { isEmptyObject } from '../../utils/ObjectUtil';

const RCV_EVENT_LOG_PREFIX = `[==> EVENT_RCV]`;
const SEND_EVENT_LOG_PREFIX = `[EVENT_SEND ==>]`;

interface InterfaceProps {
  compileTarget: string;
  walletRpcProvider: providers.WalletRpcProvider | undefined;
  providerProxy: Provider | undefined;
  nearConfig: Near | undefined;
  client: Client<Api, Readonly<IRemixApi>>;
  account: { address: string; pubKey: string };
}

const COMPILE_OPTION_LIST = [
  { label: 'Rust', value: 'near-rs' },
  { label: 'Rust Cargo Near', value: 'cargo-near' },
  { label: 'Rust Cargo Near EMBED-ABI', value: 'cargo-near-embed' },
  { label: 'AssemblyScript', value: 'near-as' },
  { label: 'TypeScript', value: 'near-ts' },
  { label: 'JavaScript', value: 'near-js' },
];

export const Compiler: React.FunctionComponent<InterfaceProps> = ({
  client,
  compileTarget,
  account,
  walletRpcProvider,
  providerProxy,
  nearConfig,
}) => {
  const [fileName, setFileName] = useState<string>('');
  const [compileIconSpin, setCompileIconSpin] = useState<string>('');
  const [testIconSpin, setTestIconSpin] = useState<string>('');
  const [wasm, setWasm] = useState<string>('');
  const [json, setJson] = useState<string>('');
  const [deployedJson, setDeployedJson] = useState<string>('');
  const [fileType, setFileType] = useState<string>('near-rs');
  const [atAddress, setAtAddress] = useState<string>('');
  const [methods, setMethods] = useState<Array<string>>([]);
  const [deployedContract, setDeployedContract] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isProgress, setIsProgress] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<Nullable<string>>('');

  /** check if contract wasm file has embeded abi */
  const getEmbedAbi = async (contractId: string) => {
    const response = await walletRpcProvider?.query<CodeResult>({
      request_type: 'call_function',
      account_id: contractId,
      method_name: '__contract_abi',
      args_base64: 'e30=',
      finality: 'optimistic',
    });
    if (response) {
      const decompressed_abi = fzstd.decompress(Buffer.from(response.result));
      const abi = Buffer.from(decompressed_abi).toString();
      return abi;
    }
    return '';
  };

  const parser = async (contractId: string, json?: string) => {
    if (!walletRpcProvider) {
      throw new Error('Wallet is not installed');
    }
    setIsProgress(true);
    const account_id = contractId;
    let abi = '';
    try {
      const { code_base64 } = await walletRpcProvider.query<ContractCodeView>({
        account_id,
        finality: 'optimistic',
        request_type: 'view_code',
      });
      const methodNames = parseContract(code_base64).methodNames; // todo
      // in case wasm had embeded abi
      if (methodNames.includes('__contract_abi')) {
        abi = await getEmbedAbi(contractId);
      }
      setMethods(methodNames);
      setDeployedContract(contractId);
      setDeployedJson(json ? json : abi ? abi : '');
      setIsProgress(false);
    } catch (e) {
      setIsProgress(false);
      await client.terminal.log({
        type: 'error',
        value: (e as Error).stack?.toString() || (e as Error).message,
      });
    }
  };

  const wrappedParser = (contract: string, json?: string) =>
    wrapPromise(parser(contract, json), client);

  const exists = async (functionName: string) => {
    setJson('');
    if (functionName === 'test') {
      return false;
    }

    try {
      const artifacts = await client.fileManager.readdir('browser/' + compileTarget + '/out');
      if (isEmptyObject(artifacts)) throw new Error('out directory does not exists')
      await client.terminal.log({
        type: 'error',
        value:
          "If you want to run a new compilation, delete the 'out' directory and click the Compile button again.",
      });
      const filesName = Object.keys(artifacts || {});
      await Promise.all(
        filesName.map(async (f) => {
          if (getExtensionOfFilename(f) === '.wasm') {
            const wasmFile = await client.fileManager.readFile('browser/' + f);
            setWasm(wasmFile || '');
            setFileName(f);
          } else if (getExtensionOfFilename(f) === '.json') {
            const abiFile = await client.fileManager.readFile('browser/' + f);
            setJson(abiFile || '');
          }
        }),
      );
      return true;
    } catch {
      return false;
    }
  };

  const readCode = async (functionName: string) => {
    if (loading) {
      await client.terminal.log({ type: 'error', value: 'Server is working...' });
      return;
    }
    if (
      fileType === 'near-rs' ||
      fileType === 'raen' ||
      fileType === 'cargo-near' ||
      fileType === 'cargo-near-embed'
    ) {
      if (!(await exists(functionName))) {
        setWasm('');
        setFileName('');
        setJson('');
        const toml = compileTarget + '/Cargo.toml';
        const sourceFiles = await client.fileManager.readdir('browser/' + compileTarget + '/src');
        const sourceFilesName = Object.keys(sourceFiles || {});

        const filesName = sourceFilesName.concat(toml);
        let code;
        const fileList = await Promise.all(
          filesName.map(async (f) => {
            code = await client.fileManager.getFile(f);
            return createFile(code || '', f.substring(f.lastIndexOf('/') + 1));
          }),
        );

        generateZip(fileList, functionName);
      }
    } else if (fileType === 'near-as') {
      if (!(await exists(functionName))) {
        setWasm('');
        setFileName('');
        setJson('');
        const sourceFiles = await client.fileManager.readdir(
          'browser/' + compileTarget + '/assembly',
        );
        const filesName = Object.keys(sourceFiles || {});

        let code;
        const fileList = await Promise.all(
          filesName.map(async (f) => {
            code = await client.fileManager.getFile(f);
            return createFile(code || '', f.substring(f.lastIndexOf('/') + 1));
          }),
        );

        generateZip(fileList, '');
      }
    } else if (fileType === 'near-ts') {
      if (!(await exists(functionName))) {
        setWasm('');
        setFileName('');
        setJson('');
        const babelConf = compileTarget + '/babel.config.json';
        const tsConf = compileTarget + '/tsconfig.json';
        const packageJson = compileTarget + '/package.json';

        const sourceFiles = await client.fileManager.readdir('browser/' + compileTarget + '/src');
        const sourceFilesName = Object.keys(sourceFiles || {});
        const filesName = sourceFilesName.concat(babelConf, tsConf, packageJson);

        let code;
        const fileList = await Promise.all(
          filesName.map(async (f) => {
            code = await client.fileManager.getFile(f);
            return createFile(code || '', f.substring(f.lastIndexOf('/') + 1));
          }),
        );

        generateZip(fileList, '');
      }
    } else if (fileType === 'near-js') {
      if (!(await exists(functionName))) {
        setWasm('');
        setFileName('');
        setJson('');
        const babelConf = compileTarget + '/babel.config.json';
        const packageJson = compileTarget + '/package.json';

        const sourceFiles = await client.fileManager.readdir('browser/' + compileTarget + '/src');
        const sourceFilesName = Object.keys(sourceFiles || {});
        const filesName = sourceFilesName.concat(babelConf, packageJson);

        let code;
        const fileList = await Promise.all(
          filesName.map(async (f) => {
            code = await client.fileManager.getFile(f);
            return createFile(code || '', f.substring(f.lastIndexOf('/') + 1));
          }),
        );

        generateZip(fileList, '');
      }
    }
  };

  const wrappedReadCode = (functionName: string) => wrapPromise(readCode(functionName), client);

  const createFile = (code: string, name: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    return new File([blob], name, { type: 'text/plain' });
  };

  const generateZip = (fileList: Array<any>, functionName: string) => {
    const zip = new JSZip();

    if (
      fileType === 'near-rs' ||
      fileType === 'raen' ||
      fileType === 'cargo-near' ||
      fileType === 'cargo-near-embed'
    ) {
      fileList.forEach((file) => {
        if (file.name === 'Cargo.toml') {
          zip.file(file.name, file as any);
        } else {
          zip.folder('src')?.file(file.name, file as any);
        }
      });
    } else if (fileType === 'near-as') {
      fileList.forEach((file) => {
        zip.folder('assembly')?.file(file.name, file as any);
      });
    } else if (fileType === 'near-ts' || fileType === 'near-js') {
      fileList.forEach((file) => {
        if (file.name.split('.').pop() === 'json') {
          zip.file(file.name, file as any);
        } else {
          zip.folder('src')?.file(file.name, file as any);
        }
      });
    }

    zip.generateAsync({ type: 'blob' }).then((blob) => {
      if (functionName === 'test') {
        wrappedTest(blob);
      } else {
        wrappedCompile(blob);
      }
    });
  };

  const compile = async (blob: Blob) => {
    const editorClient = new EditorClient(client);
    await editorClient.discardHighlight();
    await editorClient.clearAnnotations();
    setCompileError('');
    sendCustomEvent('compile', {
      event_category: 'near',
      method: 'compile',
    });
    setCompileIconSpin('fa-spin');
    setLoading(true);

    const address = account.address;
    const timestamp = Date.now().toString();

    try {
      const socket = io(NEAR_COMPILER_CONSUMER_ENDPOINT);

      socket.on('connect_error', function (err) {
        log.error('Error connecting to server');
        setCompileIconSpin('');
        setLoading(false);
        socket.disconnect();
      });

      socket.on(
        COMPILER_NEAR_COMPILE_ERROR_OCCURRED_V1,
        async (data: CompilerNearCompileErrorOccurredV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_NEAR_COMPILE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );
          if (data.compileId !== compileId(address, timestamp)) {
            return;
          }

          setCompileIconSpin('');
          setLoading(false);
          socket.disconnect();
        },
      );

      socket.on(COMPILER_NEAR_COMPILE_LOGGED_V1, async (data: CompilerNearCompileLoggedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_NEAR_COMPILE_LOGGED_V1} data=${stringify(data)}`,
        );
        if (data.compileId !== compileId(address, timestamp)) {
          return;
        }

        if (!(data.logMsg.includes('error') || data.logMsg.includes('Error'))) {
          await client.terminal.log({ type: 'info', value: data.logMsg });
        } else {
          await client.terminal.log({ type: 'error', value: data.logMsg });
          const { file, annotation, highlightPosition, positionDetail } = getPositionDetails(
            data.logMsg,
          );

          if (file) {
            if (isRealError(annotation)) {
              await editorClient.gotoLine(positionDetail.row, positionDetail.col);
              await editorClient.addAnnotation(annotation);

              await editorClient.highlight(
                highlightPosition,
                `${compileTarget}/${file}`,
                '#ff7675',
              );
              setCompileError((prev) => `${prev}\n${data.logMsg}`);

              setCompileIconSpin('');
              setLoading(false);
              socket.disconnect();
              return;
            }
          }
        }
      });

      socket.on(
        COMPILER_NEAR_COMPILE_COMPLETED_V1,
        async (data: CompilerNearCompileCompletedV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_NEAR_COMPILE_COMPLETED_V1} data=${stringify(data)}`,
          );
          if (data.compileId !== compileId(address, timestamp)) {
            return;
          }

          const bucket = STAGE === PROD ? 'wds-code-build' : 'wds-code-build-dev';
          const fileKey = `near/${address}/${timestamp}/out_${address}_${timestamp}_${fileType}.zip`;
          const res = await axios.request({
            method: 'GET',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy?bucket=${bucket}&fileKey=${fileKey}`,
            responseType: 'arraybuffer',
            responseEncoding: 'null',
          });

          const zip = await new JSZip().loadAsync(res.data);
          let content: any;
          await client.fileManager.mkdir('browser/' + compileTarget + '/out');

          Object.keys(zip.files).map(async (key) => {
            if (key.split('.')[1] === 'json') {
              content = await zip.file(key)?.async('string');
              setJson(content);
              await client.fileManager.writeFile(
                'browser/' + compileTarget + '/out/' + key,
                content,
              );
            } else {
              content = await zip.file(key)?.async('blob');
              content = content.slice(0, content.size, 'application/wasm');
              const wasm = new File([content], key);
              const wasmFile = await readFile(wasm);
              await client.fileManager.writeFile(
                'browser/' + compileTarget + '/out/' + key,
                wasmFile,
              );
              setWasm(wasmFile);
              setFileName(key);
            }
          });
          socket.disconnect();
          setCompileIconSpin('');
          setLoading(false);
        },
      );

      const formData = new FormData();
      formData.append('address', address || 'noaddress');
      formData.append('timestamp', timestamp.toString() || '0');
      formData.append('fileType', fileType || 'near-rs');
      formData.append('zipFile', blob || '');

      const res = await axios.post(COMPILER_API_ENDPOINT + '/s3Proxy/src', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/json',
        },
      });

      if (res.status !== 201) {
        log.error(`src upload fail. address=${address}, timestamp=${timestamp}`);
        socket.disconnect();
        setCompileIconSpin('');
        setLoading(false);
        return;
      }

      const remixNearCompileRequestedV2: RemixNearCompileRequestedV2 = {
        compileId: compileId(address, timestamp),
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: fileType || 'near-rs',
      };
      socket.emit(REMIX_NEAR_COMPILE_REQUESTED_V2, remixNearCompileRequestedV2);
      log.debug(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_NEAR_COMPILE_REQUESTED_V2} data=${stringify(
          remixNearCompileRequestedV2,
        )}`,
      );
    } catch (e) {
      setLoading(false);
      log.error(e);
      setCompileIconSpin('');
    }
  };

  const test = async (blob: Blob) => {
    sendCustomEvent('test', {
      event_category: 'near',
      method: 'test',
    });
    setTestIconSpin('fa-spin');
    setLoading(true);
    const formData = new FormData();

    const address = account.address;
    const timestamp = Date.now();

    formData.append('address', address || 'noaddress');
    formData.append('timestamp', timestamp.toString() || '0');
    formData.append('fileType', fileType || 'near-rs');
    formData.append('zipFile', blob || '');

    try {
      // socket connect
      const socket = io(NEAR_COMPILER_CONSUMER_ENDPOINT);
      socket.on(address + '-' + timestamp + '-log', async (msg) => {
        const enc = new TextDecoder('utf-8');
        const arr = new Uint8Array(msg);
        await client.terminal.log({ type: 'info', value: enc.decode(arr) });
      });

      let url = 'https://near-compiler.welldonestudio.io/test';

      const res = await axios.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          Accept: 'application/json',
        },
        responseType: 'blob',
      });

      log.debug(res);

      // socket disconnect
      socket.disconnect();

      setTestIconSpin('');
      setLoading(false);
    } catch (e) {
      setLoading(false);
      log.error(e);
      setTestIconSpin('');
    }
  };

  const wrappedCompile = (blob: Blob) => wrapPromise(compile(blob), client);
  const wrappedTest = (blob: Blob) => wrapPromise(test(blob), client);

  const getExtensionOfFilename = (filename: string) => {
    const _fileLen = filename.length;
    const _lastDot = filename.lastIndexOf('.');
    const _fileExt = filename.substring(_lastDot, _fileLen).toLowerCase();
    return _fileExt;
  };

  const handleChange = (e: { target: { value: React.SetStateAction<string> } }) => {
    setFileType(e.target.value);
  };

  const getContractAtAddress = () => {
    sendCustomEvent('at_address', {
      event_category: 'near',
      method: 'at_address',
    });
    wrappedParser(atAddress);
  };

  const handleAlertClose = () => {
    setCompileError('');
    client.call('editor', 'discardHighlight');
    client.call('editor', 'clearAnnotations');
  };

  const renderContract = () => {
    if (deployedJson) {
      try {
        const abi = Converter(JSON.parse(deployedJson), deployedContract);
        return (
          <SmartContracts
            client={client}
            account={account}
            walletRpcProvider={walletRpcProvider}
            providerProxy={providerProxy}
            nearConfig={nearConfig}
            contract={abi}
          />
        );
      } catch (e) {
        log.error(e);
        client.terminal.log({ type: 'error', value: 'ABI parsing error' });
      }
    }
    return (
      <Contract
        client={client}
        account={account}
        walletRpcProvider={walletRpcProvider}
        providerProxy={providerProxy}
        nearConfig={nearConfig}
        deployedContract={deployedContract}
        methods={methods}
      />
    );
  };

  return (
    <>
      {/* <Button
                variant="warning"
                onClick={lintCode}
                // onClick={setSchemaObj}
                block
            >
                <span>
                    {" "}Rust Analyzer
                </span>
            </Button> */}
      <div className="d-grid gap-2">
        <Form>
          <Form.Text className="text-muted" style={{ marginBottom: '4px' }}>
            <small>COMPILE OPTION</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              className="custom-select"
              as="select"
              value={fileType}
              onChange={handleChange}
            >
              {COMPILE_OPTION_LIST.map(({ label, value }, idx) => {
                return (
                  <option value={value} key={idx}>
                    {label}
                  </option>
                );
              })}
            </Form.Control>
          </InputGroup>
        </Form>

        {/* {fileType === 'near-rs' || fileType === 'raen' || fileType === 'cargo-near' ? (
          <Button
            variant="warning"
            disabled={accountID === ''}
            onClick={() => {
              wrappedReadCode('test');
            }}
            className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
            // onClick={setSchemaObj}
          >
            <FaSyncAlt className={testIconSpin} />
            <span> Test</span>
          </Button>
        ) : (
          false
        )} */}

        <Button
          variant="primary"
          disabled={account.address === '' || !compileTarget}
          onClick={() => {
            wrappedReadCode('compile');
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        >
          <FaSyncAlt className={compileIconSpin} />
          <span> Compile</span>
        </Button>
        <small>{fileName}</small>
        {compileError !== '' && (
          <Alert
            variant="danger"
            className="mt-3"
            style={{ whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}
          >
            <AlertCloseButton onClick={handleAlertClose} />
            {compileError}
          </Alert>
        )}
      </div>
      <hr />
      {wasm ? (
        <Deploy
          account={account}
          wasm={wasm}
          json={json}
          walletRpcProvider={walletRpcProvider}
          providerProxy={providerProxy}
          nearConfig={nearConfig}
          parser={wrappedParser}
          client={client}
        />
      ) : (
        <p className="text-center" style={{ marginTop: '0px !important', marginBottom: '3px' }}>
          <small>NO COMPILED CONTRACT</small>
        </p>
      )}
      <p className="text-center" style={{ marginTop: '5px !important', marginBottom: '5px' }}>
        <small>OR</small>
      </p>
      <Form.Group>
        <InputGroup>
          <Form.Control
            type="text"
            placeholder="account_id"
            size="sm"
            onChange={(e) => {
              setAtAddress(e.target.value.trim());
            }}
          />
          <OverlayTrigger
            placement="left"
            overlay={<Tooltip id="overlay-ataddresss">Use deployed Contract account id</Tooltip>}
          >
            <Button
              variant="info"
              size="sm"
              disabled={account.address === '' || isProgress}
              onClick={getContractAtAddress}
            >
              <small>At Address</small>
            </Button>
          </OverlayTrigger>
        </InputGroup>
      </Form.Group>
      <hr />
      {!methods.length ? (
        false
      ) : (
        <>
          <div>{'Deployed Contract: ' + deployedContract}</div>
          {renderContract()}
        </>
      )}
    </>
  );
};
