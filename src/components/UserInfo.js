import React from 'react';

const UserInfo = ({ currentUser, onLogin, onLogout }) => {
  // Функция для отображения названия роли
  const getRoleDisplayName = (role) => {
    const roleNames = {
      'Экономика': 'Экономика',
      'ПТС': 'ПТС',
      'Кап. строй': 'Кап. строй',
      'МЭС': 'МЭС'
    };
    return roleNames[role] || role;
  };

  return (
    <div className="user-section">
      {currentUser ? (
        <div className="user-info">
          <div style={{ textAlign: 'right' }}>
            <p className="user-name">{currentUser.username}</p>
            <small style={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '12px',
              display: 'block',
              marginTop: '2px'
            }}>
              {getRoleDisplayName(currentUser.role)}
            </small>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            Выйти
          </button>
        </div>
      ) : (
        <button className="login-btn" onClick={onLogin}>
          Войти
        </button>
      )}
    </div>
  );
};

export default UserInfo;