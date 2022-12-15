import React, { Dispatch, useContext } from 'react';
import {
  Form,
  InputGroup,
  Button,
  Accordion,
  Card,
  useAccordionButton,
  AccordionContext,
} from 'react-bootstrap';

export interface RowData {
  field: string;
  type: string;
  value: string;
}

interface InterfaceProps {
  setRowsData: Dispatch<React.SetStateAction<RowData[]>>;
  rowsData: RowData[];
  setInitFunction: Dispatch<React.SetStateAction<string>>;
  setInitDeposit: Dispatch<React.SetStateAction<number>>;
  setUnits: Dispatch<React.SetStateAction<string>>;
}

export const DeployOption: React.FunctionComponent<InterfaceProps> = ({
  setRowsData,
  rowsData,
  setInitFunction,
  setInitDeposit,
  setUnits,
}) => {
  function CustomToggle(props: { children: string; eventKey: string }) {
    const { activeEventKey } = useContext(AccordionContext);
    const decoratedOnClick = useAccordionButton(props.eventKey, () => {});
    const isCurrentEventKey = activeEventKey === props.eventKey;

    return (
      <div
        className="card-header"
        style={{ padding: '5px', borderBottom: '0.1px', display: 'flex' }}
        onClick={decoratedOnClick}
      >
        <small>{props.children}</small>
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
    );
  }
  return (
    <Accordion key={'option'} style={{ paddingBottom: '5px' }}>
      <Accordion.Item as={Card.Header} eventKey={'option'} style={{ padding: '0' }}>
        <CustomToggle eventKey={'option'}>Deploy Option</CustomToggle>
        <Accordion.Body>
          <Card.Body className="py-1 px-2">
            <InputGroup>
              <Form.Text className="text-muted">
                <small>Init Function</small>
              </Form.Text>
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder="init function name"
                  size="sm"
                  onChange={(e) => {
                    setInitFunction(e.target.value.trim());
                  }}
                />
              </InputGroup>
              <Form.Text className="text-muted">
                <small>Init Arguments</small>
              </Form.Text>
              <AddArguments setRowsData={setRowsData} rowsData={rowsData} />
              <Form.Text className="text-muted">
                <small>Init Deposit</small>
              </Form.Text>
              <InputGroup>
                <Form.Control
                  type="number"
                  placeholder="init deposit"
                  size="sm"
                  onChange={(e) => {
                    setInitDeposit(Number(e.target.value));
                  }}
                  style={{ height: '100%' }}
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
                  style={{ margin: '0 5px' }}
                >
                  <option value={'NEAR'} key={'1'}>
                    {'NEAR'}
                  </option>
                  <option value={'yoctoNEAR'} key={'2'}>
                    {'yoctoNEAR'}
                  </option>
                </Form.Control>
              </InputGroup>
            </InputGroup>
          </Card.Body>
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  );
};

export const AddArguments: React.FunctionComponent<{
  setRowsData: Dispatch<React.SetStateAction<RowData[]>>;
  rowsData: RowData[];
}> = ({ setRowsData, rowsData }) => {
  const addRows = (e: any) => {
    e.preventDefault();
    const rowsInput: RowData = {
      field: '',
      type: '',
      value: '',
    };
    setRowsData([...rowsData, rowsInput]);
  };

  const deleteRows = (index: any, evnt: any) => {
    evnt.preventDefault();
    const rows = [...rowsData];
    rows.splice(index, 1);
    setRowsData(rows);
  };

  type RowDataKey = 'field' | 'type' | 'value';

  const handleChange = (index: number, name: RowDataKey, value: string) => {
    // const { name, value } = event.target;
    const rowsInput = [...rowsData];
    rowsInput[index][name] = value;
    setRowsData(rowsInput);
  };
  return (
    <>
      {rowsData.length ? (
        <div className="row">
          <div className="col-sm-8">
            <table className="table">
              <thead>
                <tr style={{ textAlign: 'center' }}>
                  <th style={pad5font}>Field</th>
                  <th style={pad5font}>Type</th>
                  <th style={pad5font}>Value</th>
                </tr>
              </thead>

              <tbody>
                {rowsData.map((data: RowData, index: number) => {
                  const { field, type, value } = data;
                  return (
                    <tr key={index} style={{ borderStyle: '' }}>
                      <td style={pad5font}>
                        <input
                          type="text"
                          value={field}
                          onChange={(event) => handleChange(index, 'field', event.target.value)}
                          name="field"
                          className="form-control"
                        />
                      </td>
                      <td style={pad5font}>
                        {/* <input type="text" value={type}  onChange={(evnt)=>(handleChange(index, evnt))} name="type" className="form-control"/> */}
                        <Form.Control
                          className="custom-select form-control"
                          type="text"
                          as="select"
                          placeholder="Type"
                          size="sm"
                          onChange={(event) => handleChange(index, 'type', event.target.value)}
                          style={{ minWidth: '90px', minHeight: '35px' }}
                          data-toggle="tooltip"
                          data-placement="top"
                          title="Type"
                          value={type}
                          name="type"
                        >
                          {/* <option value={'Auto'} key={'1'}>{'Auto'}</option> */}
                          <option value={''} key={'0'}>
                            {'-------'}
                          </option>
                          <option value={'String'} key={'1'}>
                            {'String'}
                          </option>
                          <option value={'Number'} key={'2'}>
                            {'Number'}
                          </option>
                          <option value={'Boolean'} key={'3'}>
                            {'Boolean'}
                          </option>
                          {/* <option value={'Null'} key={'5'}>{'Null'}</option> */}
                          <option value={'JSON'} key={'4'}>
                            {'Raw JSON'}
                          </option>
                        </Form.Control>
                      </td>
                      <td className="position-relative" style={pad5font}>
                        <input
                          type="text"
                          value={value}
                          onChange={(event) => handleChange(index, 'value', event.target.value)}
                          name="value"
                          className="form-control"
                        />

                        <i
                          className="m-2 ml-3 fas fa-times-circle udapp_errorIcon position-absolute end-0"
                          style={{ top: '0', right: '-8px' }}
                          onClick={(evnt) => {
                            deleteRows(index, evnt);
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        false
      )}
      <InputGroup>
        <Button variant="secondary" onClick={addRows} size="sm">
          <small>Add Argument +</small>
        </Button>
      </InputGroup>
    </>
  );
};

const pad5font = { padding: '0.5rem 0.5rem', fontWeight: 'normal' };
