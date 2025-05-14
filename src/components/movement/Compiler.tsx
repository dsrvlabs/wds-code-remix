import React, { useEffect, useState } from 'react';
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
import {
  MovementGitDependency,
  compileIdV2,
  reqIdV2,
  RemixMovementCompileRequestedV2,
  RemixMovementProveRequestedV2,
  CompilerMovementCompileErrorOccurredV2,
  CompilerMovementCompileLoggedV2,
  CompilerMovementProveCompletedV2,
  CompilerMovementProveErrorOccurredV2,
  CompilerMovementProveLoggedV2,
  CompilerMovementCompileCompletedV3,
  REMIX_MOVEMENT_COMPILE_REQUESTED_V2,
  REMIX_MOVEMENT_PROVE_REQUESTED_V2,
  COMPILER_MOVEMENT_COMPILE_ERROR_OCCURRED_V2,
  COMPILER_MOVEMENT_COMPILE_LOGGED_V2,
  COMPILER_MOVEMENT_PROVE_COMPLETED_V2,
  COMPILER_MOVEMENT_PROVE_ERROR_OCCURRED_V2,
  COMPILER_MOVEMENT_PROVE_LOGGED_V2,
  COMPILER_MOVEMENT_COMPILE_COMPLETED_V3,
} from 'wds-event';

import { MOVEMENT_COMPILER_CONSUMER_ENDPOINT, COMPILER_API_ENDPOINT } from '../../const/endpoint';
import AlertCloseButton from '../common/AlertCloseButton';
import { FileInfo, FileUtil } from '../../utils/FileUtil';
import { readFile, shortenHexString, stringify } from '../../utils/helper';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import {
  movementNodeUrl,
  ArgTypeValuePair,
  codeBytes,
  getEstimateGas,
  genPayload,
  getAccountModules,
  getAccountResources,
  metadataSerializedBytes,
  viewFunction,
} from './movement-helper';

