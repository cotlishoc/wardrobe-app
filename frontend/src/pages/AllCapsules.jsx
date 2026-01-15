import { useEffect, useState } from 'react';
import api from '../api';
import { API_URL } from '../config';
import { Link, useNavigate } from 'react-router-dom';

function AllCapsules() {
  const navigate = useNavigate();
  const [capsules, setCapsules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [imagesLastUpdate, setImagesLastUpdate] = useState(null);
  const POLL_INTERVAL = 2500;

  useEffect(() => {
    const fetchCaps = () => {
      api.get('/capsules/')
        .then(res => setCapsules(res.data))
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    };
    fetchCaps();

    let mounted = true;
    let lastSeen = null;
    const poll = setInterval(async () => {
      try {
        const r = await api.get('/images/last_update');
        if (!mounted) return;
        const last = r.data && r.data.last_update ? r.data.last_update : null;
        if (last !== lastSeen) {
          lastSeen = last;
          setImagesLastUpdate(last);
          fetchCaps();
        }
      } catch(e) { /* ignore */ }
    }, POLL_INTERVAL);

    return () => { mounted = false; clearInterval(poll); };
  }, []);

  // --- helper: build possible src candidates for an image path ---
  const buildSrcCandidates = (path) => {
    if (!path) return [];
    const clean = String(path).replace(/^\/+/, '');
    const candidates = [];
    if (API_URL) candidates.push(`${API_URL}/${clean}`);
    candidates.push(`/${clean}`);
    candidates.push(clean);
    return Array.from(new Set(candidates.filter(Boolean)));
  };

  const handleImageError = (e) => {
    const img = e.target;
    const raw = img.getAttribute('data-cands') || '[]';
    let cands;
    try { cands = JSON.parse(raw); } catch { cands = []; }
    let idx = parseInt(img.getAttribute('data-err') || '0', 10);
    idx = Number.isNaN(idx) ? 0 : idx;
    const next = idx + 1;
    if (next < cands.length) {
      img.setAttribute('data-err', String(next));
      img.src = cands[next];
    } else {
      // последний фоллбэк — показываем пустой блок (или можно заменить на placeholder)
      img.style.display = 'none';
      const parent = img.parentNode;
      if (parent) {
        const fallback = document.createElement('div');
        fallback.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;background:#f0f0f0;color:#999;flex-direction:column;';
        fallback.textContent = 'Нет фото';
        parent.appendChild(fallback);
      }
    }
  };

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
          {capsules.map((capsule) => {
            const cands = buildSrcCandidates(capsule.image_path);
            const src = cands.length ? cands[0] : null;
            return (
              <div 
                  key={capsule.id} 
                  className="card" 
                  onClick={() => navigate(`/capsules/${capsule.id}`)}
                  style={{ cursor: 'pointer', position: 'relative' }}
              >
                {capsule.image_path ? (
                  /* Показываем сохраненный скриншот */
                  <img src={`${API_URL}/${capsule.image_path}${imagesLastUpdate ? `?v=${encodeURIComponent(imagesLastUpdate)}` : ''}`} alt={capsule.name} data-cands={JSON.stringify([`${API_URL}/${capsule.image_path}`, `/${capsule.image_path}`, capsule.image_path])} />
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
            );
          })}

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