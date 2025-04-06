import React, { useEffect } from 'react';
import { Form } from 'react-bootstrap';
import { MovementFunc } from './movement-types';
import { SuiMoveNormalizedType } from '@mysten/sui/client';
import { log } from '../../utils/logger';
import { txCtxRemovedParameters } from './movement-helper';
import {
  stringifySuiVectorElementType as stringifyMovementVectorElementType,
  stringifySuiVectorType as stringifyMovementVectorType,
  suiTypeName as movementTypeName,
  suiTypeParameterName as movementTypeParameterName,
} from '../sui/sui-parser';
import VectorArgForm from '../sui/VectorArgForm';

interface InterfaceProps {
  func: MovementFunc;
  setParameters: Function;
  setGenericParameters: Function;
}

export const Parameters: React.FunctionComponent<InterfaceProps> = ({
  func,
  setParameters,
  setGenericParameters,
}) => {
  log.info('func', JSON.stringify(func, null, 2));
  log.debug('parameters', JSON.stringify(func.parameters, null, 2));
  log.debug('typeParameters ', JSON.stringify(func.typeParameters, null, 2));
  useEffect(() => {
    const parameterBoxes = document.getElementsByClassName('movement-parameter');
    for (let i = 0; i < parameterBoxes.length; i++) {
      (parameterBoxes[i] as any).value = '';
    }
  }, [func]);

  const updateVecParam = (value: any, idx: number, parameterType: string) => {
    console.log(`@@@ updateParam`, value, idx, parameterType);
    setParameters((existingParams: string[]) => {
      existingParams[idx] = value;
      console.log('existingParams', existingParams);
      return existingParams;
    });
  };

  const counterBoolElementId = (id: string) => {
    if (id.includes('true')) {
      return id.replace('true', 'false');
    } else {
      return id.replace('false', 'true');
    }
  };

  const updateParam = (event: any, idx: number, parameterType: SuiMoveNormalizedType) => {
    setParameters((existingParams: string[]) => {
      if (parameterType === 'Bool') {
        const id = event.target.id;
        const el: any = document.getElementById(counterBoolElementId(id));
        el.checked = !el.checked;
        existingParams[idx] = el.checked;
        log.info('existingParams', existingParams);
        return existingParams;
      }

      existingParams[idx] = event.target.value;
      log.info('existingParams', existingParams);
      return existingParams;
    });
  };

  const updateGenericParam = (e: any, idx: any) => {
    setGenericParameters((existingGenericParams: string[]) => {
      existingGenericParams[idx] = e.target.value;
      return existingGenericParams;
    });
  };

  return (
    <div style={{ width: '100%' }}>
      <div>
        <div>{func.typeParameters.length > 0 ? <small>Type Parameters</small> : <></>}</div>
        {func.typeParameters.map((param: any, idx: number) => {
          return (
            <Form.Control
              className={`movement-parameter`}
              style={{ width: '100%', marginBottom: '5px' }}
              type="text"
              placeholder={`${movementTypeParameterName(idx, param)}`}
              size="sm"
              onChange={(e) => {
                updateGenericParam(e, idx);
              }}
              key={idx}
            />
          );
        })}
      </div>
      <div>{func.parameters.length > 0 ? <small>Parameters</small> : <></>}</div>
      {txCtxRemovedParameters(func.parameters).map(
        (parameterType: SuiMoveNormalizedType, idx: number) => {
          if (typeof parameterType !== 'string' && (parameterType as any).Vector) {
            return (
              <VectorArgForm
                func={func}
                typeName={stringifyMovementVectorType(parameterType)}
                vectorElType={stringifyMovementVectorElementType(parameterType)}
                updateParam={updateVecParam}
                parentIdx={idx}
              />
            );
          }
          if (movementTypeName(parameterType, func.typeParameters) === 'Bool') {
            return (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', height: '1em' }}>
                  <input
                    className={'movement-parameter'}
                    id={`movement-parameter-bool-true-${idx}`}
                    type="radio"
                    placeholder={movementTypeName(parameterType, func.typeParameters)}
                    defaultChecked={true}
                    onChange={(e) => {
                      updateParam(e, idx, parameterType);
                    }}
                  />
                  <div style={{ marginLeft: '0.5em', marginRight: '0.5em' }}>
                    <label>True</label>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    className={'movement-parameter'}
                    id={`movement-parameter-bool-false-${idx}`}
                    type="radio"
                    placeholder={movementTypeName(parameterType, func.typeParameters)}
                    onChange={(e) => {
                      updateParam(e, idx, parameterType);
                    }}
                  />
                  <div style={{ marginLeft: '0.5em', marginRight: '0.5em' }}>
                    <label>False</label>
                  </div>
                </div>
                <br></br>
              </div>
            );
          }

          return (
            <Form.Control
              className={`movement-parameter`}
              style={{ width: '100%', marginBottom: '5px' }}
              type="text"
              placeholder={movementTypeName(parameterType, func.typeParameters)}
              size="sm"
              key={`movement-parameterType-${idx}`}
              onChange={(e) => {
                updateParam(e, idx, parameterType);
              }}
            />
          );
        },
      )}
    </div>
  );
};
