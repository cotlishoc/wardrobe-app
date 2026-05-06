import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';

// Импорт страниц
import Wardrobe from './pages/Wardrobe';
import UploadItem from './pages/UploadItem';
import Capsules from './pages/Capsules';
import AllCapsules from './pages/AllCapsules';
import Account from './pages/Account';
import Auth from './pages/Auth';
import EditItem from './pages/EditItem';
import Preview from './pages/Preview';

// Импорт компонентов и стилей
import BottomNav from './components/BottomNav';
import './App.css';

// 1. Создаем внутренний компонент для логики
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Проверка авторизации
  useEffect(() => {
    const loggedIn = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(loggedIn);
  }, []);

  // Слушатель кнопки "Назад" для Android
  useEffect(() => {
    const backListener = CapApp.addListener('backButton', () => {
      // Список страниц, с которых нажатие "Назад" выводит из приложения
      const rootPages = ['/wardrobe', '/login'];
      
      if (rootPages.includes(location.pathname)) {
        CapApp.exitApp();
      } else {
        navigate(-1);
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [location, navigate]);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    setIsAuthenticated(false);
  };

  return (
    <div className="app-container">
      <div className="content">
        <Routes>
          {!isAuthenticated ? (
            <>
              <Route path="/login" element={<Auth onLogin={handleLogin} />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </>
          ) : (
            <>
              {/* По твоему запросу: при входе открывается Preview (Примерочная) */}
              <Route path="/" element={<Navigate to="/wardrobe" />} />
              <Route path="/preview" element={<Preview />} />
              
              <Route path="/wardrobe" element={<Wardrobe />} />
              <Route path="/item/:id" element={<EditItem />} />
              <Route path="/upload" element={<UploadItem />} />
              
              <Route path="/capsules" element={<AllCapsules />} />
              <Route path="/capsules/create" element={<Capsules />} />
              <Route path="/capsules/:id" element={<Capsules />} />
              
              <Route path="/account" element={<Account onLogout={handleLogout} />} />
              <Route path="*" element={<Navigate to="/wardrobe" />} />
            </>
          )}
        </Routes>
      </div>
      {isAuthenticated && <BottomNav />}
    </div>
  );
}

// 2. Главный компонент оборачивает всё в Router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;