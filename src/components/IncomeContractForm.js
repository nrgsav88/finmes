import React, { useState } from 'react';
import './Modal.css';

const IncomeContractForm = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    contract_number: '',
    contract_date: '',
    client: '',
    contract_amount: '',
    paid_amount: '0'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/income-contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        onSubmit(result.contract);
        // Сброс формы
        setFormData({
          contract_number: '',
          contract_date: '',
          client: '',
          contract_amount: '',
          paid_amount: '0'
        });
        onClose(); // Закрываем модальное окно
      } else {
        setError(result.error || 'Ошибка при создании договора');
      }
    } catch (err) {
      setError('Ошибка сети при создании договора');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создание доходного договора</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="contract_number">Номер договора *</label>
            <input
              type="text"
              id="contract_number"
              name="contract_number"
              value={formData.contract_number}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="contract_date">Дата заключения *</label>
            <input
              type="date"
              id="contract_date"
              name="contract_date"
              value={formData.contract_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="client">Контрагент *</label>
            <input
              type="text"
              id="client"
              name="client"
              value={formData.client}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="contract_amount">Стоимость договора *</label>
            <input
              type="number"
              id="contract_amount"
              name="contract_amount"
              value={formData.contract_amount}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="paid_amount">Оплачено</label>
            <input
              type="number"
              id="paid_amount"
              name="paid_amount"
              value={formData.paid_amount}
              onChange={handleChange}
              min="0"
            />
          </div>

          <div className="modal-footer">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Создание...' : 'Создать договор'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default IncomeContractForm;