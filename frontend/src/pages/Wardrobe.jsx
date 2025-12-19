import { useEffect, useState } from 'react';
import api from '../api';
import { Link, useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect'; // Используем его же для фильтра!
import { API_URL } from '../config';

function Wardrobe() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  
  // Состояния для поиска и фильтров
  const [searchText, setSearchText] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Значения фильтров
  const [filterCategory, setFilterCategory] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterStyle, setFilterStyle] = useState('');

  useEffect(() => {
    api.get('/items/')
      .then(res => {
        // ПРОВЕРКА: Если пришел массив - сохраняем, если нет - ставим пустой список
        if (Array.isArray(res.data)) {
            setItems(res.data);
        } else {
            console.error("Ошибка: с сервера пришел не массив!", res.data);
            setItems([]); 
        }
      })
      .catch(err => {
          console.error(err);
          setItems([]); // При ошибке тоже пустой список, чтобы не было белого экрана
      });
  }, []);

  // === ЛОГИКА ФИЛЬТРАЦИИ ===
  // Добавляем защиту "Array.isArray(items)" на всякий случай
  const filteredItems = Array.isArray(items) ? items.filter(item => {
    // ... твой код фильтров ...
    if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterCategory && item.category !== filterCategory) return false;
    if (filterColor && item.color !== filterColor) return false;
    if (filterSeason && item.season !== filterSeason) return false;
    if (filterStyle && item.style !== filterStyle) return false;
    return true;
  }) : [];

  // Сброс всех фильтров
  const clearFilters = () => {
    setFilterCategory('');
    setFilterColor('');
    setFilterSeason('');
    setFilterStyle('');
    setIsFilterOpen(false);
  };

  // Счетчик активных фильтров (для красоты)
  const activeFiltersCount = [filterCategory, filterColor, filterSeason, filterStyle].filter(Boolean).length;

  return (
    <div className="page-padding" style={{ position: 'relative' }}>
      
      {/* Верхняя панель */}
      <div className="top-bar">
        <div className="search-container">
          {/* Иконка лупы */}
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Поиск..." 
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Link to="/upload" className="add-btn-circle">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </Link>
      </div>

      {/* Кнопка фильтров (Chip) */}
      <button 
        className="filter-chip" 
        onClick={() => setIsFilterOpen(true)}
        style={{backgroundColor: activeFiltersCount > 0 ? '#000' : '#e0e0e0', color: activeFiltersCount > 0 ? '#fff' : '#000'}}
      >
        Фильтры {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''} 
        <span style={{marginLeft: '5px'}}>▼</span>
      </button>

      {/* Сетка */}
      <div className="grid">
        {/* ... тут без изменений ... */}
        {filteredItems.map(item => (
          <div 
            key={item.id} 
            className="card" 
            onClick={() => navigate(`/item/${item.id}`)}
          >
            <img src={`${API_URL}/${item.image_path}`} alt={item.name} />
          </div>
        ))}
      </div>
      
      {/* МОДАЛЬНОЕ ОКНО */}
      {isFilterOpen && (
        <div className="filter-modal-overlay" onClick={() => setIsFilterOpen(false)}>
          {/* stopPropagation чтобы клик внутри окна не закрывал его */}
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
                <h3 style={{margin: 0, fontSize: '22px'}}>Фильтры</h3>
                <button 
                  onClick={() => setIsFilterOpen(false)} 
                  className="modal-close"
                >
                  &times;
                </button>
            </div>
            
            <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
              <SmartSelect type="category" value={filterCategory} onChange={setFilterCategory} placeholder="Категория" />
              <SmartSelect type="color" value={filterColor} onChange={setFilterColor} placeholder="Цвет" />
              <SmartSelect type="season" value={filterSeason} onChange={setFilterSeason} placeholder="Сезон" />
              <SmartSelect type="style" value={filterStyle} onChange={setFilterStyle} placeholder="Стиль" />
            </div>

            <div className="filter-actions" style={{marginTop: '25px', display: 'flex', gap: '10px'}}>
              <button className="auth-btn btn-primary" onClick={() => setIsFilterOpen(false)}>
                Применить
              </button>
              <button 
                className="auth-btn" 
                onClick={clearFilters} 
                style={{background: '#ffe0e9', color: '#e05d82'}} /* Розовая кнопка сброса */
              >
                Сбросить
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Wardrobe;