import React, { useState } from 'react';
import { Alert, Button, Form, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import JSZip from 'jszip';
import axios from 'axios';
import { FaSyncAlt } from 'react-icons/fa';
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
  getModules,
  getOwnedObjects,
  getPackageIds,
  getProvider,
  initParameters,
  moveCallTxn,
  parseYaml,
  SuiChainId,
} from './sui-helper';

import { PROD, STAGE } from '../../const/stage';
import { Socket } from 'socket.io-client/build/esm/socket';
import { isEmptyList, isNotEmptyList } from '../../utils/ListUtil';
import { Parameters } from './Parameters';
import { S3Path } from '../../const/s3-path';
import {
  CompiledModulesAndDeps,
  compileIdV2,
  COMPILER_SUI_COMPILE_COMPLETED_V1,
  COMPILER_SUI_COMPILE_ERROR_OCCURRED_V1,
  COMPILER_SUI_COMPILE_LOGGED_V1,
  COMPILER_SUI_PROVE_COMPLETED_V1,
  COMPILER_SUI_PROVE_ERROR_OCCURRED_V1,
  COMPILER_SUI_PROVE_LOGGED_V1,
  COMPILER_SUI_TEST_COMPLETED_V1,
  COMPILER_SUI_TEST_ERROR_OCCURRED_V1,
  COMPILER_SUI_TEST_LOGGED_V1,
  CompilerSuiCompileCompletedV1,
  CompilerSuiCompileErrorOccurredV1,
  CompilerSuiCompileLoggedV1,
  CompilerSuiProveCompletedV1,
  CompilerSuiProveErrorOccurredV1,
  CompilerSuiProveLoggedV1,
  CompilerSuiTestCompletedV1,
  CompilerSuiTestErrorOccurredV1,
  CompilerSuiTestLoggedV1,
  REMIX_SUI_COMPILE_REQUESTED_V1,
  REMIX_SUI_PROVE_REQUESTED_V1,
  REMIX_SUI_TEST_REQUESTED_V1,
  RemixSuiCompileRequestedV1,
  RemixSuiProveRequestedV1,
  RemixSuiTestRequestedV1,
  reqIdV2,
} from 'wds-event';
import { CHAIN_NAME } from '../../const/chain';
import { BUILD_FILE_TYPE } from '../../const/build-file-type';
import { SuiFunc, SuiModule } from './sui-types';
import { SuiObjectData } from '@mysten/sui.js';
import { Deploy } from './Deploy';

export interface ModuleWrapper {
  packageName: string;
  path: string;
  module: string;
  moduleName: string;
  moduleNameHex: string;
  order: number;
}

export interface BuildInfo {
  compiled_package_info: {
    address_alias_instantiation: { [key: string]: string };
    build_flags: {
      additional_named_addresses: { [key: string]: string };
      architecture: any;
      dev_mode: boolean;
      fetch_deps_only: boolean;
      force_recompilation: boolean;
      generate_abis: boolean;
      generate_docs: boolean;
      install_dir: any;
      lock_file: string;
      skip_fetch_latest_git_deps: boolean;
      test_mode: boolean;
    };
    package_name: string;
    source_digest: string;
  };
  dependencies: string[];
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
  const [testLoading, setTestLoading] = useState<boolean>(false);
  const [proveLoading, setProveLoading] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<Nullable<string>>(null);
  const [inputAddress, setInputAddress] = useState<string>('');
  const [atAddress, setAtAddress] = useState<string>('');
  const [isProgress, setIsProgress] = useState<boolean>(false);
  const [deployedContract, setDeployedContract] = useState<string>('');

  const [buildInfo, setBuildInfo] = useState<BuildInfo | undefined>();
  const [packageName, setPackageName] = useState<string>('');
  const [compileTimestamp, setCompileTimestamp] = useState<string>('');
  const [moduleBase64s, setModuleBase64s] = useState<string[]>([]);
  const [compiledModulesAndDeps, setCompiledModulesAndDeps] = useState<
    CompiledModulesAndDeps | undefined
  >();

