import React, { useState } from 'react';
import ContractEditModal from './ContractEditModal';
import ClosedWorksModal from './ClosedWorksModal';
import ContractorPaymentsModal from './ContractorPaymentsModal';
import { exportToExcel } from './ExcelExport';

const DataTable = ({ data, activeTab, loading, currentUser, onDataUpdate }) => {
  const [searchTerm, setSearchTerm] = useState({
    contract: '',
    name: '',
    client: ''
  });
  const [typeFilter, setTypeFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [closedWorksModalOpen, setClosedWorksModalOpen] = useState(false);
  const [selectedContractForWorks, setSelectedContractForWorks] = useState(null);
  const [paymentsModalOpen, setPaymentsModalOpen] = useState(false);
  const [selectedContractForPayments, setSelectedContractForPayments] = useState(null);

  // Проверяем права доступа
  const canEditPaid = currentUser && (currentUser.role === 'Экономика' || currentUser.username === 'admin');
  const canEditPaymentLoesk = currentUser && (currentUser.role === 'Экономика' || currentUser.username === 'admin');
  const canEditContracts = currentUser && (currentUser.role === 'Экономика' || currentUser.username === 'admin');

  // Функция для получения названий месяцев
  const getCurrentMonthLabel = (offset) => {
    const currentDate = new Date();
    const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    const monthName = targetDate.toLocaleString('ru-RU', { month: 'long' });
    const year = targetDate.getFullYear();
    return `${monthName} ${year}`;
  };

  // Функция для преобразования форматированной суммы в число
  const parseFormattedAmount = (formattedAmount) => {
    if (!formattedAmount || formattedAmount === '0 ₽') return 0;

    try {
      const numericString = formattedAmount
        .replace(/[^\d,.]/g, '')
        .replace(',', '.');

      return parseFloat(numericString) || 0;
    } catch (error) {
      console.error('Error parsing amount:', error);
      return 0;
    }
  };

  // Функция для форматирования суммы в русский формат
  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '0 ₽';
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + ' ₽';
  };

  // Обработчик экспорта в Excel
  const handleExport = () => {
    const title = getTableTitle();
    const filename = getFilename();
    const exportData = prepareExportData();

    console.log('Exporting:', {
      title,
      filename,
      dataCount: exportData.length,
      columns: Object.keys(exportData[0] || {})
    });

    exportToExcel(exportData, getExportColumns(), filename, title);
  };

  const getTableTitle = () => {
    switch (activeTab) {
      case 'income': return 'Доходные договоры';
      case 'planning': return 'Планирование финансирования по расходным договорам';
      case 'actual': return 'Фактическое финансирование по расходным договорам';
      default: return 'Данные';
    }
  };

  const getFilename = () => {
    switch (activeTab) {
      case 'income': return 'доходные_договоры';
      case 'planning': return 'планирование_финансирования';
      case 'actual': return 'фактическое_финансирование';
      default: return 'данные';
    }
  };

  // Подготовка данных для экспорта
  const prepareExportData = () => {
    return filteredData.map(item => {
      const exportItem = { ...item };

      // Для доходных договоров
      if (activeTab === 'income') {
        // Убираем форматирование валюты для Excel
        if (exportItem.amount) {
          exportItem.amount = parseFormattedAmount(exportItem.amount);
        }
        if (exportItem.paid) {
          exportItem.paid = parseFormattedAmount(exportItem.paid);
        }
      }

      // Для планирования
      if (activeTab === 'planning') {
        // Преобразуем тип договора в текст
        exportItem.type_contract_display = exportItem.type_contract === 'ремонтная программа' ? 'РП' : 'ИП';

        // Убираем форматирование валюты для всех полей включая месячные
        const currencyFields = [
          'contract_amount', 'advance_amount', 'current_month', 'next_month_1',
          'next_month_2', 'three_month_total'
        ];

        currencyFields.forEach(field => {
          if (exportItem[field]) {
            exportItem[field] = parseFormattedAmount(exportItem[field]);
          } else {
            exportItem[field] = 0; // Устанавливаем 0 если значения нет
          }
        });

        // Убедимся что все месячные поля существуют
        ['current_month', 'next_month_1', 'next_month_2', 'three_month_total'].forEach(field => {
          if (exportItem[field] === undefined) {
            exportItem[field] = 0;
          }
        });

        // Преобразуем даты в объединенную строку
        if (exportItem.start_date && exportItem.end_date) {
          exportItem.dates_display = `Закл: ${exportItem.start_date}\nОконч: ${exportItem.end_date}`;
        }
      }

      // Для фактического
      if (activeTab === 'actual') {
        // Преобразуем тип договора в текст
        exportItem.type_contract_display = exportItem.type_contract === 'ремонтная программа' ? 'РП' : 'ИП';

        // Убираем форматирование валюты
        const currencyFields = [
          'contract_amount', 'payment_loesk', 'contractor_costs',
          'closed_works', 'balance', 'remaining_funding'
        ];

        currencyFields.forEach(field => {
          if (exportItem[field]) {
            exportItem[field] = parseFormattedAmount(exportItem[field]);
          }
        });

        // Преобразуем даты в объединенную строку
        if (exportItem.start_date && exportItem.end_date) {
          exportItem.dates_display = `Закл: ${exportItem.start_date}\nОконч: ${exportItem.end_date}`;
        }
      }

      return exportItem;
    });
  };

  // Колонки для экспорта
  const getExportColumns = () => {
    switch (activeTab) {
      case 'income':
        return [
          { key: 'contract', label: 'Номер договора' },
          { key: 'date', label: 'Дата заключения' },
          { key: 'client', label: 'Контрагент' },
          { key: 'amount', label: 'Стоимость договора', type: 'currency' },
          { key: 'paid', label: 'Оплачено', type: 'currency' }
        ];

      case 'planning':
        return [
          { key: 'type_contract_display', label: 'Вид' },
          { key: 'contract', label: 'Номер договора' },
          { key: 'client', label: 'Контрагент' },
          { key: 'dates_display', label: 'Даты договора' },
          { key: 'name', label: 'Наименование' },
          { key: 'contract_amount', label: 'Сумма договора', type: 'currency' },
          { key: 'advance', label: 'Аванс' },
          { key: 'advance_amount', label: 'Авансирование', type: 'currency' },
          { key: 'current_month', label: getCurrentMonthLabel(0), type: 'currency' },
          { key: 'next_month_1', label: getCurrentMonthLabel(1), type: 'currency' },
          { key: 'next_month_2', label: getCurrentMonthLabel(2), type: 'currency' },
          { key: 'three_month_total', label: 'Сумма за 3 месяца', type: 'currency' }
        ];

      case 'actual':
        return [
          { key: 'type_contract_display', label: 'Вид' },
          { key: 'contract', label: 'Номер договора' },
          { key: 'client', label: 'Контрагент' },
          { key: 'dates_display', label: 'Даты договора' },
          { key: 'name', label: 'Наименование' },
          { key: 'contract_amount', label: 'Сумма договора', type: 'currency' },
          { key: 'advance', label: 'Аванс' },
          { key: 'payment_loesk', label: 'Оплата от ЛОЭСК', type: 'currency' },
          { key: 'contractor_costs', label: 'Платежи подрядчика', type: 'currency' },
          { key: 'closed_works', label: 'Закрыто работ', type: 'currency' },
          { key: 'balance', label: 'Сальдо', type: 'currency' },
          { key: 'remaining_funding', label: 'Остаток финансирования', type: 'currency' }
        ];

      default:
        return [];
    }
  };

  // Обработчик клика по фильтру вида
  const handleTypeFilter = (type) => {
    setTypeFilter(typeFilter === type ? '' : type);
  };

  // Обработчик клика по номеру договора
  const handleContractClick = (contract) => {
    if (!canEditContracts) return;

    setSelectedContract(contract);
    setEditModalOpen(true);
  };

  // Обработчик клика на "Закрыто работ"
  const handleClosedWorksClick = (contract) => {
    if (!canEditClosedWorks(contract, currentUser)) return;

    setSelectedContractForWorks(contract);
    setClosedWorksModalOpen(true);
  };

  // Обработчик клика на "Платежи подрядчика"
  const handlePaymentsClick = (contract) => {
    const canEdit = currentUser && (
      currentUser.role === 'Экономика' ||
      currentUser.role === 'Администратор системы' ||
      currentUser.username === 'admin' ||
      (currentUser.role === 'МЭС' && (contract.client === 'МЭС' || contract.is_mes))
    );

    if (!canEdit) return;

    setSelectedContractForPayments(contract);
    setPaymentsModalOpen(true);
  };

  // функцию проверки прав для закрытых работ
  const canEditClosedWorks = (contract, user) => {
    if (!user) return false;

    // Администратор может все
    if (user.role === 'Администратор системы' || user.username === 'admin') {
      return true;
    }

    // Кап. строй может редактировать ИП договоры
    if (user.role === 'Кап. строй' && contract.type_contract === 'инвестиционная программа') {
      return true;
    }

    // ПТС может редактировать РП договоры
    if (user.role === 'ПТС' && contract.type_contract === 'ремонтная программа') {
      return true;
    }

    return false;
  };

  // Начало редактирования
  const handleEditStart = (id, currentValue, field) => {
    if ((field === 'paid' && !canEditPaid) || (field === 'payment_loesk' && !canEditPaymentLoesk)) return;

    const numericValue = parseFormattedAmount(currentValue);
    setEditingId(id);
    setEditingField(field);
    setEditValue(numericValue.toString());
  };

  // Отмена редактирования
  const handleEditCancel = () => {
    setEditingId(null);
    setEditingField(null);
    setEditValue('');
  };

  // Сохранение изменений
  const handleEditSave = async (id, field) => {
    if (!editValue || isNaN(parseFloat(editValue))) {
      handleEditCancel();
      return;
    }

    try {
      const amount = parseFloat(editValue);
      let endpoint = '';
      let requestBody = {};

      if (field === 'paid') {
        endpoint = `/api/income-contracts/${id}`;
        requestBody = { paid_amount: amount };
      } else if (field === 'payment_loesk') {
        endpoint = `/api/expense-contracts/${id}`;
        requestBody = { payment_loesk: amount };
      }

      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        // Обновляем данные через callback
        if (onDataUpdate) {
          onDataUpdate();
        }
        handleEditCancel();
      } else {
        const result = await response.json();
        alert(`Ошибка при обновлении: ${result.error}`);
      }
    } catch (error) {
      console.error('Ошибка при сохранении:', error);
      alert('Ошибка сети при сохранении');
    } finally {
      handleEditCancel();
    }
  };

  // Обработчик нажатия клавиш
  const handleKeyPress = (e, id, field) => {
    if (e.key === 'Enter') {
      handleEditSave(id, field);
    } else if (e.key === 'Escape') {
      handleEditCancel();
    }
  };

  // Функция для определения стиля ячейки "Оплачено"
  const getPaidAmountStyle = (paidAmount, contractAmount) => {
    const paid = parseFormattedAmount(paidAmount);
    const contract = parseFormattedAmount(contractAmount);

    if (paid === contract) {
      return {
        fontWeight: 'bold',
        color: '#22c55e'
      };
    } else if (paid > contract) {
      return {
        fontWeight: 'bold',
        color: '#ef4444',
      };
    }
    return {};
  };

  // Конфигурация колонок для разных вкладок
  const getColumns = () => {
    const getMonthNames = () => {
      const currentDate = new Date();
      const months = [];

      for (let i = 0; i < 3; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
        const monthName = date.toLocaleString('ru-RU', { month: 'long' });
        const year = date.getFullYear();
        months.push({
          label: `${monthName} ${year}`,
          key: `month_${i}`
        });
      }

      return months;
    };

    const monthColumns = getMonthNames();

    switch (activeTab) {
      case 'income':
        return [
          { key: 'id', label: 'ID' },
          {
            key: 'contract',
            label: 'Номер договора',
            searchable: true,
            render: (row) => (
              <div
                onClick={() => handleContractClick(row)}
                style={{
                  cursor: canEditContracts ? 'pointer' : 'default',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  backgroundColor: canEditContracts ? '#f8f9fa' : 'transparent',
                  fontWeight: canEditContracts ? '600' : 'normal',
                  color: canEditContracts ? '#667eea' : 'inherit'
                }}
                title={canEditContracts ? 'Кликните для редактирования договора' : ''}
                className={canEditContracts ? 'editable-cell' : ''}
              >
                {row.contract}
              </div>
            )
          },
          { key: 'date', label: 'Дата заключения' },
          {
            key: 'client',
            label: 'Контрагент',
            searchable: true
          },
          { key: 'amount', label: 'Стоимость договора' },
          {
            key: 'paid',
            label: 'Оплачено',
            render: (row) => {
              if (editingId === row.id && editingField === 'paid') {
                return (
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, row.id, 'paid')}
                    onBlur={() => handleEditSave(row.id, 'paid')}
                    style={{
                      width: '100%',
                      padding: '4px',
                      border: '2px solid #667eea',
                      borderRadius: '4px',
                      fontSize: 'inherit',
                      background: 'white',
                    }}
                    autoFocus
                    step="0.01"
                    min="0"
                  />
                );
              }

              const style = getPaidAmountStyle(row.paid, row.amount);
              return (
                <div
                  onClick={() => canEditPaid && handleEditStart(row.id, row.paid, 'paid')}
                  style={{
                    cursor: canEditPaid ? 'pointer' : 'default',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                    ...style,
                    backgroundColor: canEditPaid ? '#f8f9fa' : 'transparent'
                  }}
                  title={canEditPaid ? 'Кликните для редактирования' : ''}
                  className={canEditPaid ? 'editable-cell' : ''}
                >
                  {row.paid}
                </div>
              );
            }
          }
        ];
      case 'planning':
        return [
          { key: 'id', label: 'ID' },
          {
            key: 'type_contract',
            label: 'Вид',
            render: (row) => (
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: row.type_contract === 'ремонтная программа' ? '#e6f7ff' : '#f6ffed',
                color: row.type_contract === 'ремонтная программа' ? '#1890ff' : '#52c41a',
                border: row.type_contract === 'ремонтная программа' ? '1px solid #91d5ff' : '1px solid #b7eb8f'
              }}>
                {row.type_contract === 'ремонтная программа' ? 'РП' : 'ИП'}
              </span>
            )
          },
          {
            key: 'contract',
            label: 'Номер договора',
            searchable: true,
            render: (row) => (
              <div
                onClick={() => handleContractClick(row)}
                style={{
                  cursor: canEditContracts ? 'pointer' : 'default',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  backgroundColor: canEditContracts ? '#f8f9fa' : 'transparent',
                  fontWeight: canEditContracts ? '600' : 'normal',
                  color: canEditContracts ? '#667eea' : 'inherit'
                }}
                title={canEditContracts ? 'Кликните для редактирования договора' : ''}
                className={canEditContracts ? 'editable-cell' : ''}
              >
                {row.contract}
              </div>
            )
          },
          {
            key: 'client',
            label: 'Контрагент',
            searchable: true
          },
          {
            key: 'dates',
            label: 'Даты договора',
            render: (row) => (
              <div className="dates-column">
                <div className="date-start">Закл: {row.start_date}</div>
                <div className="date-end">Оконч: {row.end_date}</div>
              </div>
            )
          },
          {
            key: 'name',
            label: 'Наименование',
            searchable: true
          },
          { key: 'contract_amount', label: 'Сумма договора' },
          {
            key: 'advance',
            label: 'Аванс',
            className: 'border-right'
          },
          {
            key: 'advance_amount',
            label: 'Авансирование'
          },
          // Динамические колонки месяцев
          {
            key: 'current_month',
            label: monthColumns[0].label,
            render: (row) => row.current_month
          },
          {
            key: 'next_month_1',
            label: monthColumns[1].label,
            render: (row) => row.next_month_1
          },
          {
            key: 'next_month_2',
            label: monthColumns[2].label,
            render: (row) => row.next_month_2
          },
          {
            key: 'three_month_total',
            label: `Сумма за 3 месяца`
          }
        ];
      case 'actual':
        return [
          { key: 'id', label: 'ID' },
          {
            key: 'type_contract',
            label: 'Вид',
            render: (row) => (
              <span style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '600',
                backgroundColor: row.type_contract === 'ремонтная программа' ? '#e6f7ff' : '#f6ffed',
                color: row.type_contract === 'ремонтная программа' ? '#1890ff' : '#52c41a',
                border: row.type_contract === 'ремонтная программа' ? '1px solid #91d5ff' : '1px solid #b7eb8f'
              }}>
                {row.type_contract === 'ремонтная программа' ? 'РП' : 'ИП'}
              </span>
            )
          },
          {
            key: 'contract',
            label: 'Номер договора',
            searchable: true,
            render: (row) => (
              <div
                onClick={() => handleContractClick(row)}
                style={{
                  cursor: canEditContracts ? 'pointer' : 'default',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease',
                  backgroundColor: canEditContracts ? '#f8f9fa' : 'transparent',
                  fontWeight: canEditContracts ? '600' : 'normal',
                  color: canEditContracts ? '#667eea' : 'inherit'
                }}
                title={canEditContracts ? 'Кликните для редактирования договора' : ''}
                className={canEditContracts ? 'editable-cell' : ''}
              >
                {row.contract}
              </div>
            )
          },
          {
            key: 'client',
            label: 'Контрагент',
            searchable: true
          },
          {
            key: 'dates',
            label: 'Даты договора',
            render: (row) => (
              <div className="dates-column">
                <div className="date-start">Закл: {row.start_date}</div>
                <div className="date-end">Оконч: {row.end_date}</div>
              </div>
            )
          },
          {
            key: 'name',
            label: 'Наименование',
            searchable: true
          },
          { key: 'contract_amount', label: 'Сумма договора' },
          {
            key: 'advance',
            label: 'Аванс',
            className: 'border-right'
          },
          {
            key: 'payment_loesk',
            label: 'Оплата от ЛОЭСК',
            render: (row) => {
              if (editingId === row.id && editingField === 'payment_loesk') {
                return (
                  <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, row.id, 'payment_loesk')}
                    onBlur={() => handleEditSave(row.id, 'payment_loesk')}
                    style={{
                      width: '100%',
                      padding: '4px',
                      border: '2px solid #667eea',
                      borderRadius: '4px',
                      fontSize: 'inherit',
                      background: 'white',
                    }}
                    autoFocus
                    step="0.01"
                    min="0"
                  />
                );
              }

              return (
                <div
                  onClick={() => canEditPaymentLoesk && handleEditStart(row.id, row.payment_loesk, 'payment_loesk')}
                  style={{
                    cursor: canEditPaymentLoesk ? 'pointer' : 'default',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                    backgroundColor: canEditPaymentLoesk ? '#f8f9fa' : 'transparent'
                  }}
                  title={canEditPaymentLoesk ? 'Кликните для редактирования' : ''}
                  className={canEditPaymentLoesk ? 'editable-cell' : ''}
                >
                  {row.payment_loesk}
                </div>
              );
            }
          },
          {
            key: 'contractor_costs',
            label: 'Платежи подрядчика',
            render: (row) => {
              const canEdit = currentUser && (
                currentUser.role === 'Экономика' ||
                currentUser.role === 'Администратор системы' ||
                currentUser.username === 'admin' ||
                (currentUser.role === 'МЭС' && (row.client === 'МЭС' || row.is_mes))
              );

              return (
                <div
                  onClick={() => handlePaymentsClick(row)}
                  style={{
                    cursor: canEdit ? 'pointer' : 'default',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                    backgroundColor: canEdit ? '#f0f9ff' : 'transparent',
                    fontWeight: canEdit ? '600' : 'normal',
                    color: canEdit ? '#1e40af' : 'inherit'
                  }}
                  title={canEdit ? 'Кликните для управления платежами' : ''}
                  className={canEdit ? 'editable-cell' : ''}
                >
                  {row.contractor_costs}
                </div>
              );
            }
          },
          {
            key: 'closed_works',
            label: 'Закрыто работ',
            render: (row) => {
              const canEdit = canEditClosedWorks(row, currentUser);
              return (
                <div
                  onClick={() => handleClosedWorksClick(row)}
                  style={{
                    cursor: canEdit ? 'pointer' : 'default',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                    backgroundColor: canEdit ? '#f0f9ff' : 'transparent',
                    fontWeight: canEdit ? '600' : 'normal',
                    color: canEdit ? '#1e40af' : 'inherit'
                  }}
                  title={canEdit ? 'Кликните для редактирования закрытых работ' : ''}
                  className={canEdit ? 'editable-cell' : ''}
                >
                  {row.closed_works}
                </div>
              );
            }
          },
          {
            key: 'balance',
            label: 'Сальдо'
          },
          { key: 'remaining_funding', label: 'Остаток финансирования' }
        ];
      default:
        return [];
    }
  };

  const handleSearch = (field, value) => {
    setSearchTerm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const columns = getColumns();

  // Фильтрация данных для разных вкладок
  const filteredData = data.filter(item => {
    if (activeTab === 'income') {
      return (
        (item.contract || '').toLowerCase().includes(searchTerm.contract.toLowerCase()) &&
        (item.client || '').toLowerCase().includes(searchTerm.client.toLowerCase())
      );
    } else {
      // Для planning и actual добавляем фильтр по виду
      const matchesType = typeFilter === '' || item.type_contract === typeFilter;

      return (
        (item.contract || '').toLowerCase().includes(searchTerm.contract.toLowerCase()) &&
        (item.name || '').toLowerCase().includes(searchTerm.name.toLowerCase()) &&
        (item.client || '').toLowerCase().includes(searchTerm.client.toLowerCase()) &&
        matchesType
      );
    }
  });

  if (loading) {
    return <div className="loading">Загрузка данных...</div>;
  }

  const renderTableHeader = () => {
    return (
      <tr>
        {columns.map(column => {
          if (column.key === 'type_contract') {
            // Специальный заголовок для столбца "Вид" с кнопками фильтрации
            return (
              <th key={column.key}>
                <div className="type-filter-header">
                  <div className="column-label">{column.label}</div>
                  <div className="type-filter-buttons">
                    <button
                      className={`type-filter-btn ${typeFilter === 'ремонтная программа' ? 'active' : ''}`}
                      onClick={() => handleTypeFilter('ремонтная программа')}
                    >
                      РП
                    </button>
                    <button
                      className={`type-filter-btn ${typeFilter === 'инвестиционная программа' ? 'active' : ''}`}
                      onClick={() => handleTypeFilter('инвестиционная программа')}
                    >
                      ИП
                    </button>
                    {typeFilter && (
                      <button
                        className="type-filter-clear"
                        onClick={() => setTypeFilter('')}
                        title="Сбросить фильтр"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {typeFilter && (
                    <div className="type-filter-active">
                      Активный фильтр: {typeFilter === 'ремонтная программа' ? 'РП' : 'ИП'}
                    </div>
                  )}
                </div>
              </th>
            );
          }

          if (column.searchable) {
            return (
              <th key={column.key} className={column.className}>
                <div className="search-header">
                  <div className="column-label">{column.label}</div>
                  <input
                    type="text"
                    placeholder={`Поиск...`}
                    value={searchTerm[column.key] || ''}
                    onChange={(e) => handleSearch(column.key, e.target.value)}
                    className="search-input"
                  />
                </div>
              </th>
            );
          }

          return (
            <th key={column.key} className={column.className}>
              {column.label}
            </th>
          );
        })}
      </tr>
    );
  };

  const renderTableRow = (row) => {
    return (
      <tr key={row.id}>
        {columns.map(column => {
          if (column.render) {
            return (
              <td key={column.key} className={column.className}>
                {column.render(row)}
              </td>
            );
          }
          return (
            <td key={column.key} className={column.className}>
              {row[column.key]}
            </td>
          );
        })}
      </tr>
    );
  };

  const renderTotalRow = () => {
    if (activeTab !== 'planning' && activeTab !== 'actual') return null;
    if (filteredData.length === 0) return null;

    // Расчет итогов для финансовых колонок
    const totals = {};

    filteredData.forEach(row => {
      if (activeTab === 'planning') {
        ['advance_amount', 'current_month', 'next_month_1', 'next_month_2', 'three_month_total'].forEach(key => {
          if (row[key]) {
            const value = parseFormattedAmount(row[key]);
            totals[key] = (totals[key] || 0) + value;
          }
        });
      } else if (activeTab === 'actual') {
        ['payment_loesk', 'contractor_costs', 'closed_works', 'balance', 'remaining_funding'].forEach(key => {
          if (row[key]) {
            const value = parseFormattedAmount(row[key]);
            totals[key] = (totals[key] || 0) + value;
          }
        });
      }
    });

    // Форматируем все итоговые значения
    Object.keys(totals).forEach(key => {
      totals[key] = formatCurrency(totals[key]);
    });

    return (
      <tr className="total-row">
        {columns.map(column => {
          if (column.key === 'id') {
            return <td key={column.key} className="total-label">ИТОГО:</td>;
          }
          else if (column.key === 'contract' || column.key === 'dates' || column.key === 'name' ||
                   column.key === 'contract_amount' || column.key === 'advance' ||
                   column.key === 'client' || column.key === 'date' || column.key === 'paid' ||
                   column.key === 'type_contract') {
            return <td key={column.key}></td>;
          }
          else if (totals[column.key]) {
            return (
              <td key={column.key} className="total-value">
                {totals[column.key]}
              </td>
            );
          }
          return <td key={column.key}></td>;
        })}
      </tr>
    );
  };

  // Определяем тип договора для модального окна
  const getContractTypeForModal = () => {
    return activeTab === 'income' ? 'income' : 'expense';
  };

  return (
    <div className="data-table-container">
      <div className="table-header">
        <h2>
          {activeTab === 'income' && 'Доходные договоры'}
          {activeTab === 'planning' && 'Планирование финансирования по расходным договорам'}
          {activeTab === 'actual' && 'Фактическое финансирование по расходным договорам'}
        </h2>
        <div className="table-actions">
          <button className="action-btn export-btn" onClick={handleExport}>
            Скачать в Excel
          </button>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            {renderTableHeader()}
          </thead>
          <tbody>
            {filteredData.map(renderTableRow)}
            {renderTotalRow()}
          </tbody>
        </table>
      </div>

      {filteredData.length === 0 && (
        <div className="empty-state">
          <p>Нет данных для отображения</p>
          {(searchTerm.contract || searchTerm.name || searchTerm.client || typeFilter) && (
            <p className="no-results">Попробуйте изменить условия поиска</p>
          )}
        </div>
      )}

      {/* Модальное окно редактирования договора */}
      <ContractEditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedContract(null);
        }}
        contract={selectedContract}
        contractType={getContractTypeForModal()}
        onUpdate={onDataUpdate}
        currentUser={currentUser}
      />

      {/* Модальное окно закрытых работ */}
      <ClosedWorksModal
        isOpen={closedWorksModalOpen}
        onClose={() => {
          setClosedWorksModalOpen(false);
          setSelectedContractForWorks(null);
        }}
        contract={selectedContractForWorks}
        currentUser={currentUser}
        onDataUpdate={onDataUpdate}
      />

      {/* Модальное окно платежей подрядчика */}
      <ContractorPaymentsModal
        isOpen={paymentsModalOpen}
        onClose={() => {
          setPaymentsModalOpen(false);
          setSelectedContractForPayments(null);
        }}
        contract={selectedContractForPayments}
        currentUser={currentUser}
        onDataUpdate={onDataUpdate}
      />
    </div>
  );
};

export default DataTable;