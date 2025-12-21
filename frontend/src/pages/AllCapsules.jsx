import { useEffect, useState } from 'react';
import api from '../api';
import { API_URL } from '../config';
import { Link, useNavigate } from 'react-router-dom';

function AllCapsules() {
  const navigate = useNavigate();
  const [capsules, setCapsules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCapsules = () => {
      setIsLoading(true);
      api.get('/capsules/')
        .then(res => setCapsules(res.data))
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    };

    fetchCapsules();

    const onStorage = (e) => { if (e.key === 'items_updated') fetchCapsules(); };
    const onCustom = () => fetchCapsules();
    const onFocus = () => fetchCapsules();

    window.addEventListener('storage', onStorage);
    window.addEventListener('items_updated', onCustom);
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('items_updated', onCustom);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <div style={{ padding: '20px', paddingBottom: '90px' }}>
      
      {/* Шапка: Заголовок и кнопка + */}
      <div className="top-bar" style={{ justifyContent: 'space-between' }}>
        <h2>Мои Капсулы</h2>
        <Link to="/capsules/create" className="add-btn-circle">
          +
        </Link>
      </div>

      {isLoading ? (
        <p style={{ textAlign: 'center', color: '#888' }}>Загрузка...</p>
      ) : (
        <div className="grid">
          {capsules.map((capsule) => (
            <div 
                key={capsule.id} 
                className="card" 
                onClick={() => navigate(`/capsules/${capsule.id}`)}
                style={{ cursor: 'pointer', position: 'relative' }}
            >
              {capsule.image_path ? (
                /* Показываем сохраненный скриншот */
                <img src={`${API_URL}/${capsule.image_path}`} alt={capsule.name} />
              ) : (
                /* Фоллбэк, если скриншота нет (старая капсула) */
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#f0f0f0', color: '#999', flexDirection: 'column' }}>
                   <span>Нет фото</span>
                </div>
              )}
              {/* Название капсулы на плашке */}
              <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, 
                  background: 'rgba(255,255,255,0.9)', padding: '5px', 
                  fontSize: '12px', textAlign: 'center', fontWeight: 'bold'
              }}>
                  {capsule.name}
              </div>
            </div>
          ))}

          {capsules.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: '50px', color: '#999' }}>
              <p>У вас пока нет капсул.</p>
              <p>Нажмите <b>+</b>, чтобы создать образ!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AllCapsules;