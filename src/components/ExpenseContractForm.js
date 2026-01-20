import React, { useState, useEffect } from 'react';
import './Modal.css';

const ExpenseContractForm = ({ isOpen, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    contract_number: '',
    start_date: '',
    end_date: '',
    name: '',
    contract_amount: '',
    advance_percentage: '0',
    type_contract: '',
    funding_source: '',
    client_type: 'mes',
    client_name: '',
    is_mes: true
  });
  const [fundingSources, setFundingSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Загрузка источников финансирования при открытии формы
  useEffect(() => {
    if (isOpen) {
      fetchFundingSources();
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Формируем данные для отправки
      const submitData = {
        ...formData,
        client: formData.client_type === 'mes' ? 'МЭС' : formData.client_name,
        is_mes: formData.client_type === 'mes'
      };

      // Валидация: если выбран "Другой", но не введено название
      if (formData.client_type === 'other' && !formData.client_name.trim()) {
        setError('Введите наименование контрагента');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/expense-contracts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const result = await response.json();

      if (response.ok) {
        onSubmit(result.contract);
        // Сброс формы
        setFormData({
          contract_number: '',
          start_date: '',
          end_date: '',
          name: '',
          contract_amount: '',
          advance_percentage: '0',
          type_contract: '',
          funding_source: '',
          client_type: 'mes',
          client_name: '',
          is_mes: true
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
    const { name, value, type } = e.target;

    if (name === 'client_type') {
      setFormData({
        ...formData,
        [name]: value,
        is_mes: value === 'mes',
        client_name: value === 'mes' ? '' : formData.client_name
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  // Типы деятельности для type_contract
  const contractTypes = [
    { value: '', label: 'Выберите тип деятельности' },
    { value: 'ремонтная программа', label: 'Ремонтная программа' },
    { value: 'инвестиционная программа', label: 'Инвестиционная программа' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content wide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Создание расходного договора</h2>
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

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start_date">Дата заключения *</label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={formData.start_date}
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
                value={formData.end_date}
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
              value={formData.name}
              onChange={handleChange}
              placeholder="Краткое описание предмета договора"
              required
            />
          </div>

          {/* Выбор контрагента с радиокнопками в одну строку */}
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '15px', fontWeight: '600', color: '#4a5568' }}>
              Контрагент *
            </label>

            <div className="radio-group-horizontal">
              <label className={`radio-option-horizontal ${formData.client_type === 'mes' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="client_type"
                  value="mes"
                  checked={formData.client_type === 'mes'}
                  onChange={handleChange}
                  className="radio-input-hidden"
                />
                <div className="radio-content-horizontal">
                  <div className="radio-icon-horizontal">
                    {formData.client_type === 'mes' && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="radio-text-horizontal">
                    <div className="radio-title-horizontal">МЭС</div>
                    <div className="radio-description-horizontal">ООО МЭС</div>
                  </div>
                </div>
              </label>

              <label className={`radio-option-horizontal ${formData.client_type === 'other' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="client_type"
                  value="other"
                  checked={formData.client_type === 'other'}
                  onChange={handleChange}
                  className="radio-input-hidden"
                />
                <div className="radio-content-horizontal">
                  <div className="radio-icon-horizontal">
                    {formData.client_type === 'other' && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="radio-text-horizontal">
                    <div className="radio-title-horizontal">Другой контрагент</div>
                    <div className="radio-description-horizontal">Укажите вручную</div>
                  </div>
                </div>
              </label>
            </div>

            {formData.client_type === 'other' && (
              <div style={{ marginTop: '15px' }}>
                <input
                  type="text"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleChange}
                  placeholder="Введите полное наименование контрагента"
                  style={{ width: '100%' }}
                  required={formData.client_type === 'other'}
                />
                <small style={{ color: '#718096', fontSize: '12px', marginTop: '5px', display: 'block' }}>
                  Например: ООО "Строительная компания", ИП Иванов и т.д.
                </small>
              </div>
            )}
          </div>

          <div className="form-row">
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
              <label htmlFor="advance_percentage">Аванс (%)</label>
              <input
                type="number"
                id="advance_percentage"
                name="advance_percentage"
                value={formData.advance_percentage}
                onChange={handleChange}
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="type_contract">Тип деятельности *</label>
              <select
                id="type_contract"
                name="type_contract"
                value={formData.type_contract}
                onChange={handleChange}
                required
              >
                {contractTypes.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="funding_source">Источник финансирования *</label>
              <select
                id="funding_source"
                name="funding_source"
                value={formData.funding_source}
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

export default ExpenseContractForm;