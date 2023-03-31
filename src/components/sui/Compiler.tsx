import React, { useState } from 'react';
import { Alert, Button, Form, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import JSZip from 'jszip';
import axios from 'axios';
import { FaSyncAlt } from 'react-icons/fa';
import { Deploy } from './Deploy';
import { io } from 'socket.io-client';
import wrapPromise from '../../utils/wrapPromise';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import stripAnsi from 'strip-ansi';

import * as _ from 'lodash';
import { COMPILER_API_ENDPOINT, SUI_COMPILER_CONSUMER_ENDPOINT } from '../../const/endpoint';
import AlertCloseButton from '../common/AlertCloseButton';
import { FileInfo, FileUtil } from '../../utils/FileUtil';
import { readFile, stringify } from '../../utils/helper';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import {
  ArgTypeValuePair,
  dappTxn,
  getAccountModules,
  getAccountResources,
  serializedArgs,
  viewFunction,
} from './sui-helper';

import { PROD, STAGE } from '../../const/stage';
import { Socket } from 'socket.io-client/build/esm/socket';
import { isEmptyList, isNotEmptyList } from '../../utils/ListUtil';
import { TxnBuilderTypes, Types } from 'aptos';
import { Parameters } from './Parameters';
import { S3Path } from '../../const/s3-path';
import {
  compileIdV2,
  COMPILER_SUI_COMPILE_COMPLETED_V1,
  COMPILER_SUI_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_SUI_COMPILE_LOGGED_V1,
  COMPILER_SUI_PROVE_COMPLETED_V1,
  COMPILER_SUI_PROVE_ERROR_OCCURRED_V1,
  COMPILER_SUI_PROVE_LOGGED_V1,
  CompilerSuiCompileCompletedV1,
  CompilerSuiCompileErrorOccurredV1,
  CompilerSuiCompileLoggedV1,
  CompilerSuiProveCompletedV1,
  CompilerSuiProveErrorOccurredV1,
  CompilerSuiProveLoggedV1,
  REMIX_SUI_COMPILE_REQUESTED_V1,
  REMIX_SUI_PROVE_REQUESTED_V1,
  RemixSuiCompileRequestedV1,
  RemixSuiProveRequestedV1,
  reqIdV2,
} from 'wds-event';
import { CHAIN_NAME } from '../../const/chain';
import { BUILD_FILE_TYPE } from '../../const/build-file-type';

export interface ModuleWrapper {
  packageName: string;
  path: string;
  module: string;
  moduleName: string;
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

  const [packageName, setPackageName] = useState<string>('');
  const [compileTimestamp, setCompileTimestamp] = useState<string>('');
  const [moduleWrappers, setModuleWrappers] = useState<ModuleWrapper[]>([]);
  const [moduleBase64s, setModuleBase64s] = useState<string[]>([]);
  const [metaData64, setMetaDataBase64] = useState<string>('');

  const [modules, setModules] = useState<Types.MoveModuleBytecode[]>([]);
  const [targetModule, setTargetModule] = useState<string>('');
  const [moveFunction, setMoveFunction] = useState<Types.MoveFunction | undefined>();

  const [genericParameters, setGenericParameters] = useState<string[]>([]);
  const [parameters, setParameters] = useState<ArgTypeValuePair[]>([]);

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
      event_category: 'sui',
      method: 'compile',
    });
    setLoading(true);

    const address = accountID;
    const timestamp = Date.now().toString();
    setCompileTimestamp(timestamp);
    try {
      // socket connect
      let socket: Socket;
      if (STAGE === PROD) {
        socket = io(SUI_COMPILER_CONSUMER_ENDPOINT);
      } else {
        socket = io(SUI_COMPILER_CONSUMER_ENDPOINT, {
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
        COMPILER_SUI_COMPILE_ERROR_OCCURRED_V1,
        async (data: CompilerSuiCompileErrorOccurredV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_COMPILE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );
          if (
            data.compileId !==
            // compileIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp) // todo sui
            compileIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)
          ) {
            return;
          }
          await client.terminal.log({ value: stripAnsi(data.errMsg), type: 'error' });

          setLoading(false);
          socket.disconnect();
        },
      );

      socket.on(COMPILER_SUI_COMPILE_LOGGED_V1, async (data: CompilerSuiCompileLoggedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_COMPILE_LOGGED_V1} data=${stringify(data)}`,
        );
        if (
          data.compileId !==
          // compileIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp) // todo sui
          compileIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)
        ) {
          return;
        }

        await client.terminal.log({ value: stripAnsi(data.logMsg), type: 'info' });
      });

      socket.on(COMPILER_SUI_COMPILE_COMPLETED_V1, async (data: CompilerSuiCompileCompletedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_COMPILE_COMPLETED_V1} data=${stringify(data)}`,
        );
        if (
          data.compileId !==
          // compileIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp) // todo sui
          compileIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)
        ) {
          return;
        }

        const res = await axios.request({
          method: 'GET',
          url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
          params: {
            bucket: S3Path.bucket(),
            fileKey: S3Path.outKey(
              CHAIN_NAME.sui,
              // dapp.networks.sui.chain, // todo sui
              'devnet',
              accountID,
              timestamp,
              BUILD_FILE_TYPE.move,
            ),
          },
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

        let packageName = '';
        let metaData64 = '';
        let metaData: Buffer;
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
              metaData = Buffer.from(metaData64, 'base64');
              const packageNameLength = metaData[0];
              packageName = metaData.slice(1, packageNameLength + 1).toString();
              metaDataHex = metaData.toString('hex');
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

              const moduleName = Buffer.from(
                FileUtil.extractFilenameWithoutExtension(filepath),
              ).toString();
              const moduleNameHex = Buffer.from(
                FileUtil.extractFilenameWithoutExtension(filepath),
              ).toString('hex');
              const order = metaDataHex.indexOf(moduleNameHex);

              moduleWrappers.push({
                packageName: packageName,
                path: filepath,
                module: moduleBase64,
                moduleName: moduleName,
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

        setPackageName(packageName);
        setModuleWrappers([...moduleWrappers]);
        setModuleBase64s([...moduleWrappers.map((mw) => mw.module)]);
        setFileNames([...filenames]);
        setMetaDataBase64(metaData64);

        socket.disconnect();
        setLoading(false);
      });

      const formData = new FormData();
      formData.append('chainName', CHAIN_NAME.sui);
      // formData.append('chainId', dapp.networks.sui.chain); // todo sui
      formData.append('chainId', 'devnet');
      formData.append('account', address || 'noaddress');
      formData.append('timestamp', timestamp.toString() || '0');
      formData.append('fileType', 'move');
      formData.append('zipFile', blob || '');

      const res = await axios.post(COMPILER_API_ENDPOINT + '/s3Proxy/src-v2', formData, {
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

      const remixSuiCompileRequestedV1: RemixSuiCompileRequestedV1 = {
        // compileId: (CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp), // todo sui
        compileId: (CHAIN_NAME.sui, 'devnet', address, timestamp),
        chainName: CHAIN_NAME.sui,
        // chainId: dapp.networks.sui.chain, // todo sui
        chainId: 'devnet',
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'move',
      };
      socket.emit(REMIX_SUI_COMPILE_REQUESTED_V1, remixSuiCompileRequestedV1);
      log.debug(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_SUI_COMPILE_REQUESTED_V1} data=${stringify(
          remixSuiCompileRequestedV1,
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
        socket = io(SUI_COMPILER_CONSUMER_ENDPOINT);
      } else {
        socket = io(SUI_COMPILER_CONSUMER_ENDPOINT, {
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
        COMPILER_SUI_PROVE_ERROR_OCCURRED_V1,
        async (data: CompilerSuiProveErrorOccurredV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_PROVE_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );

          // if (data.id !== reqIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp)) { // todo sui
          if (data.id !== reqIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)) {
            return;
          }
          await client.terminal.log({ value: stripAnsi(data.errMsg), type: 'error' });

          setProveLoading(false);
          socket.disconnect();
        },
      );

      socket.on(COMPILER_SUI_PROVE_LOGGED_V1, async (data: CompilerSuiProveLoggedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_PROVE_LOGGED_V1} data=${stringify(data)}`,
        );
        // if (data.id !== reqIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp)) { // todo sui
        if (data.id !== reqIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)) {
          return;
        }

        await client.terminal.log({ value: stripAnsi(data.logMsg), type: 'info' });
      });

      socket.on(COMPILER_SUI_PROVE_COMPLETED_V1, async (data: CompilerSuiProveCompletedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_PROVE_COMPLETED_V1} data=${stringify(data)}`,
        );
        // if (data.id !== reqIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp)) { // todo sui
        if (data.id !== reqIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)) {
          return;
        }
        socket.disconnect();
        setProveLoading(false);
      });

      const formData = new FormData();
      formData.append('chainName', CHAIN_NAME.sui);
      // formData.append('chainId', dapp.networks.sui.chain); // todo sui
      formData.append('chainId', 'devnet');
      formData.append('account', address || 'noaddress');
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

      const remixSuiProveRequestedV1: RemixSuiProveRequestedV1 = {
        // id: compileIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp), // todo sui
        id: compileIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp),
        chainName: CHAIN_NAME.sui,
        // chainId: dapp.networks.sui.chain, // todo sui
        chainId: 'devnet',
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'move',
      };
      socket.emit(REMIX_SUI_PROVE_REQUESTED_V1, remixSuiProveRequestedV1);
      log.debug(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_SUI_PROVE_REQUESTED_V1} data=${stringify(
          remixSuiProveRequestedV1,
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
        setMoveFunction(undefined);
        return;
      }
      setModules(accountModules);
      const firstAccountModule = accountModules[0];
      setTargetModule(firstAccountModule.abi!.name);
      setMoveFunction(firstAccountModule.abi!.exposed_functions[0]);
    } catch (e) {
      log.error(e);
      client.terminal.log({ type: 'error', value: 'Cannot get account module error' });
    }
  };

  const getContractAtAddress = async () => {
    sendCustomEvent('at_address', {
      event_category: 'sui',
      method: 'at_address',
    });
    setDeployedContract(atAddress);
    getAccountModulesFromAccount(atAddress, dapp.networks.sui.chain);

    const moveResources = await getAccountResources(atAddress, dapp.networks.sui.chain);
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
        if (mod.abi?.name === e.target.value) {
          setMoveFunction(mod.abi?.exposed_functions[0]);
          setParameters([]);
        }
      });
    }
  };

  const handleFunction = (e: any) => {
    setParameters([]);
    setGenericParameters([]);
    setMoveFunction(undefined);

    const module = modules.find((m) => m.abi?.name === targetModule);
    if (!module) {
      return;
    }

    const matchFunc = module.abi?.exposed_functions.find((f) => {
      return f.name === e.target.value;
    });
    if (!matchFunc) {
      return;
    }
    setMoveFunction(matchFunc);
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
    log.info('parameters', JSON.stringify(parameters, null, 2));
    const dappTxn_ = await dappTxn(
      accountID,
      dapp.networks.sui.chain,
      deployedContract + '::' + targetModule,
      moveFunction?.name || '',
      genericParameters.map((typeTag) => TxnBuilderTypes.StructTag.fromString(typeTag)),
      serializedArgs(parameters),
    );

    const txHash = await dapp.request('sui', {
      method: 'dapp:signAndSendTransaction',
      params: [dappTxn_],
    });
    log.debug(`@@@ txHash=${txHash}`);
  };

  const view = async () => {
    console.log(parameters);

    const view = await viewFunction(
      deployedContract,
      targetModule,
      moveFunction?.name || '',
      dapp.networks.sui.chain,
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

    setPackageName('');
    setCompileTimestamp('');
    setModuleWrappers([]);
    setMetaDataBase64('');
    setModuleBase64s([]);
    setFileNames([]);

    if (isEmptyList(artifactPaths)) {
      return [];
    }

    let metaData64 = '';
    let metaData: Buffer;
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
    metaData = Buffer.from(metaData64, 'base64');
    const packageNameLength = metaData[0];
    const packageName = metaData.slice(1, packageNameLength + 1).toString();

    await Promise.all(
      artifactPaths.map(async (path) => {
        if (getExtensionOfFilename(path) === '.mv') {
          let moduleBase64 = await client?.fileManager.readFile('browser/' + path);
          if (moduleBase64) {
            const moduleName = Buffer.from(
              FileUtil.extractFilenameWithoutExtension(path),
            ).toString();
            const moduleNameHex = Buffer.from(
              FileUtil.extractFilenameWithoutExtension(path),
            ).toString('hex');
            const order = metaDataHex.indexOf(moduleNameHex);

            moduleWrappers.push({
              packageName: packageName,
              path: path,
              module: moduleBase64,
              moduleName: moduleName,
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

    setPackageName(packageName);
    setFileNames([...filenames]);
    setModuleWrappers([...moduleWrappers]);
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
          variant="warning"
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
          <small key={`sui-module-file-${i}`}>
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
          compileTimestamp={compileTimestamp}
          packageName={packageName}
          moduleWrappers={moduleWrappers}
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

      {modules.length > 0 ? (
        <>
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
                {modules.map((mod, idx) => {
                  return (
                    <option value={mod.abi?.name} key={idx + 1}>
                      {mod.abi?.name}
                    </option>
                  );
                })}
              </Form.Control>
            </InputGroup>
          </Form.Group>
          <Form.Group>
            <Form.Text className="text-muted" style={mb4}>
              <small>Functions</small>
            </Form.Text>
            <Form.Control
              style={{ marginBottom: '10px' }}
              className="custom-select"
              as="select"
              value={moveFunction?.name}
              onChange={handleFunction}
            >
              {modules.map((mod, idx) => {
                if (mod.abi?.name === targetModule) {
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
          {moveFunction ? (
            <Form.Group>
              <InputGroup>
                <Parameters
                  func={moveFunction}
                  setGenericParameters={setGenericParameters}
                  setParameters={setParameters}
                />
                <div>
                  {moveFunction.is_entry ? (
                    <Button
                      style={{ marginTop: '10px', minWidth: '70px' }}
                      variant="primary"
                      size="sm"
                      onClick={entry}
                    >
                      <small>{moveFunction.name}</small>
                    </Button>
                  ) : (
                    <div>
                      <Button
                        style={{ marginTop: '10px', minWidth: '70px' }}
                        variant="warning"
                        size="sm"
                        onClick={view}
                      >
                        <small>{moveFunction.name}</small>
                      </Button>
                    </div>
                  )}
                </div>
              </InputGroup>
              <hr />
            </Form.Group>
          ) : (
            false
          )}
        </>
      ) : (
        false
      )}
    </>
  );
};

const mb4 = {
  marginBottom: '4px',
};
