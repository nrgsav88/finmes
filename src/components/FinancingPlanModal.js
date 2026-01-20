import React, { useState, useEffect, useCallback } from 'react';
import './Modal.css';

const FinancingPlanModal = ({ isOpen, onClose, contract, contractData, onUpdate }) => {
  const [planData, setPlanData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Генерация периодов (годы и месяцы)
  const generatePeriods = useCallback(() => {
    if (!contractData.start_date) return [];

    const startDate = new Date(contractData.start_date);
    const endDate = new Date(contractData.end_date);
    const periods = [];

    // Добавляем +3 года к дате окончания
    const maxDate = new Date(endDate);
    maxDate.setFullYear(maxDate.getFullYear() + 3);

    let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (currentDate <= maxDate) {
      periods.push({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        key: `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`,
        label: `${currentDate.toLocaleString('ru-RU', { month: 'long' })} ${currentDate.getFullYear()}`
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return periods;
  }, [contractData.start_date, contractData.end_date]);

  // Загрузка данных плана
  useEffect(() => {
    if (isOpen && contract) {
      fetchPlanData();
    }
  }, [isOpen, contract]);

  const fetchPlanData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/expense-contracts/${contract.id}/cal-plan`);
      if (response.ok) {
        const data = await response.json();

        // Преобразуем данные в удобный формат
        const periods = generatePeriods();
        const planMap = {};

        data.forEach(item => {
          const date = new Date(item.date);
          const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
          planMap[key] = parseFloat(item.plopl) || 0;
        });

        // Создаем полный набор данных
        const fullPlanData = periods.map(period => ({
          ...period,
          amount: planMap[period.key] || 0
        }));

        setPlanData(fullPlanData);
      } else {
        setError('Ошибка при загрузке данных плана');
      }
    } catch (err) {
      setError('Ошибка сети при загрузке данных плана');
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (key, value) => {
    const numericValue = parseFloat(value) || 0;
    setPlanData(prev =>
      prev.map(item =>
        item.key === key ? { ...item, amount: numericValue } : item
      )
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      // Фильтруем только периоды с ненулевыми значениями
      const planToSave = planData
        .filter(item => item.amount > 0)
        .map(item => ({
          date: `${item.year}-${item.month.toString().padStart(2, '0')}-01`,
          plopl: item.amount
        }));

      const response = await fetch(`/api/expense-contracts/${contract.id}/cal-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plans: planToSave }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Plan saved successfully:', result);
        onUpdate();
        onClose();
      } else {
        const result = await response.json();
        setError(result.error || 'Ошибка при сохранении плана');
      }
    } catch (err) {
      setError('Ошибка сети при сохранении плана');
    } finally {
      setSaving(false);
    }
  };

  // Расчет суммарных показателей
  const calculateTotals = () => {
    const totalPlanned = planData.reduce((sum, item) => sum + item.amount, 0);
    const contractAmount = parseFloat(contractData.contract_amount) || 0;
    const remaining = contractAmount - totalPlanned;

    return {
      totalPlanned,
      contractAmount,
      remaining,
      isOverplanned: remaining < 0
    };
  };

  const totals = calculateTotals();
  const periods = generatePeriods();

  // Группировка по годам для удобного отображения
  const groupedByYear = periods.reduce((acc, period) => {
    if (!acc[period.year]) {
      acc[period.year] = [];
    }
    acc[period.year].push(period);
    return acc;
  }, {});

  if (!isOpen) return null;

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + ' ₽';
  };

  const monthNames = [
    'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
    'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content extra-wide-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1400px', width: '95%' }}>
        <div className="modal-header">
          <h2>План финансирования - {contract?.contract}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          {/* Сводная информация */}
          <div className="financing-summary">
            <div className="summary-cards">
              <div className="summary-card">
                <div className="summary-label">Стоимость договора</div>
                <div className="summary-value">{formatCurrency(totals.contractAmount)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Запланировано</div>
                <div className="summary-value">{formatCurrency(totals.totalPlanned)}</div>
              </div>
              <div className="summary-card">
                <div className="summary-label">Осталось запланировать</div>
                <div className={`summary-value ${totals.isOverplanned ? 'negative' : ''}`}>
                  {formatCurrency(totals.remaining)}
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading">Загрузка данных плана...</div>
          ) : (
            <div className="financing-plan-table">
              <h3>Планирование по месяцам</h3>
              <div className="table-scroll-container">
                <table className="data-table financing-table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Год</th>
                      {monthNames.map(month => (
                        <th key={month} style={{ width: '80px' }}>{month}</th>
                      ))}
                      <th style={{ width: '100px' }}>Итого за год</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(groupedByYear).map(([year, yearPeriods]) => {
                      const yearData = planData.filter(item => item.year === parseInt(year));
                      const yearTotal = yearData.reduce((sum, item) => sum + item.amount, 0);

                      return (
                        <tr key={year}>
                          <td className="year-cell"><strong>{year}</strong></td>
                          {monthNames.map((_, monthIndex) => {
                            const monthNumber = monthIndex + 1;
                            const period = yearPeriods.find(p => p.month === monthNumber);
                            const planItem = planData.find(item =>
                              item.year === parseInt(year) && item.month === monthNumber
                            );

                            return (
                              <td key={`${year}-${monthNumber}`} className="month-cell">
                                {period ? (
                                  <input
                                    type="number"
                                    value={planItem?.amount || 0}
                                    onChange={(e) => handleAmountChange(period.key, e.target.value)}
                                    className="plan-input"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                  />
                                ) : (
                                  <span className="no-period">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="year-total">
                            <strong>{formatCurrency(yearTotal)}</strong>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Футер модального окна - только кнопка Сохранить */}
          <div className="modal-footer" style={{ justifyContent: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || totals.isOverplanned}
              style={{ minWidth: '200px' }}
            >
              {saving ? 'Сохранение...' : 'Сохранить план'}
            </button>
          </div>

          {totals.isOverplanned && (
            <div className="form-error" style={{ marginTop: '15px', textAlign: 'center' }}>
              Внимание: Сумма планирования превышает стоимость договора!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancingPlanModal;