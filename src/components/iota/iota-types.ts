import { SuiMoveModuleId } from '@mysten/sui/client';
import { SuiMoveNormalizedFunction, SuiMoveNormalizedStruct } from '@mysten/sui/client';

export type IotaFunc = SuiMoveNormalizedFunction & { name: string };
export type IotaStruct = SuiMoveNormalizedStruct & { name: string };

export interface IotaModule {
  fileFormatVersion: number;
  address: string;
  name: string;
  friends: SuiMoveModuleId[];
  exposedFunctions: IotaFunc[];
  structs: IotaStruct[];
}
