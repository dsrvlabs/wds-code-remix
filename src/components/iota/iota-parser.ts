import { log } from '../../utils/logger';
import {
  SuiMoveAbilitySet as IotaMoveAbilitySet,
  SuiMoveNormalizedType as IotaMoveNormalizedType,
} from '@mysten/sui/client';

export type IotaTypeParameter = {
  abilities: string[];
};

export function iotaTypeParameterName(idx: number, typeParameter: IotaTypeParameter) {
  return `T${idx}: ${typeParameter.abilities.join(' + ')}`;
}

export function isHexadecimal(str: string) {
  const reg = /^[a-fA-F0-9]+$/;
  return reg.test(str) && str.length % 2 === 0;
}

export function iotaTypeName(
  parameterType: IotaMoveNormalizedType,
  typeParameters?: IotaMoveAbilitySet[],
): string {
  log.info(`parameterType`, JSON.stringify(parameterType, null, 2));
  if (typeof parameterType === 'string') {
    return parameterType;
  }

  if (typeof parameterType === 'number') {
    return parameterType;
  }
  const t: any = parameterType;

  if (t.Struct) {
    let typeArgsStr = '';
    if (t.Struct.typeArguments.length > 0) {
      const typeArgs = t.Struct.typeArguments.map((targ: any) => {
        if (typeof targ.TypeParameter === 'number') {
          return `T${targ.TypeParameter}: ${typeParameters?.[targ.TypeParameter].abilities.join(
            ' + ',
          )}`;
        }

        return iotaTypeName(targ, typeParameters);
      });
      typeArgsStr = `<${typeArgs.join(', ')}>`;
    }

    let b = `${t.Struct.address}::${t.Struct.module}::${t.Struct.name}`;
    if (typeArgsStr) {
      b = b + typeArgsStr;
    }
    return b;
  }

  if (t.Reference) {
    let typeArgsStr = '';
    if (t.Reference.Struct.typeArguments.length > 0) {
      const typeArgs = t.Reference.Struct.typeArguments.map((targ: any) => {
        if (typeof targ.TypeParameter === 'number') {
          return `T${targ.TypeParameter}: ${typeParameters?.[targ.TypeParameter].abilities.join(
            ' + ',
          )}`;
        }
        return iotaTypeName(targ, typeParameters);
      });
      typeArgsStr = `<${typeArgs.join(', ')}>`;
    }
    let b = `${t.Reference.Struct.address}::${t.Reference.Struct.module}::${t.Reference.Struct.name}`;
    if (typeArgsStr) {
      b = b + typeArgsStr;
    }
    return b;
  }

  if (t.MutableReference) {
    let typeArgsStr = '';
    if (t.MutableReference.Struct.typeArguments.length > 0) {
      const typeArgs = t.MutableReference.Struct.typeArguments.map((targ: any) => {
        if (typeof targ.TypeParameter === 'number') {
          return `T${targ.TypeParameter}: ${typeParameters?.[targ.TypeParameter].abilities.join(
            ' + ',
          )}`;
        }
        return iotaTypeName(targ, typeParameters);
      });
      typeArgsStr = `<${typeArgs.join(', ')}>`;
    }
    let b = `${t.MutableReference.Struct.address}::${t.MutableReference.Struct.module}::${t.MutableReference.Struct.name}`;
    if (typeArgsStr) {
      b = b + typeArgsStr;
    }
    return b;
  }

  if (t.Vector) {
    return stringifyIotaVectorType(t);
  }

  throw new Error(`iotaTypeName Invalid type ${JSON.stringify(parameterType, null, 2)}`);
}

export function stringifyIotaVectorType(t: any, typeParameters?: IotaMoveAbilitySet[]): string {
  if (!t.Vector) {
    throw new Error(`stringifyIotaVectorType ${JSON.stringify(t, null, 2)}`);
  }

  let curVal = t;
  let cnt = 0;
  while (curVal) {
    cnt++;

    if (curVal.Struct) {
      break;
    }

    if (typeof curVal.Vector === 'string' || curVal === undefined) {
      curVal = curVal.Vector;
      break;
    }
    curVal = curVal.Vector;
  }

  const vectorCnt = typeof curVal === 'string' ? cnt : cnt - 1;
  let prefix = '';
  for (let i = 0; i < vectorCnt; i++) {
    prefix += 'Vector<';
  }

  const elTypeStr = iotaTypeName(curVal, typeParameters);

  let postfix = '';
  for (let i = 0; i < vectorCnt; i++) {
    postfix += '>';
  }

  return prefix + elTypeStr + postfix;
}

export function stringifyIotaVectorElementType(
  t: any,
  typeParameters?: IotaMoveAbilitySet[],
): string {
  let curVal = t;
  let cnt = 0;
  while (curVal) {
    cnt++;

    if (curVal.Struct) {
      break;
    }

    if (typeof curVal.Vector === 'string' || curVal === undefined) {
      curVal = curVal.Vector;
      break;
    }
    curVal = curVal.Vector;
  }

  return iotaTypeName(curVal, typeParameters);
}
