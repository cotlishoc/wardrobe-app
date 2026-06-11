import { useEffect, useState } from 'react';
import api from '../api';
import { API_URL } from '../config';
import { Link, useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect';

function AllCapsules() {
  const navigate = useNavigate();
  const [capsules, setCapsules] = useState([]);
  const [occasionOptions, setOccasionOptions] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [filterOccasion, setFilterOccasion] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getUniqueOccasions = (items) => {
    const unique = Array.from(new Set((items || []).map(item => String(item.occasion || '').trim()).filter(Boolean)));
    return unique.sort();
  };

  const fetchCaps = () => {
    api.get('/capsules/')
      .then(res => {
        const data = Array.isArray(res.data) ? res.data : [];
        setCapsules(data);
        setOccasionOptions(getUniqueOccasions(data));
      })
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchCaps();
  }, []);

  const deleteCapsule = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Удалить этот образ навсегда?')) {
      try {
        await api.delete(`/capsules/${id}`);
        const updated = capsules.filter(c => c.id !== id);
        setCapsules(updated);
        setOccasionOptions(getUniqueOccasions(updated));
      } catch (e) {
        alert('Ошибка при удалении');
      }
    }
  };

  const filteredCapsules = capsules.filter(capsule => {
    const nameMatch = !searchText || String(capsule.name || '').toLowerCase().includes(searchText.toLowerCase());
    const occasionMatch = !filterOccasion || String(capsule.occasion || '').trim() === filterOccasion.trim();
    return nameMatch && occasionMatch;
  });

  const clearFilters = () => {
    setFilterOccasion('');
    setIsFilterOpen(false);
  };

  return (
    <div className="page-padding" style={{ paddingBottom: '100px' }}>
      <div className="top-bar" style={{ gap: '10px', marginBottom: '15px' }}>
        <div className="search-container" style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Поиск по названию..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <span style={{ position: 'absolute', left: '15px', top: '15px', opacity: 0.5 }}>🔍</span>
        </div>
        <Link to="/capsules/create" className="add-btn-circle">+</Link>
      </div>

      <button
        className="filter-chip"
        onClick={() => setIsFilterOpen(true)}
        style={{
          backgroundColor: filterOccasion ? 'var(--primary-green)' : '#f0f0f0',
          color: filterOccasion ? '#fff' : '#333',
          marginBottom: '20px',
        }}
      >
        Фильтр события {filterOccasion ? `(${filterOccasion})` : '▼'}
      </button>

      {isLoading ? (
        <p style={{ textAlign: 'center', color: '#888' }}>Загрузка...</p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {filteredCapsules.map((capsule) => (
            <div 
                key={capsule.id} 
                className="card" 
                onClick={() => navigate(`/capsules/${capsule.id}`)}
                style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            >
              {capsule.image_path ? (
                <img src={`${API_URL}/${capsule.image_path}`} alt={capsule.name} />
              ) : (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: '#eee', color: '#999', fontSize: '12px' }}>Нет фото</div>
              )}
              
              {/* КНОПКА УДАЛЕНИЯ (КРАСНАЯ И РОВНАЯ) */}
              <button 
                onClick={(e) => deleteCapsule(e, capsule.id)}
                style={{
                    position: 'absolute', 
                    top: '8px', 
                    right: '8px',
                    width: '34px', 
                    height: '34px', 
                    borderRadius: '50%',
                    background: 'white', 
                    border: 'none',
                    boxShadow: '0 4px 10px rgba(116, 17, 17, 0.89)', 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    cursor: 'pointer',
                    transition: 'transform 0.1s'
                }}
                onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'}
                onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {/* SVG Иконка корзины */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>

              {/* Плашка с названием */}
              <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, 
                  background: 'rgba(255,255,255,0.92)', padding: '6px 4px', 
                  fontSize: '11px', textAlign: 'center', borderTop: '1px solid #f0f0f0'
              }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--primary-green)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {capsule.name}
                  </div>
                  {capsule.occasion && (
                    <div style={{ fontSize: '9px', color: '#999' }}>#{capsule.occasion}</div>
                  )}
              </div>
            </div>
          ))}

          {filteredCapsules.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '40px', color: '#aaa' }}>
              <p>{capsules.length === 0 ? 'У вас пока нет сохраненных образов' : 'По вашему запросу ничего не найдено'}</p>
            </div>
          )}
        </div>
      )}

      {isFilterOpen && (
        <div className="filter-modal-overlay" onClick={() => setIsFilterOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Фильтр по событию</h3>
              <button onClick={() => setIsFilterOpen(false)} style={{ border: 'none', background: 'none', fontSize: '28px' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <SmartSelect options={occasionOptions} value={filterOccasion} onChange={setFilterOccasion} placeholder="Событие" />
            </div>

            <div className="filter-actions" style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
              <button className="auth-btn btn-primary" onClick={() => setIsFilterOpen(false)}>Применить</button>
              <button className="auth-btn" onClick={clearFilters} style={{ background: '#ffe0e9', color: '#e05d82' }}>Сбросить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AllCapsules;