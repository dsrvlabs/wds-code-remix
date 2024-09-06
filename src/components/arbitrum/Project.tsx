import React, { useEffect, useState } from 'react';
import { Button, Form, InputGroup, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';

// import { Compiler } from './Compiler';
import axios from 'axios';
import JSZip from 'jszip';
import wrapPromise from '../../utils/wrapPromise';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { log } from '../../utils/logger';
import { Compiler } from './Compiler';
import SmartContracts from './SmartContracts';
import { InterfaceContract } from '../../utils/Types';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';

interface InterfaceProps {
  account: string;
  client: Client<Api, Readonly<IRemixApi>>;
  injectedProvider: any;
  providerNetwork: string;
}

export const Project: React.FunctionComponent<InterfaceProps> = ({
  account,
  injectedProvider,
  providerNetwork,
  client,
}) => {
  const [projectName, setProjectName] = useState<string>('noname');
  const [projectList, setProjectList] = useState<string[]>([]);
  const [compileTarget, setCompileTarget] = useState<string>('');
  const [template, setTemplate] = useState<string>('hello-world');
  const [fileName, setFileName] = useState<string>('');
  const [contractAbiMap, setContractAbiMap] = useState<Map<string, AbiItem[]>>(
    new Map<string, AbiItem[]>(),
  );
  const [contractName, setContractName] = useState<string>('');

  const [isCompiling, setIsCompiling] = React.useState<boolean>(false);
  const [busy, setBusy] = React.useState<boolean>(false);
  const [contractAddr, setContractAddr] = React.useState<string>('');
  const [contracts, setContracts] = React.useState<InterfaceContract[]>([]);
  const [selected, setSelected] = React.useState<InterfaceContract | null>(null);
  const [isActivated, setIsActivated] = React.useState<boolean>(false);

  const templateList = ['hello-world', 'erc20', 'erc721', 'single_call', 'vending_machine'];

  useEffect(() => {
    getList();
  }, []);

  // const getList = async () => {
  //   const list = await getProjectList();
  //   setProjectList(list);
  //   list?.length > 0 && setCompileTarget(list[0]);
  // };

  // const getProjectList = async () => {
  //   try {
  //     const list = await client?.fileManager.readdir('browser/arbitrum/');
  //     return Object.keys(list || []);
  //   } catch (e) {
  //     log.error(e);
  //   }
  //   return [];
  // };

  const getList = async () => {
    const projects = await getProjectHaveTomlFile('browser/arbitrum');
    setProjectList(projects);
    if (projects?.length > 0) {
      const compileTarget = projects[0];
      setCompileTarget(compileTarget);
      try {
        const abiStr = await client?.fileManager.readFile('browser/arbitrum/abi.json');
        setContractAbiMap((prevMap) => {
          const newMap = new Map(prevMap);
          return newMap;
        });
        console.log(`@@@ abiStr=${abiStr}`);
      } catch (e) {
        console.log(`No abi.json. Writing empty abi.`);
        await client?.fileManager.writeFile('browser/arbitrum/abi.json', '[]');
        setContractAbiMap((prevMap) => {
          const newMap = new Map(prevMap);
          return newMap;
        });
      }
    }
  };

  const wrappedGetList = () => wrapPromise(getList(), client);

  const setProject = (e: { target: { value: React.SetStateAction<string> } }) => {
    setProjectName(e.target.value);
  };

  const setTarget = (e: { target: { value: React.SetStateAction<string> } }) => {
    setCompileTarget(e.target.value);
  };

  const setTargetTemplate = (e: { target: { value: React.SetStateAction<string> } }) => {
    setTemplate(e.target.value);
  };

  function addNewContract(contract: InterfaceContract) {
    const filtered = contracts.filter((c) => c.address.toString() !== contract.address.toString());
    const c = {
      ...contract,
    };
    setContracts([c].concat(filtered));
  }

  const createProject = async () => {
    sendCustomEvent('new_project', {
      event_category: 'arbitrum',
      method: 'new_project',
    });
    if (await wrappedIsExists(projectName)) {
      await client.terminal.log({
        type: 'error',
        value: 'The folder "arbitrum/' + projectName + '" already exists',
      });
      return;
    }

    try {
      const path = 'browser/arbitrum/' + projectName;
      await client?.fileManager.mkdir(path + '/src');
      await client?.fileManager.mkdir(path + '/examples');
      await client?.fileManager.mkdir(path + '/.cargo/config');
      await client?.fileManager.writeFile(path + '/Cargo.toml', '');
      getList();
    } catch (e: any) {
      await client.terminal.log(e.message);
    }
  };
  const wrappedCreateProject = () => wrapPromise(createProject(), client);

  const getProjectHaveTomlFile = async (path: string): Promise<string[]> => {
    if (!client) return [];

    const projects: string[] = [];

    const findTomlFileRecursively = async (currentPath: string): Promise<void> => {
      const list = await client.fileManager.readdir(currentPath);
      const hasTomlFile = Object.keys(list).some((item) => item.endsWith('Cargo.toml'));
      if (hasTomlFile) {
        projects.push(currentPath.replace('browser/', ''));
      }

      for (const [key, value] of Object.entries(list)) {
        if ((value as any).isDirectory) {
          const additionalPath = key.split('/').pop();
          await findTomlFileRecursively(currentPath + '/' + additionalPath);
        }
      }
    };

    await findTomlFileRecursively(path);

    return projects;
  };

  const isExists = async (dir: string) => {
    try {
      log.debug(await client.fileManager.readdir('browser/arbitrum/' + dir));
      return true;
    } catch (e) {
      log.error(e);
      return false;
    }
  };

  const wrappedIsExists = (dir: string) => wrapPromise(isExists(dir), client);

  const createTemplate = async () => {
    sendCustomEvent('create_template', {
      event_category: 'arbitrum',
      method: 'create_template',
    });

    if (await wrappedIsExists(template)) {
      await client.terminal.log({
        type: 'error',
        value: `The folder "arbitrum/${template} already exists`,
      });
      return;
    }

    const res = await axios.request({
      method: 'GET',
      url:
        `https://api.welldonestudio.io/compiler/s3Proxy?bucket=code-template&fileKey=arbitrum/` +
        template +
        '.zip',
      responseType: 'arraybuffer',
      responseEncoding: 'null',
    });

    const jsZip = new JSZip();
    const zip = await jsZip.loadAsync(res.data);

    let content: any;
    try {
      Object.keys(zip.files).map(async (key) => {
        log.debug(`@@@ key=${key}`);
        if (zip.files[key].dir) {
          await client?.fileManager.mkdir('browser/arbitrum/' + key);
        } else if (!key.startsWith('_') && key !== template + '/.DS_Store') {
          content = await zip.file(key)?.async('string');
          await client?.fileManager.writeFile('browser/arbitrum/' + key, content);
        }
      });
      await wrappedGetList();
      await client.terminal.log({ type: 'info', value: template + ' is created successfully.' });
    } catch (e) {
      log.error(e);
    }
  };

  const wrappedCreateTemplate = () => wrapPromise(createTemplate(), client);

  return (
    <div>
      <Form>
        <div>
          <Form.Group style={mt8}>
            <Form.Text className="text-muted" style={mb4}>
              <small>NEW PROJECT</small>
            </Form.Text>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Project Name"
                size="sm"
                onChange={setProject}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.preventDefault();
                }}
              />
              <Button variant="success" size="sm" onClick={wrappedCreateProject}>
                <small>Create</small>
              </Button>
            </InputGroup>
          </Form.Group>
          <Form.Group style={mt8}>
            <Form.Text className="text-muted" style={mb4}>
              <small>SELECT A TEMPLATE</small>
            </Form.Text>
            <InputGroup>
              <Form.Control
                className="custom-select"
                as="select"
                value={template}
                onChange={setTargetTemplate}
              >
                {templateList.map((temp, idx) => {
                  return (
                    <option value={temp} key={idx}>
                      {temp}
                    </option>
                  );
                })}
              </Form.Control>
              <Button variant="success" size="sm" onClick={wrappedCreateTemplate}>
                <small>Create</small>
              </Button>
            </InputGroup>
          </Form.Group>
          <Form.Group style={mt8}>
            <Form.Text className="text-muted" style={mb4}>
              <small>TARGET PROJECT </small>
              <span onClick={wrappedGetList}>
                <FaSyncAlt />
              </span>
            </Form.Text>
            <InputGroup>
              <Form.Control
                className="custom-select"
                as="select"
                value={compileTarget}
                onChange={setTarget}
              >
                {projectList?.map((projectName, idx) => {
                  return (
                    <option value={projectName} key={idx}>
                      {projectName}
                    </option>
                  );
                })}
              </Form.Control>
            </InputGroup>
          </Form.Group>
        </div>
      </Form>

      <hr />
      <Compiler
        isCompiling={isCompiling}
        setIsCompiling={setIsCompiling}
        fileName={fileName}
        setFileName={setFileName}
        providerInstance={injectedProvider}
        compileTarget={compileTarget}
        account={account}
        client={client}
        providerNetwork={providerNetwork}
        contractAbiMap={contractAbiMap}
        setContractAbiMap={setContractAbiMap}
        contractAddr={contractAddr}
        setContractAddr={setContractAddr}
        setContractName={setContractName}
        addNewContract={addNewContract}
        setSelected={setSelected}
        isActivated={isActivated}
        setIsActivated={setIsActivated}
      />
      <p className="text-center mt-3">
        <small>OR</small>
      </p>
      <InputGroup className="mb-3">
        <Form.Control
          value={contractAddr}
          placeholder="contract address"
          onChange={(e) => {
            setContractAddr(e.target.value);
          }}
          size="sm"
          disabled={busy || account === '' || isCompiling}
        />
        <OverlayTrigger
          placement="left"
          overlay={<Tooltip id="overlay-ataddresss">Use deployed Contract address</Tooltip>}
        >
          <Button
            variant="primary"
            size="sm"
            disabled={busy || account === '' || isCompiling}
            onClick={async () => {
              sendCustomEvent('at_address', {
                event_category: 'arbitrum',
                method: 'at_address',
              });
              console.log(`@@@ contractAddr=${contractAddr}, selected`, selected);
              setBusy(true);
              let abi = contractAbiMap.get(contractAddr.toLowerCase());
              console.log('on at address contractAbiMap', contractAbiMap, abi);
              if (abi) {
                console.log(`Existing abi`, abi);
              } else {
                console.log(`@@@ Reading user specific abi`, abi);
                const abiStr = await client.fileManager.readFile('browser/arbitrum/abi.json');
                abi = JSON.parse(abiStr);
              }

              addNewContract({
                name: '',
                address: contractAddr,
                abi: abi || [],
              });
              setBusy(false);
            }}
          >
            <small>At Address</small>
          </Button>
        </OverlayTrigger>
        <OverlayTrigger
          placement="top"
          overlay={
            <Tooltip id="overlay-ataddresss">
              <span>Please specify ABI in </span>
              <span style={{ fontWeight: 'bold' }}>/arbitrum/abi.json</span>
            </Tooltip>
          }
        >
          <div
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              marginLeft: '0.1em',
              fontSize: '0.9em',
            }}
          >
            &#9432;
          </div>
        </OverlayTrigger>
      </InputGroup>
      <div style={{ marginTop: '-0.5em', marginBottom: '1em', alignContent: 'center' }}></div>
      <SmartContracts
        dapp={injectedProvider}
        account={account}
        busy={busy}
        setBusy={setBusy}
        contracts={contracts}
        setContracts={setContracts}
        client={client}
        web3={new Web3(injectedProvider)}
      />
      <hr />
    </div>
  );
};

const mt8 = {
  marginTop: '8px',
};

const mb4 = {
  marginBottom: '4px',
};
