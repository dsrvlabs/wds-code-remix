import { Annotation, HighlightPosition } from '@remixproject/plugin-api';
export interface PositionDetails {
  file: string;
  annotation: Annotation;
  highlightPosition: HighlightPosition;
  positionDetail: Record<string, number | number>;
}
