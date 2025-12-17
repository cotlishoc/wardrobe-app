import { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false); // false = Вход, true = Регистрация
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Нужно только для регистрации
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isRegister) {
      // Логика РЕГИСТРАЦИИ
      try {
        await api.post('/users/', { email, password });
        alert("Регистрация успешна! Теперь войдите.");
        setIsRegister(false); // Переключаем на вкладку входа
      } catch (error) {
        alert("Ошибка регистрации (возможно email занят)");
      }
    } else {
      // Логика ВХОДА (Для MVP - просто имитация)
      // В реальном проекте тут должен быть запрос /login
      if (email && password) {
        // Сохраняем "флаг" что мы вошли
        localStorage.setItem('isAuthenticated', 'true');
        onLogin(); // Сообщаем App.js что вход выполнен
        navigate('/wardrobe');
      } else {
        alert("Введите данные");
      }
    }
  };

  return (
    <div className="auth-page">
      {/* Табы сверху */}
      <div className="auth-tabs">
        <div 
          className={`auth-tab ${!isRegister ? 'active' : ''}`} 
          onClick={() => setIsRegister(false)}
        >
          вход
        </div>
        <div 
          className={`auth-tab ${isRegister ? 'active' : ''}`} 
          onClick={() => setIsRegister(true)}
        >
          регистрация
        </div>
      </div>

      {/* Форма */}
      <form className="auth-form" onSubmit={handleSubmit}>
        <input 
          type="email" 
          placeholder="почта" 
          className="custom-input"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        
        {isRegister && (
          <input 
            type="text" 
            placeholder="Имя" 
            className="custom-input"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        )}

        <input 
          type="password" 
          placeholder="пароль" 
          className="custom-input"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        <button type="submit" className="auth-btn">
          {isRegister ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

export default Auth;