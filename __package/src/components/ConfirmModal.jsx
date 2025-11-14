import React from "react";

const ConfirmModal = ({
  open,
  title = "Confirm Changes",
  message = "Are you sure you want to apply these changes?",
  confirmLabel = "Okay",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="confirmModalOverlay">
      <div className="confirmModalContent">
        <div className="confirmModalHeader">
          <h3>{title}</h3>
        </div>

        <div className="confirmModalBody">
          <p>{message}</p>
        </div>
        <div className="confirmModalActions">
          <button className="confirmBtn" onClick={onConfirm}>
            ✓ <span>{confirmLabel}</span>
          </button>
          <button className="cancelBtn" onClick={onCancel}>
            ✕ <span>{cancelLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
