import React, { useState, useEffect } from 'react';
import './Modal.css';
import FinancingPlanModal from './FinancingPlanModal';

const ContractEditModal = ({ isOpen, onClose, contract, contractType, onUpdate, currentUser }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fundingSources, setFundingSources] = useState([]);
  const [financingPlanOpen, setFinancingPlanOpen] = useState(false);

  // Загрузка данных договора при открытии
  useEffect(() => {
    if (isOpen && contract) {
      const baseData = {
        id: contract.id,
        contract_number: contract.contract,
        client: contract.client
      };

      if (contractType === 'income') {
        Object.assign(baseData, {
          contract_date: contract.date,
          contract_amount: parseFormattedAmount(contract.amount),
          paid_amount: parseFormattedAmount(contract.paid)
        });
      } else {
        Object.assign(baseData, {
          start_date: contract.start_date,
          end_date: contract.end_date,
          name: contract.name,
          contract_amount: parseFormattedAmount(contract.contract_amount),
          advance_percentage: contract.advance ? parseFloat(contract.advance.replace('%', '')) : 0,
          type_contract: contract.type_contract
        });
      }

      setFormData(baseData);
      fetchContractDetails();
      if (contractType === 'expense') {
        fetchFundingSources();
      }
    }
  }, [isOpen, contract, contractType]);

  const parseFormattedAmount = (formattedAmount) => {
    if (!formattedAmount || formattedAmount === '0 ₽') return 0;
    try {
      const numericString = formattedAmount
        .replace(/[^\d,.]/g, '')
        .replace(',', '.');
      return parseFloat(numericString) || 0;
    } catch (error) {
      return 0;
    }
  };

  const fetchContractDetails = async () => {
    try {
      let endpoint = '';
      if (contractType === 'income') {
        endpoint = `/api/income-contracts/${contract.id}`;
      } else {
        endpoint = `/api/expense-contracts/${contract.id}`;
      }

      const response = await fetch(endpoint);
      if (response.ok) {
        const contractData = await response.json();

        if (contractType === 'expense' && contractData.income_contract_id) {
          contractData.income_contract_id = parseInt(contractData.income_contract_id);
        }

        setFormData(prevData => ({
          ...prevData,
          ...contractData
        }));
      }
    } catch (err) {
      console.error('Ошибка при загрузке данных договора:', err);
    }
  };

  const fetchFundingSources = async () => {
    try {
      const response = await fetch('/api/income-contracts/options');
      const data = await response.json();
      if (response.ok) {
        setFundingSources(data);
      }
    } catch (err) {
      console.error('Ошибка при загрузке источников финансирования:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let endpoint = '';
      let requestBody = {};

      if (contractType === 'income') {
        endpoint = `/api/income-contracts/${contract.id}`;
        requestBody = {
          contract_number: formData.contract_number,
          contract_date: formData.contract_date,
          client: formData.client,
          contract_amount: parseFloat(formData.contract_amount),
          paid_amount: parseFloat(formData.paid_amount || 0)
        };
      } else {
        endpoint = `/api/expense-contracts/${contract.id}`;
        requestBody = {
          contract_number: formData.contract_number,
          start_date: formData.start_date,
          end_date: formData.end_date,
          name: formData.name,
          client: formData.client,
          contract_amount: parseFloat(formData.contract_amount),
          advance_percentage: parseFloat(formData.advance_percentage || 0),
          type_contract: formData.type_contract,
          income_contract_id: parseInt(formData.income_contract_id)
        };
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const result = await response.json();
        onUpdate(); // Обновляем данные в таблице
        onClose(); // Закрываем модальное окно ← ДОБАВЛЕНО ЗДЕСЬ
      } else {
        const result = await response.json();
        setError(result.error || 'Ошибка при обновлении договора');
      }
    } catch (err) {
      setError('Ошибка сети при обновлении договора');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Вы уверены, что хотите удалить этот договор?')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      let endpoint = '';
      if (contractType === 'income') {
        endpoint = `/api/income-contracts/${contract.id}`;
      } else {
        endpoint = `/api/expense-contracts/${contract.id}`;
      }

      const response = await fetch(endpoint, {
        method: 'DELETE',
      });

      if (response.ok) {
        onUpdate(); // Обновляем данные в таблице
        onClose(); // Закрываем модальное окно ← ДОБАВЛЕНО ЗДЕСЬ
      } else {
        const result = await response.json();
        setError(result.error || 'Ошибка при удалении договора');
      }
    } catch (err) {
      setError('Ошибка сети при удалении договора');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (!isOpen) return null;

  const isIncome = contractType === 'income';

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content wide-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Редактирование договора {contract?.contract}</h2>
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
                value={formData.contract_number || ''}
                onChange={handleChange}
                required
              />
            </div>

            {isIncome ? (
              <>
                <div className="form-group">
                  <label htmlFor="contract_date">Дата заключения *</label>
                  <input
                    type="date"
                    id="contract_date"
                    name="contract_date"
                    value={formData.contract_date || ''}
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
                    value={formData.client || ''}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="contract_amount">Стоимость договора *</label>
                    <input
                      type="number"
                      id="contract_amount"
                      name="contract_amount"
                      value={formData.contract_amount || ''}
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
                      value={formData.paid_amount || ''}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="start_date">Дата заключения *</label>
                    <input
                      type="date"
                      id="start_date"
                      name="start_date"
                      value={formData.start_date || ''}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="end_date">Дата окончания *</label>
                    <input
                      type="date"
                      id="end_date"
                      name="end_date"
                      value={formData.end_date || ''}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="name">Наименование *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name || ''}
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
                    value={formData.client || ''}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="contract_amount">Стоимость договора *</label>
                    <input
                      type="number"
                      id="contract_amount"
                      name="contract_amount"
                      value={formData.contract_amount || ''}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="advance_percentage">Аванс (%)</label>
                    <input
                      type="number"
                      id="advance_percentage"
                      name="advance_percentage"
                      value={formData.advance_percentage || ''}
                      onChange={handleChange}
                      step="0.01"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="type_contract">Тип деятельности *</label>
                    <select
                      id="type_contract"
                      name="type_contract"
                      value={formData.type_contract || ''}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Выберите тип деятельности</option>
                      <option value="ремонтная программа">Ремонтная программа</option>
                      <option value="инвестиционная программа">Инвестиционная программа</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="income_contract_id">Источник финансирования *</label>
                    <select
                      id="income_contract_id"
                      name="income_contract_id"
                      value={formData.income_contract_id || ''}
                      onChange={handleChange}
                      required
                    >
                      <option value="">Выберите источник финансирования</option>
                      {fundingSources.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Кнопка План финансирования - выровнена по центру */}
                <div className="form-group" style={{ textAlign: 'center', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setFinancingPlanOpen(true)}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      padding: '12px 30px',
                      fontSize: '16px',
                      minWidth: '200px'
                    }}
                  >
                    📊 План финансирования
                  </button>
                </div>
              </>
            )}

            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={loading}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Удаление...' : 'Удалить'}
              </button>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Модальное окно плана финансирования */}
      {!isIncome && (
        <FinancingPlanModal
          isOpen={financingPlanOpen}
          onClose={() => setFinancingPlanOpen(false)}
          contract={contract}
          contractData={formData}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
};

export default ContractEditModal;