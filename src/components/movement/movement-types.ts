import {
  SuiMoveModuleId,
  SuiMoveNormalizedFunction,
  SuiMoveNormalizedStruct,
} from '@mysten/sui/client';

export type MovementFunc = SuiMoveNormalizedFunction & { name: string };
export type MovementStruct = SuiMoveNormalizedStruct & { name: string };

export interface MovementModule {
  fileFormatVersion: number;
  address: string;
  name: string;
  friends: SuiMoveModuleId[];
  exposedFunctions: MovementFunc[];
  structs: MovementStruct[];
}
