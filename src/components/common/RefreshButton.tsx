import React from 'react';

import { IoMdRefresh } from 'react-icons/io';

interface RefreshButtonProps {
  handleRefresh: () => void;
}

function RefreshButton({ handleRefresh }: RefreshButtonProps) {
  return (
    <button
      onClick={handleRefresh}
      style={{
        background: 'none',
        color: 'inherit',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        font: 'inherit',
        outline: 'inherit',
      }}
    >
      <IoMdRefresh
        style={{
          width: '18px',
          height: '18px',
        }}
      />
    </button>
  );
}

export default RefreshButton;
