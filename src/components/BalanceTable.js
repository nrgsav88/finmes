import React, { useState, useEffect } from 'react';
import { exportBalanceToExcel } from './ExcelExport';
import './BalanceTable.css';

const BalanceTable = ({ data, loading, currentUser, onDataUpdate }) => {
  const [balanceData, setBalanceData] = useState([]);
  const [totalBalance, setTotalBalance] = useState(0);

  // Форматирование валюты
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0 ₽';
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + ' ₽';
  };

  // Загрузка данных баланса
  useEffect(() => {
    fetchBalanceData();
  }, []);

  const fetchBalanceData = async () => {
    try {
      const response = await fetch('/api/balance');
      if (response.ok) {
        const result = await response.json();
        setBalanceData(result.contracts || []);
        setTotalBalance(parseFloat(result.total_balance) || 0);
      } else {
        console.error('Ошибка при загрузки данных баланса');
      }
    } catch (error) {
      console.error('Ошибка сети при загрузке данных баланса:', error);
    }
  };

  // Обработчик экспорта в Excel
  const handleExport = () => {
    exportBalanceToExcel(balanceData, 'баланс_по_договорам');
  };

  if (loading) {
    return <div className="loading">Загрузка данных баланса...</div>;
  }

  return (
    <div className="data-table-container">
      <div className="table-header">
        <h2>Баланс по договорам</h2>
        <div className="table-actions">
          <button className="action-btn export-btn" onClick={handleExport}>
            Скачать в Excel
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table balance-table">
          <thead>
            <tr>
              <th colSpan="4" style={{ textAlign: 'center' }}>
                ДОХОДНЫЕ ДОГОВОРЫ
              </th>
              <th colSpan="3" style={{ textAlign: 'center' }}>
                РАСХОДНЫЕ ДОГОВОРЫ
              </th>
              <th colSpan="2" style={{ textAlign: 'center' }}>
                САЛЬДО
              </th>
            </tr>
            <tr>
              {/* Заголовки для доходных договоров */}
              <th>Договор</th>
              <th>Контрагент</th>
              <th>Сумма</th>
              <th className="border-right">Оплачено</th>

              {/* Заголовки для расходных договоров */}
              <th>Договор</th>
              <th>Сумма</th>
              <th className="border-right">Оплачено</th>

              {/* Заголовки для сальдо */}
              <th>Стоимость</th>
              <th>Оплачено</th>
            </tr>
          </thead>
          <tbody>
            {balanceData.map((item, index) => {
              const incomeAmount = parseFloat(item.income_contract.amount) || 0;
              const incomePaid = parseFloat(item.income_contract.paid) || 0;
              const totalExpenseAmount = parseFloat(item.total_expense) || 0;
              const totalExpensePaid = parseFloat(item.total_paid) || 0;

              // Расчет сальдо по стоимости и оплате
              const balanceAmount = incomeAmount - totalExpenseAmount;
              const balancePaid = incomePaid - totalExpensePaid;

              return (
                <React.Fragment key={item.income_contract.id}>
                  {/* Основная строка с доходным договором и первым расходным */}
                  <tr>
                    {/* Данные доходного договора */}
                    <td style={{ fontWeight: '600' }}>
                      {item.income_contract.number}
                    </td>
                    <td>
                      {item.income_contract.client}
                    </td>
                    <td>
                      {formatCurrency(incomeAmount)}
                    </td>
                    <td className="border-right">
                      {formatCurrency(incomePaid)}
                    </td>

                    {/* Данные расходных договоров */}
                    {item.expense_contracts.length > 0 ? (
                      <>
                        <td>
                          {item.expense_contracts[0].number}
                        </td>
                        <td>
                          {formatCurrency(parseFloat(item.expense_contracts[0].amount))}
                        </td>
                        <td className="border-right">
                          {formatCurrency(parseFloat(item.expense_contracts[0].paid))}
                        </td>
                      </>
                    ) : (
                      <>
                        <td>-</td>
                        <td>-</td>
                        <td className="border-right">-</td>
                      </>
                    )}

                    {/* Сальдо - разделено на две составляющие */}
                    <td style={{
                      fontWeight: '600',
                      color: balanceAmount >= 0 ? '#059669' : '#dc2626'
                    }}>
                      {formatCurrency(balanceAmount)}
                    </td>
                    <td style={{
                      fontWeight: '600',
                      color: balancePaid >= 0 ? '#059669' : '#dc2626'
                    }}>
                      {formatCurrency(balancePaid)}
                    </td>
                  </tr>

                  {/* Дополнительные строки для остальных расходных договоров */}
                  {item.expense_contracts.slice(1).map((expense, expIndex) => (
                    <tr key={expense.id}>
                      <td colSpan="4" className="border-right"></td>
                      <td>
                        {expense.number}
                      </td>
                      <td>
                        {formatCurrency(parseFloat(expense.amount))}
                      </td>
                      <td className="border-right">
                        {formatCurrency(parseFloat(expense.paid))}
                      </td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}

                  {/* Черта-разделитель между доходными договорами */}
                  {index < balanceData.length - 1 && (
                    <tr className="divider-row">
                      <td colSpan="9"></td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan="2" style={{ textAlign: 'right', fontWeight: '700' }}>
                ОБЩИЙ БАЛАНС:
              </td>
              <td style={{ fontWeight: '700' }}>
                {formatCurrency(balanceData.reduce((sum, item) => sum + parseFloat(item.income_contract.amount), 0))}
              </td>
              <td style={{ fontWeight: '700' }} className="border-right">
                {formatCurrency(balanceData.reduce((sum, item) => sum + parseFloat(item.income_contract.paid), 0))}
              </td>
              <td></td>
              <td style={{ fontWeight: '700' }}>
                {formatCurrency(balanceData.reduce((sum, item) => sum + parseFloat(item.total_expense), 0))}
              </td>
              <td style={{ fontWeight: '700' }} className="border-right">
                {formatCurrency(balanceData.reduce((sum, item) => sum + parseFloat(item.total_paid), 0))}
              </td>
              <td style={{
                fontWeight: '700',
                textAlign: 'center'
              }}>
                {formatCurrency(
                  balanceData.reduce((sum, item) => sum + parseFloat(item.income_contract.amount), 0) -
                  balanceData.reduce((sum, item) => sum + parseFloat(item.total_expense), 0)
                )}
              </td>
              <td style={{
                fontWeight: '700',
                textAlign: 'center'
              }}>
                {formatCurrency(
                  balanceData.reduce((sum, item) => sum + parseFloat(item.income_contract.paid), 0) -
                  balanceData.reduce((sum, item) => sum + parseFloat(item.total_paid), 0)
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {balanceData.length === 0 && !loading && (
        <div className="empty-state">
          <p>Нет данных для отображения</p>
        </div>
      )}
    </div>
  );
};

export default BalanceTable;