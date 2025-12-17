import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Wardrobe from './pages/Wardrobe';
import UploadItem from './pages/UploadItem';
import Capsules from './pages/Capsules';
import AllCapsules from './pages/AllCapsules';
import Account from './pages/Account';
import Auth from './pages/Auth';
import BottomNav from './components/BottomNav';
import EditItem from './pages/EditItem';
import './App.css';


function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Проверяем при загрузке, был ли вход
    const loggedIn = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(loggedIn);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <div className="app-container">
        <div className="content">
          <Routes>
            {/* Если не авторизован - показываем только страницу входа */}
            {!isAuthenticated ? (
              <>
                <Route path="/login" element={<Auth onLogin={handleLogin} />} />
                <Route path="*" element={<Navigate to="/login" />} />
              </>
            ) : (
              /* Если авторизован - показываем приложение */
              <>
                <Route path="/" element={<Navigate to="/wardrobe" />} />
                <Route path="/wardrobe" element={<Wardrobe />} />
                <Route path="/item/:id" element={<EditItem />} />
                <Route path="/upload" element={<UploadItem />} />
                <Route path="/capsules" element={<AllCapsules />} />
                <Route path="/capsules/create" element={<Capsules />} />
                <Route path="/capsules/:id" element={<Capsules />} />
                <Route path="/account" element={<Account onLogout={handleLogout} />} />
                {/* Если ввели ерунду в адрес - на гардероб */}
                <Route path="*" element={<Navigate to="/wardrobe" />} />
              </>
            )}
          </Routes>
        </div>

        {/* Нижнее меню показываем только если вошли в систему */}
        {isAuthenticated && <BottomNav />}
      </div>
    </Router>
  );
}

export default App;