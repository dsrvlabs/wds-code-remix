import React, { Dispatch, useContext } from 'react';
import { Accordion, Form, InputGroup, useAccordionButton, AccordionContext } from 'react-bootstrap';
import { AbiInput, AbiItem } from 'web3-utils';
import { log } from '../../utils/logger';

interface InterfaceProps {
  abi: AbiItem | null;
  setArgs: (name: string, value: any) => void;
  setObjArgs: (name: string, value: any, componentName: string) => void;
  setDeposit: Dispatch<React.SetStateAction<number>>;
  setUnits: Dispatch<React.SetStateAction<string>>;
  setDisable: Dispatch<React.SetStateAction<boolean>>;
  setGasLimit: Dispatch<React.SetStateAction<number>>;
}

const Method: React.FunctionComponent<InterfaceProps> = (props) => {
  const [inputs, setInputs] = React.useState<AbiInput[]>([]);
  const { abi, setArgs, setObjArgs, setDeposit, setUnits, setDisable, setGasLimit } = props;

  React.useEffect(() => {
    setInputs(abi && abi.inputs ? abi.inputs : []);
  }, [abi]);

  function DrawInputs() {
    const setArguments = (event: React.ChangeEvent<HTMLInputElement>, item: AbiInput) => {
      let type = item.type;
      let args: string | null = event.target.value;
      if (item.type.includes('null')) {
        type = item.type.split('|')[0].trim();
      }
      if (args === '') args = null;
      switch (type) {
        case 'string':
          setArgs(event.target.name, args === null ? null : String(args));
          break;
        case 'number':
        case 'integer':
          setArgs(event.target.name, args === null ? null : Number(args));
          break;
        case 'boolean':
          setArgs(event.target.name, args === null ? null : JSON.parse(args.toLowerCase()));
          break;
        case 'array':
        case 'object':
          setArgs(event.target.name, args === null ? null : JSON.parse(args));
          break;
      }
    };

    const setComponents = (
      event: React.ChangeEvent<HTMLInputElement>,
      component: AbiInput,
      name: string,
    ) => {
      let type = component.type;
      let args: string | null = event.target.value;
      if (component.type.includes('null')) {
        type = component.type.split('|')[0].trim();
      }
      if (args === '') args = null;

      switch (type) {
        case 'string':
          setObjArgs(name, args === null ? null : String(args), event.target.name);
          break;
        case 'number':
        case 'integer':
          setObjArgs(name, args === null ? null : Number(args), event.target.name);
          break;
        case 'boolean':
          setObjArgs(name, args === null ? null : Boolean(args), event.target.name);
          break;
        case 'array':
        case 'object':
          setObjArgs(name, args === null ? null : JSON.parse(args), event.target.name);
          break;
      }
    };

    const CustomToggle = (props: { item: AbiInput; eventKey: string }) => {
      const { activeEventKey } = useContext(AccordionContext);
      const decoratedOnClick = useAccordionButton(props.eventKey, () => {});
      const isCurrentEventKey = activeEventKey === props.eventKey;

      return (
        <>
          <div style={{ display: 'flex' }}>
            <Form.Control
              type="text"
              size="sm"
              disabled={true}
              name={props.item.name}
              style={{ display: 'inline-block' }}
              placeholder={
                props.item.type.includes('null') && !props.item.internalType?.includes('null')
                  ? props.item.internalType + ' | null'
                  : props.item.internalType
              }
            />
            <i
              className={
                isCurrentEventKey
                  ? 'fas fa-angle-up udapp_methCaret'
                  : 'fas fa-angle-down udapp_methCaret'
              }
              onClick={decoratedOnClick}
              style={{ margin: 'auto 0 auto 10px' }}
            ></i>
          </div>
        </>
      );
    };

    const DrawComponents = (props: { inputs: AbiInput[]; name: string }) => {
      const components = props.inputs.map((component: AbiInput, index) => {
        return (
          <>
            <React.Fragment key={index.toString()}>
              <div
                style={{
                  margin: '5px 20px 5px 0',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <label style={{ margin: 'auto 5px auto 0' }} className="text-muted">
                  {component.name}:
                </label>
                <Form.Control
                  type="text"
                  size="sm"
                  name={component.name}
                  style={{ width: '60%' }}
                  placeholder={
                    component.type.includes('null') && !component.internalType?.includes('null')
                      ? component.internalType + ' | null'
                      : component.internalType
                  }
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    setComponents(event, component, props.name)
                  }
                />
              </div>
            </React.Fragment>
          </>
        );
      });
      return <Form.Group>{components}</Form.Group>;
    };

    const items = inputs.map((item: AbiInput, index: number) => {
      if (item.internalType === 'borsh') {
        setDisable(true);
      }
      if (item.components) {
        return (
          <>
            <React.Fragment key={index.toString()}>
              <Form.Text className="text-muted">
                <small>{item.name}</small>
              </Form.Text>
              <Accordion>
                <Accordion.Item eventKey={`Components_${index}`}>
                  <CustomToggle eventKey={`Components_${index}`} item={item} />
                  <Accordion.Body>
                    <DrawComponents inputs={item.components} name={item.name} />
                  </Accordion.Body>
                </Accordion.Item>
              </Accordion>
            </React.Fragment>
          </>
        );
      }
      return (
        <>
          <React.Fragment key={index.toString()}>
            <Form.Text className="text-muted">
              <small>{item.name}</small>
            </Form.Text>
            <Form.Control
              type="text"
              size="sm"
              disabled={item.internalType === 'borsh'}
              name={item.name}
              placeholder={
                item.internalType === 'borsh'
                  ? 'not support borsh type'
                  : item.type.includes('null') && !item.internalType?.includes('null')
                  ? item.internalType + ' | null'
                  : item.internalType
              }
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setArguments(event, item)}
            />
          </React.Fragment>
        </>
      );
    });

    const deposit = () => {
      return (
        <>
          {abi?.stateMutability === 'payable' ? (
            <InputGroup style={{ marginTop: '10px' }}>
              <Form.Control
                type="number"
                placeholder="Deposit"
                size="sm"
                onChange={(e) => {
                  setDeposit(Number(e.target.value));
                }}
                style={{ top: '1px', height: '32px', marginTop: '5px', marginRight: '3px' }}
              />
              <Form.Control
                className="custom-select"
                type="text"
                as="select"
                placeholder="Units"
                size="sm"
                onChange={(e) => {
                  setUnits(e.target.value);
                }}
                style={{ marginTop: '5px', marginLeft: '2px' }}
              >
                <option value={'NEAR'} key={'1'}>
                  {'NEAR'}
                </option>
                <option value={'yoctoNEAR'} key={'2'}>
                  {'yoctoNEAR'}
                </option>
              </Form.Control>
            </InputGroup>
          ) : (
            false
          )}
        </>
      );
    };

    const gasLimit = () => {
      return (
        <>
          {abi?.stateMutability !== 'view' && (
            <React.Fragment>
              <Form.Text className="text-muted">
                <small>GAS LIMIT</small>
              </Form.Text>
              <Form.Control
                type="text"
                size="sm"
                defaultValue="30000000000000"
                aria-describedby="gasLimitHelp"
                onChange={(e) => {
                  setGasLimit(Number(e.target.value));
                }}
              />
              <Form.Text id="gasLimitHelp" muted>
                Max amount of gas this call can use.
                <br /> Default value is 30TGas.
              </Form.Text>
            </React.Fragment>
          )}
        </>
      );
    };
    return (
      <>
        <Form.Group>{items}</Form.Group>
        {deposit()}
        {gasLimit()}
      </>
    );
  }

  return <Form className="Method">{DrawInputs()}</Form>;
};

export default Method;
