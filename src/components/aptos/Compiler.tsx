import React, { useState } from 'react';
import { Alert, Button, Form, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import JSZip from 'jszip';
import axios from 'axios';
import { FaSyncAlt } from 'react-icons/fa';
import { Deploy } from './Deploy';
import { io } from 'socket.io-client';
import wrapPromise from '../../utils/wrapPromise';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import * as _ from 'lodash';
import {
  compileId,
  COMPILER_APTOS_COMPILE_COMPLETED_V1,
  COMPILER_APTOS_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_APTOS_COMPILE_LOGGED_V1,
  COMPILER_APTOS_PROVE_COMPLETED_V1,
  COMPILER_APTOS_PROVE_ERROR_OCCURRED_V1,
  COMPILER_APTOS_PROVE_LOGGED_V1,
  CompilerAptosCompileCompletedV1,
  CompilerAptosCompileErrorOccurredV1,
  CompilerAptosCompileLoggedV1,
  CompilerAptosProveCompletedV1,
  CompilerAptosProveErrorOccurredV1,
  CompilerAptosProveLoggedV1,
  REMIX_APTOS_COMPILE_REQUESTED_V1,
  REMIX_APTOS_PROVE_REQUESTED_V1,
  RemixAptosCompileRequestedV1,
  RemixAptosProveRequestedV1,
  reqId,
} from 'wds-event';

import { APTOS_COMPILER_CONSUMER_ENDPOINT, COMPILER_API_ENDPOINT } from '../../const/endpoint';
import AlertCloseButton from '../common/AlertCloseButton';
import { FileInfo, FileUtil } from '../../utils/FileUtil';
import { readFile, stringify } from '../../utils/helper';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import { build, getAccountModules, getAccountResources, viewFunction } from './aptos-helper';

import { PROD, STAGE } from '../../const/stage';
import { Socket } from 'socket.io-client/build/esm/socket';
import { isEmptyList, isNotEmptyList } from '../../utils/ListUtil';
import { Types } from 'aptos';

interface ModuleWrapper {
  path: string;
  module: string;
  moduleNameHex: string;
  order: number;
}

const RCV_EVENT_LOG_PREFIX = `[==> EVENT_RCV]`;
const SEND_EVENT_LOG_PREFIX = `[EVENT_SEND ==>]`;

interface InterfaceProps {
  compileTarget: string;
  accountID: string;
  dapp: any;
  client: Client<Api, Readonly<IRemixApi>>;
}

export const Compiler: React.FunctionComponent<InterfaceProps> = ({
  client,
  compileTarget,
  accountID,
  dapp,
}) => {
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [proveLoading, setProveLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<Nullable<string>>(null);
  const [atAddress, setAtAddress] = useState<string>('');
  const [isProgress, setIsProgress] = useState<boolean>(false);
  const [deployedContract, setDeployedContract] = useState<string>('');

  const [moduleBase64s, setModuleBase64s] = useState<string[]>([]);
  const [metaData64, setMetaDataBase64] = useState<string>('');

  const [modules, setModules] = useState<any[]>([]);
  const [targetModule, setTargetModule] = useState<string>('');

  const [targetFunction, setTargetFunction] = useState<string>('');

  const [genericParameters, setGenericParameters] = useState<any[]>([]);
  const [parameters, setParameters] = useState<any[]>([]);

  const [accountResources, setAccountResources] = useState<Types.MoveResource[]>([]);
  const [targetResource, setTargetResource] = useState<string>('');

  const findArtifacts = async () => {
    let artifacts = {};
    try {
      artifacts = await client?.fileManager.readdir('browser/' + compileTarget + '/out');
    } catch (e) {
      log.info(`no out folder`);
    }
    log.debug(`@@@ artifacts`, artifacts);
    return Object.keys(artifacts || {});
  };

  const handleAlertClose = () => {
    setCompileError('');
    client.call('editor', 'discardHighlight');
    client.call('editor', 'clearAnnotations');
  };

  const requestProve = async () => {
    if (proveLoading) {
      await client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }
    const projFiles = await FileUtil.allFilesForBrowser(client, compileTarget);
    log.debug(`@@@ prove projFiles`, projFiles);
    const buildFileExcluded = projFiles.filter((f) => !f.path.startsWith(`${compileTarget}/out`));
    log.debug(`@@@ prove buildFileExcluded`, buildFileExcluded);
    if (isEmptyList(buildFileExcluded)) {
      return;
    }

    const blob = await generateZip(buildFileExcluded);

    await wrappedProve(blob);
  };

  const wrappedRequestCompile = () => wrapPromise(requestCompile(), client);
  const wrappedRequestProve = () => wrapPromise(requestProve(), client);

  const createFile = (code: string, name: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    return new File([blob], name, { type: 'text/plain' });
  };

  const generateZip = async (fileInfos: Array<FileInfo>) => {
    const zip = new JSZip();

    await Promise.all(
      fileInfos.map(async (fileinfo: FileInfo) => {
        if (!fileinfo.isDirectory) {
          const content = await client?.fileManager.readFile(fileinfo.path);
          const f = createFile(
            content || '',
            fileinfo.path.substring(fileinfo.path.lastIndexOf('/') + 1),
          );
          const chainFolderExcluded = fileinfo.path.substring(fileinfo.path.indexOf('/') + 1);
          const projFolderExcluded = chainFolderExcluded.substring(
            chainFolderExcluded.indexOf('/') + 1,
          );
          zip.file(projFolderExcluded, f);
        }
      }),
    );

    return zip.generateAsync({ type: 'blob' });
  };

  const sendCompileReq = async (blob: Blob) => {
    setCompileError(null);
    sendCustomEvent('compile', {
      event_category: 'aptos',
      method: 'compile',
    });
    setLoading(true);

    const address = accountID;
    const timestamp = Date.now().toString();
    try {
      // socket connect
      let socket: Socket;
      if (STAGE === PROD) {
        socket = io(APTOS_COMPILER_CONSUMER_ENDPOINT);
      } else {
        socket = io(APTOS_COMPILER_CONSUMER_ENDPOINT, {
          transports: ['websocket'],
        });
      }

      socket.on('connect_error', function (err) {
        // handle server error here
        log.debug('Error connecting to server');
        setLoading(false);
        socket.disconnect();
      });

      socket.on(
        COMPILER_APTOS_COMPILE_ERROR_OCCURRED_V1,
        async (data: CompilerAptosCompileErrorOccurredV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_APTOS_COMPILE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );
          if (data.compileId !== compileId(address, timestamp)) {
            return;
          }

          setLoading(false);
          socket.disconnect();
        },
      );

      socket.on(COMPILER_APTOS_COMPILE_LOGGED_V1, async (data: CompilerAptosCompileLoggedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_APTOS_COMPILE_LOGGED_V1} data=${stringify(data)}`,
        );
        if (data.compileId !== compileId(address, timestamp)) {
          return;
        }

        await client.terminal.log({ value: data.logMsg, type: 'info' });
      });

      socket.on(
        COMPILER_APTOS_COMPILE_COMPLETED_V1,
        async (data: CompilerAptosCompileCompletedV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_APTOS_COMPILE_COMPLETED_V1} data=${stringify(
              data,
            )}`,
          );
          if (data.compileId !== compileId(address, timestamp)) {
            return;
          }

          const bucket = 'aptos-origin-code';
          const fileKey = `${address}/${timestamp}/out_${address}_${timestamp}_move.zip`;
          const res = await axios.request({
            method: 'GET',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy?bucket=${bucket}&fileKey=${fileKey}`,
            responseType: 'arraybuffer',
            responseEncoding: 'null',
          });
          //
          // const zip = await new JSZip().loadAsync(res.data);
          // let content: any;

          const zip = await new JSZip().loadAsync(res.data);
          try {
            await client?.fileManager.mkdir('browser/' + compileTarget + '/out');
          } catch (e) {
            log.error(e);
            setLoading(false);
            return;
          }

          let metaData64 = '';
          let metaDataHex = '';
          let filenames: string[] = [];
          let moduleWrappers: ModuleWrapper[] = [];

          log.debug(zip.files);

          // ABI
          // await Promise.all(
          //   Object.keys(zip.files).map(async (key) => {
          //     if (key.includes('.abi')) {
          //       let content = await zip.file(key)?.async('arraybuffer');
          //       log.debug(content)
          //       log.debug((new TextDecoder().decode(content)))

          //       await client?.fileManager.writeFile(
          //         'browser/' + compileTarget + '/out/abi/' + FileUtil.extractFilename(key),
          //         (new TextDecoder().decode(content))
          //       );
          //     }
          //   }),
          // );

          await Promise.all(
            Object.keys(zip.files).map(async (key) => {
              if (key.includes('package-metadata.bcs')) {
                let content = await zip.file(key)?.async('blob');
                content = content?.slice(0, content.size) ?? new Blob();
                metaData64 = await readFile(new File([content], key));
                metaDataHex = Buffer.from(metaData64, 'base64').toString('hex');
                log.debug(`metadataFile_Base64=${metaData64}`);
                try {
                  await client?.fileManager.writeFile(
                    'browser/' + compileTarget + '/out/' + FileUtil.extractFilename(key),
                    metaData64,
                  );
                } catch (e) {
                  log.error(e);
                  setLoading(false);
                }
              }
            }),
          );

          await Promise.all(
            Object.keys(zip.files).map(async (filepath) => {
              if (filepath.match('\\w+\\/bytecode_modules\\/\\w+.mv')) {
                const moduleDataBuf = await zip.file(filepath)?.async('nodebuffer');
                log.debug(`moduleDataBuf=${moduleDataBuf?.toString('hex')}`);
                let content = await zip.file(filepath)?.async('blob');
                content = content?.slice(0, content.size) ?? new Blob();
                const moduleBase64 = await readFile(new File([content], filepath));
                log.debug(`moduleBase64=${moduleBase64}`);

                const moduleNameHex = Buffer.from(
                  FileUtil.extractFilenameWithoutExtension(filepath),
                ).toString('hex');
                const order = metaDataHex.indexOf(moduleNameHex);

                moduleWrappers.push({
                  path: filepath,
                  module: moduleBase64,
                  moduleNameHex: moduleNameHex,
                  order: order,
                });

                try {
                  await client?.fileManager.writeFile(
                    'browser/' + compileTarget + '/out/' + FileUtil.extractFilename(filepath),
                    moduleBase64,
                  );
                  filenames.push(compileTarget + '/out/' + FileUtil.extractFilename(filepath));
                } catch (e) {
                  log.error(e);
                  setLoading(false);
                }
              }
            }),
          );
          moduleWrappers = _.orderBy(moduleWrappers, (mw) => mw.order);
          log.info('@@@ moduleWrappers', moduleWrappers);

          setModuleBase64s([...moduleWrappers.map((mw) => mw.module)]);
          setFileNames([...filenames]);
          setMetaDataBase64(metaData64);

          socket.disconnect();
          setLoading(false);
        },
      );

      const formData = new FormData();
      formData.append('address', address || 'noaddress');
      formData.append('timestamp', timestamp.toString() || '0');
      formData.append('fileType', 'move');
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
        setLoading(false);
        return;
      }

      const remixAptosCompileRequestedV1: RemixAptosCompileRequestedV1 = {
        compileId: compileId(address, timestamp),
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'move',
      };
      socket.emit(REMIX_APTOS_COMPILE_REQUESTED_V1, remixAptosCompileRequestedV1);
      log.debug(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_APTOS_COMPILE_REQUESTED_V1} data=${stringify(
          remixAptosCompileRequestedV1,
        )}`,
      );
    } catch (e) {
      setLoading(false);
      log.error(e);
    }
  };

  const sendProveReq = async (blob: Blob) => {
    setProveLoading(true);

    const address = accountID;
    const timestamp = Date.now().toString();
    try {
      // socket connect
      let socket: Socket;
      if (STAGE === PROD) {
        socket = io(APTOS_COMPILER_CONSUMER_ENDPOINT);
      } else {
        socket = io(APTOS_COMPILER_CONSUMER_ENDPOINT, {
          transports: ['websocket'],
        });
      }

      socket.on('connect_error', function (err) {
        // handle server error here
        log.debug('Error connecting to server');
        setProveLoading(false);
        socket.disconnect();
      });

      socket.on(
        COMPILER_APTOS_PROVE_ERROR_OCCURRED_V1,
        async (data: CompilerAptosProveErrorOccurredV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_APTOS_PROVE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );

          if (data.id !== reqId(address, timestamp)) {
            return;
          }
          await client.terminal.log({ value: data.errMsg, type: 'error' });

          setProveLoading(false);
          socket.disconnect();
        },
      );

      socket.on(COMPILER_APTOS_PROVE_LOGGED_V1, async (data: CompilerAptosProveLoggedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_APTOS_PROVE_LOGGED_V1} data=${stringify(data)}`,
        );
        if (data.id !== reqId(address, timestamp)) {
          return;
        }

        await client.terminal.log({ value: data.logMsg, type: 'info' });
      });

      socket.on(COMPILER_APTOS_PROVE_COMPLETED_V1, async (data: CompilerAptosProveCompletedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_APTOS_PROVE_COMPLETED_V1} data=${stringify(data)}`,
        );
        if (data.id !== reqId(address, timestamp)) {
          return;
        }
        socket.disconnect();
        setProveLoading(false);
      });

      const formData = new FormData();
      formData.append('address', address || 'noaddress');
      formData.append('timestamp', timestamp.toString() || '0');
      formData.append('fileType', 'move');
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
        setLoading(false);
        return;
      }

      const remixAptosProveRequestedV1: RemixAptosProveRequestedV1 = {
        id: compileId(address, timestamp),
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'move',
      };
      socket.emit(REMIX_APTOS_PROVE_REQUESTED_V1, remixAptosProveRequestedV1);
      log.debug(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_APTOS_PROVE_REQUESTED_V1} data=${stringify(
          remixAptosProveRequestedV1,
        )}`,
      );
    } catch (e) {
      setProveLoading(false);
      log.error(e);
    }
  };

  const wrappedCompile = (blob: Blob) => wrapPromise(sendCompileReq(blob), client);
  const wrappedProve = (blob: Blob) => wrapPromise(sendProveReq(blob), client);

  const getExtensionOfFilename = (filename: string) => {
    const _fileLen = filename.length;
    const _lastDot = filename.lastIndexOf('.');
    return filename.substring(_lastDot, _fileLen).toLowerCase();
  };

  const getAccountModulesFromAccount = async (account: string, chainId: string) => {
    try {
      const accountModules = await getAccountModules(account, chainId);
      log.info('@@@ accountModules', accountModules);
      if (isEmptyList(accountModules)) {
        setModules([]);
        setTargetModule('');
        setTargetFunction('');
        return;
      }
      setModules(accountModules);
      const firstAccountModule = accountModules[0];
      setTargetModule(firstAccountModule.abi!.name);
      setTargetFunction(firstAccountModule.abi!.exposed_functions[0].name);
    } catch (e) {
      log.error(e);
      client.terminal.log({ type: 'error', value: 'Cannot get account module error' });
    }
  };

  const getContractAtAddress = async () => {
    sendCustomEvent('at_address', {
      event_category: 'aptos',
      method: 'at_address',
    });
    setDeployedContract(atAddress);
    getAccountModulesFromAccount(atAddress, dapp.networks.aptos.chain);

    const moveResources = await getAccountResources(atAddress, dapp.networks.aptos.chain);
    log.info(`@@@ moveResources`, moveResources);
    setAccountResources([...moveResources]);
    if (isNotEmptyList(moveResources)) {
      setTargetResource(moveResources[0].type);
    } else {
      setTargetResource('');
    }
    setParameters([]);
  };

  const setModuleAndABI = (e: any) => {
    setTargetModule(e.target.value);
    if (modules.length) {
      modules.map((mod, idx) => {
        if (mod.abi.name === e.target.value) {
          setTargetFunction(mod.abi.exposed_functions[0].name);
          setParameters([]);
        }
      });
    }
  };

  const handleFunction = (e: any) => {
    setTargetFunction(e.target.value);
    setParameters([]);
    setGenericParameters([]);
  };

  const onChangeResource = (e: any) => {
    const resourceType = e.target.value;
    log.info('###', resourceType);
    setTargetResource(resourceType);
  };

  const queryResource = () => {
    log.info(`targetResource`, targetResource);
    log.info(`accountResources`, accountResources);
    const selectedResource = accountResources.find((r) => r.type === targetResource);
    if (!selectedResource) {
      client.terminal.log({
        type: 'error',
        value: `Resource Not Found For Type ${targetResource}`,
      });
      return;
    }

    client.terminal.log({
      type: 'info',
      value: `\n${targetResource}\n${JSON.stringify(selectedResource.data, null, 2)}\n`,
    });
  };

  const entry = async () => {
    // remove signer param
    let param = parameters;
    if (param.length >= 1 && param[0] === undefined) {
      param.shift();
    }

    console.log(param);
    const chainId = dapp.networks.aptos.chain;
    const abiBuilderConfig = {
      sender: accountID,
    };

    const setMsg = await build(
      deployedContract + '::' + targetModule + '::' + targetFunction,
      genericParameters,
      param, // Array
      chainId,
      abiBuilderConfig,
    );

    const txHash = await dapp.request('aptos', {
      method: 'dapp:signAndSendTransaction',
      params: [setMsg],
    });
    log.debug(`@@@ txHash=${txHash}`);
  };

  const updateGenericParam = (e: any, idx: any) => {
    setGenericParameters((existingGenericParams) => {
      existingGenericParams[idx] = e.target.value;
      return existingGenericParams;
    });
  };

  const updateParam = (e: any, idx: any) => {
    setParameters((existingParams) => {
      log.debug(e.target.value);
      existingParams[idx] = e.target.value;
      return existingParams;
    });
  };

  const view = async () => {
    console.log(parameters);

    const view = await viewFunction(
      deployedContract,
      targetModule,
      targetFunction,
      dapp.networks.aptos.chain,
      genericParameters, // typeArgs
      parameters,
    );

    log.debug(view);
    if (view.error) {
      await client.terminal.log({
        type: 'error',
        value: view.error.split('\\"').join(''),
      });
      return;
    }

    if (Array.isArray(view.result) && view.result.length === 1) {
      await client.terminal.log({
        type: 'info',
        value: `${JSON.stringify(view.result[0], null, 2)}`,
      });
      return;
    }

    await client.terminal.log({
      type: 'info',
      value: `${JSON.stringify(view.result, null, 2)}`,
    });
  };

  const prepareModules = async () => {
    const artifactPaths = await findArtifacts();

    setMetaDataBase64('');
    setModuleBase64s([]);
    setFileNames([]);

    if (isEmptyList(artifactPaths)) {
      return [];
    }

    let metaData64 = '';
    let metaDataHex = '';
    let filenames: string[] = [];
    let moduleWrappers: ModuleWrapper[] = [];

    await Promise.all(
      artifactPaths.map(async (path) => {
        if (path.includes('package-metadata.bcs')) {
          metaData64 = await client?.fileManager.readFile('browser/' + path);
          metaDataHex = Buffer.from(metaData64, 'base64').toString('hex');
        }
      }),
    );

    await Promise.all(
      artifactPaths.map(async (path) => {
        if (getExtensionOfFilename(path) === '.mv') {
          let moduleBase64 = await client?.fileManager.readFile('browser/' + path);
          if (moduleBase64) {
            const moduleNameHex = Buffer.from(
              FileUtil.extractFilenameWithoutExtension(path),
            ).toString('hex');
            const order = metaDataHex.indexOf(moduleNameHex);

            moduleWrappers.push({
              path: path,
              module: moduleBase64,
              moduleNameHex: moduleNameHex,
              order: order,
            });
          }
          filenames.push(path);
        }
      }),
    );

    moduleWrappers = _.orderBy(moduleWrappers, (mw) => mw.order);
    log.debug('@@@ moduleWrappers', moduleWrappers);

    setFileNames([...filenames]);
    setModuleBase64s([...moduleWrappers.map((m) => m.module)]);
    setMetaDataBase64(metaData64);

    return filenames;
  };

  const requestCompile = async () => {
    if (loading) {
      await client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }

    const moduleFiles = await prepareModules();
    if (isNotEmptyList(moduleFiles)) {
      await client.terminal.log({
        type: 'error',
        value:
          "If you want to run a new compilation, delete the 'out' directory and click the Compile button again.",
      });
      return;
    }

    const projFiles = await FileUtil.allFilesForBrowser(client, compileTarget);
    log.info(`@@@ compile projFiles`, projFiles);
    if (isEmptyList(projFiles)) {
      return;
    }

    const existsOutFolder = projFiles.find((f) => f.path.startsWith(`${compileTarget}/out`));
    if (existsOutFolder) {
      await client.terminal.log({
        type: 'error',
        value:
          "If you want to run a new compilation, delete the 'out' directory and click the Compile button again.",
      });
      return;
    }

    const blob = await generateZip(projFiles);
    if (!blob) {
      return;
    }

    await wrappedCompile(blob);
  };

  return (
    <>
      <div className="d-grid gap-2">
        <Button
          variant="primary"
          disabled={accountID === '' || proveLoading || loading}
          onClick={async () => {
            await wrappedRequestCompile();
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
          // onClick={setSchemaObj}
        >
          <FaSyncAlt className={loading ? 'fa-spin' : ''} />
          <span> Compile</span>
        </Button>

        <Button
          variant="primary"
          disabled={accountID === '' || proveLoading || loading}
          onClick={async () => {
            await wrappedRequestProve();
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        >
          <FaSyncAlt className={proveLoading ? 'fa-spin' : ''} />
          <span> Prove</span>
        </Button>

        {fileNames.map((filename, i) => (
          <small key={`aptos-module-file-${i}`}>
            {filename}
            {i < filename.length - 1 ? <br /> : false}
          </small>
        ))}

        {compileError && (
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
      {metaData64 ? (
        <Deploy
          wallet={'Dsrv'}
          accountID={accountID}
          metaData64={metaData64}
          moduleBase64s={moduleBase64s}
          dapp={dapp}
          client={client}
          setDeployedContract={setDeployedContract}
          setAtAddress={setAtAddress}
          setAccountResources={setAccountResources}
          setTargetResource={setTargetResource}
          setParameters={setParameters}
          getAccountModulesFromAccount={getAccountModulesFromAccount}
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
            placeholder="account"
            size="sm"
            onChange={(e) => {
              setAtAddress(e.target.value.trim());
            }}
            value={atAddress}
          />
          <OverlayTrigger
            placement="left"
            overlay={<Tooltip id="overlay-ataddresss">Use deployed Contract account</Tooltip>}
          >
            <Button
              variant="info"
              size="sm"
              disabled={accountID === '' || isProgress}
              onClick={getContractAtAddress}
            >
              <small>At Address</small>
            </Button>
          </OverlayTrigger>
        </InputGroup>
      </Form.Group>
      <hr />

      {atAddress || deployedContract ? (
        <Form.Group>
          <Form.Text className="text-muted" style={mb4}>
            <small>Resources</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              style={{ width: '80%', marginBottom: '10px' }}
              className="custom-select"
              as="select"
              value={targetResource}
              onChange={onChangeResource}
            >
              {accountResources.map((accountResource, idx) => {
                return (
                  <option value={accountResource.type} key={`accountResources-${idx}`}>
                    {accountResource.type}
                  </option>
                );
              })}
            </Form.Control>
          </InputGroup>
          <Button
            style={{ marginTop: '10px', minWidth: '70px' }}
            variant="warning"
            size="sm"
            onClick={queryResource}
          >
            <small>Query Resource</small>
          </Button>
        </Form.Group>
      ) : (
        false
      )}

      {modules.length ? (
        <Form.Group>
          <Form.Text className="text-muted" style={mb4}>
            <small>Modules</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              className="custom-select"
              as="select"
              value={targetModule}
              onChange={setModuleAndABI}
            >
              {modules?.map((mod, idx) => {
                return (
                  <option value={mod.abi.name} key={idx + 1}>
                    {mod.abi.name}
                  </option>
                );
              })}
            </Form.Control>
          </InputGroup>
        </Form.Group>
      ) : (
        false
      )}
      {modules.length && targetModule ? (
        <Form.Group>
          <Form.Text className="text-muted" style={mb4}>
            <small>Functions</small>
          </Form.Text>
          <Form.Control
            style={{ marginBottom: '10px' }}
            className="custom-select"
            as="select"
            value={targetFunction}
            onChange={handleFunction}
          >
            {modules.map((mod, idx) => {
              if (mod.abi.name === targetModule) {
                return mod.abi.exposed_functions.map((func: any, idx: any) => {
                  return (
                    <option value={func.name} key={idx}>
                      {func.name}
                    </option>
                  );
                });
              }
            })}
          </Form.Control>
        </Form.Group>
      ) : (
        false
      )}
      {targetModule && targetFunction
        ? modules.map((mod) => {
            if (mod.abi.name === targetModule) {
              return mod.abi.exposed_functions.map((func: any, idx: any) => {
                if (func.name === targetFunction) {
                  return (
                    <Form.Group key={`parameters-${idx}`}>
                      <InputGroup>
                        <div style={{ width: '100%' }}>
                          <div>
                            <div>
                              {func.generic_type_params.length > 0 ? (
                                <small>Type Parameters</small>
                              ) : (
                                <></>
                              )}
                            </div>
                            {func.generic_type_params.map((param: any, idx: number) => {
                              return (
                                <Form.Control
                                  style={{ width: '100%', marginBottom: '5px' }}
                                  type="text"
                                  placeholder={`Type Arg ${idx + 1}`}
                                  size="sm"
                                  onChange={(e) => {
                                    updateGenericParam(e, idx);
                                  }}
                                  key={idx}
                                />
                              );
                            })}
                          </div>
                          <div>
                            <small>Parameters</small>
                            {func.params.map((param: any, idx: number) => {
                              if (func.is_entry && idx === 0) {
                                return <></>;
                              }
                              return (
                                <Form.Control
                                  style={{ width: '100%', marginBottom: '5px' }}
                                  type="text"
                                  placeholder={param}
                                  size="sm"
                                  onChange={(e) => {
                                    updateParam(e, idx);
                                  }}
                                />
                              );
                            })}
                            {func.is_entry ? (
                              <Button
                                style={{ marginTop: '10px', minWidth: '70px' }}
                                variant="primary"
                                size="sm"
                                onClick={entry}
                              >
                                <small>{func.name}</small>
                              </Button>
                            ) : (
                              <div>
                                <Button
                                  style={{ marginTop: '10px', minWidth: '70px' }}
                                  variant="warning"
                                  size="sm"
                                  onClick={view}
                                >
                                  <small>{func.name}</small>
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </InputGroup>
                      <hr />
                    </Form.Group>
                  );
                }
              });
            }
          })
        : false}
    </>
  );
};

const mb4 = {
  marginBottom: '4px',
};
