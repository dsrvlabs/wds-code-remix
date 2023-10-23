import React, { useEffect } from 'react';
import { Form } from 'react-bootstrap';

import { Types } from 'aptos';
import { ArgTypeValuePair, getVectorArgTypeStr } from './aptos-helper';
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
  useEffect(() => {
    const parameterBoxes = document.getElementsByClassName('aptos-parameter');
    for (let i = 0; i < parameterBoxes.length; i++) {
      (parameterBoxes[i] as any).value = '';
    }
  }, [func]);
  const singerRemovedParams = func.params.filter((para, i) => {
    return !(i === 0 && (para === 'signer' || para === '&signer'));
  });

  const updateParam = (value: any, idx: number, parameterType: string) => {
    console.log(`@@@ updateParam`, value, idx, parameterType);
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
        if (parameterType.startsWith('vector') && parameterType !== 'vector<u8>') {
          return (
            <VectorArgForm
              func={func}
              typeName={parameterType}
              vectorElType={getVectorArgTypeStr(parameterType)}
              updateParam={updateParam}
              parentIdx={idx}
            />
          );
        }
        return (
          <Form.Control
            className={'aptos-parameter'}
            style={{ width: '100%', marginBottom: '5px' }}
            type="text"
            placeholder={aptosParameterPlaceHolder(parameterType)}
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

function aptosParameterPlaceHolder(parameterType: string) {
  if (parameterType === 'vector<u8>') {
    return `vector<u8> (ex. 616263)`;
  }

  if (parameterType === 'bool') {
    return `bool (true / false)`;
  }

  return parameterType;
}
