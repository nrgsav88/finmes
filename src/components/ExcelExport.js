import * as XLSX from 'xlsx-js-style';

export const exportToExcel = (data, columns, filename, title) => {
  // Создаем новую рабочую книгу
  const wb = XLSX.utils.book_new();

  // Подготовка данных для Excel
  const excelData = prepareExcelData(data, columns, title);

  // Создаем лист с данными
  const ws = XLSX.utils.aoa_to_sheet(excelData.data);

  // Применяем стили к ячейкам
  applyStyles(ws, excelData.styles, excelData.merges);

  // Настройка ширины колонок
  setColumnWidths(ws, columns);

  // Добавляем лист в книгу
  XLSX.utils.book_append_sheet(wb, ws, 'Данные');

  // Скачиваем файл
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

const prepareExcelData = (data, columns, title) => {
  const result = {
    data: [],
    styles: {},
    merges: []
  };

  // Заголовок таблицы
  result.data.push([title]);
  result.styles['A1'] = {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '3B82F6' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  result.merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } });

  // Пустая строка
  result.data.push([]);

  // Заголовки колонок
  const headers = columns.map(col => col.label || col.key);
  result.data.push(headers);

  // Стили для заголовков
  headers.forEach((_, index) => {
    const cellRef = XLSX.utils.encode_cell({ r: 2, c: index });
    result.styles[cellRef] = {
      font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1D4ED8' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'FFFFFF' } },
        left: { style: 'thin', color: { rgb: 'FFFFFF' } },
        bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
        right: { style: 'thin', color: { rgb: 'FFFFFF' } }
      }
    };
  });

  // Данные строк
  data.forEach((row, rowIndex) => {
    const rowData = columns.map(col => {
      // Просто возвращаем значение из данных
      return row[col.key] || '';
    });
    result.data.push(rowData);

    // Стили для строк данных
    rowData.forEach((value, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 3, c: colIndex });
      const isEvenRow = rowIndex % 2 === 0;

      result.styles[cellRef] = {
        font: { sz: 11 },
        fill: { fgColor: { rgb: isEvenRow ? 'F8FAFC' : 'FFFFFF' } },
        border: {
          top: { style: 'thin', color: { rgb: 'E2E8F0' } },
          left: { style: 'thin', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
          right: { style: 'thin', color: { rgb: 'E2E8F0' } }
        }
      };

      // Стили для числовых колонок (выравнивание по правому краю)
      if (columns[colIndex].type === 'currency') {
        result.styles[cellRef].alignment = { horizontal: 'right' };

        // Форматирование числовых значений
        if (typeof value === 'number') {
          // Форматируем как число с двумя знаками после запятой
          result.data[rowIndex + 3][colIndex] = value;
        }
      }

      // Выравнивание по центру для текстовых колонок
      if (!columns[colIndex].type) {
        result.styles[cellRef].alignment = { horizontal: 'left' };
      }
    });
  });

  return result;
};

const applyStyles = (ws, styles, merges) => {
  // Применяем стили к ячейкам
  Object.keys(styles).forEach(cellRef => {
    if (!ws[cellRef]) ws[cellRef] = {};
    ws[cellRef].s = styles[cellRef];
  });

  // Применяем объединение ячеек
  if (merges && merges.length > 0) {
    if (ws['!merges']) {
      ws['!merges'] = ws['!merges'].concat(merges);
    } else {
      ws['!merges'] = merges;
    }
  }
};

const setColumnWidths = (ws, columns) => {
  const colWidths = columns.map(col => {
    // Базовая ширина в зависимости от типа данных
    let width = 12;
    if (col.key === 'contract' || col.key === 'client') width = 20;
    if (col.key === 'name') width = 30;
    if (col.key === 'dates_display') width = 25;
    if (col.type === 'currency') width = 15;
    return { width };
  });

  ws['!cols'] = colWidths;
};

