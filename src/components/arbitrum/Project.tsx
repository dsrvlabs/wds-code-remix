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
  wallet: string;
  account: string;
  client: Client<Api, Readonly<IRemixApi>>;
  injectedProvider: any;
  providerNetwork: string;
}

export const Project: React.FunctionComponent<InterfaceProps> = ({
  wallet,
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
  const [abi, setAbi] = useState<AbiItem[]>([]);
  const [contractName, setContractName] = useState<string>('');

  const [busy, setBusy] = React.useState<boolean>(false);
  const [contractAddr, setContractAddr] = React.useState<string>('');
  const [contracts, setContracts] = React.useState<InterfaceContract[]>([]);
  const [selected, setSelected] = React.useState<InterfaceContract | null>(null);

  const templateList = ['hello-world'];

  useEffect(() => {
    getList().then();
  }, []);

  const getList = async () => {
    const projects = await getProjects();
    setProjectList(projects);
    if (projects?.length > 0) {
      const compileTarget = projects[0];
      setCompileTarget(compileTarget);
      try {
        const abiStr = await client?.fileManager.readFile(
          'browser/' + compileTarget + '/output/abi.json',
        );
        const abi = JSON.parse(abiStr) as AbiItem[];
        setAbi(abi);
        setSelected({ name: '', address: '', abi: abi });
        console.log(`@@@ abiStr=${abiStr}`);
      } catch (e) {
        console.log(`No abi.json`);
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
    const filtered = contracts.filter((c) => c.address !== contract.address);
    setContracts([contract].concat(filtered));
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

  const getProjects = async () => {
    try {
      const list = await client?.fileManager.readdir('browser/arbitrum/');
      return Object.keys(list || []);
    } catch (e) {
      log.error(e);
    }
    return [];
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
        fileName={fileName}
        setFileName={setFileName}
        providerInstance={injectedProvider}
        compileTarget={compileTarget}
        wallet={wallet}
        account={account}
        client={client}
        providerNetwork={providerNetwork}
        abi={abi}
        setAbi={setAbi}
        contractAddr={contractAddr}
        setContractAddr={setContractAddr}
        setContractName={setContractName}
        addNewContract={addNewContract}
        setSelected={setSelected}
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
          disabled={busy || account === '' || !selected}
        />
        <OverlayTrigger
          placement="left"
          overlay={<Tooltip id="overlay-ataddresss">Use deployed Contract address</Tooltip>}
        >
          <Button
            variant="primary"
            size="sm"
            disabled={busy || account === '' || !selected}
            onClick={() => {
              sendCustomEvent('at_address', {
                event_category: 'arbitrum',
                method: 'at_address',
              });
              setBusy(true);
              if (selected) {
                addNewContract({ ...selected, address: contractAddr });
              }
              setBusy(false);
            }}
          >
            <small>At Address</small>
          </Button>
        </OverlayTrigger>
      </InputGroup>
      <hr />
      <SmartContracts
        dapp={injectedProvider}
        account={account}
        busy={busy}
        setBusy={setBusy}
        contracts={contracts}
        client={client}
        web3={new Web3(injectedProvider)}
      />
    </div>
  );
};

const mt8 = {
  marginTop: '8px',
};

const mb4 = {
  marginBottom: '4px',
};
