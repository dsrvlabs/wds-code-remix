import { SuiMoveModuleId } from '@mysten/sui/client';
import { SuiMoveNormalizedFunction, SuiMoveNormalizedStruct } from '@mysten/sui/client';

export type SuiFunc = SuiMoveNormalizedFunction & { name: string };
export type SuiStruct = SuiMoveNormalizedStruct & { name: string };

export interface SuiModule {
  fileFormatVersion: number;
  address: string;
  name: string;
  friends: SuiMoveModuleId[];
  exposedFunctions: SuiFunc[];
  structs: SuiStruct[];
}