// Специальная функция для экспорта баланса
export const exportBalanceToExcel = (balanceData, filename) => {
  const wb = XLSX.utils.book_new();
  const wsData = [];
  const styles = {};
  const merges = [];

  // Заголовок
  wsData.push(['Баланс по договорам']);
  styles['A1'] = {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '3B82F6' } },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } });

  wsData.push([]);

  // Заголовки секций
  const sectionHeaders = [
    'ДОХОДНЫЕ ДОГОВОРЫ', '', '', '',
    'РАСХОДНЫЕ ДОГОВОРЫ', '', '',
    'САЛЬДО', ''
  ];
  wsData.push(sectionHeaders);

  sectionHeaders.forEach((_, index) => {
    const cellRef = XLSX.utils.encode_cell({ r: 2, c: index });
    let bgColor = '3B82F6'; // синий для доходных
    if (index >= 4 && index <= 6) bgColor = '10B981'; // зеленый для расходных
    if (index >= 7) bgColor = 'F59E0B'; // оранжевый для сальдо

    styles[cellRef] = {
      font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: bgColor } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  });

  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: 3 } });
  merges.push({ s: { r: 2, c: 4 }, e: { r: 2, c: 6 } });
  merges.push({ s: { r: 2, c: 7 }, e: { r: 2, c: 8 } });

  // Подзаголовки колонок
  const columnHeaders = [
    'Договор', 'Контрагент', 'Сумма', 'Оплачено',
    'Договор', 'Сумма', 'Оплачено',
    'Стоимость', 'Оплачено'
  ];
  wsData.push(columnHeaders);

  columnHeaders.forEach((_, index) => {
    const cellRef = XLSX.utils.encode_cell({ r: 3, c: index });
    let bgColor = '3B82F6';
    if (index >= 4 && index <= 6) bgColor = '10B981';
    if (index >= 7) bgColor = 'F59E0B';

    styles[cellRef] = {
      font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: bgColor } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        top: { style: 'thin', color: { rgb: 'FFFFFF' } },
        left: { style: 'thin', color: { rgb: 'FFFFFF' } },
        bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
        right: { style: 'thin', color: { rgb: 'FFFFFF' } }
      }
    };
  });

  // Данные
  let rowIndex = 4;
  balanceData.forEach((item, itemIndex) => {
    // Основная строка с доходным договором
    const mainRow = [
      item.income_contract.number,
      item.income_contract.client,
      parseFloat(item.income_contract.amount),
      parseFloat(item.income_contract.paid)
    ];

    // Данные расходных договоров
    if (item.expense_contracts.length > 0) {
      mainRow.push(
        item.expense_contracts[0].number,
        parseFloat(item.expense_contracts[0].amount),
        parseFloat(item.expense_contracts[0].paid)
      );
    } else {
      mainRow.push('', '', '');
    }

    // Сальдо
    const balanceAmount = parseFloat(item.income_contract.amount) - parseFloat(item.total_expense);
    const balancePaid = parseFloat(item.income_contract.paid) - parseFloat(item.total_paid);
    mainRow.push(balanceAmount, balancePaid);

    wsData.push(mainRow);

    // Стили для основной строки
    mainRow.forEach((_, colIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      styles[cellRef] = {
        font: { sz: 11 },
        fill: { fgColor: { rgb: 'F8FAFC' } },
        border: {
          top: { style: 'thin', color: { rgb: 'E2E8F0' } },
          left: { style: 'thin', color: { rgb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
          right: { style: 'thin', color: { rgb: 'E2E8F0' } }
        }
      };

      // Выравнивание числовых колонок
      if ([2, 3, 5, 6, 7, 8].includes(colIndex)) {
        styles[cellRef].alignment = { horizontal: 'right' };
      }

      // Цвет для сальдо
      if (colIndex >= 7) {
        const value = colIndex === 7 ? balanceAmount : balancePaid;
        styles[cellRef].font.color = { rgb: value >= 0 ? '059669' : 'DC2626' };
        styles[cellRef].font.bold = true;
      }
    });

    rowIndex++;

    // Дополнительные строки для расходных договоров
    item.expense_contracts.slice(1).forEach((expense) => {
      const expenseRow = ['', '', '', '', expense.number, parseFloat(expense.amount), parseFloat(expense.paid), '', ''];
      wsData.push(expenseRow);

      expenseRow.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
        styles[cellRef] = {
          font: { sz: 11 },
          fill: { fgColor: { rgb: 'FFFFFF' } },
          border: {
            top: { style: 'thin', color: { rgb: 'E2E8F0' } },
            left: { style: 'thin', color: { rgb: 'E2E8F0' } },
            bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
            right: { style: 'thin', color: { rgb: 'E2E8F0' } }
          }
        };

        if ([5, 6].includes(colIndex)) {
          styles[cellRef].alignment = { horizontal: 'right' };
        }
      });

      rowIndex++;
    });

    // Разделитель между договорами
    if (itemIndex < balanceData.length - 1) {
      wsData.push(Array(9).fill(''));
      const dividerRowIndex = rowIndex;
      styles[XLSX.utils.encode_cell({ r: dividerRowIndex, c: 0 })] = {
        fill: { fgColor: { rgb: 'E5E7EB' } }
      };
      merges.push({ s: { r: dividerRowIndex, c: 0 }, e: { r: dividerRowIndex, c: 8 } });
      rowIndex++;
    }
  });

  // Итоговая строка
  const totalIncomeAmount = balanceData.reduce((sum, item) => sum + parseFloat(item.income_contract.amount), 0);
  const totalIncomePaid = balanceData.reduce((sum, item) => sum + parseFloat(item.income_contract.paid), 0);
  const totalExpenseAmount = balanceData.reduce((sum, item) => sum + parseFloat(item.total_expense), 0);
  const totalExpensePaid = balanceData.reduce((sum, item) => sum + parseFloat(item.total_paid), 0);
  const totalBalanceAmount = totalIncomeAmount - totalExpenseAmount;
  const totalBalancePaid = totalIncomePaid - totalExpensePaid;

  const totalRow = [
    'ОБЩИЙ БАЛАНС:', '', totalIncomeAmount, totalIncomePaid,
    '', totalExpenseAmount, totalExpensePaid,
    totalBalanceAmount, totalBalancePaid
  ];
  wsData.push(totalRow);

  totalRow.forEach((_, colIndex) => {
    const cellRef = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
    styles[cellRef] = {
      font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '1D4ED8' } },
      alignment: { horizontal: colIndex >= 2 ? 'right' : 'left' },
      border: {
        top: { style: 'thin', color: { rgb: 'FFFFFF' } },
        left: { style: 'thin', color: { rgb: 'FFFFFF' } },
        bottom: { style: 'thin', color: { rgb: 'FFFFFF' } },
        right: { style: 'thin', color: { rgb: 'FFFFFF' } }
      }
    };

    if (colIndex >= 7) {
      const value = colIndex === 7 ? totalBalanceAmount : totalBalancePaid;
      styles[cellRef].font.color = { rgb: value >= 0 ? '10B981' : 'EF4444' };
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  applyStyles(ws, styles, merges);

  // Настройка ширины колонок
  ws['!cols'] = [
    { width: 20 }, { width: 25 }, { width: 15 }, { width: 15 },
    { width: 20 }, { width: 15 }, { width: 15 },
    { width: 15 }, { width: 15 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Баланс');
  XLSX.writeFile(wb, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
};