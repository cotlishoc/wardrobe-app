import { useEffect, useState } from 'react';
import api from '../api';
import { API_URL } from '../config';
import { Link, useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect'; // Импортируем наш селект

function AllCapsules() {
  const navigate = useNavigate();
  const [capsules, setCapsules] = useState([]);
  const [dbOccasions, setDbOccasions] = useState([]); // Для списка событий
  const [isLoading, setIsLoading] = useState(true);
  
  // --- СОСТОЯНИЯ ФИЛЬТРОВ ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOccasion, setFilterOccasion] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    // 1. Загружаем капсулы
    const fetchCaps = () => {
      api.get('/capsules/')
        .then(res => setCapsules(res.data))
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    };

    // 2. Загружаем справочник событий
    const fetchOccasions = () => {
        api.get('/occasions')
          .then(res => setDbOccasions(res.data))
          .catch(err => console.error(err));
    };

    fetchCaps();
    fetchOccasions();
  }, []);

  // --- ЛОГИКА ФИЛЬТРАЦИИ ---
  const filteredCapsules = capsules.filter(capsule => {
    const matchName = capsule.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchOccasion = filterOccasion ? capsule.occasion === filterOccasion : true;
    return matchName && matchOccasion;
  });

  const activeFiltersCount = [filterOccasion].filter(Boolean).length;

  return (
    <div style={{ padding: '20px', paddingBottom: '90px' }}>
      
      {/* Шапка с Поиском и кнопкой Добавить */}
      <div className="top-bar" style={{ gap: '10px', marginBottom: '15px' }}>
        <div className="search-container" style={{ flex: 1, position: 'relative' }}>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Поиск образа..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <span style={{ position: 'absolute', left: '15px', top: '15px', opacity: 0.5 }}>🔍</span>
        </div>
        <Link to="/capsules/create" className="add-btn-circle">
          +
        </Link>
      </div>

      {/* Кнопка фильтра по событию */}
      <button 
         className="filter-chip" 
         onClick={() => setIsFilterOpen(true)}
         style={{
            backgroundColor: activeFiltersCount > 0 ? 'var(--primary-green)' : '#f0f0f0', 
            color: activeFiltersCount > 0 ? '#fff' : '#333',
            marginBottom: '20px',
            width: 'auto'
         }}
      >
        {filterOccasion ? `Событие: ${filterOccasion}` : 'Все события ▼'}
      </button>

      {isLoading ? (
        <p style={{ textAlign: 'center', color: '#888' }}>Загрузка...</p>
      ) : (
        <div className="grid">
          {filteredCapsules.map((capsule) => (
            <div 
                key={capsule.id} 
                className="card" 
                onClick={() => navigate(`/capsules/${capsule.id}`)}
                style={{ cursor: 'pointer', position: 'relative' }}
            >
              {capsule.image_path ? (
                <img src={`${API_URL}/${capsule.image_path}`} alt={capsule.name} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#f0f0f0', color: '#999' }}>
                   <span>Нет фото</span>
                </div>
              )}
              
              {/* Плашка с названием и событием */}
              <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, 
                  background: 'rgba(255,255,255,0.9)', padding: '5px', 
                  fontSize: '11px', textAlign: 'center'
              }}>
                  <div style={{ fontWeight: 'bold' }}>{capsule.name}</div>
                  {capsule.occasion && (
                    <div style={{ color: 'var(--primary-green)', fontSize: '9px' }}>#{capsule.occasion}</div>
                  )}
              </div>
            </div>
          ))}

          {filteredCapsules.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '50px', color: '#999' }}>
              <p>Ничего не найдено.</p>
            </div>
          )}
        </div>
      )}

      {/* МОДАЛКА ФИЛЬТРА ПО СОБЫТИЮ */}
      {isFilterOpen && (
        <div className="filter-modal-overlay" onClick={() => setIsFilterOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <h3>Фильтр по случаю</h3>
            <SmartSelect 
               options={dbOccasions.map(o => o.name)} 
               value={filterOccasion} 
               onChange={setFilterOccasion} 
               placeholder="Выберите событие" 
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="auth-btn btn-primary" onClick={() => setIsFilterOpen(false)}>Применить</button>
                <button className="auth-btn" onClick={() => { setFilterOccasion(''); setIsFilterOpen(false); }} style={{ background: '#eee' }}>Сбросить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllCapsules;