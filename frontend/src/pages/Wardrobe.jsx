import { useEffect, useState } from 'react';
import api from '../api';
import { Link, useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect'; 
import { API_URL } from '../config';

function Wardrobe() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  
  const [dbData, setDbData] = useState({ 
    categories: [], 
    colors: [], 
    styles: [], 
    seasons: [], 
    fits: [] 
  });

  const [searchText, setSearchText] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [filterCategory, setFilterCategory] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterStyle, setFilterStyle] = useState('');
  const [filterFit, setFilterFit] = useState('');

  useEffect(() => {
    const fetchItems = () => {
      api.get('/items/')
        .then(res => setItems(Array.isArray(res.data) ? res.data : []))
        .catch(err => console.error("Ошибка загрузки вещей:", err));
    };

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

   const filteredItems = items.filter(item => {
    const itemCat = String(item.category || '').trim();
    const itemCol = String(item.color || '').trim();
    const itemFit = String(item.fit || '').trim();
    const itemSeason = String(item.season || '').trim();
    const itemStyle = String(item.style || '').trim();

    if (searchText && !item.name.toLowerCase().includes(searchText.toLowerCase())) return false;
    if (filterCategory && itemCat !== filterCategory.trim()) return false;
    if (filterColor && itemCol !== filterColor.trim()) return false;
    if (filterFit && itemFit !== filterFit.trim()) return false;
    if (filterSeason && itemSeason !== filterSeason.trim()) return false;
    if (filterStyle && itemStyle !== filterStyle.trim()) return false;
    
    return true;
});

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
       
       {/* ОБНОВЛЕННАЯ ВЕРХНЯЯ ПАНЕЛЬ (как в Капсулах) */}
       <div className="top-bar" style={{ gap: '10px', marginBottom: '15px' }}>
         <div className="search-container" style={{ flex: 1, position: 'relative' }}>
           <input 
             type="text" 
             className="search-input" 
             placeholder="Поиск по названию..." 
             value={searchText}
             onChange={(e) => setSearchText(e.target.value)}
             style={{ paddingLeft: '40px' }} // Место под лупу
           />
           {/* Иконка-эмодзи в том же стиле */}
           <span style={{ position: 'absolute', left: '15px', top: '15px', opacity: 0.5 }}>🔍</span>
         </div>
         <Link to="/upload" className="add-btn-circle">+</Link>
       </div>

       {/* Кнопка фильтров */}
       <button 
         className="filter-chip" 
         onClick={() => setIsFilterOpen(true)}
         style={{
            backgroundColor: activeFiltersCount > 0 ? 'var(--primary-green)' : '#f0f0f0', 
            color: activeFiltersCount > 0 ? '#fff' : '#333',
            marginBottom: '20px'
         }}
       >
         Параметры поиска {activeFiltersCount > 0 ? `(${activeFiltersCount})` : '▼'}
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
                 <button onClick={() => setIsFilterOpen(false)} style={{border:'none', background:'none', fontSize:'28px'}}>&times;</button>
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