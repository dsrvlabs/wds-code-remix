// import { Placement } from 'react-bootstrap/esm/Overlay';
declare type AutoPlacement = 'auto' | 'auto-start' | 'auto-end';
declare type VariationPlacement =
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end'
  | 'right-start'
  | 'right-end'
  | 'left-start'
  | 'left-end';
declare const top: 'top';
declare const bottom: 'bottom';
declare const right: 'right';
declare const left: 'left';
declare type BasePlacement = typeof top | typeof bottom | typeof right | typeof left;
export declare type Placement = AutoPlacement | BasePlacement | VariationPlacement;

import { OverlayDelay, OverlayTriggerRenderProps } from 'react-bootstrap/esm/OverlayTrigger';
import React from 'react';

export type CustomTooltipType = {
  children:
    | React.ReactElement<any, string | React.JSXElementConstructor<any>>
    | ((props: OverlayTriggerRenderProps) => React.ReactNode);
  placement?: Placement;
  tooltipId?: string;
  tooltipClasses?: string;
  tooltipText: string | JSX.Element;
  tooltipTextClasses?: string;
  delay?: OverlayDelay;
};