import { PROD, STAGE } from '../../const/stage';
import { Socket } from 'socket.io-client/build/esm/socket';
import { isEmptyList, isNotEmptyList } from '../../utils/ListUtil';
import { AptosClient as MovementClient, HexString, Types } from 'aptos';
import { Parameters } from './Parameters';
import { S3Path } from '../../const/s3-path';
import { CHAIN_NAME } from '../../const/chain';
import { BUILD_FILE_TYPE } from '../../const/build-file-type';
import copy from 'copy-to-clipboard';
import EntryButton from './EntryButton';
import { CustomTooltip } from '../common/CustomTooltip';

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
  const [cliVersion, setCliVersion] = useState<string>('');
  const [movementGitDependencies, setMovementGitDependencies] = useState<MovementGitDependency[]>(
    [],
  );

  const [modules, setModules] = useState<Types.MoveModuleBytecode[]>([]);
  const [targetModule, setTargetModule] = useState<string>('');
  const [moveFunction, setMoveFunction] = useState<Types.MoveFunction | undefined>();

  const [genericParameters, setGenericParameters] = useState<string[]>([]);
  const [parameters, setParameters] = useState<ArgTypeValuePair[]>([]);

  const [accountResources, setAccountResources] = useState<Types.MoveResource[]>([]);
  const [targetResource, setTargetResource] = useState<string>('');

  const [copyMsg, setCopyMsg] = useState<string>('Copy');

  const [estimatedGas, setEstimatedGas] = useState<string | undefined>();
  const [gasUnitPrice, setGasUnitPrice] = useState<string>('0');
  const [maxGasAmount, setMaxGasAmount] = useState<string>('0');

  const [entryEstimatedGas, setEntryEstimatedGas] = useState<string | undefined>();
  const [entryGasUnitPrice, setEntryGasUnitPrice] = useState<string>('0');
  const [entryMaxGasAmount, setEntryMaxGasAmount] = useState<string>('0');
  const [uploadCodeChecked, setUploadCodeChecked] = useState(true);

  useEffect(() => {
    setPackageName('');
    setCompileTimestamp('');
    setModuleBase64s([]);
    setFileNames([]);
    setModuleWrappers([]);
    setMetaDataBase64('');
    setCliVersion('');
    setMovementGitDependencies([]);
  }, [compileTarget]);
  const handleCheckboxChange = (event: {
    target: { checked: boolean | ((prevState: boolean) => boolean) };
  }) => {
    setUploadCodeChecked(event.target.checked);
  };

  const setGasUnitPriceValue = (e: { target: { value: React.SetStateAction<string> } }) => {
    setGasUnitPrice(e.target.value);
  };

  const setMaxGasAmountValue = (e: { target: { value: React.SetStateAction<string> } }) => {
    setMaxGasAmount(e.target.value);
  };

  const setEntryGasUnitPriceValue = (e: { target: { value: React.SetStateAction<string> } }) => {
    setEntryGasUnitPrice(e.target.value);
  };

  const setEntryMaxGasAmountValue = (e: { target: { value: React.SetStateAction<string> } }) => {
    setEntryMaxGasAmount(e.target.value);
  };

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
      event_category: 'movement',
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
        socket = io(MOVEMENT_COMPILER_CONSUMER_ENDPOINT);
      } else {
        socket = io(MOVEMENT_COMPILER_CONSUMER_ENDPOINT, {
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
        COMPILER_MOVEMENT_COMPILE_ERROR_OCCURRED_V2,
        async (data: CompilerMovementCompileErrorOccurredV2) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_MOVEMENT_COMPILE_ERROR_OCCURRED_V2} data=${stringify(
              data,
            )}`,
          );

          if (!uploadCodeChecked) {
            try {
              await axios.request({
                method: 'DELETE',
                url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
                params: {
                  chainName: CHAIN_NAME.movement,
                  chainId: data.chainId,
                  account: data.address,
                  timestamp: timestamp,
                },
                responseType: 'arraybuffer',
                responseEncoding: 'null',
              });
            } catch (e) {
              //
            }
          }

          if (
            data.compileId !==
            compileIdV2(CHAIN_NAME.movement, dapp.networks.movement.chain, address, timestamp)
          ) {
            return;
          }
          await client.terminal.log({ value: stripAnsi(data.errMsg), type: 'error' });

          setLoading(false);
          socket.disconnect();
        },
      );

      socket.on(
        COMPILER_MOVEMENT_COMPILE_LOGGED_V2,
        async (data: CompilerMovementCompileLoggedV2) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_MOVEMENT_COMPILE_LOGGED_V2} data=${stringify(
              data,
            )}`,
          );
          if (
            data.compileId !==
            compileIdV2(CHAIN_NAME.movement, dapp.networks.movement.chain, address, timestamp)
          ) {
            return;
          }

          await client.terminal.log({ value: stripAnsi(data.logMsg), type: 'info' });
        },
      );

      socket.on(
        COMPILER_MOVEMENT_COMPILE_COMPLETED_V3,
        async (data: CompilerMovementCompileCompletedV3) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_MOVEMENT_COMPILE_COMPLETED_V3} data=${stringify(
              data,
            )}`,
          );

          if (
            data.compileId !==
            compileIdV2(CHAIN_NAME.movement, dapp.networks.movement.chain, address, timestamp)
          ) {
            return;
          }

          const res = await axios.request({
            method: 'GET',
            url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
            params: {
              bucket: S3Path.bucket(),
              fileKey: S3Path.outKey(
                CHAIN_NAME.movement,
                dapp.networks.movement.chain,
                address,
                timestamp,
                BUILD_FILE_TYPE.move,
              ),
            },
            responseType: 'arraybuffer',
            responseEncoding: 'null',
          });

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

          if (!uploadCodeChecked) {
            try {
              await axios.request({
                method: 'DELETE',
                url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
                params: {
                  chainName: CHAIN_NAME.movement,
                  chainId: data.chainId,
                  account: data.address,
                  timestamp: timestamp,
                },
                responseType: 'arraybuffer',
                responseEncoding: 'null',
              });
            } catch (e) {
              //
            }
          }

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

          setPackageName(packageName);
          setModuleWrappers([...moduleWrappers]);
          setModuleBase64s([...moduleWrappers.map((mw) => mw.module)]);
          setFileNames([...filenames]);
          setMetaDataBase64(metaData64);
          setCliVersion(data.cliVersion);
          log.info(
            `@@@ data.movementGitDependencies ${JSON.stringify(data.movementGitDependencies)}`,
          );
          setMovementGitDependencies([...data.movementGitDependencies]);

          const movementClient = new MovementClient(movementNodeUrl(dapp.networks.movement.chain));

          const rawTransaction = await movementClient.generateRawTransaction(
            new HexString(accountID),
            genPayload(
              '0x1::code',
              'publish_package_txn',
              [],
              [
                metadataSerializedBytes(metaData64),
                codeBytes([...moduleWrappers.map((mw) => mw.module)]),
              ],
            ),
          );
          // pubKey가 없는 경우 기본값 사용
          const pubKey =
            dapp.networks.movement.account?.pubKey ||
            '0x0000000000000000000000000000000000000000000000000000000000000000';

          const estimatedGas = await getEstimateGas(
            movementNodeUrl(dapp.networks.movement.chain),
            pubKey,
            rawTransaction,
          );

          setEstimatedGas(estimatedGas.gas_used);
          setGasUnitPrice(estimatedGas.gas_unit_price);
          setMaxGasAmount(estimatedGas.gas_used);

          socket.disconnect();
          setLoading(false);
        },
      );

      const formData = new FormData();
      formData.append('chainName', CHAIN_NAME.movement);
      formData.append('chainId', dapp.networks.movement.chain);
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

      const remixMovementCompileRequestedV2: RemixMovementCompileRequestedV2 = {
        compileId: (CHAIN_NAME.movement, dapp.networks.movement.chain, address, timestamp),
        chainName: CHAIN_NAME.movement,
        chainId: dapp.networks.movement.chain,
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'move',
      };
      socket.emit(REMIX_MOVEMENT_COMPILE_REQUESTED_V2, remixMovementCompileRequestedV2);
      log.debug(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_MOVEMENT_COMPILE_REQUESTED_V2} data=${stringify(
          remixMovementCompileRequestedV2,
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
        socket = io(MOVEMENT_COMPILER_CONSUMER_ENDPOINT);
      } else {
        socket = io(MOVEMENT_COMPILER_CONSUMER_ENDPOINT, {
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
        COMPILER_MOVEMENT_PROVE_ERROR_OCCURRED_V2,
        async (data: CompilerMovementProveErrorOccurredV2) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_MOVEMENT_PROVE_ERROR_OCCURRED_V2} data=${stringify(
              data,
            )}`,
          );
          if (!uploadCodeChecked) {
            try {
              await axios.request({
                method: 'DELETE',
                url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
                params: {
                  chainName: CHAIN_NAME.movement,
                  chainId: data.chainId,
                  account: data.address,
                  timestamp: timestamp,
                },
                responseType: 'arraybuffer',
                responseEncoding: 'null',
              });
            } catch (e) {
              //
            }
          }

          if (
            data.id !==
            reqIdV2(CHAIN_NAME.movement, dapp.networks.movement.chain, address, timestamp)
          ) {
            return;
          }
          await client.terminal.log({ value: stripAnsi(data.errMsg), type: 'error' });

          setProveLoading(false);
          socket.disconnect();
        },
      );

      socket.on(COMPILER_MOVEMENT_PROVE_LOGGED_V2, async (data: CompilerMovementProveLoggedV2) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_MOVEMENT_PROVE_LOGGED_V2} data=${stringify(data)}`,
        );
        if (
          data.id !== reqIdV2(CHAIN_NAME.movement, dapp.networks.movement.chain, address, timestamp)
        ) {
          return;
        }

        await client.terminal.log({ value: stripAnsi(data.logMsg), type: 'info' });
      });

      socket.on(
        COMPILER_MOVEMENT_PROVE_COMPLETED_V2,
        async (data: CompilerMovementProveCompletedV2) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_MOVEMENT_PROVE_COMPLETED_V2} data=${stringify(
              data,
            )}`,
          );

          if (!uploadCodeChecked) {
            try {
              await axios.request({
                method: 'DELETE',
                url: `${COMPILER_API_ENDPOINT}/s3Proxy`,
                params: {
                  chainName: CHAIN_NAME.movement,
                  chainId: data.chainId,
                  account: data.address,
                  timestamp: timestamp,
                },
                responseType: 'arraybuffer',
                responseEncoding: 'null',
              });
            } catch (e) {
              //
            }
          }

          if (
            data.id !==
            reqIdV2(CHAIN_NAME.movement, dapp.networks.movement.chain, address, timestamp)
          ) {
            return;
          }
          socket.disconnect();
          setProveLoading(false);
        },
      );

      const formData = new FormData();
      formData.append('chainName', CHAIN_NAME.movement);
      formData.append('chainId', dapp.networks.movement.chain);
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

      const remixMovementProveRequestedV2: RemixMovementProveRequestedV2 = {
        id: compileIdV2(CHAIN_NAME.movement, dapp.networks.movement.chain, address, timestamp),
        chainName: CHAIN_NAME.movement,
        chainId: dapp.networks.movement.chain,
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'move',
      };
      socket.emit(REMIX_MOVEMENT_PROVE_REQUESTED_V2, remixMovementProveRequestedV2);
      log.debug(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_MOVEMENT_PROVE_REQUESTED_V2} data=${stringify(
          remixMovementProveRequestedV2,
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
        setEntryEstimatedGas(undefined);
        setEntryGasUnitPrice('0');
        setEntryMaxGasAmount('0');
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
      event_category: 'movement',
      method: 'at_address',
    });
    setDeployedContract(atAddress);
    getAccountModulesFromAccount(atAddress, dapp.networks.movement.chain);

    const moveResources = await getAccountResources(atAddress, dapp.networks.movement.chain);
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
    setEntryEstimatedGas(undefined);
    setEntryGasUnitPrice('0');
    setEntryMaxGasAmount('0');

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

  const queryResource = async () => {
    const resources = await getAccountResources(deployedContract, dapp.networks.movement.chain);
    log.info(`targetResource`, targetResource);
    log.info(`deployedContract`, deployedContract);
    log.info(`resources`, resources);
    const selectedResource = resources.find((r) => r.type === targetResource);
    if (!selectedResource) {
      await client.terminal.log({
        type: 'error',
        value: `Resource Not Found For Type ${targetResource}`,
      });
      return;
    }

    await client.terminal.log({
      type: 'info',
      value: `\n${targetResource}\n${JSON.stringify(selectedResource.data, null, 2)}\n`,
    });
  };

  const view = async () => {
    const view = await viewFunction(
      deployedContract,
      targetModule,
      moveFunction?.name || '',
      dapp.networks.movement.chain,
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

  const requestCompile = async () => {
    if (loading) {
      await client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }

    setEstimatedGas(undefined);
    setGasUnitPrice('0');
    setMaxGasAmount('0');

    const removeArtifacts = async () => {
      log.info(`removeArtifacts ${'browser/' + compileTarget + '/out'}`);
      try {
        await client?.fileManager.remove('browser/' + compileTarget + '/out');
        setPackageName('');
        setCompileTimestamp('');
        setModuleWrappers([]);
        setMetaDataBase64('');
        setModuleBase64s([]);
        setFileNames([]);
        setCliVersion('');
        setMovementGitDependencies([]);
      } catch (e) {
        log.info(`no out folder`);
      }
    };

    await removeArtifacts();

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
        <div className="mb-2 form-check">
          <input
            type="checkbox"
            className="form-check-input"
            id="uploadCodeCheckbox"
            checked={uploadCodeChecked}
            onChange={handleCheckboxChange}
            disabled={loading || (!!moduleWrappers && moduleWrappers.length > 0)}
          />
          <CustomTooltip
            placement="top"
            tooltipId="overlay-ataddresss"
            tooltipText="When you upload the code, a code verification feature will be provided in the future."
          >
            <label
              className="form-check-label"
              htmlFor="uploadCodeCheckbox"
              style={{ verticalAlign: 'top' }}
            >
              Upload Code
            </label>
          </CustomTooltip>
        </div>
        <Button
          variant="primary"
          disabled={accountID === '' || proveLoading || loading || !compileTarget}
          onClick={async () => {
            await wrappedRequestCompile();
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
          // onClick={setSchemaObj}
        >
          <FaSyncAlt className={loading ? 'fa-spin' : ''} />
          <span> Compile</span>
        </Button>

        {fileNames.map((filename, i) => (
          <small key={`movement-module-file-${i}`}>
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
        <div style={{ marginTop: '-1.5em' }}>
          <Form.Group style={mt8}>
            <Form.Text className="text-muted" style={mb4}>
              <small>Gas Unit Price</small>
            </Form.Text>
            <InputGroup>
              <Form.Control
                type="number"
                placeholder="0"
                size="sm"
                onChange={setGasUnitPriceValue}
                value={gasUnitPrice}
              />
            </InputGroup>
          </Form.Group>
          <Form.Group style={mt8}>
            <Form.Text className="text-muted" style={mb4}>
              <small>
                Max Gas Amount
                {estimatedGas ? (
                  <span style={{ fontWeight: 'bolder', fontSize: '1.1em' }}>
                    {' '}
                    ( Estimated Gas {estimatedGas}. If the transaction fails, try again with a
                    higher gas fee. )
                  </span>
                ) : undefined}
              </small>
            </Form.Text>
            <InputGroup>
              <Form.Control
                type="number"
                placeholder="0"
                size="sm"
                onChange={setMaxGasAmountValue}
                value={maxGasAmount}
              />
            </InputGroup>
          </Form.Group>
          <Deploy
            wallet={'OKX'}
            accountID={accountID}
            compileTimestamp={compileTimestamp}
            packageName={packageName}
            moduleWrappers={moduleWrappers}
            metaData64={metaData64}
            moduleBase64s={moduleBase64s}
            cliVersion={cliVersion}
            movementGitDependencies={movementGitDependencies}
            dapp={dapp}
            client={client}
            setDeployedContract={setDeployedContract}
            setAtAddress={setAtAddress}
            setAccountResources={setAccountResources}
            setTargetResource={setTargetResource}
            setParameters={setParameters}
            getAccountModulesFromAccount={getAccountModulesFromAccount}
            estimatedGas={estimatedGas}
            setEstimatedGas={setEstimatedGas}
            gasUnitPrice={gasUnitPrice}
            setGasUnitPrice={setGasUnitPrice}
            maxGasAmount={maxGasAmount}
            setMaxGasAmount={setMaxGasAmount}
          />
        </div>
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
            <span style={mr6}>Deployed Contract</span>
            <span>{shortenHexString(deployedContract, 6, 6)}</span>
            <OverlayTrigger placement="top" overlay={<Tooltip>{copyMsg}</Tooltip>}>
              <Button
                variant="link"
                size="sm"
                className="mt-0 pt-0"
                onClick={() => {
                  copy(deployedContract);
                  setCopyMsg('Copied');
                }}
                onMouseLeave={() => {
                  setTimeout(() => setCopyMsg('Copy'), 100);
                }}
              >
                <i className="far fa-copy" />
              </Button>
            </OverlayTrigger>
          </Form.Text>
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
                <div style={{ width: '100%' }}>
                  {moveFunction.is_entry ? (
                    <div>
                      {entryEstimatedGas ? (
                        <div>
                          <Form.Group style={mt8}>
                            <Form.Text className="text-muted" style={mb4}>
                              <small>Gas Unit Price</small>
                            </Form.Text>
                            <InputGroup>
                              <Form.Control
                                type="number"
                                placeholder="0"
                                size="sm"
                                onChange={setEntryGasUnitPriceValue}
                                value={entryGasUnitPrice}
                              />
                            </InputGroup>
                          </Form.Group>
                          <Form.Group style={mt8}>
                            <Form.Text className="text-muted" style={mb4}>
                              <small>
                                Max Gas Amount
                                {entryEstimatedGas ? (
                                  <span style={{ fontWeight: 'bolder', fontSize: '1.1em' }}>
                                    {' '}
                                    ( Estimated Gas {entryEstimatedGas}. If the transaction fails,
                                    try again with a higher gas fee. )
                                  </span>
                                ) : undefined}
                              </small>
                            </Form.Text>
                            <InputGroup>
                              <Form.Control
                                type="number"
                                placeholder="0"
                                size="sm"
                                onChange={setEntryMaxGasAmountValue}
                                value={entryMaxGasAmount}
                              />
                            </InputGroup>
                          </Form.Group>
                        </div>
                      ) : null}

                      <EntryButton
                        accountId={accountID}
                        dapp={dapp}
                        atAddress={atAddress}
                        targetModule={targetModule}
                        moveFunction={moveFunction}
                        genericParameters={genericParameters}
                        parameters={parameters}
                        entryEstimatedGas={entryEstimatedGas}
                        setEntryEstimatedGas={setEntryEstimatedGas}
                        entryGasUnitPrice={entryGasUnitPrice}
                        setEntryGasUnitPrice={setEntryGasUnitPrice}
                        entryMaxGasAmount={entryMaxGasAmount}
                        setEntryMaxGasAmount={setEntryMaxGasAmount}
                      />
                    </div>
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
const mr6 = {
  marginRight: '6px',
};

const mt8 = {
  marginTop: '8px',
};
