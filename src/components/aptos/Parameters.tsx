import React from 'react';
import { Form } from 'react-bootstrap';
import { log } from '../../utils/logger';

import { Types } from 'aptos';
import { ArgTypeValuePair } from './aptos-helper';
import VectorArgForm from './VectorArgForm';

interface InterfaceProps {
  func: Types.MoveFunction;
  setGenericParameters: Function;
  setParameters: Function;
}

export const Parameters: React.FunctionComponent<InterfaceProps> = ({
  func,
  setGenericParameters,
  setParameters,
}) => {
  const singerRemovedParams = func.params.filter((para, i) => {
    return !(i === 0 && (para === 'signer' || para === '&signer'));
  });

  const updateParam = (value: any, idx: number, parameterType: string) => {
    setParameters((existingParams: ArgTypeValuePair[]) => {
      existingParams[idx] = {
        type: parameterType,
        val: value,
      };
      console.log('existingParams', existingParams);
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
        <div>{func.generic_type_params.length > 0 ? <small>Type Parameters</small> : <></>}</div>
        {func.generic_type_params.map((param: any, idx: number) => {
          return (
            <Form.Control
              style={{ width: '100%', marginBottom: '5px' }}
              type="text"
              placeholder={`Type Arg ${idx + 1}`}
              size="sm"
              onChange={(e) => {
                updateGenericParam(e, idx);
              }}
              key={idx}
            />
          );
        })}
      </div>
      <div>{func.params.length > 0 ? <small>Parameters</small> : <></>}</div>
      {singerRemovedParams.map((parameterType: string, idx: number) => {
        log.debug(`idx=${idx}, parameterType=${parameterType}`);
        // if (parameterType.startsWith('vector')) {
        //   return (
        //     <VectorArgForm typeName={parameterType} vectorElType={'u8'} updateParam={updateParam} />
        //   );
        // }
        return (
          <Form.Control
            style={{ width: '100%', marginBottom: '5px' }}
            type="text"
            placeholder={parameterType}
            size="sm"
            onChange={(e) => {
              updateParam(e.target.value, idx, parameterType);
            }}
          />
        );
      })}
    </div>
  );
};
