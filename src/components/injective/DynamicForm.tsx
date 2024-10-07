import React, { useState, useEffect, Dispatch } from 'react';
import { Button, FloatingLabel, InputGroup, Form } from 'react-bootstrap';

interface IDynamicFormProps {
  schema: { [key: string]: any };
  children?: React.ReactNode;
  msgData: { [key: string]: any };
  setMsgData: Dispatch<React.SetStateAction<{ [key: string]: any }>>;
}

type CosmwasmSchemaType = 'boolean' | 'object' | 'intger' | 'array';

const DynamicForm = ({ schema, children, msgData, setMsgData }: IDynamicFormProps) => {
  const [selectedSchemaIndex, setSelectedSchemaIndex] = useState(0);

  useEffect(() => {
    if (schema.oneOf) {
      const selectedSchema = schema.oneOf[selectedSchemaIndex];
      const initialData = initializeFormData(selectedSchema.properties);
      setMsgData(initialData);
    }
  }, [selectedSchemaIndex, schema]);

  const initializeFormData = (properties: { [key: string]: any }) => {
    const initialData: { [x: string]: any } = {};
    Object.keys(properties).forEach((key) => {
      const property = properties[key];
      if (property.type === 'object' && property.properties) {
        initialData[key] = initializeFormData(property.properties);
      } else if (property.type === 'string') {
        initialData[key] = '';
      } else if (property.type === 'integer') {
        initialData[key] = 0;
      } else if (property.type === 'array') {
        initialData[key] = [];
      } else if (property.type === 'object' && !property.properties) {
        initialData[key] = {};
      }
    });
    return initialData;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    parentKey: string | number,
    key: string | number,
    fieldType: CosmwasmSchemaType,
  ) => {
    const { value } = e.target;
    const booleanValueId = e.target.id.split('-');
    if (fieldType === 'boolean') {
      setMsgData((prevData) => ({
        ...prevData,
        [parentKey]: {
          ...prevData[parentKey],
          [key]: booleanValueId[booleanValueId.length - 1],
        },
      }));
    } else {
      setMsgData((prevData) => ({
        ...prevData,
        [parentKey]: {
          ...prevData[parentKey],
          [key]: value,
        },
      }));
    }
  };

  const renderFormFields = (
    properties: { [key: string]: any },
    parentKey: string,
    definitions?: { [key: string]: string },
  ) => {
    // console.log(definitions);
    return Object.keys(properties).map((key) => {
      const property = properties[key];
      if (property.type === 'object' && property.properties) {
        return <div key={key}>{renderFormFields(property.properties, key)}</div>;
      } else if (property.type === 'object' && !property.properties) {
        // JSON Object property with no property inside
        return null;
      } else if (property.type === 'integer' || property.type === 'string') {
        return (
          <div key={key}>
            <Form.Text>{key}</Form.Text>
            <InputGroup key={key}>
              <Form.Control
                key={key}
                type={property.type === 'integer' ? 'number' : 'text'}
                value={msgData[parentKey]?.[key] || ''}
                onChange={(e) => handleInputChange(e, parentKey, key, property.type)}
              ></Form.Control>
            </InputGroup>
          </div>
        );
      } else if (property.type === 'array') {
        return (
          <div key={key}>
            <Form.Text>Array</Form.Text>
          </div>
        );
      } else if (property.type === 'boolean') {
        return (
          <div key="inline-radio" className="mt-2">
            <Form.Check
              inline
              name="group1"
              type="radio"
              id="inj-radio-bool-true"
              label={'true'}
              onChange={(e) => {
                handleInputChange(e, parentKey, key, property.type);
              }}
            />
            <Form.Check
              inline
              name="group1"
              type="radio"
              id="inj-radio-bool-true"
              label={'false'}
              onChange={(e) => {
                handleInputChange(e, parentKey, key, property.type);
              }}
            />
          </div>
        );
      }
    });
  };

  const handleSchemaSelection = (e: { target: { value: any } }) => {
    setSelectedSchemaIndex(Number(e.target.value));
  };

  return (
    <div>
      <Form.Group className="mb-2">
        <Form.Text className="mb-2">{schema.title}</Form.Text>
        <Form.Control className="custom-select" as="select" onChange={handleSchemaSelection}>
          {schema.oneOf
            ? schema.oneOf.map((option: any, index: any) => (
                <option key={index} value={index}>
                  {Object.keys(option.properties || {}).join(', ')}
                </option>
              ))
            : null}
        </Form.Control>
        {schema.oneOf
          ? renderFormFields(schema.oneOf[selectedSchemaIndex].properties, '', schema.definitions)
          : null}
      </Form.Group>
      {children}
    </div>
  );
};

export default DynamicForm;
