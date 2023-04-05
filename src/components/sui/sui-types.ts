import { SuiMoveModuleId } from '@mysten/sui.js/src/types/normalized';
import { SuiMoveNormalizedFunction, SuiMoveNormalizedStruct } from '@mysten/sui.js';

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
