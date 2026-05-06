import { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

function Auth({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Состояние для видимости пароля
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await api.post('/users/', { email, password, name });
        alert("Регистрация успешна! Теперь войдите.");
        setIsRegister(false);
      } else {
        const response = await api.post('/login', { email, password });
        localStorage.setItem('token', response.data.access_token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userId', response.data.user_id);
        localStorage.setItem('userName', response.data.name || 'User'); 
        localStorage.setItem('userEmail', response.data.email);
        onLogin();
        navigate('/wardrobe');
      }
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.detail || "Ошибка входа или регистрации");
    }
  };

  return (
    <div className="page-padding" style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      minHeight: '100dvh',
      backgroundColor: '#fff'
    }}>
      
      {/* ЛОГОТИП / ПРИВЕТСТВИЕ */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ 
          fontSize: '50px', 
          marginBottom: '10px',
          filter: 'drop-shadow(0 4px 10px rgba(52, 94, 55, 0.1))' 
        }}>👗</div>
        <h1 style={{ 
          margin: 0, 
          color: 'var(--primary-green)', 
          fontSize: '28px', 
          fontWeight: '800',
          letterSpacing: '-0.5px'
        }}>
          Smart Closet
        </h1>
        <p style={{ color: '#aaa', fontSize: '14px', marginTop: '5px' }}>
          {isRegister ? 'Создайте аккаунт для начала' : 'Ваш персональный ИИ-стилист'}
        </p>
      </div>

      {/* ПЕРЕКЛЮЧАТЕЛЬ (TABS) */}
      <div style={{ 
        display: 'flex', 
        background: 'var(--light-green)', 
        padding: '5px', 
        borderRadius: '15px',
        marginBottom: '30px'
      }}>
        <button 
          onClick={() => setIsRegister(false)}
          style={{
            flex: 1, border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold',
            background: !isRegister ? 'var(--primary-green)' : 'transparent',
            color: !isRegister ? 'white' : 'var(--primary-green)', // Исправлено здесь
            transition: '0.3s'
          }}
        >
          Вход
        </button>
        <button 
          onClick={() => setIsRegister(true)}
          style={{
            flex: 1, border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold',
            background: isRegister ? 'var(--primary-green)' : 'transparent',
            color: isRegister ? 'white' : 'var(--primary-green)',
            transition: '0.3s'
          }}
        >
          Регистрация
        </button>
      </div>

      {/* ФОРМА */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {isRegister && (
          <div className="input-group">
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)', marginLeft: '10px' }}>ИМЯ</label>
            <input 
              type="text" placeholder="Как вас зовут?" className="custom-input"
              value={name} onChange={e => setName(e.target.value)} required
            />
          </div>
        )}

        <div className="input-group">
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)', marginLeft: '10px' }}>EMAIL</label>
          <input 
            type="email" placeholder="example@mail.com" className="custom-input"
            value={email} onChange={e => setEmail(e.target.value)} required
          />
        </div>

        <div className="input-group">
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)', marginLeft: '10px' }}>ПАРОЛЬ</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPassword ? "text" : "password"} // Переключение типа поля
              placeholder="••••••••" 
              className="custom-input"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
              style={{ paddingRight: '50px' }} // Отступ для иконки
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '15px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '18px',
                color: 'var(--primary-green)',
                opacity: 0.7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {showPassword ? '👁️' : '🙈'} 
            </button>
          </div>
        </div>

        <button type="submit" className="auth-btn btn-primary" style={{ marginTop: '20px', fontSize: '16px' }}>
          {isRegister ? 'Зарегистрироваться' : 'Войти в аккаунт'}
        </button>
      </form>
    </div>
  );
}

export default Auth;