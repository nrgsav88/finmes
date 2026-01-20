import React from 'react';
import './Modal.css';

const ContractTypeModal = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Выберите тип договора</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="contract-type-buttons">
            <button
              className="contract-type-btn income-btn"
              onClick={() => onSelect('income')}
            >
              <div className="contract-type-icon">💰</div>
              <div className="contract-type-info">
                <h2>Доходный договор</h2>
                <p>Договор по технологическому присоединению или НВВ</p>
              </div>
            </button>

            <button
              className="contract-type-btn expense-btn"
              onClick={() => onSelect('expense')}
            >
              <div className="contract-type-icon">💸</div>
              <div className="contract-type-info">
                <h2>Расходный договор</h2>
                <p>Договор на выполнение работ по рем. или инвест. программе</p>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ContractTypeModal;