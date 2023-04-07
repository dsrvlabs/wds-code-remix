import React, { useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { SuiFunc } from './sui-types';
import { SuiMoveNormalizedType } from '@mysten/sui.js/dist/types/normalized';
import { log } from '../../utils/logger';
import { txCtxRemovedParameters } from './sui-helper';
import { parseSuiVectorInnerType, parseSuiVectorType } from './sui-parser';
import VectorArgForm from '../sui/VectorArgForm';

interface InterfaceProps {
  func: SuiFunc;
  setParameters: Function;
}

export const Parameters: React.FunctionComponent<InterfaceProps> = ({ func, setParameters }) => {
  log.info('parameters', JSON.stringify(func.parameters, null, 2));
  useEffect(() => {
    const parameterBoxes = document.getElementsByClassName('sui-parameter');
    for (let i = 0; i < parameterBoxes.length; i++) {
      (parameterBoxes[i] as any).value = '';
    }
  }, [func]);

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
      return parseSuiVectorType(t);
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <div>{func.parameters.length > 0 ? <small>Parameters</small> : <></>}</div>
      {txCtxRemovedParameters(func.parameters).map(
        (parameterType: SuiMoveNormalizedType, idx: number) => {
          if (typeof parameterType !== 'string' && (parameterType as any).Vector) {
            return (
              <VectorArgForm
                func={func}
                typeName={parseSuiVectorType(parameterType)}
                vectorElType={parseSuiVectorInnerType(parameterType)}
                updateParam={updateParam}
                parentIdx={idx}
              />
            );
          }
          return (
            <Form.Control
              className={`sui-parameter`}
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
        },
      )}
    </div>
  );
};
