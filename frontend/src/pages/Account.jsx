import React from 'react';

function Account({ onLogout }) {
  // ЧИТАЕМ ИЗ ПАМЯТИ
  const userName = localStorage.getItem('userName') || 'Пользователь';
  const userEmail = localStorage.getItem('userEmail') || 'email@example.com';

  // Получаем первую букву для аватара
  const avatarLetter = userName ? userName[0].toUpperCase() : 'U';

  return (
    <div style={{ 
        height: '100%', 
        minHeight: '100%',
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'space-between'
    }}>
      
      {/* ВЕРХНЯЯ ЧАСТЬ */}
      <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          marginTop: '60px', 
          flex: 1
      }}>
        <div style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            backgroundColor: '#fff',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: '50px',
            color: 'var(--primary-green)',
            marginBottom: '20px',
            border: '2px solid var(--primary-green)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
        }}>
          {avatarLetter}
        </div>
        
        {/* ВЫВОДИМ ИМЯ */}
        <h2 style={{ margin: 0, color: 'var(--primary-green)' }}>{userName}</h2>
        
        {/* ВЫВОДИМ ПОЧТУ */}
        <p style={{ color: '#999', marginTop: '5px' }}>{userEmail}</p>
      </div>

      {/* НИЖНЯЯ ЧАСТЬ */}
      <div style={{ marginBottom: '20px', width: '100%' }}>
        <button 
          onClick={onLogout} 
          className="auth-btn"
          style={{ 
            background: 'white', 
            color: '#ff4d4d', 
            border: '1px solid #ff4d4d',
            fontWeight: '600'
          }}
        >
          Выйти из аккаунта
        </button>
      </div>

    </div>
  );
}

export default Account;