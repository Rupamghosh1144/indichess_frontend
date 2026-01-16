import React, { useState } from 'react';
import "../component-styles/PromotionModal.css";

const PromotionModal = ({ showModal, onClose, onSelect }) => {
  // Handle selecting a promotion piece
  const handleSelect = (piece) => {
    onSelect(piece);  // Call the onSelect callback with the selected piece
    onClose();  // Close the modal
  };

  if (!showModal) return null;  // Don't render the modal if showModal is false

  return (
    <div className="promotion-modal-overlay">
      <div className="promotion-modal">
        <h2>Choose your promotion piece</h2>
        <div className="promotion-options">
          <div className="promotion-option" onClick={() => handleSelect('Q')}>
            <span className="icon">♕</span> {/* Queen Icon */}
            <p>Queen</p>
          </div>
          <div className="promotion-option" onClick={() => handleSelect('N')}>
            <span className="icon">♘</span> {/* Knight Icon */}
            <p>Knight</p>
          </div>
          <div className="promotion-option" onClick={() => handleSelect('R')}>
            <span className="icon">♖</span> {/* Rook Icon */}
            <p>Rook</p>
          </div>
          <div className="promotion-option" onClick={() => handleSelect('B')}>
            <span className="icon">♗</span> {/* Bishop Icon */}
            <p>Bishop</p>
          </div>
        </div>
        <button className="close-modal" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default PromotionModal;