  const [suiObjects, setSuiObjects] = useState<SuiObjectData[]>([]);
  const [targetObjectId, setTargetObjectId] = useState<string>('');

  const [packageIds, setPackageIds] = useState<string[]>([]);
  const [targetPackageId, setTargetPackageId] = useState('');

  const [modules, setModules] = useState<SuiModule[]>([]);
  const [targetModuleName, setTargetModuleName] = useState<string>('');
  const [funcs, setFuncs] = useState<SuiFunc[]>([]);
  const [targetFunc, setTargetFunc] = useState<SuiFunc>();
  const [parameters, setParameters] = useState<string[]>([]);

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

  const requestTest = async () => {
    if (testLoading) {
      await client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }
    const projFiles = await FileUtil.allFilesForBrowser(client, compileTarget);
    log.debug(`@@@ test projFiles`, projFiles);
    const buildFileExcluded = projFiles.filter((f) => !f.path.startsWith(`${compileTarget}/out`));
    log.debug(`@@@ test buildFileExcluded`, buildFileExcluded);
    if (isEmptyList(buildFileExcluded)) {
      return;
    }

    const blob = await generateZip(buildFileExcluded);

    await wrappedTest(blob);
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
  const wrappedRequestTest = () => wrapPromise(requestTest(), client);
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
            compileIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp) // todo sui
            // compileIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)
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
          compileIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp) // todo sui
          // compileIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)
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
          compileIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp) // todo sui
          // compileIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)
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
              dapp.networks.sui.chain, // todo sui
              // 'devnet',
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
        let buildInfo: BuildInfo | undefined;
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
            if (key.includes('compiledModulesAndDeps.json')) {
              let content = (await zip.file(key)?.async('blob')) ?? new Blob();
              const arrayBuffer = await content.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              log.debug(`compiledModulesAndDeps=${buffer.toString()}`);
              try {
                await client?.fileManager.writeFile(
                  'browser/' + compileTarget + '/out/' + FileUtil.extractFilename(key),
                  buffer.toString(),
                );
              } catch (e) {
                log.error(e);
                setLoading(false);
              }
            }

            if (key.includes('BuildInfo.yaml')) {
              let content = (await zip.file(key)?.async('blob')) ?? new Blob();
              const arrayBuffer = await content.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              buildInfo = parseYaml(buffer.toString());
              packageName = buildInfo?.compiled_package_info.package_name || '';

              try {
                await client?.fileManager.writeFile(
                  'browser/' + compileTarget + '/out/' + FileUtil.extractFilename(key),
                  buffer.toString(),
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
        setBuildInfo(buildInfo);
        setModuleBase64s([...moduleWrappers.map((mw) => mw.module)]);
        setFileNames([...filenames]);
        setCompiledModulesAndDeps(data.compiledModulesAndDeps);

        socket.disconnect();
        setLoading(false);
      });

      const formData = new FormData();
      formData.append('chainName', CHAIN_NAME.sui);
      formData.append('chainId', dapp.networks.sui.chain); // todo sui
      // formData.append('chainId', 'devnet');
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
        compileId: (CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp), // todo sui
        // compileId: (CHAIN_NAME.sui, 'devnet', address, timestamp),
        chainName: CHAIN_NAME.sui,
        chainId: dapp.networks.sui.chain, // todo sui
        // chainId: 'devnet',
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

  const sendTestReq = async (blob: Blob) => {
    setTestLoading(true);

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
        setTestLoading(false);
        socket.disconnect();
      });

      socket.on(
        COMPILER_SUI_TEST_ERROR_OCCURRED_V1,
        async (data: CompilerSuiTestErrorOccurredV1) => {
          log.debug(
            `${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_TEST_ERROR_OCCURRED_V1} data=${stringify(
              data,
            )}`,
          );

          if (data.id !== reqIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp)) {
            // todo sui
            // if (data.id !== reqIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)) {
            return;
          }
          await client.terminal.log({ value: stripAnsi(data.errMsg), type: 'error' });

          setTestLoading(false);
          socket.disconnect();
        },
      );

      socket.on(COMPILER_SUI_TEST_LOGGED_V1, async (data: CompilerSuiTestLoggedV1) => {
        log.debug(`${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_TEST_LOGGED_V1} data=${stringify(data)}`);
        if (data.id !== reqIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp)) {
          // todo sui
          // if (data.id !== reqIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)) {
          return;
        }

        await client.terminal.log({ value: stripAnsi(data.logMsg), type: 'info' });
      });

      socket.on(COMPILER_SUI_TEST_COMPLETED_V1, async (data: CompilerSuiTestCompletedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_TEST_COMPLETED_V1} data=${stringify(data)}`,
        );
        if (data.id !== reqIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp)) {
          // todo sui
          // if (data.id !== reqIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)) {
          return;
        }
        socket.disconnect();
        setTestLoading(false);
      });

      const formData = new FormData();
      formData.append('chainName', CHAIN_NAME.sui);
      formData.append('chainId', dapp.networks.sui.chain); // todo sui
      // formData.append('chainId', 'devnet');
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

      const remixSuiTestRequestedV1: RemixSuiTestRequestedV1 = {
        id: compileIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp), // todo sui
        // id: compileIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp),
        chainName: CHAIN_NAME.sui,
        chainId: dapp.networks.sui.chain, // todo sui
        // chainId: 'devnet',
        address: address || 'noaddress',
        timestamp: timestamp.toString() || '0',
        fileType: 'move',
      };
      socket.emit(REMIX_SUI_TEST_REQUESTED_V1, remixSuiTestRequestedV1);
      log.debug(
        `${SEND_EVENT_LOG_PREFIX} ${REMIX_SUI_TEST_REQUESTED_V1} data=${stringify(
          remixSuiTestRequestedV1,
        )}`,
      );
    } catch (e) {
      setTestLoading(false);
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

          if (data.id !== reqIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp)) {
            // todo sui
            // if (data.id !== reqIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)) {
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
        if (data.id !== reqIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp)) {
          // todo sui
          // if (data.id !== reqIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)) {
          return;
        }

        await client.terminal.log({ value: stripAnsi(data.logMsg), type: 'info' });
      });

      socket.on(COMPILER_SUI_PROVE_COMPLETED_V1, async (data: CompilerSuiProveCompletedV1) => {
        log.debug(
          `${RCV_EVENT_LOG_PREFIX} ${COMPILER_SUI_PROVE_COMPLETED_V1} data=${stringify(data)}`,
        );
        if (data.id !== reqIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp)) {
          // todo sui
          // if (data.id !== reqIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp)) {
          return;
        }
        socket.disconnect();
        setProveLoading(false);
      });

      const formData = new FormData();
      formData.append('chainName', CHAIN_NAME.sui);
      formData.append('chainId', dapp.networks.sui.chain); // todo sui
      // formData.append('chainId', 'devnet');
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

      const remixSuiProveRequestedV1: RemixSuiProveRequestedV1 = {
        id: compileIdV2(CHAIN_NAME.sui, dapp.networks.sui.chain, address, timestamp), // todo sui
        // id: compileIdV2(CHAIN_NAME.sui, 'devnet', address, timestamp),
        chainName: CHAIN_NAME.sui,
        chainId: dapp.networks.sui.chain, // todo sui
        // chainId: 'devnet',
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
  const wrappedTest = (blob: Blob) => wrapPromise(sendTestReq(blob), client);
  const wrappedProve = (blob: Blob) => wrapPromise(sendProveReq(blob), client);

  const getExtensionOfFilename = (filename: string) => {
    const _fileLen = filename.length;
    const _lastDot = filename.lastIndexOf('.');
    return filename.substring(_lastDot, _fileLen).toLowerCase();
  };

  function clearAccountCtx() {
    clearObjectCtx();
    clearPackageCtx();
  }

  function clearObjectCtx() {
    setSuiObjects([]);
    setTargetObjectId('');
  }

  function clearPackageCtx() {
    setPackageIds([]);
    setTargetPackageId('');

    setModules([]);
    setTargetModuleName('');

    setFuncs([]);
    setTargetFunc(undefined);
  }

  const initPackageCtx = async (account: string, chainId: SuiChainId, packageId?: string) => {
    try {
      const packageIds = await getPackageIds(account, chainId);
      log.info('@@@ packageIds', packageIds);
      if (isEmptyList(packageIds)) {
        return;
      }
      setPackageIds([...packageIds]);

      let targetInitPackageId;
      if (packageId) {
        setTargetPackageId(packageId);
        targetInitPackageId = packageId;
      } else {
        setTargetPackageId(packageIds[0]);
        targetInitPackageId = packageIds[0];
      }
      const modules = await getModules(dapp.networks.sui.chain, targetInitPackageId); // todo sui
      // const modules = await getModules('devnet', packageIds[0]);
      if (isEmptyList(modules)) {
        setModules([]);
        setTargetModuleName('');
        setFuncs([]);
        setTargetFunc(undefined);
        return;
      }
      setModules([...modules]);
      const firstModule = modules[0];
      setTargetModuleName(firstModule.name);

      const entryFuncs = firstModule.exposedFunctions.filter((f) => f.isEntry);

      if (isEmptyList(entryFuncs)) {
        setFuncs([]);
        setTargetFunc(undefined);
        return;
      }
      setFuncs([...entryFuncs]);

      const func = entryFuncs[0];
      setTargetFunc(func);
      setParameters([...initParameters(func.parameters)]);
    } catch (e) {
      log.error(e);
      client.terminal.log({ type: 'error', value: 'Cannot get account module error' });
    }
  };

  async function initObjectsCtx(account: string, chainId: SuiChainId) {
    try {
      const objects = await getOwnedObjects(account, dapp.networks.sui.chain); // todo sui
      // const objects = await getOwnedObjects(account, chainId);
      log.info(`@@@ sui objects`, objects);
      setSuiObjects([...objects]);
      if (isNotEmptyList(objects)) {
        setTargetObjectId(objects[0].objectId);
      }
    } catch (e) {
      log.error(e);
      client.terminal.log({ type: 'error', value: `Object Fetch Fail. account ${account}` });
    }
  }

  const initContract = async (address: string, packageId?: string) => {
    clearAccountCtx();
    setAtAddress(address);
    sendCustomEvent('at_address', {
      event_category: 'sui',
      method: 'at_address',
    });
    setDeployedContract(address);

    await initObjectsCtx(address, dapp.networks.sui.chain); // todo sui
    // await initObjectsCtx(inputAddress, 'devnet');

    await initPackageCtx(address, dapp.networks.sui.chain, packageId);
    // await initPackageCtx(inputAddress, 'devnet');
  };

  const onChangePackageId = async (e: any) => {
    const packageId = e.target.value;
    setTargetPackageId(packageId);
    const modules = await getModules(dapp.networks.sui.chain, packageId); // todo sui
    // const modules = await getModules('devnet', packageId);
    setModules([...modules]);
    if (isEmptyList(modules)) {
      setFuncs([]);
      setTargetFunc(undefined);
      setParameters([]);
      return;
    }

    setTargetModuleName(modules[0].name);

    const entryFuncs = modules[0].exposedFunctions.filter((f) => f.isEntry);

    setFuncs([...entryFuncs]);
    if (isEmptyList(entryFuncs)) {
      setTargetFunc(undefined);
      setParameters([]);
      return;
    }

    const func = entryFuncs[0];
    setTargetFunc(func);
    setParameters([...initParameters(func.parameters)]);
    return;
  };

  const onChangeModuleName = async (e: any) => {
    log.info('onChangeModuleName', e.target.value);
    const moduleName = e.target.value;
    setTargetModuleName(moduleName);
    const module = modules.find((m) => m.name === moduleName);
    if (!module) {
      throw new Error(`Not Found Module ${moduleName}`);
    }

    const entryFuncs = module.exposedFunctions.filter((f) => f.isEntry);
    setFuncs([...entryFuncs]);
    if (isEmptyList(entryFuncs)) {
      setTargetFunc(undefined);
      setParameters([]);
      return;
    }

    const func = entryFuncs[0];
    setTargetFunc(func);

    setParameters([...initParameters(func.parameters)]);
  };

  const onChangeFuncName = (e: any) => {
    log.info('onChangeFuncName', e.target.value);
    const funcName = e.target.value;

    const func = funcs.find((f) => f.name === funcName);
    if (!func) {
      throw new Error(`Not Found Function ${funcName}`);
    }

    setTargetFunc(func);

    setParameters([...initParameters(func.parameters)]);
  };

  const onChangeObjectId = (e: any) => {
    const objectId = e.target.value;
    log.info('###', objectId);
    setTargetObjectId(objectId);
  };

  const moveCall = async () => {
    log.info('parameters', JSON.stringify(parameters, null, 2));
    const dappTxn_ = await moveCallTxn(
      accountID,
      dapp.networks.sui.chain,
      targetPackageId,
      targetModuleName,
      targetFunc!.name,
      parameters,
    );

    const txHash = await dapp.request('sui', {
      method: 'dapp:signAndSendTransaction',
      params: [dappTxn_],
    });
    log.debug(`@@@ txHash=${txHash}`);
    await client.terminal.log({ type: 'info', value: `transaction hash ---> ${txHash}` });
  };

  const queryObject = async () => {
    log.info(`targetObjectId`, targetObjectId);
    const selectedObject = suiObjects.find((object) => object.objectId === targetObjectId);
    if (!selectedObject) {
      client.terminal.log({
        type: 'error',
        value: `Resource Not Found For Object ID ${targetObjectId}`,
      });
      return;
    }

    const object = await getProvider(dapp.networks.sui.chain).getObject({
      id: targetObjectId,
      options: {
        showType: true,
        showContent: true,
        // showBcs: true,
        showOwner: true,
        // showPreviousTransaction: true,
        // showStorageRebate: true,
        showDisplay: true,
      },
    });

    client.terminal.log({
      type: 'info',
      value: `\n${targetObjectId}\n${JSON.stringify(object, null, 2)}\n`,
    });
  };

  const prepareModules = async () => {
    const artifactPaths = await findArtifacts();

    setPackageName('');
    setBuildInfo(undefined);
    setCompileTimestamp('');
    setModuleBase64s([]);
    setFileNames([]);
    setCompiledModulesAndDeps(undefined);

    if (isEmptyList(artifactPaths)) {
      return [];
    }

    let packageName = '';
    let buildInfo: BuildInfo | undefined = undefined;
    let filenames: string[] = [];
    let moduleWrappers: ModuleWrapper[] = [];

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

            moduleWrappers.push({
              packageName: packageName,
              path: path,
              module: moduleBase64,
              moduleName: moduleName,
              moduleNameHex: moduleNameHex,
              order: 0,
            });
          }
          filenames.push(path);
        }

        if (path.includes('compiledModulesAndDeps.json')) {
          const compiledModulesAndDepsStr = await client?.fileManager.readFile('browser/' + path);
          const compiledModulesAndDeps = JSON.parse(compiledModulesAndDepsStr);
          console.log('compiledModulesAndDeps', compiledModulesAndDeps);
          setCompiledModulesAndDeps(compiledModulesAndDeps);
        }

        if (path.includes('BuildInfo.yaml')) {
          const buildinfoStr = await client?.fileManager.readFile('browser/' + path);
          buildInfo = parseYaml(buildinfoStr);
          packageName = buildInfo?.compiled_package_info.package_name || '';
          log.info('buildinfo', buildInfo);
        }
      }),
    );

    moduleWrappers = _.orderBy(moduleWrappers, (mw) => mw.order);
    log.debug('@@@ moduleWrappers', moduleWrappers);

    setPackageName(packageName);
    setBuildInfo(buildInfo);
    setFileNames([...filenames]);
    setModuleBase64s([...moduleWrappers.map((m) => m.module)]);

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
          disabled={accountID === '' || testLoading || proveLoading || loading || !compileTarget}
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
          disabled={accountID === '' || testLoading || proveLoading || loading || !compileTarget}
          onClick={async () => {
            await wrappedRequestTest();
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        >
          <FaSyncAlt className={testLoading ? 'fa-spin' : ''} />
          <span> Test</span>
        </Button>

        <Button
          variant="warning"
          disabled={accountID === '' || testLoading || proveLoading || loading || !compileTarget}
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
      {compiledModulesAndDeps ? (
        <Deploy
          wallet={'Dsrv'}
          accountID={accountID}
          compileTimestamp={compileTimestamp}
          packageName={packageName}
          compiledModulesAndDeps={compiledModulesAndDeps}
          dapp={dapp}
          client={client}
          setDeployedContract={setDeployedContract}
          setAtAddress={setAtAddress}
          setSuiObjects={setSuiObjects}
          setTargetObjectId={setTargetObjectId}
          setParameters={setParameters}
          setInputAddress={setInputAddress}
          initContract={initContract}
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
              setInputAddress(e.target.value.trim());
            }}
            value={inputAddress}
          />
          <OverlayTrigger
            placement="left"
            overlay={<Tooltip id="overlay-ataddresss">Use deployed Contract account</Tooltip>}
          >
            <Button
              variant="info"
              size="sm"
              disabled={accountID === '' || isProgress}
              onClick={() => initContract(inputAddress)}
            >
              <small>At Address</small>
            </Button>
          </OverlayTrigger>
        </InputGroup>
      </Form.Group>
      <hr />
      {suiObjects.length > 0 ? (
        <Form.Group>
          <Form.Text className="text-muted" style={mb4}>
            <small>Objects</small>
          </Form.Text>
          <InputGroup>
            <Form.Control
              style={{ width: '80%', marginBottom: '10px' }}
              className="custom-select"
              as="select"
              value={targetObjectId}
              onChange={onChangeObjectId}
            >
              {suiObjects.map((object, idx) => {
                return (
                  <option value={object.objectId} key={`sui-object-${idx}`}>
                    {object.objectId}
                  </option>
                );
              })}
            </Form.Control>
          </InputGroup>
          <Button
            style={{ marginTop: '10px', minWidth: '70px' }}
            variant="warning"
            size="sm"
            onClick={queryObject}
          >
            <small>Query Object</small>
          </Button>
        </Form.Group>
      ) : (
        false
      )}

      {packageIds.length > 0 ? (
        <>
          <Form.Group>
            <Form.Text className="text-muted" style={mb4}>
              <small>Packages</small>
            </Form.Text>
            <InputGroup>
              <Form.Control
                className="custom-select"
                as="select"
                value={targetPackageId}
                onChange={onChangePackageId}
              >
                {packageIds.map((packageId, idx) => {
                  return (
                    <option value={packageId} key={`packageId-${packageId}}`}>
                      {packageId}
                    </option>
                  );
                })}
              </Form.Control>
            </InputGroup>
          </Form.Group>
          <Form.Group>
            <Form.Text className="text-muted" style={mb4}>
              <small>Modules</small>
            </Form.Text>
            <InputGroup>
              <Form.Control
                className="custom-select"
                as="select"
                value={targetModuleName}
                onChange={onChangeModuleName}
              >
                {modules.map((module) => {
                  return (
                    <option value={module.name} key={`${targetPackageId}-${module.name}`}>
                      {module.name}
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
              value={targetFunc?.name}
              onChange={onChangeFuncName}
            >
              {funcs.map((func) => {
                return (
                  <option
                    value={func.name}
                    key={`${targetPackageId}-${targetModuleName}-${func.name}`}
                  >
                    {func.name}
                  </option>
                );
              })}
            </Form.Control>
          </Form.Group>
          {targetFunc ? (
            <Form.Group>
              <InputGroup>
                <Parameters func={targetFunc} setParameters={setParameters} />
                <div>
                  <Button
                    style={{ marginTop: '10px', minWidth: '70px' }}
                    variant="primary"
                    size="sm"
                    onClick={moveCall}
                  >
                    <small>{targetFunc.name}</small>
                  </Button>
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
