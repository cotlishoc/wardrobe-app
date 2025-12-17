import { useState } from 'react';
import api from '../api'; // <-- Здесь это сработает!
import { useNavigate } from 'react-router-dom';

function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await api.post('/users/', { email, password });
        alert("Регистрация успешна! Теперь войдите.");
        setIsRegister(false);
      } else {
        // === ЛОГИКА ВХОДА ===
        const response = await api.post('/login', { email, password });
        
        console.log("Успешный вход:", response.data);
        
        // СОХРАНЯЕМ ТОКЕН!
        localStorage.setItem('token', response.data.access_token);
        
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userId', response.data.user_id); 
        
        onLogin(); 
        navigate('/wardrobe'); 
      }
    } catch (error) {
      console.error(error);
      if (error.response && error.response.status === 400) {
          alert("Ошибка: Неверная почта или пароль");
      } else if (isRegister && error.response) {
          alert("Ошибка регистрации. Возможно, пользователь уже существует.");
      } else {
          alert("Что-то пошло не так.");
      }
    }
  };

  return (
    <div className="auth-page">
      <h2 style={{fontSize: '24px', marginBottom: '30px', textAlign: 'center'}}>
        {isRegister ? 'Создать аккаунт' : 'Добро пожаловать'}
      </h2>

      <div className="auth-tabs">
        <div className={`auth-tab ${!isRegister ? 'active' : ''}`} onClick={() => setIsRegister(false)}>
          Вход
        </div>
        <div className={`auth-tab ${isRegister ? 'active' : ''}`} onClick={() => setIsRegister(true)}>
          Регистрация
        </div>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input 
          type="email" placeholder="Электронная почта" className="custom-input"
          value={email} onChange={e => setEmail(e.target.value)} required
        />
        {isRegister && (
          <input 
            type="text" placeholder="Имя" className="custom-input"
            value={name} onChange={e => setName(e.target.value)}
          />
        )}
        <input 
          type="password" placeholder="Пароль" className="custom-input"
          value={password} onChange={e => setPassword(e.target.value)} required
        />
        <button type="submit" className="auth-btn btn-primary" style={{marginTop: '20px'}}>
          {isRegister ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>
    </div>
  );
}

export default Auth;