import React, { useState } from 'react';
import api from '../api';
import './styles/Account.css';

function Account({ onLogout }) {
  const cachedName = localStorage.getItem('userName') || 'Пользователь';
  const cachedEmail = localStorage.getItem('userEmail') || 'email@example.com';

  // Окно редактирования + стейт формы
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({
    name: cachedName,
    email: cachedEmail,
    current_password: '',
    new_password: ''
  });

  const firstLetter = cachedName ? cachedName.charAt(0).toUpperCase() : 'U';

  const sendProfileUpdate = async (evt) => {
    evt.preventDefault();
    
    if (!form.current_password.trim()) {
      alert("Введите текущий пароль для подтверждения изменений!");
      return;
    }

    try {
      const { data } = await api.put('/users/me', form);
      
      localStorage.setItem('userName', data.name);
      localStorage.setItem('userEmail', data.email);
      
      alert("Профиль успешно обновлен!");
      setShowEdit(false);
      setForm(old => ({ ...old, current_password: '', new_password: '' }));
      window.location.reload();
    } catch (err) {
      console.warn('Profile update failed:', err);
      const errMsg = err.response?.data?.detail || "Не удалось обновить профиль. Проверьте введенные данные.";
      alert(errMsg);
    }
  };

  return (
    <div className="page-padding" style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#f8f9fa' 
    }}>
      
      <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          padding: '40px 20px',
          background: 'linear-gradient(180deg, var(--light-green) 0%, #f8f9fa 100%)',
          borderRadius: '0 0 30px 30px',
          marginBottom: '20px'
      }}>
        <div style={{ 
            width: '100px', 
            height: '100px', 
            borderRadius: '50%', 
            backgroundColor: 'var(--primary-green)',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '40px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '15px',
            boxShadow: '0 8px 20px rgba(52, 94, 55, 0.2)',
            border: '4px solid white'
        }}>
          {firstLetter}
        </div>
        
        <h2 style={{ margin: 0, color: 'var(--primary-green)', fontSize: '24px' }}>{cachedName}</h2>
        <p style={{ color: '#888', marginTop: '5px', fontSize: '14px' }}>{cachedEmail}</p>
      </div>

      <div style={{ flex: 1, padding: '0 20px' }}>
        <div className="form-container" style={{ background: 'white', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <button 
              className="auth-btn" 
              onClick={() => setShowEdit(true)} 
              style={{ 
                background: 'var(--light-green)', 
                color: 'var(--primary-green)', 
                marginTop: '15px',
                fontWeight: 'bold',
                borderRadius: '14px',
                height: '45px',
                fontSize: '14px'
              }}
            >
              Редактировать профиль
            </button>
        </div>
      </div>

      <div style={{ padding: '20px', paddingBottom: '120px' }}>
        <button 
          onClick={onLogout} 
          className="auth-btn"
          style={{ 
            background: '#fff0f0', 
            color: '#ff4d4d', 
            border: '2px solid #ff4d4d',
            fontWeight: 'bold',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(255, 77, 77, 0.1)'
          }}
        >
          <span style={{ marginRight: '10px' }}></span> Выйти из системы
        </button>
      </div>

      {showEdit && (
        <div className="filter-modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()} style={{ padding: '25px 20px', borderRadius: '24px' }}>
            <h3 style={{ marginBottom: '10px', color: 'var(--primary-green)' }}>Настройки профиля</h3>
            <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', marginBottom: '20px' }}>Измените необходимые личные данные</p>
            
            <form onSubmit={sendProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary-green)', marginLeft: '5px' }}>ИМЯ ПОЛЬЗОВАТЕЛЯ</label>
                <input type="text" className="custom-input" placeholder="Имя" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary-green)', marginLeft: '5px' }}>ЭЛЕКТРОННАЯ ПОЧТА</label>
                <input type="email" className="custom-input" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--primary-green)', marginLeft: '5px' }}>НОВЫЙ ПАРОЛЬ (ОПЦИОНАЛЬНО)</label>
                <input type="password" className="custom-input" placeholder="Оставьте пустым, если не хотите менять" value={form.new_password} onChange={e => setForm({...form, new_password: e.target.value})} />
              </div>

              <hr style={{ border: 'none', borderTop: '1px dashed #ddd', margin: '10px 0' }} />
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'red', marginLeft: '5px' }}>ТЕКУЩИЙ ПАРОЛЬ ДЛЯ ПОДТВЕРЖДЕНИЯ *</label>
                <input type="password" className="custom-input" placeholder="Введите ваш текущий пароль" value={form.current_password} onChange={e => setForm({...form, current_password: e.target.value})} required />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button type="button" className="auth-btn" onClick={() => setShowEdit(false)} style={{ background: '#f0f0f0', flex: 1 }}>Отмена</button>
                <button type="submit" className="auth-btn btn-primary" style={{ flex: 1.5 }}>Сохранить</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default Account;