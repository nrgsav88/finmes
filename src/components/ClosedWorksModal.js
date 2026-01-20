import React, { useState, useEffect, useCallback } from 'react';
import './Modal.css';

const ClosedWorksModal = ({ isOpen, onClose, contract, currentUser, onDataUpdate }) => {
  const [works, setWorks] = useState([]);
  const [newWork, setNewWork] = useState({
    act_number: '',
    act_date: '',
    amount: '',
    file: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewFile, setPreviewFile] = useState(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [uploadingFiles, setUploadingFiles] = useState({}); // Для отслеживания загрузки файлов

  // Загрузка актов при открытии модального окна
  useEffect(() => {
    if (isOpen && contract) {
      fetchWorks();
    }
  }, [isOpen, contract]);

  const fetchWorks = async () => {
    try {
      const response = await fetch(`/api/expense-contracts/${contract.id}/closed-works`);
      if (response.ok) {
        const data = await response.json();
        setWorks(data);
      } else {
        setError('Ошибка при загрузке данных');
      }
    } catch (err) {
      setError('Ошибка сети при загрузке данных');
    }
  };

  const handleAddWork = async (e) => {
    e.preventDefault();
    if (!newWork.act_number || !newWork.act_date || !newWork.amount) {
      setError('Все поля обязательны для заполнения');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const formData = new FormData();
      formData.append('act_number', newWork.act_number);
      formData.append('act_date', newWork.act_date);
      formData.append('amount', newWork.amount);
      if (newWork.file) {
        formData.append('file', newWork.file);
      }

      const response = await fetch(`/api/expense-contracts/${contract.id}/closed-works`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Сбрасываем форму
        setNewWork({ act_number: '', act_date: '', amount: '', file: null });

        // Оптимизированное обновление: добавляем новый акт локально
        setWorks(prevWorks => [...prevWorks, result.work]);

        // Обновляем основную таблицу (если нужно)
        if (onDataUpdate) {
          onDataUpdate();
        }
      } else {
        setError(result.error || 'Ошибка при добавлении акта');
      }
    } catch (err) {
      setError('Ошибка сети при добавлении акта');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWork = async (workId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот акт?')) {
      return;
    }

    try {
      // Оптимизация: сразу удаляем из UI, потом делаем запрос
      setWorks(prevWorks => prevWorks.filter(work => work.id !== workId));

      const response = await fetch(`/api/expense-contracts/${contract.id}/closed-works/${workId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Если ошибка - возвращаем обратно
        const result = await response.json();
        setError(result.error || 'Ошибка при удалении акта');
        // Перезагружаем данные
        fetchWorks();
      } else {
        // Обновляем основную таблицу (если нужно)
        if (onDataUpdate) {
          onDataUpdate();
        }
      }
    } catch (err) {
      setError('Ошибка сети при удалении акта');
      // Перезагружаем данные при ошибке сети
      fetchWorks();
    }
  };

  // Функция для добавления файла к существующему акту
  const handleAddFileToWork = async (workId, file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Пожалуйста, выберите файл в формате PDF');
      return;
    }

    try {
      setUploadingFiles(prev => ({ ...prev, [workId]: true }));

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/closed-works/${workId}/file`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        // Обновляем акт в локальном состоянии
        setWorks(prevWorks =>
          prevWorks.map(work =>
            work.id === workId
              ? { ...work, file_url: result.file_url, file_name: result.file_name }
              : work
          )
        );
      } else {
        setError(result.error || 'Ошибка при добавлении файла');
      }
    } catch (err) {
      setError('Ошибка сети при добавлении файла');
    } finally {
      setUploadingFiles(prev => ({ ...prev, [workId]: false }));
    }
  };

  const handleInputChange = (e) => {
    setNewWork({
      ...newWork,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      setNewWork({
        ...newWork,
        file: file
      });
    } else if (file) {
      setError('Пожалуйста, выберите файл в формате PDF');
      e.target.value = '';
    }
  };

  const handleFilePreview = useCallback((work) => {
    if (work.file_url) {
      setPreviewFile(work.file_url);
      setPreviewFileName(work.file_name || 'Документ.pdf');
    }
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewFile(null);
    setPreviewFileName('');
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

  // Если модалка закрыта - не рендерим ничего
  if (!isOpen) return null;

  return (
    <>
      {/* Основное модальное окно */}
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content extra-wide-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '1200px', width: '95%' }}>
          <div className="modal-header">
            <h2>Закрытые работы - {contract?.contract}</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>

          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            {/* Форма добавления нового акта */}
            <div className="works-form-section">
              <h3>Добавить новый акт КС</h3>
              <form onSubmit={handleAddWork} className="works-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="act_number">Акт КС *</label>
                    <input
                      type="text"
                      id="act_number"
                      name="act_number"
                      value={newWork.act_number}
                      onChange={handleInputChange}
                      placeholder="Номер акта"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="act_date">Дата *</label>
                    <input
                      type="date"
                      id="act_date"
                      name="act_date"
                      value={newWork.act_date}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="amount">Сумма *</label>
                    <input
                      type="number"
                      id="amount"
                      name="amount"
                      value={newWork.amount}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 2 }}>
                    <label htmlFor="file">Прикрепить PDF файл</label>
                    <input
                      type="file"
                      id="file"
                      name="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      style={{ padding: '8px' }}
                    />
                    {newWork.file && (
                      <div style={{ marginTop: '5px', fontSize: '12px', color: '#10b981' }}>
                        Выбран файл: {newWork.file.name}
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '25px' }}>
                      {loading ? 'Добавление...' : 'Добавить акт'}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Список актов */}
            <div className="works-list-section">
              <h3>Список актов КС</h3>
              <div className="works-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Акт КС</th>
                      <th style={{ width: '20%' }}>Дата</th>
                      <th style={{ width: '20%' }}>Сумма</th>
                      <th style={{ width: '20%', textAlign: 'center' }}>Файл</th>
                      <th style={{ width: '15%', textAlign: 'center' }}>Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {works.map(work => (
                      <tr key={work.id}>
                        <td>{work.act_number}</td>
                        <td>{work.act_date}</td>
                        <td>{formatCurrency(work.amount)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {work.file_url ? (
                            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleFilePreview(work)}
                                className="btn-primary small-btn"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                title="Просмотреть PDF"
                              >
                                👁️ Просмотр
                              </button>
                              <button
                                onClick={() => handleDownloadFile(work)}
                                className="btn-secondary small-btn"
                                style={{ padding: '4px 8px', fontSize: '12px' }}
                                title="Скачать файл"
                              >
                                📥 Скачать
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                              <span style={{ color: '#a0aec0', fontSize: '12px' }}>Нет файла</span>
                              <label className="file-upload-label" style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: uploadingFiles[work.id] ? 'not-allowed' : 'pointer',
                                background: uploadingFiles[work.id] ? '#9ca3af' : '#e5e7eb',
                                color: uploadingFiles[work.id] ? '#6b7280' : '#4b5563',
                                borderRadius: '4px',
                                display: 'inline-block',
                                whiteSpace: 'nowrap'
                              }}>
                                {uploadingFiles[work.id] ? 'Загрузка...' : '➕ Добавить'}
                                <input
                                  type="file"
                                  accept=".pdf"
                                  style={{ display: 'none' }}
                                  onChange={(e) => {
                                    const file = e.target.files[0];
                                    if (file) {
                                      handleAddFileToWork(work.id, file);
                                    }
                                    e.target.value = '';
                                  }}
                                  disabled={uploadingFiles[work.id]}
                                />
                              </label>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            onClick={() => handleDeleteWork(work.id)}
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
                        </td>
                      </tr>
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
          </div>
        </div>
      </div>

      {/* Модальное окно предпросмотра PDF - рендерится отдельно */}
      {previewFile && (
        <PdfPreviewModal
          previewFile={previewFile}
          previewFileName={previewFileName}
          onClose={handleClosePreview}
        />
      )}
    </>
  );
};

// Выносим модалку предпросмотра в отдельный компонент
const PdfPreviewModal = React.memo(({ previewFile, previewFileName, onClose }) => {
  const handleDownload = useCallback(() => {
    const downloadUrl = previewFile + '?download=true';
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = previewFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [previewFile, previewFileName]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content extra-wide-modal" onClick={(e) => e.stopPropagation()} style={{
        maxWidth: '90%',
        height: '90%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div className="modal-header">
          <h2>Просмотр документа: {previewFileName}</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleDownload}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              📥 Скачать
            </button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>
        <div className="modal-body" style={{
          flex: 1,
          padding: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <iframe
            src={previewFile}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '0 0 12px 12px'
            }}
            title={`PDF Preview - ${previewFileName}`}
          />
          <div style={{
            padding: '10px',
            background: '#f8f9fa',
            borderTop: '1px solid #e9ecef',
            textAlign: 'center',
            fontSize: '12px',
            color: '#6c757d'
          }}>
            Если PDF не отображается, используйте кнопку "Скачать" для просмотра файла
          </div>
        </div>
      </div>
    </div>
  );
});

export default ClosedWorksModal;