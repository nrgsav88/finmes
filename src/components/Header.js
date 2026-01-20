import React, { useState, useEffect } from 'react';
import ContractTypeModal from './ContractTypeModal';
import IncomeContractForm from './IncomeContractForm';
import ExpenseContractForm from './ExpenseContractForm';
import LoginModal from './LoginModal';
import UsersModal from './UsersModal';
import UserInfo from './UserInfo';

const Header = ({ user, onLogin, onLogout, activeTab, onTabChange, onDataUpdate }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [canCreateContract, setCanCreateContract] = useState(false);
  const [contractTypeModalOpen, setContractTypeModalOpen] = useState(false);
  const [incomeFormOpen, setIncomeFormOpen] = useState(false);
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [systemMessages, setSystemMessages] = useState([]);

  // Проверяем права пользователя
  useEffect(() => {
    const checkUserPermissions = async () => {
      if (user) {
        // Проверяем админа
        try {
          const response = await fetch('/api/auth/is-admin');
          if (response.ok) {
            const data = await response.json();
            setIsAdmin(data.is_admin);
          }
        } catch (error) {
          console.error('Ошибка при проверке прав администратора:', error);
        }

        // Проверяем возможность создания договоров
        const allowedRoles = ['Экономика', 'ПТС', 'Кап. строй', 'Администратор системы'];
        setCanCreateContract(allowedRoles.includes(user.role) || user.username === 'admin');
      } else {
        setIsAdmin(false);
        setCanCreateContract(false);
      }
    };

    checkUserPermissions();
  }, [user]);

  // Функция для добавления системного сообщения
  const addSystemMessage = (message, severity = 'info') => {
    const newMessage = {
      id: Date.now(),
      message,
      severity,
      timestamp: new Date().toLocaleTimeString()
    };

    setSystemMessages(prev => [newMessage, ...prev.slice(0, 4)]);

    setTimeout(() => {
      setSystemMessages(prev => prev.filter(msg => msg.id !== newMessage.id));
    }, 4000);
  };

  const handleUsersClick = () => {
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    setUsersModalOpen(true);
  };

  const handleLoginSuccess = (userData) => {
    setLoginModalOpen(false);
    onLogin(userData);
    addSystemMessage(`Пользователь ${userData.name} вошел в систему`, 'success');
  };

  const handleLogoutClick = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        const userName = user?.name || 'Пользователь';
        onLogout();
        addSystemMessage(`Пользователь ${userName} вышел из системы`, 'info');
      }
    } catch (error) {
      console.error('Ошибка при выходе:', error);
      addSystemMessage('Ошибка при выходе из системы', 'error');
    }
  };

  const handleNewContractClick = () => {
    if (!user) {
      setLoginModalOpen(true);
      return;
    }
    setContractTypeModalOpen(true);
  };

  const handleContractTypeSelect = (type) => {
    setContractTypeModalOpen(false);
    if (type === 'income') {
      setIncomeFormOpen(true);
    } else if (type === 'expense') {
      setExpenseFormOpen(true);
    }
  };

  const handleContractCreated = (contract) => {
    const contractType = contract.contract_number?.includes('ДГ') ? 'доходный' : 'расходный';
    addSystemMessage(`Создан ${contractType} договор: ${contract.contract_number}`, 'success');
    setIncomeFormOpen(false);
    setExpenseFormOpen(false);

    if (onDataUpdate) {
      onDataUpdate();
    }
  };

  const handleUserAction = (message) => {
    addSystemMessage(message, 'success');
  };

  const handleSystemMessageClose = (messageId) => {
    setSystemMessages(prev => prev.filter(msg => msg.id !== messageId));
  };

  const handleTabClick = (tabId) => {
    onTabChange(tabId);
  };

  return (
    <>
      <header className="App-header">
        <div className="header-left">
          {/* Кнопки слева: Новый договор и Пользователи */}
          {canCreateContract && (
            <button
              className="new-contract-btn"
              onClick={handleNewContractClick}
              style={{ marginRight: '10px' }}
            >
              Новый договор
            </button>
          )}

          {isAdmin && (
            <button
              className="new-contract-btn"
              onClick={handleUsersClick}
            >
              Пользователи
            </button>
          )}
        </div>

        <div className="header-center">
          <div className="header-title">
            <h1>Финансирование</h1>
          </div>

          {/* Кнопки вкладок в центре */}
          <div className="navigation-tabs">
            <button
              className={`nav-tab-button ${activeTab === 'income' ? 'active' : ''}`}
              onClick={() => handleTabClick('income')}
            >
              Доходные
            </button>
            <button
              className={`nav-tab-button ${activeTab === 'planning' ? 'active' : ''}`}
              onClick={() => handleTabClick('planning')}
            >
              Планирование
            </button>
            <button
              className={`nav-tab-button ${activeTab === 'actual' ? 'active' : ''}`}
              onClick={() => handleTabClick('actual')}
            >
              Фактическое
            </button>
            <button
              className={`nav-tab-button ${activeTab === 'balance' ? 'active' : ''}`}
              onClick={() => handleTabClick('balance')}
            >
              Баланс
            </button>
          </div>
        </div>

        <div className="header-right">
          {/* Информация о пользователе справа */}
          <UserInfo
            currentUser={user}
            onLogin={() => setLoginModalOpen(true)}
            onLogout={handleLogoutClick}
          />
        </div>
      </header>

      {/* Системные сообщения */}
      <div className="system-messages-container">
        {systemMessages.map((message) => (
          <div key={message.id} className={`system-message system-message-${message.severity}`}>
            <div className="system-message-content">
              <span className="system-message-text">{message.message}</span>
              <span className="system-message-time">{message.timestamp}</span>
            </div>
            <button
              className="system-message-close"
              onClick={() => handleSystemMessageClose(message.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Модальное окно выбора типа договора */}
      <ContractTypeModal
        isOpen={contractTypeModalOpen}
        onClose={() => setContractTypeModalOpen(false)}
        onSelect={handleContractTypeSelect}
      />

      {/* Форма создания доходного договора */}
      <IncomeContractForm
        isOpen={incomeFormOpen}
        onClose={() => setIncomeFormOpen(false)}
        onSubmit={handleContractCreated}
      />

      {/* Форма создания расходного договора */}
      <ExpenseContractForm
        isOpen={expenseFormOpen}
        onClose={() => setExpenseFormOpen(false)}
        onSubmit={handleContractCreated}
      />

      {/* Модальное окно входа */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLogin={handleLoginSuccess}
      />

      {/* Модальное окно управления пользователями */}
      <UsersModal
        isOpen={usersModalOpen}
        onClose={() => setUsersModalOpen(false)}
        onUserAction={handleUserAction}
      />
    </>
  );
};

export default Header;