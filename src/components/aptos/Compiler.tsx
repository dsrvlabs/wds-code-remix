import React, { useEffect, useState } from 'react';
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
  CompilerAptosCompileCompletedV1,
  CompilerAptosCompileErrorOccurredV1,
  CompilerAptosCompileLoggedV1,
  REMIX_APTOS_COMPILE_REQUESTED_V1,
  RemixAptosCompileRequestedV1,
} from 'wds-event';

import { APTOS_COMPILER_CONSUMER_ENDPOINT, COMPILER_API_ENDPOINT } from '../../const/endpoint';
import AlertCloseButton from '../common/AlertCloseButton';
import { FileUtil } from '../../utils/FileUtil';
import { readFile, stringify } from '../../utils/helper';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import { genRawTx, getAccountModules, build, viewFunction } from './aptos-helper';


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
  const [compileIconSpin, setCompileIconSpin] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [compileError, setCompileError] = useState<Nullable<string>>(null);
  const [rawTx, setRawTx] = useState('');
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

  const [viewResult, setViewResult] = useState<any>()

  const exists = async () => {
    try {
      const artifacts = await client?.fileManager.readdir('browser/' + compileTarget + '/out');
      await client.terminal.log({
        type: 'error',
        value:
          "If you want to run a new compilation, delete the 'out' directory and click the Compile button again.",
      });

      const artifactPaths = Object.keys(artifacts || {});
      log.debug(artifactPaths);
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

      if (metaData64 && moduleWrappers.length > 0) {
        const _tx = await genRawTx(metaData64, moduleBase64s, accountID, dapp.networks.aptos.chain);
        setRawTx(_tx);
        return true;
      } else {
        return false;
      }
    } catch (e: any) {
      await client.terminal.log({
        type: 'error',
        value: e.toString(),
      });
      return false;
    }
  };

  const handleAlertClose = () => {
    setCompileError('');
    client.call('editor', 'discardHighlight');
    client.call('editor', 'clearAnnotations');
  };

  const readCode = async () => {
    if (loading) {
      await client.terminal.log({ value: 'Server is working...', type: 'log' });
      return;
    }

    if (!(await exists())) {
      setModuleBase64s([]);
      setFileNames([]);
      const toml = compileTarget + '/Move.toml';
      log.debug(`toml=${toml}`);

      const sourceFiles = await client?.fileManager.readdir(
        'browser/' + compileTarget + '/sources',
      );
      const sourceFilesNames = Object.keys(sourceFiles || {});
      log.debug(`sourceFilesNames=${sourceFilesNames}`);
      const filesNames = sourceFilesNames.concat(toml);
      log.debug(`filesNames=${filesNames}`);

      let code;
      const fileList = await Promise.all(
        filesNames.map(async (f) => {
          code = await client?.fileManager.getFile(f);
          return createFile(code || '', f.substring(f.lastIndexOf('/') + 1));
        }),
      );

      generateZip(fileList);
    }
  };

  const wrappedReadCode = () => wrapPromise(readCode(), client);

  const createFile = (code: string, name: string) => {
    const blob = new Blob([code], { type: 'text/plain' });
    return new File([blob], name, { type: 'text/plain' });
  };

  const generateZip = (fileList: Array<File>) => {
    const zip = new JSZip();
    fileList.map((file: File) => {
      if (file.name === 'Move.toml') {
        zip.file(file.name, file);
      } else {
        zip.folder('sources')?.file(file.name, file);
      }
    });

    zip.generateAsync({ type: 'blob' }).then((blob) => {
      wrappedCompile(blob);
    });
  };

  const compile = async (blob: Blob) => {
    setCompileError(null);
    sendCustomEvent('compile', {
      event_category: 'aptos',
      method: 'compile',
    });
    setCompileIconSpin('fa-spin');
    setLoading(true);

    const address = accountID;
    const timestamp = Date.now().toString();
    try {
      // socket connect
      const socket = io(APTOS_COMPILER_CONSUMER_ENDPOINT);

      socket.on('connect_error', function (err) {
        // handle server error here
        log.debug('Error connecting to server');
        setCompileIconSpin('');
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

          setCompileIconSpin('');
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
          await client?.fileManager.mkdir('browser/' + compileTarget + '/out');

          let metaData64 = '';
          let metaDataHex = '';
          let filenames: string[] = [];
          let moduleWrappers: ModuleWrapper[] = [];

          log.debug(zip.files)

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
                await client?.fileManager.writeFile(
                  'browser/' + compileTarget + '/out/' + FileUtil.extractFilename(key),
                  metaData64,
                );
              }
            }),
          );

          await Promise.all(
            Object.keys(zip.files).map(async (key) => {
              if (key.match('\\w+\\/bytecode_modules\\/\\w+.mv')) {
                const moduleDataBuf = await zip.file(key)?.async('nodebuffer');
                log.debug(`moduleDataBuf=${moduleDataBuf?.toString('hex')}`);
                let content = await zip.file(key)?.async('blob');
                content = content?.slice(0, content.size) ?? new Blob();
                const moduleBase64 = await readFile(new File([content], key));
                log.debug(`moduleBase64=${moduleBase64}`);

                const moduleNameHex = Buffer.from(
                  FileUtil.extractFilenameWithoutExtension(key),
                ).toString('hex');
                const order = metaDataHex.indexOf(moduleNameHex);

                moduleWrappers.push({
                  path: key,
                  module: moduleBase64,
                  moduleNameHex: moduleNameHex,
                  order: order,
                });
                await client?.fileManager.writeFile(
                  'browser/' + compileTarget + '/out/' + FileUtil.extractFilename(key),
                  moduleBase64,
                );
                filenames.push(key);
              }
            }),
          );
          moduleWrappers = _.orderBy(moduleWrappers, (mw) => mw.order);
          log.info('@@@ moduleWrappers', moduleWrappers);

          setModuleBase64s([...moduleWrappers.map((mw) => mw.module)]);
          setFileNames([...filenames]);
          setMetaDataBase64(metaData64);

          if (metaData64 && moduleWrappers.length > 0) {
            const _tx = await genRawTx(
              metaData64,
              moduleBase64s,
              accountID,
              dapp.networks.aptos.chain,
            );
            setRawTx(_tx);
          }

          socket.disconnect();
          setCompileIconSpin('');
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
        setCompileIconSpin('');
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
      setCompileIconSpin('');
    }
  };

  const wrappedCompile = (blob: Blob) => wrapPromise(compile(blob), client);

  const getExtensionOfFilename = (filename: string) => {
    const _fileLen = filename.length;
    const _lastDot = filename.lastIndexOf('.');
    return filename.substring(_lastDot, _fileLen).toLowerCase();
  };

  const getAccountModulesFromAccount = async (account: string, chainId: string) => {
    try {
      const accountModules = await getAccountModules(account, chainId);
      setModules(accountModules);
      log.debug("@@@", accountModules);
      setTargetModule((accountModules[0] as any).abi.name);
      setTargetFunction((accountModules[0] as any).abi.exposed_functions[0].name);
      setParameters([])
    } catch (e) {
      log.error(e);
      client.terminal.log({ type: 'error', value: 'Cannot get account module error' });
    }
  }

  const getContractAtAddress = () => {
    sendCustomEvent('at_address', {
      event_category: 'aptos',
      method: 'at_address',
    });
    setDeployedContract(atAddress);
    getAccountModulesFromAccount(atAddress, dapp.networks.aptos.chain)
  };

  const setModuleAndABI = (e: any) => {
    setTargetModule(e.target.value);
    if (modules.length) {
      modules.map((mod, idx) => {
        if (mod.abi.name === e.target.value) {
          setTargetFunction(mod.abi.exposed_functions[0].name)
          setParameters([]);
        }
      })
    }
  }

  const handleFunction = (e: any) => {
    setTargetFunction(e.target.value);
    setParameters([]);
    setGenericParameters([]);
  }

  const entry = async () => {

    // remove signer param 
    log.debug("@@@ parameters[0]", parameters[0])
    let param = parameters
    if (param.length >= 1 && param[0] === undefined) {
      param.shift()
    }

    console.log(param)
    const chainId = dapp.networks.aptos.chain;
    const abiBuilderConfig = {
      sender: accountID,
    }

    const setMsg = await build(
      // "0x9b67139040a4a92f09412f64157fe2c05c55a320f293f2c5369e42cd2e18c6dd::message::set_message",
      deployedContract + "::" + targetModule + "::" + targetFunction,
      genericParameters,
      param, // Array
      chainId,
      abiBuilderConfig
    )


    const txHash = await dapp.request('aptos', {
      method: 'dapp:signAndSendTransaction',
      params: [setMsg],
    });
    log.debug(`@@@ txHash=${txHash}`);
  }

  const updateGenericParam = (e: any, idx: any) => {
    setGenericParameters(existingGenericParams => {
      existingGenericParams[idx] = e.target.value;
      return existingGenericParams;
    })
  }

  const updateParam = (e: any, idx: any) => {
    setParameters(existingParams => {
      existingParams[idx] = e.target.value;
      return existingParams;
    })
  }

  const view = async () => {
    console.log(parameters)

    const result = await viewFunction(
      deployedContract,
      targetModule,
      targetFunction,
      dapp.networks.aptos.chain,
      genericParameters, // typeArgs
      parameters
    )

    log.debug(result)
    setViewResult(result)
  }

  return (
    <>
      <div className="d-grid gap-2">
        <Button
          variant="primary"
          disabled={accountID === ''}
          onClick={() => {
            wrappedReadCode();
          }}
          className="btn btn-primary btn-block d-block w-100 text-break remixui_disabled mb-1 mt-3"
        // onClick={setSchemaObj}
        >
          <FaSyncAlt className={compileIconSpin} />
          <span> Compile</span>
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
      {rawTx ?
        <Deploy
          wallet={'Dsrv'}
          accountID={accountID}
          rawTx={rawTx}
          metaData64={metaData64}
          moduleBase64s={moduleBase64s}
          dapp={dapp}
          client={client}
          setDeployedContract={setDeployedContract}
          getAccountModulesFromAccount={getAccountModulesFromAccount}
        /> :
        <p className="text-center" style={{ marginTop: '0px !important', marginBottom: '3px' }}>
          <small>NO COMPILED CONTRACT</small>
        </p>
      }
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

      {modules.length ?
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
                )

              })}
            </Form.Control>
          </InputGroup></Form.Group> : false
      }
      <hr />

      {/* Resources */}
      {/* <Form.Control
              style={{ "marginBottom": "10px" }}
              className="custom-select"
              as="select"
              value={''}
              onChange={() => { }}
            >
              {
                modules.map((mod, idx) => {
                  log.debug(mod.abi.name === targetModule)

                  if (mod.abi.name === targetModule) {
                    return mod.abi.structs.map((resource: any, idx: any) => {
                      log.debug(resource)

                      return (
                        <option value={resource.name} key={idx}>
                          {resource.name}
                        </option>
                      );
                    })
                  } else {
                    return false
                  }
                })
              }
            </Form.Control> */}
      {
        modules.length && targetModule ?
          <>
            <Form.Group>
              <Form.Text className="text-muted" style={mb4}>
                <small>Functions</small>
              </Form.Text>
              <Form.Control
                style={{ "marginBottom": "10px" }}
                className="custom-select"
                as="select"
                value={targetFunction}
                onChange={handleFunction}
              >
                {
                  modules.map((mod, idx) => {
                    if (mod.abi.name === targetModule) {
                      return mod.abi.exposed_functions.map((func: any, idx: any) => {
                        return (
                          <option value={func.name} key={idx}>
                            {func.name}
                          </option>
                        );
                      })
                    }
                  })
                }
              </Form.Control>
            </Form.Group>
            <hr />
          </> : false
      }
      {
        targetModule && targetFunction ?
          modules.map((mod) => {
            if (mod.abi.name === targetModule) {
              return mod.abi.exposed_functions.map((func: any, idx: any) => {
                if (func.name === targetFunction) {
                  return (
                    <>
                      <Form style={{ "marginTop": "30px" }} key={idx}>
                        <Form.Group>
                          <InputGroup>
                            <div style={{width: "100%"}}>
                              <div>
                                <div>
                                  { func.generic_type_params.length > 0 ? <small>Type Parameters</small> : <></> }
                                </div>
                                {
                                  func.generic_type_params.map((param: any, idx: number) => {
                                    return < Form.Control style={{ "width": "100%", "marginBottom": "5px" }} type="text" placeholder={`Type Arg ${idx + 1}`} size="sm"
                                                          onChange={(e) => { updateGenericParam(e, idx) }} key={idx} />
                                  })
                                }
                              </div>
                              <div>
                                <small>Parameters</small>
                                {
                                  func.params.map((param: any, idx: number) => {
                                    if (func.is_entry && idx === 0) {
                                      return <></>
                                    }

                                    return < Form.Control style={{ "width": "100%", "marginBottom": "5px" }} type="text" placeholder={param} size="sm"
                                                          onChange={(e) => { updateParam(e, idx) }} key={idx} />
                                  })
                                }
                                {
                                  func.is_entry ?
                                    <Button
                                      style={{ "marginTop": "10px", "minWidth": "70px" }}
                                      variant="primary" size="sm"
                                      onClick={entry} >
                                      <small>{func.name}</small>
                                    </Button> :
                                    <div>
                                      <Button
                                        style={{ "marginTop": "10px", "minWidth": "70px" }}
                                        variant="warning" size="sm"
                                        onClick={view} >
                                        <small>{func.name}</small>
                                      </Button>
                                      {
                                        viewResult ?
                                          (
                                            <div>
                                              <small>{viewResult}</small>
                                            </div>
                                          ) : <></>
                                      }
                                    </div>
                                }
                              </div>
                            </div>
                          </InputGroup>
                          <hr />
                        </Form.Group>
                      </Form>

                      <hr />
                    </>
                  )

                }
              })
            }
          }) : false
      }
    </>
  );
};

const mb4 = {
  marginBottom: '4px',
};
