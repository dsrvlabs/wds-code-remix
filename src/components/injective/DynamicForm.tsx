import React, { useState, useEffect, Dispatch } from 'react';
import { Button, FloatingLabel, InputGroup, Form } from 'react-bootstrap';

interface IDynamicFormProps {
  schema: { [key: string]: any };
  children?: React.ReactNode;
  msgData: { [key: string]: any };
  setMsgData: Dispatch<React.SetStateAction<{ [key: string]: any }>>;
}

const DynamicForm = ({ schema, children, msgData, setMsgData }: IDynamicFormProps) => {
  const [selectedSchemaIndex, setSelectedSchemaIndex] = useState(0);

  useEffect(() => {
    if (schema.oneOf) {
      const selectedSchema = schema.oneOf[selectedSchemaIndex];
      const initialData = initializeFormData(selectedSchema.properties);
      setMsgData(initialData);
    }
  }, [selectedSchemaIndex, schema]);

  const initializeFormData = (properties: { [x: string]: any }) => {
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
  ) => {
    const { value } = e.target;
    setMsgData((prevData) => ({
      ...prevData,
      [parentKey]: {
        ...prevData[parentKey],
        [key]: value,
      },
    }));
  };

  const renderFormFields = (properties: { [x: string]: any }, parentKey: string) => {
    return Object.keys(properties).map((key) => {
      const property = properties[key];
      if (property.type === 'object' && property.properties) {
        return <div key={key}>{renderFormFields(property.properties, key)}</div>;
      } else if (property.type === 'object' && !property.properties) {
        // return <div key={key}>{`${Object.keys(properties)}`}</div>;
        return null;
      } // Need more condition for more types

      return (
        <div key={key}>
          <Form.Text>{key}</Form.Text>
          <InputGroup key={key}>
            <Form.Control
              key={key}
              type={property.type === 'integer' ? 'number' : 'text'}
              value={msgData[parentKey]?.[key] || ''}
              onChange={(e) => handleInputChange(e, parentKey, key)}
            ></Form.Control>
          </InputGroup>
        </div>
      );
    });
  };

  const handleSchemaSelection = (e: { target: { value: any } }) => {
    setSelectedSchemaIndex(Number(e.target.value));
  };

  return (
    <div>
      <Form.Group className="mb-2">
        <Form.Control className="custom-select" as="select" onChange={handleSchemaSelection}>
          {schema.oneOf
            ? schema.oneOf.map((option: any, index: any) => (
                <option key={index} value={index}>
                  {Object.keys(option.properties || {}).join(', ')}
                </option>
              ))
            : null}
        </Form.Control>
        {schema.oneOf ? renderFormFields(schema.oneOf[selectedSchemaIndex].properties, '') : null}
      </Form.Group>
      {children}
    </div>
  );
};

export default DynamicForm;
