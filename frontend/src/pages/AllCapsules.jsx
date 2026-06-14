import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { API_URL } from '../config';
import SmartSelect from '../components/SmartSelect';
import './styles/AllCapsules.css';

const AllCapsules = () => {
  const navigate = useNavigate();
  
  // Состояния
  const [items, setItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOccasion, setActiveOccasion] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Загрузка данных
  const loadData = async () => {
    try {
      const { data } = await api.get('/capsules/');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch capsules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Вычисляемые значения для фильтров
  const occasions = useMemo(() => {
    const list = items
      .map(i => String(i.occasion || '').trim())
      .filter(Boolean);
    return [...new Set(list)].sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOccasion = !activeOccasion || 
        item.occasion === activeOccasion;
      
      return matchesSearch && matchesOccasion;
    });
  }, [items, searchQuery, activeOccasion]);

  // Удаление образа
  const handleDelete = async (e, id) => {
    e.stopPropagation();
    
    if (!window.confirm('Удалить этот образ?')) return;

    try {
      await api.delete(`/capsules/${id}`);
      setItems(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      alert('Не удалось удалить');
      console.error(err);
    }
  };

  const resetFilters = () => {
    setActiveOccasion('');
    setIsFilterOpen(false);
  };

  return (
    <div className="page-padding" style={{ paddingBottom: '100px' }}>
      {/* верхеяя панель */}
      <div className="top-bar" style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Найти образ..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '40px', width: '100%' }}
          />
          <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }}>
            🔍
          </span>
        </div>
        <Link to="/capsules/create" className="add-btn-circle">+</Link>
      </div>

      <button
        className="filter-chip"
        onClick={() => setIsFilterOpen(true)}
        style={{
          backgroundColor: activeOccasion ? 'var(--primary-green)' : '#f0f0f0',
          color: activeOccasion ? '#fff' : '#333',
          marginBottom: '20px'
        }}
      >
        {activeOccasion ? `Событие: ${activeOccasion}` : 'Фильтр по событию ▼'}
      </button>

      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '40px', color: '#999' }}>Загрузка...</div>
      ) : (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {filteredItems.map((item) => (
            <div 
              key={item.id} 
              className="card" 
              onClick={() => navigate(`/capsules/${item.id}`)}
              style={{ cursor: 'pointer', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}
            >
              {item.image_path ? (
                <img src={`${API_URL}/${item.image_path}`} alt={item.name} style={{ width: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', color: '#ccc' }}>
                  Нет фото
                </div>
              )}
              
              <button 
                onClick={(e) => handleDelete(e, item.id)}
                className="delete-item-btn"
                style={{
                    position: 'absolute', top: '8px', right: '8px',
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: '#b16c6c', border: 'none',
                    boxShadow: '0 2px 8px rgba(88, 28, 28, 0.34)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 5
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>

              <div className="card-info" style={{
                  position: 'absolute', bottom: 0, width: '100%',
                  background: 'rgba(255,255,255,0.95)', padding: '8px 4px',
                  borderTop: '1px solid #eee'
              }}>
                <div style={{ fontWeight: '600', fontSize: '12px', color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
                {item.occasion && (
                  <div style={{ fontSize: '10px', color: 'var(--primary-green)' }}>#{item.occasion}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* нет вещей */}
      {!loading && filteredItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa' }}>
          {items.length === 0 ? 'Гардероб пуст' : 'Ничего не нашлось'}
        </div>
      )}

      {/* фильтр */}
      {isFilterOpen && (
        <div className="filter-modal-overlay" onClick={() => setIsFilterOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()} style={{ padding: '20px', borderRadius: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Фильтры</h3>
              <button onClick={() => setIsFilterOpen(false)} style={{ border: 'none', background: 'none', fontSize: '24px' }}>&times;</button>
            </div>

            <SmartSelect 
              options={occasions} 
              value={activeOccasion} 
              onChange={setActiveOccasion} 
              placeholder="Выберите событие" 
            />

            <div style={{ marginTop: '25px', display: 'flex', gap: '10px' }}>
              <button className="auth-btn btn-primary" onClick={() => setIsFilterOpen(false)} style={{ flex: 1 }}>
                Готово
              </button>
              <button className="auth-btn" onClick={resetFilters} style={{ background: '#f0f0f0', color: '#666' }}>
                Сброс
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllCapsules;