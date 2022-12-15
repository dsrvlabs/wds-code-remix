import React, { Dispatch } from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

interface InterfaceProps {
  setCheck: Dispatch<React.SetStateAction<boolean>>;
  dsrvProceed: Function;
}

export const ConfirmModal: React.FunctionComponent<InterfaceProps> = ({
  setCheck,
  dsrvProceed,
}) => {
  return (
    <Modal.Dialog size="sm">
      <Modal.Header>
        <Modal.Title id="example-modal-sizes-title-sm">INFO</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>This account already has a deployed contract. Do you want to proceed?</p>
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setCheck(false);
          }}
        >
          NO
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={async () => {
            setCheck(false);
            await dsrvProceed();
          }}
        >
          YES
        </Button>
      </Modal.Footer>
    </Modal.Dialog>
  );
};

export default ConfirmModal;
