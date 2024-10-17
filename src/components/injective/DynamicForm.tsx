import { isObject } from '@rjsf/utils';
import React, { useState, useEffect, Dispatch, useCallback } from 'react';
import { Button, FloatingLabel, InputGroup, Form } from 'react-bootstrap';

interface IDynamicFormProps {
  schema: { [key: string]: any };
  children?: React.ReactNode;
  msgData: { [key: string]: any };
  setMsgData: Dispatch<React.SetStateAction<{ [key: string]: any }>>;
}

const DynamicForm = ({ schema, children, msgData, setMsgData }: IDynamicFormProps) => {
  const [selectedSchemaIndex, setSelectedSchemaIndex] = useState(0);
  const [selectedSchemaName, setselectedSchemaName] = useState('');
  const [selecteSchemaFieldKeys, setSelectedSchemaFieldKeys] = useState([]);
  const [filedData, setFieldData] = useState<{ [x: string]: any }>({});
  const [inputValue, setInputValue] = useState<{ [x: string]: any }>({});

  const reset = () => {
    setSelectedSchemaIndex(0);
    setselectedSchemaName('');
    setSelectedSchemaFieldKeys([]);
    setFieldData({});
    setMsgData({});
  };

  useEffect(() => {
    if (schema.oneOf) {
      reset();
      makeSelectedSchemaData(schema.oneOf[selectedSchemaIndex], schema.definitions);
    }
  }, [schema]);

  const makeSelectedSchemaData = useCallback(
    (selectedSchema: { [x: string]: any }, definitions: { [x: string]: any }) => {
      setselectedSchemaName(selectedSchema.required[0]);
      let schemaName: string = selectedSchema.required[0];
      const setInitialFormData = (
        selectedSchema: { [x: string]: any },
        definitions: { [x: string]: any },
      ) => {
        Object.keys(selectedSchema).forEach((schemaKey) => {
          const schemaProperty = selectedSchema[schemaKey];

          if (schemaProperty === 'object' && schemaProperty.properties) {
            setInitialFormData(schemaProperty.properties, definitions);
          } else if (isObject(schemaProperty) && Object.keys(schemaProperty).length === 1) {
            if (!schemaProperty[schemaName].required) {
              setMsgData({ [schemaName]: {} });
              setFieldData({ [schemaName]: {} });
            } else {
              setSelectedSchemaFieldKeys(schemaProperty[schemaName].required);
              Object.keys(schemaProperty[schemaName].properties).forEach((key) => {
                const property = schemaProperty[schemaName].properties[key];

                switch (property.type) {
                  case 'string': {
                    setMsgData((prevData) => ({
                      [schemaName]: {
                        ...prevData[schemaName],
                        [key]: '',
                      },
                    }));

                    setFieldData((prevData) => ({
                      ...prevData,
                      [key]: property,
                    }));
                    break;
                  }
                  case 'integer': {
                    setMsgData((prevData) => ({
                      [schemaName]: {
                        ...prevData[schemaName],
                        [key]: 0,
                      },
                    }));

                    setFieldData((prevData) => ({
                      ...prevData,
                      [key]: property,
                    }));
                    break;
                  }
                  case 'array': {
                    if (property.items.$ref) {
                      const refData = resolveRef(property.items.$ref, definitions);
                      if (refData.properties) {
                        Object.keys(refData.properties).forEach((refPropertyKey) => {
                          if (refData.properties[refPropertyKey].$ref) {
                            const doubleRefData = resolveRef(
                              refData.properties[refPropertyKey].$ref,
                              definitions,
                            );

                            setMsgData((prevData) => ({
                              [schemaName]: {
                                ...prevData[schemaName],
                                [key]: {
                                  [refPropertyKey]: doubleRefData.type === 'integer' ? 0 : '',
                                },
                              },
                            }));

                            setFieldData((prevData) => ({
                              ...prevData,
                              [key]: {
                                type: 'array',
                                ...prevData[key],
                                [refPropertyKey]: { ...doubleRefData },
                              },
                            }));
                          } else {
                            setMsgData((prevData) => ({
                              [schemaName]: {
                                ...prevData[schemaName],
                                [key]: {
                                  [refPropertyKey]:
                                    refData.properties[refPropertyKey].type === 'integer' ? 0 : '',
                                },
                              },
                            }));

                            setFieldData((prevData) => ({
                              ...prevData,
                              [key]: {
                                type: 'array',
                                ...prevData[key],
                                [refPropertyKey]: { ...refData.properties[refPropertyKey] },
                              },
                            }));
                          }
                        });
                      }
                    } else {
                      setMsgData((prevData) => ({
                        [schemaName]: {
                          ...prevData[schemaName],
                          [key]: [],
                        },
                      }));

                      setFieldData((prevData) => ({
                        ...prevData,
                        [key]: property,
                      }));
                    }
                    break;
                  }
                  default: {
                    if (property.$ref) {
                      const refData = resolveRef(property.$ref, definitions);
                      //ref inside the ref (e.g FPDecimal)
                      if (refData.properties) {
                        Object.keys(refData.properties).forEach((propertyKey) => {
                          setMsgData((prevData) => ({
                            [schemaName]: {
                              ...prevData[schemaName],
                              [key]: {
                                [propertyKey]:
                                  refData.properties[propertyKey].type === 'integer' ? 0 : '',
                              },
                            },
                          }));
                        });
                        setFieldData((prevData) => ({
                          ...prevData,
                          [key]: { ...refData.properties },
                        }));
                      } else {
                        setMsgData((prevData) => ({
                          [schemaName]: {
                            ...prevData[schemaName],
                            [key]: refData.type === 'integer' ? 0 : '',
                          },
                        }));

                        setFieldData((prevData) => ({
                          ...prevData,
                          [key]: { ...refData },
                        }));
                      }
                    } else if (property.anyOf) {
                    }
                    break;
                  }
                }
              });
            }
          }
        });
      };
      setInitialFormData(selectedSchema, definitions);
    },
    [],
  );
  const resolveRef = (ref: string, definitions: { [key: string]: any }) => {
    const refKey = ref.replace('#/definitions/', '');
    return definitions[refKey];
  };

  const addElementToArrayField = (fieldData: any, fieldKey: string) => {
    Object.keys(fieldData).forEach((fieldDataKey) => {
      if (fieldData[fieldDataKey].type) {
      } else {
        return null;
      }
    });
  };
  const handleInputChange = (e: any, fieldKey: any, parentKey?: any, index?: number) => {
    setMsgData((prevData) => ({
      [selectedSchemaName]: {
        ...prevData[selectedSchemaName],
        [fieldKey]: e.target.value,
      },
    }));
  };

  const renderForm = () => {
    return (
      <div>
        {selecteSchemaFieldKeys.map((field: string, index: number) => (
          <div key={index}>
            <Form.Text style={{ fontSize: '1em' }} className="mb-2">
              {field}
            </Form.Text>
            {Object.keys(filedData).map((dataKey: any, index: any) => (
              <div key={index}>
                {field === dataKey ? renderFormFields(filedData[dataKey], dataKey, field) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderFormFields = (
    fieldData: { [x: string]: any },
    fieldName: string,
    parentKey: string,
  ) => {
    return Object.keys(fieldData).map((dataKey: any) => {
      if (fieldData[dataKey] === 'array') {
        return (
          <div>
            <Button
              onClick={() => {
                addElementToArrayField(filedData, fieldName);
              }}
            >
              +
            </Button>
          </div>
        );
      } else if (fieldData[dataKey] === 'string') {
        return <Form.Control className="mb-2" key={dataKey} type="text"></Form.Control>;
      } else if (fieldData[dataKey] === 'integer') {
        return (
          <Form.Control
            className="mb-2"
            key={dataKey}
            type="number"
            value={msgData[selectedSchemaName][fieldName]}
            onChange={(e) => handleInputChange(e, fieldName, parentKey)}
          ></Form.Control>
        );
      } else {
        return null;
      }
    });
  };

  const handleSchemaSelection = (e: any) => {
    reset();
    setSelectedSchemaIndex(Number(e.target.value));
    makeSelectedSchemaData(schema.oneOf[e.target.value], schema.definitions);
  };

  useEffect(() => {
    if (schema.oneOf) {
      makeSelectedSchemaData(schema.oneOf[selectedSchemaIndex], schema.definitions);
    }
    console.log(msgData);
  }, [makeSelectedSchemaData, schema, selectedSchemaIndex]);

  return (
    <div>
      <Form.Group className="mb-2">
        <Form.Text className="mb-2">{schema.title}</Form.Text>
        <Form.Control
          className="cosmwasm-schema-select"
          as="select"
          onChange={handleSchemaSelection}
        >
          {schema.oneOf
            ? schema.oneOf.map((option: any, index: any) => (
                <option key={index} value={index}>
                  {Object.keys(option.properties || {})}
                </option>
              ))
            : null}
        </Form.Control>
        {renderForm()}
        <Button
          onClick={() => {
            console.log(msgData);
            console.log(selectedSchemaName);
          }}
        >
          Test
        </Button>
        {children}
      </Form.Group>
    </div>
  );
};
export default DynamicForm;
