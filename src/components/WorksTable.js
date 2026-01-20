import React, { useState, useEffect, useCallback } from 'react';

const WorksTable = React.memo(({
  contractId,
  onDataUpdate
}) => {
  const [works, setWorks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Загрузка данных при монтировании
  useEffect(() => {
    if (contractId) {
      fetchWorks();
    }
  }, [contractId]);

  const fetchWorks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/expense-contracts/${contractId}/closed-works`);
      if (response.ok) {
        const data = await response.json();
        setWorks(data);
      } else {
        setError('Ошибка при загрузке данных');
      }
    } catch (err) {
      setError('Ошибка сети при загрузке данных');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWork = async (workId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот акт?')) {
      return;
    }

    try {
      // Оптимистичное обновление
      setWorks(prevWorks => prevWorks.filter(work => work.id !== workId));

      const response = await fetch(`/api/expense-contracts/${contractId}/closed-works/${workId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Если ошибка - возвращаем обратно и перезагружаем
        const result = await response.json();
        setError(result.error || 'Ошибка при удалении акта');
        fetchWorks();
      } else {
        // Уведомляем родительский компонент об обновлении
        if (onDataUpdate) {
          onDataUpdate();
        }
      }
    } catch (err) {
      setError('Ошибка сети при удалении акта');
      fetchWorks();
    }
  };

  const handleFilePreview = useCallback((work) => {
    if (work.file_url) {
      // Здесь можно открыть модальное окно предпросмотра
      window.open(work.file_url, '_blank');
    }
  }, []);

  const handleDownloadFile = useCallback((work) => {
    if (work.file_url) {
      const downloadUrl = work.file_url + '?download=true';
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = work.file_name || 'document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, []);

  const formatCurrency = useCallback((value) => {
    if (value === null || value === undefined) return '0 ₽';
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + ' ₽';
  }, []);

  const calculateTotal = useCallback(() => {
    return works.reduce((total, work) => total + (parseFloat(work.amount) || 0), 0);
  }, [works]);

  if (loading) {
    return <div className="loading">Загрузка актов...</div>;
  }

  return (
    <div className="works-list-section">
      <h3>Список актов КС</h3>
      {error && <div className="form-error" style={{ marginBottom: '15px' }}>{error}</div>}
      <div className="works-table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Акт КС</th>
              <th>Дата</th>
              <th>Сумма</th>
              <th>Файл</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {works.map(work => (
              <WorkRow
                key={work.id}
                work={work}
                onDeleteWork={handleDeleteWork}
                onFilePreview={handleFilePreview}
                onDownloadFile={handleDownloadFile}
                formatCurrency={formatCurrency}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td colSpan="2" className="total-label">ИТОГО:</td>
              <td className="total-value">{formatCurrency(calculateTotal())}</td>
              <td></td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {works.length === 0 && (
          <div className="empty-state">
            <p>Нет добавленных актов КС</p>
          </div>
        )}
      </div>
    </div>
  );
});

const WorkRow = React.memo(({ work, onDeleteWork, onFilePreview, onDownloadFile, formatCurrency }) => {
  return (
    <tr>
      <td>{work.act_number}</td>
      <td>{work.act_date}</td>
      <td>{formatCurrency(work.amount)}</td>
      <td>
        {work.file_url ? (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
            <button
              onClick={() => onFilePreview(work)}
              className="btn-primary small-btn"
              style={{ padding: '4px 8px', fontSize: '12px' }}
              title="Просмотреть PDF"
            >
              👁️ Просмотр
            </button>
            <button
              onClick={() => onDownloadFile(work)}
              className="btn-secondary small-btn"
              style={{ padding: '4px 8px', fontSize: '12px' }}
              title="Скачать файл"
            >
              📥 Скачать
            </button>
          </div>
        ) : (
          <span style={{ color: '#a0aec0', fontSize: '12px' }}>Нет файла</span>
        )}
      </td>
      <td>
        <button
          onClick={() => onDeleteWork(work.id)}
          className="btn-danger small-btn"
        >
          Удалить
        </button>
      </td>
    </tr>
  );
});

export default WorksTable;