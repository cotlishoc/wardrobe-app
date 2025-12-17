import { NavLink } from 'react-router-dom';

function BottomNav() {
  return (
    <nav className="bottom-nav">
      {/* Используем NavLink, он сам добавляет класс 'active' */}
      <NavLink to="/wardrobe" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        гардероб
      </NavLink>
      
      <NavLink to="/capsules" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        капсулы
      </NavLink>
      
      <NavLink to="/account" className={({ isActive }) => isActive ? "nav-item active" : "nav-item"}>
        аккаунт
      </NavLink>
    </nav>
  );
}

export default BottomNav;