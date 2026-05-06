import { useEffect, useState } from 'react';
import api from '../api';
import { API_URL } from '../config';
import { Link, useNavigate } from 'react-router-dom';

function AllCapsules() {
  const navigate = useNavigate();
  const [capsules, setCapsules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCaps = () => {
    api.get('/capsules/')
      .then(res => setCapsules(res.data))
      .catch(err => console.error(err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchCaps();
  }, []);

  const deleteCapsule = async (e, id) => {
    e.stopPropagation(); 
    if (window.confirm("Удалить этот образ навсегда?")) {
        try {
            await api.delete(`/capsules/${id}`);
            setCapsules(capsules.filter(c => c.id !== id));
        } catch (e) {
            alert("Ошибка при удалении");
        }
    }
  };

  return (
    <div className="page-padding" style={{ paddingBottom: '100px' }}>
      <div className="top-bar" style={{ justifyContent: 'space-between' }}>
        <h2>Мои Капсулы</h2>
        <Link to="/capsules/create" className="add-btn-circle">+</Link>
      </div>

      {isLoading ? (
        <p style={{ textAlign: 'center', color: '#888' }}>Загрузка...</p>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          {capsules.map((capsule) => (
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

          {capsules.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '40px', color: '#aaa' }}>
                <p>У вас пока нет сохраненных образов</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AllCapsules;