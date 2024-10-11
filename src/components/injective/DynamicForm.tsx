import { isObject } from '@rjsf/utils';
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
  const [selectedRefFieldIndex, setSelectedRefFieldIndex] = useState(0);

  useEffect(() => {
    if (schema.oneOf) {
      const selectedSchema = schema.oneOf[selectedSchemaIndex];
      const initialData = initializeFormData(selectedSchema.properties);
      setMsgData(initialData);
    }
  }, [selectedSchemaIndex, schema]);

  const resolveRef = (ref: string, definitions: { [key: string]: any }) => {
    const refKey = ref.replace('#/definitions/', '');
    return definitions[refKey];
  };

  const initializeFormData = (properties: { [key: string]: any }, parentKey?: string) => {
    const initialData: { [x: string]: any } = {};
    Object.keys(properties).forEach((key) => {
      const property = properties[key];

      if (property.type === 'object' && property.properties) {
        initialData[key] = initializeFormData(property.properties);
      } else if (property.type === 'string' || property === 'string') {
        initialData[key] = '';
      } else if (property.type === 'integer' || property === 'integer') {
        initialData[key] = 0;
      } else if (property.type === 'array') {
        initialData[key] = [];
      } else if (property.type === 'object' && !property.properties) {
        initialData[key] = {};
      } else if (property.$ref) {
        const refProperty = resolveRef(property.$ref, schema.definitions);
        initialData[key] = initializeFormData(refProperty);
      } else if (isObject(property) && !property.type) {
        // type 이 들어감
        Object.keys(property).forEach((key) => {
          const { type } = initializeFormData(property[key]);

          initialData[key] = type;
        });
      }
    });
    return initialData;
  };

  const updateSpecificNestedKey = (
    obj: any,
    parentKey: string | number,
    targetKey: string | number,
    newValue: any,
  ) => {
    const newData = JSON.parse(JSON.stringify(obj));
    function recurse(currentObj: { [x: string]: any }) {
      Object.keys(currentObj).forEach((key) => {
        if (typeof currentObj[key] === 'object' && currentObj[key] !== null) {
          if (key === parentKey && currentObj[key].hasOwnProperty(targetKey)) {
            currentObj[key][targetKey] = newValue;
          }
          recurse(currentObj[key]);
        }
      });
    }
    recurse(newData);
    return newData;
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
    } else if (!Object.keys(msgData).some((key) => key === parentKey)) {
      const updatedMsgData = updateSpecificNestedKey(msgData, parentKey, key, value);
      setMsgData(updatedMsgData);
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

  const handleRefFieldChange = (e: any) => {
    setSelectedRefFieldIndex(Number(e.target.value));
  };

  // TODO: Accept object itself not properties

  const renderFormFields: any = (
    schemaProperty: { [key: string]: any },
    parentKey: string,
    definitions?: { [key: string]: string },
  ) => {
    const msgProperties = schemaProperty.properties ? schemaProperty.properties : schemaProperty;
    return Object.keys(msgProperties).map((key) => {
      const property = msgProperties[key];
      const type: string = property.type ? property.type : property;
      if (type === 'object' && property.properties) {
        return <div key={key}>{renderFormFields(property, key, definitions)}</div>;
      } else if (property.type === 'object' && !property.properties) {
        // JSON Object property with no property inside
        return <div>No Object</div>;
      } else if (type === 'integer' || type === 'string') {
        return (
          <div key={key}>
            <Form.Text>{key}</Form.Text>
            <InputGroup key={key}>
              <Form.Control
                key={key}
                type={property.type === 'integer' ? 'number' : 'text'}
                //had to use uncotrolled form since this form doesn't have submit not really critical
                //but have to fix it
                // value={msgData[pathKeys[0]]?.[pathKeys[1] as any]?.[key as any] || ''}
                onChange={(e) => handleInputChange(e, parentKey, key, property.type)}
              ></Form.Control>
            </InputGroup>
          </div>
        );
      } else if (type === 'array') {
        return (
          <div key={key}>
            <Form.Text>Array</Form.Text>
          </div>
        );
      } else if (type === 'boolean') {
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
      } else if (property.$ref) {
        const refKey = property.$ref.replace('#/definitions/', '');
        const refProperty = resolveRef(property.$ref, definitions!);

        return (
          <div key={key}>
            <Form.Text style={{ fontSize: '1em' }}>{key === '0' ? null : key}</Form.Text>
            <Form.Text>{refKey}</Form.Text>
            {renderFormFields(refProperty, key, definitions)}
          </div>
        );
      } else if (property.anyOf) {
        return (
          <div key={key} className="mb-2">
            <Form.Text style={{ fontSize: '1em' }}>{key}</Form.Text>
            {renderFormFields(property.anyOf, key, definitions)}
          </div>
        );
      } else if (property.oneOf || key === 'oneOf') {
        const oneOfProperty = property.oneOf ? property.oneOf : property;
        return (
          <div>
            <Form.Control className="custom-select" as="select" onChange={handleRefFieldChange}>
              {oneOfProperty.map((option: any, index: any) => (
                <option key={index} value={index}>
                  {option.properties
                    ? Object.keys(option.properties || {}).join(', ')
                    : option.enum[0]}
                </option>
              ))}
            </Form.Control>
            {renderFormFields(oneOfProperty[selectedRefFieldIndex], key, definitions)}
          </div>
        );
      } else {
        return <></>;
      }
    });
  };

  const handleSchemaSelection = (e: any) => {
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
                  {Object.keys(option.properties || {})}
                </option>
              ))
            : null}
        </Form.Control>
        {schema.oneOf
          ? renderFormFields(schema.oneOf[selectedSchemaIndex], '', schema.definitions)
          : null}
      </Form.Group>
      <Button
        onClick={() => {
          console.log(msgData);
        }}
      >
        Test
      </Button>
      {children}
    </div>
  );
};

export default DynamicForm;
