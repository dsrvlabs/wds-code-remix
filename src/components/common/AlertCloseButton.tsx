import { HTMLAttributes } from 'react';

import { IoMdClose } from 'react-icons/io';

interface AlertCloseButtonProps extends HTMLAttributes<HTMLButtonElement> {
  className?: string;
  onClick: () => void;
  [key: string]: any;
}
function AlertCloseButton({ onClick, ...props }: AlertCloseButtonProps) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        color: 'inherit',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        font: 'inherit',
        outline: 'inherit',
      }}
      {...props}
    >
      <IoMdClose
        style={{
          width: '18px',
          height: '18px',
        }}
      />
    </button>
  );
}

export default AlertCloseButton;
