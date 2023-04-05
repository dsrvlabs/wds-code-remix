import React from 'react';
import { Form } from 'react-bootstrap';
import { SuiFunc } from './sui-types';
import { SuiMoveNormalizedType } from '@mysten/sui.js/dist/types/normalized';
import { log } from '../../utils/logger';
import {txCtxRemovedParameters} from "./sui-helper";

interface InterfaceProps {
  func: SuiFunc;
  setParameters: Function;
}

export const Parameters: React.FunctionComponent<InterfaceProps> = ({ func, setParameters }) => {
  const updateParam = (value: any, idx: number, parameterType: SuiMoveNormalizedType) => {
    console.log(`@@@ updateParam`, value, idx, parameterType);
    setParameters((existingParams: string[]) => {
      existingParams[idx] = value;
      console.log('existingParams', existingParams);
      return existingParams;
    });
  };

  function typeName(parameterType: SuiMoveNormalizedType) {
    log.info(`parameterType`, parameterType);
    if (typeof parameterType === 'string') {
      return parameterType;
    }

    if (typeof parameterType === 'number') {
      return parameterType;
    }
    const t: any = parameterType;

    if (t.Struct) {
      return `${t.Struct.address}::${t.Struct.module}::${t.Struct.name}`;
    }

    if (t.Reference) {
      return `${t.Reference.Struct.address}::${t.Reference.Struct.module}::${t.Reference.Struct.name}`;
    }

    if (t.MutableReference) {
      return `${t.MutableReference.Struct.address}::${t.MutableReference.Struct.module}::${t.MutableReference.Struct.name}`;
    }

    if (t.Vector) {
      return `${t.Vector.Struct.address}::${t.Vector.Struct.module}::${t.Vector.Struct.name}`;
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <div>{func.parameters.length > 0 ? <small>Parameters</small> : <></>}</div>
      {txCtxRemovedParameters(func.parameters).map((parameterType: SuiMoveNormalizedType, idx: number) => {
          return (
            <Form.Control
              style={{ width: '100%', marginBottom: '5px' }}
              type="text"
              placeholder={typeName(parameterType)}
              size="sm"
              key={`sui-parameterType-${idx}`}
              onChange={(e) => {
                updateParam(e.target.value, idx, parameterType);
              }}
            />
          );
        })}
    </div>
  );
};
