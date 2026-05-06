import React, { useState, useEffect } from 'react';

function Account({ onLogout }) {
  // ЧИТАЕМ ИЗ ПАМЯТИ
  const userName = localStorage.getItem('userName') || 'Пользователь';
  const userEmail = localStorage.getItem('userEmail') || 'email@example.com';

  // Получаем первую букву для аватара
  const avatarLetter = userName ? userName[0].toUpperCase() : 'U';

  return (
    <div className="page-padding" style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#f8f9fa' // Легкий фон для контраста
    }}>
      
      {/* ДЕКОРАТИВНАЯ ШАПКА ПРОФИЛЯ */}
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
          {avatarLetter}
        </div>
        
        <h2 style={{ margin: 0, color: 'var(--primary-green)', fontSize: '24px' }}>{userName}</h2>
        <p style={{ color: '#888', marginTop: '5px', fontSize: '14px' }}>{userEmail}</p>
      </div>


      {/* НИЖНЯЯ ЧАСТЬ С КНОПКОЙ */}
      {/* Добавляем padding-bottom: 120px чтобы кнопка гарантированно была выше BottomNav */}
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
          <span style={{ marginRight: '10px' }}>🚪</span> Выйти из системы
        </button>

      </div>

    </div>
  );
}

export default Account;