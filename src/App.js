import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DataTable from './components/DataTable';
import BalanceTable from './components/BalanceTable'; // Импортируем новый компонент
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('income');
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Проверяем текущего пользователя при загрузке
  useEffect(() => {
    const checkCurrentUser = async () => {
      try {
        const response = await fetch('/api/auth/current');
        if (response.ok) {
          const userData = await response.json();
          if (userData) {
            setUser(userData);
          }
        }
      } catch (error) {
        console.error('Ошибка при проверке пользователя:', error);
      }
    };

    checkCurrentUser();
  }, []);

  // Загрузка данных при смене вкладки
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch (activeTab) {
        case 'income':
          endpoint = '/api/income';
          break;
        case 'planning':
          endpoint = '/api/planning';
          break;
        case 'actual':
          endpoint = '/api/actual';
          break;
        case 'balance':
          endpoint = '/api/balance'; // Для баланса используем данные доходных договоров как основу
          break;
        default:
          endpoint = '/api/income';
      }

      const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();

          // Для баланса данные приходят в другом формате
          if (activeTab === 'balance') {
            setTableData(data.contracts || []);
          } else {
            setTableData(data);
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
      } finally {
        setLoading(false);
      }
    };

  // Функция для обновления данных таблицы
  const refreshTableData = () => {
    fetchData();
  };

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  return (
    <div className="App">
      <Header
        user={user}
        onLogin={handleLogin}
        onLogout={handleLogout}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onDataUpdate={refreshTableData}
      />

      {/* Рендерим разные компоненты в зависимости от активной вкладки */}
      {activeTab === 'balance' ? (
        <BalanceTable
          data={tableData}
          activeTab={activeTab}
          loading={loading}
          currentUser={user}
          onDataUpdate={refreshTableData}
        />
      ) : (
        <DataTable
          data={tableData}
          activeTab={activeTab}
          loading={loading}
          currentUser={user}
          onDataUpdate={refreshTableData}
        />
      )}
    </div>
  );
}

export default App;