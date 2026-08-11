import { FunctionComponent, ReactNode } from 'react';

interface InterfaceProps {
  children: ReactNode;
}

/** A labelled rule that separates the panel into stages. */
export const SectionTitle: FunctionComponent<InterfaceProps> = ({ children }) => (
  <div className="wds-section">{children}</div>
);
