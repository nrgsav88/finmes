import React, { useState, useEffect } from 'react';
import './Modal.css';

const UsersModal = ({ isOpen, onClose, onUserAction }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    password: '',
    role: 'Экономика'
  });

  // Загрузка пользователей при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError('Ошибка при загрузке пользователей');
      }
    } catch (err) {
      setError('Ошибка сети при загрузке пользователей');
    } finally {
      setLoading(false);
    }
  };

  // Проверка, является ли пользователь администратором системы
  const isSystemAdmin = (user) => {
    return user.role === 'Администратор системы' || user.username === 'admin';
  };

  // Проверка, активен ли пользователь
  const isUserActive = (user) => {
    return user.is_active !== false;
  };

  // Проверка, можно ли редактировать пользователя
  const canEditUser = (user) => {
    return isUserActive(user);
  };

  // Проверка, можно ли удалить пользователя
  const canDeleteUser = (user) => {
    return isUserActive(user) && !isSystemAdmin(user);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserForm.username || !newUserForm.password) {
      setError('Логин и пароль обязательны');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUserForm),
      });

      const result = await response.json();

      if (response.ok) {
        setNewUserForm({ username: '', password: '', role: 'Экономика' });
        fetchUsers();
        onUserAction(`Пользователь ${newUserForm.username} создан`);
        setError('');
      } else {
        setError(result.error || 'Ошибка при создании пользователя');
      }
    } catch (err) {
      setError('Ошибка сети при создании пользователя');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser.username) {
      setError('Логин обязателен');
      return;
    }

    // Запрещаем изменение роли для администратора системы
    const originalUser = users.find(u => u.id === editingUser.id);
    if (isSystemAdmin(originalUser) && originalUser.role !== editingUser.role) {
      setError('Нельзя изменять роль администратора системы');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: editingUser.username,
          role: editingUser.role,
          ...(editingUser.password && { password: editingUser.password })
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setEditingUser(null);
        fetchUsers();
        onUserAction(`Пользователь ${editingUser.username} обновлен`);
        setError('');
      } else {
        setError(result.error || 'Ошибка при обновлении пользователя');
      }
    } catch (err) {
      setError('Ошибка сети при обновлении пользователя');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    const user = users.find(u => u.id === userId);

    // Запрещаем удаление администратора системы и неактивных пользователей
    if (!canDeleteUser(user)) {
      if (isSystemAdmin(user)) {
        setError('Нельзя удалить администратора системы');
      } else {
        setError('Нельзя удалить удаленного пользователя');
      }
      return;
    }

    if (!window.confirm(`Вы уверены, что хотите удалить пользователя ${username}?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchUsers();
        onUserAction(`Пользователь ${username} удален`);
      } else {
        const result = await response.json();
        setError(result.error || 'Ошибка при удалении пользователя');
      }
    } catch (err) {
      setError('Ошибка сети при удалении пользователя');
    } finally {
      setLoading(false);
    }
  };

  const handleNewUserChange = (e) => {
    setNewUserForm({
      ...newUserForm,
      [e.target.name]: e.target.value
    });
  };

  const handleEditUserChange = (e) => {
    setEditingUser({
      ...editingUser,
      [e.target.name]: e.target.value
    });
  };

  const startEditing = (user) => {
    // Запрещаем редактирование неактивных пользователей
    if (!isUserActive(user)) {
      setError('Нельзя редактировать удаленного пользователя');
      return;
    }
    setEditingUser({ ...user, password: '' });
  };

  const cancelEditing = () => {
    setEditingUser(null);
  };

  if (!isOpen) return null;

  const roles = ['Экономика', 'ПТС', 'Кап. строй', 'МЭС'];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content extra-wide-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Управление пользователями</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          {/* Форма создания нового пользователя */}
          <div className="user-form-section">
            <h3>Создать нового пользователя</h3>
            <form onSubmit={handleCreateUser} className="user-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="new_username">Логин *</label>
                  <input
                    type="text"
                    id="new_username"
                    name="username"
                    value={newUserForm.username}
                    onChange={handleNewUserChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new_password">Пароль *</label>
                  <input
                    type="password"
                    id="new_password"
                    name="password"
                    value={newUserForm.password}
                    onChange={handleNewUserChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new_role">Роль</label>
                  <select
                    id="new_role"
                    name="role"
                    value={newUserForm.role}
                    onChange={handleNewUserChange}
                  >
                    {roles.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <button type="submit" className="btn-primary" disabled={loading}>
                    Создать
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Список пользователей */}
            <div className="users-list-section">
              <h3>Список пользователей</h3>
              {loading ? (
                <div className="loading">Загрузка...</div>
              ) : (
                <div className="users-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>Логин</th>
                        <th style={{ width: '25%' }}>Роль</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>Статус</th>
                        <th style={{ width: '35%', textAlign: 'center' }}>Действия</th> {/* Добавляем textAlign: 'center' */}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => {
                        const systemAdmin = isSystemAdmin(user);
                        const userActive = isUserActive(user);
                        const canEdit = canEditUser(user);
                        const canDelete = canDeleteUser(user);

                        return (
                          <tr key={user.id} className={!userActive ? 'inactive-user' : ''}>
                            {editingUser && editingUser.id === user.id ? (
                              <>
                                <td>
                                  <input
                                    type="text"
                                    name="username"
                                    value={editingUser.username}
                                    onChange={handleEditUserChange}
                                    className="edit-input"
                                  />
                                </td>
                                <td>
                                  <select
                                    name="role"
                                    value={editingUser.role}
                                    onChange={handleEditUserChange}
                                    className="edit-select"
                                    disabled={systemAdmin}
                                  >
                                    {roles.map(role => (
                                      <option key={role} value={role}>{role}</option>
                                    ))}
                                  </select>
                                  {systemAdmin && (
                                    <div className="admin-note">
                                      Роль администратора системы нельзя изменить
                                    </div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="password"
                                    name="password"
                                    value={editingUser.password}
                                    onChange={handleEditUserChange}
                                    placeholder="Новый пароль"
                                    className="edit-input"
                                  />
                                  {systemAdmin && (
                                    <div className="admin-note">
                                      Можно изменить пароль
                                    </div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}> {/* Добавляем выравнивание по центру */}
                                  <div className="action-buttons">
                                    <button
                                      onClick={handleUpdateUser}
                                      className="btn-primary small-btn"
                                      disabled={loading}
                                    >
                                      Сохранить
                                    </button>
                                    <button
                                      onClick={cancelEditing}
                                      className="btn-secondary small-btn"
                                    >
                                      Отмена
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td>
                                  <div className="username-cell">
                                    {user.username}
                                    {systemAdmin && (
                                      <span className="admin-badge">Админ</span>
                                    )}
                                    {!userActive && (
                                      <span className="deleted-badge">Удален</span>
                                    )}
                                  </div>
                                </td>
                                <td>{user.role}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className={`status-badge ${userActive ? 'active' : 'deleted'}`}>
                                    {userActive ? 'Активен' : 'Удален'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}> {/* Добавляем выравнивание по центру */}
                                  <div className="action-buttons">
                                    <button
                                      onClick={() => startEditing(user)}
                                      className="btn-primary small-btn"
                                      disabled={!canEdit || loading}
                                      title={!canEdit ? 'Нельзя редактировать удаленного пользователя' : systemAdmin ? 'Можно изменить пароль' : ''}
                                    >
                                      Редактировать
                                    </button>
                                    <button
                                      onClick={() => handleDeleteUser(user.id, user.username)}
                                      className="btn-danger small-btn"
                                      disabled={!canDelete || loading}
                                      title={!canDelete ? (systemAdmin ? 'Нельзя удалить администратора системы' : 'Нельзя удалить удаленного пользователя') : ''}
                                    >
                                      Удалить
                                    </button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default UsersModal;