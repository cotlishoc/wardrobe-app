import { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import './styles/Auth.css';

function Auth({ onLogin: syncAuthStatus }) {
  const navigate = useNavigate();

  const [isNewUser, setIsNewUser] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    
    try {
      if (isNewUser) {
        // Регистрация нового аккаунта
        await api.post('/users/', { email, password, name });
        alert("Регистрация успешна! Теперь войдите.");
        setIsNewUser(false);
      } else {
        // Авторизация
        const { data } = await api.post('/login', { email, password });
        
        // Сохраняем сессию
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userId', data.user_id);
        localStorage.setItem('userName', data.name || 'User'); 
        localStorage.setItem('userEmail', data.email);
        
        syncAuthStatus();
        navigate('/wardrobe');
      }
    } catch (err) {
      console.error('Auth error:', err);
      const msg = err.response?.data?.detail || "Ошибка доступа. Проверьте данные.";
      alert(msg);
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

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ 
          margin: 0, 
          color: 'var(--primary-green)', 
          fontSize: '28px', 
          fontWeight: '800',
          letterSpacing: '-0.5px'
        }}>
          WardrobeApp
        </h1>
        <p style={{ color: '#aaa', fontSize: '14px', marginTop: '5px' }}>
          {isNewUser ? 'Создайте аккаунт для начала' : 'Ваш персональный ИИ-стилист'}
        </p>
      </div>

      {/* свич */}
      <div style={{ 
        display: 'flex', 
        background: 'var(--light-green)', 
        padding: '5px', 
        borderRadius: '15px',
        marginBottom: '30px'
      }}>
        <button 
          onClick={() => setIsNewUser(false)}
          type="button"
          style={{
            flex: 1, border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold',
            background: !isNewUser ? 'var(--primary-green)' : 'transparent',
            color: !isNewUser ? 'white' : 'var(--primary-green)',
            transition: '0.3s',
            cursor: 'pointer'
          }}
        >
          Вход
        </button>
        <button 
          onClick={() => setIsNewUser(true)}
          type="button"
          style={{
            flex: 1, border: 'none', padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold',
            background: isNewUser ? 'var(--primary-green)' : 'transparent',
            color: isNewUser ? 'white' : 'var(--primary-green)',
            transition: '0.3s',
            cursor: 'pointer'
          }}
        >
          Регистрация
        </button>
      </div>

      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {isNewUser && (
          <div className="input-group">
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)', marginLeft: '10px' }}>ИМЯ</label>
            <input 
              type="text" 
              placeholder="Как вас зовут?" 
              className="custom-input"
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
            />
          </div>
        )}

        <div className="input-group">
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)', marginLeft: '10px' }}>EMAIL</label>
          <input 
            type="email" 
            placeholder="example@mail.com" 
            className="custom-input"
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            required
          />
        </div>

        <div className="input-group">
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)', marginLeft: '10px' }}>ПАРОЛЬ</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPwd ? "text" : "password"} 
              placeholder="••••••••" 
              className="custom-input"
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required
              style={{ paddingRight: '50px' }}
            />
            <button 
              type="button"
              onClick={() => setShowPwd(!showPwd)}
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
              {showPwd ? '👁️' : '🙈'} 
            </button>
          </div>
        </div>

        <button type="submit" className="auth-btn btn-primary" style={{ marginTop: '20px', fontSize: '16px' }}>
          {isNewUser ? 'Зарегистрироваться' : 'Войти в аккаунт'}
        </button>
      </form>
    </div>
  );
}

export default Auth;