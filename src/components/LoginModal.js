import React, { useState } from 'react';
import './Modal.css';

const LoginModal = ({ isOpen, onClose, onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        onLogin(result.user);
        setFormData({ username: '', password: '' });
        onClose();
      } else {
        setError(result.error || 'Ошибка при входе');
      }
    } catch (err) {
      setError('Ошибка сети при входе');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Вход в систему</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="form-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="username">Логин</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              autoComplete="username"
              placeholder="Введите логин"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              placeholder="Введите пароль"
            />
          </div>

          <div className="modal-footer">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </div>

          <div style={{
            textAlign: 'center',
            marginTop: '15px',
            fontSize: '12px',
            color: '#666',
            padding: '10px',
            background: '#f8f9fa',
            borderRadius: '5px'
          }}>
            <strong>Тестовые пользователи:</strong><br />
            economist / 123 (Экономика)<br />
            pts / 123 (ПТС)<br />
            kapstroy / 123 (Кап. строй)<br />
            mes / 123 (МЭС)<br />
            admin / 123 (Экономика)
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginModal;