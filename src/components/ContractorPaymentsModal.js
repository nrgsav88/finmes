import React, { useState, useEffect, useCallback } from 'react';
import './Modal.css';

const ContractorPaymentsModal = ({ isOpen, onClose, contract, currentUser, onDataUpdate }) => {
  const [payments, setPayments] = useState([]);
  const [newPayment, setNewPayment] = useState({
    date: '',
    kontragent: '',
    category: '',
    purpose: '',
    amount: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Категории для выпадающего списка
  const categories = [
    'Проектные работы',
    'Общестроительные работы',
    'Электромонтажные работы',
    'Пуско-наладочные работы',
    'Оборудование',
    'Материалы',
    'Инструменты и принадлежности'
  ];

  // Проверка прав доступа
  const canEditPayments = useCallback(() => {
    if (!currentUser) return false;

    const allowedRoles = ['Экономика', 'Администратор системы'];
    const isAllowedRole = allowedRoles.includes(currentUser.role) || currentUser.username === 'admin';

    // МЭС может редактировать только для договоров МЭС
    const isMES = currentUser.role === 'МЭС';
    const isMESContract = contract?.client === 'МЭС' || contract?.is_mes;

    return isAllowedRole || (isMES && isMESContract);
  }, [currentUser, contract]);

  // Загрузка платежей при открытии модального окна
  useEffect(() => {
    if (isOpen && contract) {
      fetchPayments();
    }
  }, [isOpen, contract]);

  const fetchPayments = async () => {
    try {
      const response = await fetch(`/api/expense-contracts/${contract.id}/cost-items`);
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      } else {
        setError('Ошибка при загрузке данных');
      }
    } catch (err) {
      setError('Ошибка сети при загрузке данных');
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!newPayment.date || !newPayment.kontragent || !newPayment.category || !newPayment.purpose || !newPayment.amount) {
      setError('Все поля обязательны для заполнения');
      return;
    }

    if (!canEditPayments()) {
      setError('Недостаточно прав для добавления платежей');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`/api/expense-contracts/${contract.id}/cost-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPayment),
      });

      const result = await response.json();

      if (response.ok) {
        // Сбрасываем форму
        setNewPayment({
          date: '',
          kontragent: '',
          category: '',
          purpose: '',
          amount: ''
        });

        // Добавляем новый платеж локально
        setPayments(prevPayments => [...prevPayments, result.cost_item]);

        // Обновляем основную таблицу
        if (onDataUpdate) {
          onDataUpdate();
        }
      } else {
        setError(result.error || 'Ошибка при добавлении платежа');
      }
    } catch (err) {
      setError('Ошибка сети при добавлении платежа');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот платеж?')) {
      return;
    }

    if (!canEditPayments()) {
      setError('Недостаточно прав для удаления платежей');
      return;
    }

    try {
      // Сразу удаляем из UI
      setPayments(prevPayments => prevPayments.filter(payment => payment.id !== paymentId));

      const response = await fetch(`/api/expense-contracts/${contract.id}/cost-items/${paymentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Если ошибка - возвращаем обратно
        const result = await response.json();
        setError(result.error || 'Ошибка при удалении платежа');
        // Перезагружаем данные
        fetchPayments();
      } else {
        // Обновляем основную таблицу
        if (onDataUpdate) {
          onDataUpdate();
        }
      }
    } catch (err) {
      setError('Ошибка сети при удалении платежа');
      // Перезагружаем данные при ошибке сети
      fetchPayments();
    }
  };

  const handleInputChange = (e) => {
    setNewPayment({
      ...newPayment,
      [e.target.name]: e.target.value
    });
  };

  const formatCurrency = useCallback((value) => {
    if (value === null || value === undefined) return '0 ₽';
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + ' ₽';
  }, []);

  const calculateTotal = useCallback(() => {
    return payments.reduce((total, payment) => total + (parseFloat(payment.amount) || 0), 0);
  }, [payments]);

  // Если модалка закрыта - не рендерим ничего
  if (!isOpen) return null;

  const hasEditPermissions = canEditPayments();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content extra-wide-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px', width: '95%' }}>
        <div className="modal-header">
          <h2>Платежи подрядчика - {contract?.contract}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          {/* Форма добавления нового платежа */}
          {hasEditPermissions && (
            <div className="works-form-section">
              <h3>Добавить новый платеж</h3>
              <form onSubmit={handleAddPayment} className="works-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="date">Дата *</label>
                    <input
                      type="date"
                      id="date"
                      name="date"
                      value={newPayment.date}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="kontragent">Контрагент *</label>
                    <input
                      type="text"
                      id="kontragent"
                      name="kontragent"
                      value={newPayment.kontragent}
                      onChange={handleInputChange}
                      placeholder="Наименование контрагента"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="category">Категория *</label>
                    <select
                      id="category"
                      name="category"
                      value={newPayment.category}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="">Выберите категорию</option>
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label htmlFor="purpose">Назначение платежа *</label>
                    <input
                      type="text"
                      id="purpose"
                      name="purpose"
                      value={newPayment.purpose}
                      onChange={handleInputChange}
                      placeholder="Назначение платежа"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="amount">Сумма *</label>
                    <input
                      type="number"
                      id="amount"
                      name="amount"
                      value={newPayment.amount}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                      style={{ marginTop: '25px' }}
                    >
                      {loading ? 'Добавление...' : 'Добавить платеж'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Список платежей */}
          <div className="works-list-section">
            <h3>Список платежей</h3>
            <div className="works-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '15%' }}>Дата</th>
                    <th style={{ width: '20%' }}>Контрагент</th>
                    <th style={{ width: '20%' }}>Категория</th>
                    <th style={{ width: '25%' }}>Назначение платежа</th>
                    <th style={{ width: '10%' }}>Сумма</th>
                    <th style={{ width: '10%', textAlign: 'center' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(payment => (
                    <tr key={payment.id}>
                      <td>{payment.date}</td>
                      <td>{payment.kontragent}</td>
                      <td>{payment.category}</td>
                      <td>{payment.purpose}</td>
                      <td>{formatCurrency(payment.amount)}</td>
                      <td style={{ textAlign: 'center' }}>
                        {hasEditPermissions && (
                          <button
                            onClick={() => handleDeletePayment(payment.id)}
                            className="btn-danger small-btn"
                            style={{
                              padding: '4px 8px',
                              fontSize: '12px',
                              display: 'inline-block',
                              margin: '0 auto'
                            }}
                          >
                            Удалить
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="total-row">
                    <td colSpan="4" className="total-label">ИТОГО:</td>
                    <td className="total-value">{formatCurrency(calculateTotal())}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>

              {payments.length === 0 && (
                <div className="empty-state">
                  <p>Нет добавленных платежей</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractorPaymentsModal;