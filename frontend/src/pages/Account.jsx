function Account({ onLogout }) {
  return (
    <div className="page-padding" style={{ width: '100%' }}>
      
      <div className="mb-20">
        <h2>Профиль</h2>
      </div>

      <div className="avatar-circle">
        {/* Заглушка для аватара */}
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" color="#345e37"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      </div>
      
      <div className="account-settings">
        <h3 style={{ fontSize: '18px', marginBottom: '15px' }}>Настройки</h3>
        
        {/* Кнопка выхода стилизованная под Danger (красноватая) или обычная */}
        <button 
          onClick={onLogout} 
          className="auth-btn btn-danger"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}

export default Account;