import React, { useState, useEffect } from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import { FaSyncAlt } from 'react-icons/fa';
import { Compiler } from './Compiler';
import axios from 'axios';
import JSZip from 'jszip';
import wrapPromise from '../../utils/wrapPromise';
import { sendCustomEvent } from '../../utils/sendCustomEvent';
import { COMPILER_API_ENDPOINT } from '../../const/endpoint';
import { Client } from '@remixproject/plugin';
import { Api } from '@remixproject/plugin-utils';
import { IRemixApi } from '@remixproject/plugin-api';
import { Near, providers } from 'near-api-js';
import { Provider } from './WalletRpcProvider';
import { log } from '../../utils/logger';

interface InterfaceProps {
  accountID: string;
  walletRpcProvider: providers.WalletRpcProvider | undefined;
  providerProxy: Provider | undefined;
  nearConfig: Near | undefined;
  client: Client<Api, Readonly<IRemixApi>>;
}

const PROJECT_TEMPLATE_FILETYPE = [
  { label: 'Rust', value: 'rs' },
  { label: 'AssemblyScript', value: 'as' },
  { label: 'TypeScript', value: 'ts' },
  { label: 'JavaScript', value: 'js' },
];

export const Project: React.FunctionComponent<InterfaceProps> = ({
  accountID,
  walletRpcProvider,
  providerProxy,
  nearConfig,
  client,
}) => {
  const [projectName, setProjectName] = useState<string>('noname');
  const [projectList, setProjectList] = useState<string[]>([]);
  const [compileTarget, setCompileTarget] = useState<string>('');
  const [lang, setLang] = useState<string>('rs');
  const [template, setTemplate] = useState<string>('as_counter');
  const templateList = ['as_counter', 'rs_counter', 'rs_ft', 'rs_nft'];

  useEffect(() => {
    getList();
  }, []);

  const getList = async () => {
    const list = await getProjectList();
    setProjectList(list);
    list.length > 0 && setCompileTarget(list[0]);
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

  const createProject = async () => {
    sendCustomEvent('new_project', {
      event_category: 'near',
      method: 'new_project',
    });
    if (await wrappedIsExists(projectName)) {
      await client.terminal.log({
        type: 'error',
        value: 'The folder "near/' + projectName + '" already exists',
      });
      return;
    }

    try {
      const path = 'browser/near/' + projectName;
      if (lang === 'rs') {
        await client.fileManager.mkdir(path + '/src');
        await client.fileManager.writeFile(path + '/Cargo.toml', '');
      } else if (lang === 'as') {
        await client.fileManager.mkdir(path + '/assembly');
        await client.fileManager.writeFile(path + '/assembly/index.ts', '');
      } else if (lang === 'ts') {
        await client.fileManager.writeFile(path + '/src/contract.ts', '');
        await client.fileManager.writeFile(path + '/package.json', '');
        await client.fileManager.writeFile(path + '/babel.config.json', '');
        await client.fileManager.writeFile(path + '/tsconfig.json', '');
      } else if (lang === 'js') {
        await client.fileManager.writeFile(path + '/src/contract.js', '');
        await client.fileManager.writeFile(path + '/package.json', '');
        await client.fileManager.writeFile(path + '/babel.config.json', '');
      }
      wrappedGetList();
    } catch (e: any) {
      await client.terminal.log({ type: 'error', value: e.message });
    }
  };
  const wrappedCreateProject = () => wrapPromise(createProject(), client);

  const getProjectList = async () => {
    try {
      const list = await client.fileManager.readdir('browser/near/');
      return Object.keys(list || []);
    } catch (e) {
      log.error(e);
    }
    return [];
  };

  // const wrappedGetProjectList = () => wrapPromise(getProjectList(), client);

  const isExists = async (dir: string) => {
    try {
      log.debug(await client.fileManager.readdir('browser/near/' + dir));
      return true;
    } catch (e) {
      log.error(e);
      return false;
    }
  };

  const wrappedIsExists = (dir: string) => wrapPromise(isExists(dir), client);

  const createTemplate = async () => {
    sendCustomEvent('create_template', {
      event_category: 'near',
      method: 'create_template',
    });

    if (await wrappedIsExists(template)) {
      await client.terminal.log({
        type: 'error',
        value: 'The folder "near/' + template + '" already exists',
      });
      return;
    }

    const res = await axios.request({
      method: 'GET',
      url:
        `${COMPILER_API_ENDPOINT}/s3Proxy?bucket=code-template&fileKey=near/` + template + '.zip',
      responseType: 'arraybuffer',
      responseEncoding: 'null',
    });

    const jsZip = new JSZip();
    const zip = await jsZip.loadAsync(res.data);

    let content: any;
    try {
      Object.keys(zip.files).map(async (key) => {
        if (zip.files[key].dir) {
          await client.fileManager.mkdir('browser/near/' + key);
        } else if (!key.startsWith('_') && key !== template + '/.DS_Store') {
          content = await zip.file(key)?.async('string');
          await client.fileManager.writeFile('browser/near/' + key, content);
        }
      });
      await wrappedGetList();
      await client.terminal.log({
        type: 'info',
        value: template + ' is created successfully.',
      });
    } catch (e) {
      log.error(e);
    }
  };

  const wrappedCreateTemplate = () => wrapPromise(createTemplate(), client);

  const handleChange = (e: { target: { value: React.SetStateAction<string> } }) => {
    setLang(e.target.value);
  };

  return (
    <div>
      <Form>
        <Form.Group style={mt8}>
          <Form.Text className="text-muted" style={mb4}>
            <small>TEMPLATE CODE</small>
          </Form.Text>
          <InputGroup>
            <Form.Control as="select" value={template} onChange={setTargetTemplate}>
              {templateList.map((temp, idx) => {
                return (
                  <option value={temp} key={idx}>
                    {temp}
                  </option>
                );
              })}
            </Form.Control>
            <Button variant="success" size="sm" onClick={wrappedCreateTemplate}>
              <small>Create Template</small>
            </Button>
          </InputGroup>
        </Form.Group>
        <Form.Group style={mt8}>
          <Form.Text className="text-muted">
            <small>PROJECT</small>
          </Form.Text>
          <InputGroup style={mb4}>
            {PROJECT_TEMPLATE_FILETYPE.map(({ label, value }, idx) => {
              return (
                <Form.Check
                  inline
                  label={label}
                  name={'group1'}
                  type={'radio'}
                  id={`radio${idx}`}
                  value={value}
                  onChange={handleChange}
                />
              );
            })}
          </InputGroup>
          <InputGroup>
            <Form.Control type="text" placeholder="Project Name" size="sm" onChange={setProject} />
            <Button variant="success" size="sm" onClick={wrappedCreateProject}>
              <small>New Project</small>
            </Button>
          </InputGroup>
        </Form.Group>
        <Form.Group style={mt8}>
          <Form.Text className="text-muted" style={mb4}>
            <small>PROJECT TO COMPILE </small>
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
              {projectList.map((projectName, idx) => {
                return (
                  <option value={projectName} key={idx}>
                    {projectName}
                  </option>
                );
              })}
            </Form.Control>
          </InputGroup>
        </Form.Group>
      </Form>

      <hr />
      <Compiler
        compileTarget={compileTarget}
        accountID={accountID}
        walletRpcProvider={walletRpcProvider}
        providerProxy={providerProxy}
        nearConfig={nearConfig}
        client={client}
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
