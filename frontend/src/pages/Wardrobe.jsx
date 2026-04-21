import { useEffect, useState } from 'react';
import api from '../api';
import { Link, useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect'; 
import { API_URL } from '../config';

function Wardrobe() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  
  // Состояние для списков из базы данных
  const [dbData, setDbData] = useState({ 
    categories: [], 
    colors: [], 
    styles: [], 
    seasons: [], 
    fits: [] 
  });

  // Состояния для поиска и открытия модалки
  const [searchText, setSearchText] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // --- СОСТОЯНИЯ ФИЛЬТРОВ (Все должны быть тут!) ---
  const [filterCategory, setFilterCategory] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterStyle, setFilterStyle] = useState('');
  const [filterFit, setFilterFit] = useState(''); // Наш новый фильтр

  useEffect(() => {
    // 1. Загружаем вещи
    const fetchItems = () => {
      api.get('/items/')
        .then(res => setItems(Array.isArray(res.data) ? res.data : []))
        .catch(err => console.error("Ошибка загрузки вещей:", err));
    };

    // 2. Загружаем справочники для фильтров
    const fetchFilters = async () => {
        try {
            const [c, cl, st, se, fi] = await Promise.all([
                api.get('/categories'), 
                api.get('/colors'),
                api.get('/styles'), 
                api.get('/seasons'), 
                api.get('/fits')
            ]);
            setDbData({ 
                categories: c.data, 
                colors: cl.data, 
                styles: st.data, 
                seasons: se.data, 
                fits: fi.data 
            });
        } catch (e) { 
            console.error("Ошибка загрузки фильтров:", e); 
        }
    };

    fetchItems();
    fetchFilters();
  }, []);

   // === ЛОГИКА ФИЛЬТРАЦИИ ===
   const filteredItems = items.filter(item => {
    // Приводим всё к строкам и удаляем лишние пробелы для точного сравнения
    const itemCat = String(item.category || '').trim();
    const itemCol = String(item.color || '').trim();
    const itemFit = String(item.fit || '').trim();

    if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterCategory && itemCat !== filterCategory.trim()) return false;
    if (filterColor && itemCol !== filterColor.trim()) return false;
    if (filterFit && itemFit !== filterFit.trim()) return false;
    
    // Добавьте остальные фильтры по аналогии...
    return true;
});

   // Сброс всех фильтров
   const clearFilters = () => {
     setFilterCategory('');
     setFilterColor('');
     setFilterSeason('');
     setFilterStyle('');
     setFilterFit('');
     setIsFilterOpen(false);
   };

   const activeFiltersCount = [filterCategory, filterColor, filterSeason, filterStyle, filterFit].filter(Boolean).length;

   return (
     <div className="page-padding">
       
       {/* Верхняя панель */}
       <div className="top-bar">
         <div className="search-container">
           <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
           <input 
             type="text" 
             className="search-input" 
             placeholder="Поиск по названию..." 
             value={searchText}
             onChange={(e) => setSearchText(e.target.value)}
           />
         </div>
         <Link to="/upload" className="add-btn-circle">+</Link>
       </div>

       {/* Кнопка фильтров */}
       <button 
         className="filter-chip" 
         onClick={() => setIsFilterOpen(true)}
         style={{
            backgroundColor: activeFiltersCount > 0 ? 'var(--primary-green)' : '#e0e0e0', 
            color: activeFiltersCount > 0 ? '#fff' : '#000'
         }}
       >
         Фильтры {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''} ▼
       </button>

       {/* Сетка вещей */}
       <div className="grid">
         {filteredItems.map(item => (
           <div key={item.id} className="card" onClick={() => navigate(`/item/${item.id}`)}>
             <img src={`${API_URL}/${item.image_path}`} alt={item.name} />
           </div>
         ))}
       </div>
       
       {/* МОДАЛЬНОЕ ОКНО ФИЛЬТРОВ */}
       {isFilterOpen && (
         <div className="filter-modal-overlay" onClick={() => setIsFilterOpen(false)}>
           <div className="filter-modal" onClick={e => e.stopPropagation()}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
                 <h3 style={{margin: 0}}>Параметры поиска</h3>
                 <button onClick={() => setIsFilterOpen(false)} className="modal-close">&times;</button>
             </div>
             
             <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
               <SmartSelect options={dbData.categories} value={filterCategory} onChange={setFilterCategory} placeholder="Категория" />
               <SmartSelect options={dbData.colors} value={filterColor} onChange={setFilterColor} placeholder="Цвет" />
               <SmartSelect options={dbData.styles} value={filterStyle} onChange={setFilterStyle} placeholder="Стиль" />
               <SmartSelect options={dbData.seasons} value={filterSeason} onChange={setFilterSeason} placeholder="Сезон" />
               <SmartSelect options={dbData.fits} value={filterFit} onChange={setFilterFit} placeholder="Крой (Fit)" />
             </div>

             <div className="filter-actions" style={{marginTop: '25px', display: 'flex', gap: '10px'}}>
               <button className="auth-btn btn-primary" onClick={() => setIsFilterOpen(false)}>Применить</button>
               <button className="auth-btn" onClick={clearFilters} style={{background: '#ffe0e9', color: '#e05d82'}}>Сбросить</button>
             </div>
           </div>
         </div>
       )}
     </div>
   );
 }

 export default Wardrobe;