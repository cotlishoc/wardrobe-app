import { useEffect, useState, useRef } from 'react';
import api from '../api';
import { Rnd } from 'react-rnd';
import SmartSelect from '../components/SmartSelect';
import BottomNav from '../components/BottomNav';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { API_URL } from '../config';

// Импортируем расширенные правила
import { 
  COLOR_RULES, STYLE_RULES, FIT_RULES, COLOR_GROUPS, 
  STYLE_FORMALITY, CATEGORY_LAYERS, COLOR_TEMP, STYLE_COMPATIBILITY, SEASON_COMPATIBILITY 
} from '../data/wardrobeRules';

function Capsules() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- СОСТОЯНИЯ ---
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [dbData, setDbData] = useState({ categories: [], colors: [], styles: [], seasons: [], fits: [] });
  const [dbOccasions, setDbOccasions] = useState([]);
  const [canvasItems, setCanvasItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [maxZIndex, setMaxZIndex] = useState(100);
  const [loading, setLoading] = useState(true);

  // Предпочтения и подбор
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);
  const [prefOccasion, setPrefOccasion] = useState(null);
  const [prefPalette, setPrefPalette] = useState('');
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [matchCriteria, setMatchCriteria] = useState({ color: true, style: true, fit: true });
  const [isMatchingMode, setIsMatchingMode] = useState(false);
  const [matchSourceItem, setMatchSourceItem] = useState(null);

  // Фильтры
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterFit, setFilterFit] = useState('');

  // Сохранение
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [capsuleName, setCapsuleName] = useState('');
  const [selectedOccasionForSave, setSelectedOccasionForSave] = useState('');

  const canvasRef = useRef(null);
  const [initialDist, setInitialDist] = useState(null); // Для Pinch Zoom

  // --- ЛОГИКА СОВМЕСТИМОСТИ ---
  const checkCompatibility = (source, target) => {
    if (!source || !target) return true;

    const s = {
      style: source.style || "Повседневный",
      color: (source.color || "Белый").toLowerCase(),
      fit: source.fit || "Базовый",
      season: source.season || "Всесезон"
    };
    const t = {
      style: target.style || "Повседневный",
      color: (target.color || "Белый").toLowerCase(),
      fit: target.fit || "Базовый",
      season: target.season || "Всесезон"
    };

    let colorOk = true; let styleOk = true; let fitOk = true;

    if (matchCriteria.color) {
      const sTemp = Object.keys(COLOR_TEMP).find(k => COLOR_TEMP[k].includes(source.color)) || 'neutral';
      const tTemp = Object.keys(COLOR_TEMP).find(k => COLOR_TEMP[k].includes(target.color)) || 'neutral';
      colorOk = s.color === t.color || sTemp === tTemp || sTemp === 'neutral' || tTemp === 'neutral';
    }

    if (matchCriteria.style) {
      styleOk = STYLE_COMPATIBILITY[s.style]?.includes(t.style) || s.style === t.style;
    }

    if (matchCriteria.fit) {
      if (s.fit === "Оверсайз (Oversize)" && t.fit === "Оверсайз (Oversize)") fitOk = false;
      else fitOk = true;
    }

    return colorOk && styleOk && fitOk;
  };

  // --- ЗАГРУЗКА ДАННЫХ ---
  useEffect(() => {
    const init = async () => {
      try {
        const [items, cats, cols, stys, seas, fits, occs] = await Promise.all([
          api.get('/items/'), api.get('/categories'), api.get('/colors'),
          api.get('/styles'), api.get('/seasons'), api.get('/fits'), api.get('/occasions')
        ]);
        setWardrobeItems(items.data || []);
        setDbData({ categories: cats.data, colors: cols.data, styles: stys.data, seasons: seas.data, fits: fits.data });
        setDbOccasions(occs.data);

        if (id) {
          const res = await api.get('/capsules/');
          const capsule = res.data.find(c => String(c.id) === String(id));
          if (capsule) {
            setCapsuleName(capsule.name);
            setSelectedOccasionForSave(capsule.occasion || '');
            setCanvasItems(JSON.parse(capsule.layout || '[]').map(i => ({ ...i, uniqueId: Math.random() })));
          }
        }
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    init();
  }, [id]);

  // --- УПРАВЛЕНИЕ СЛОЯМИ ---
  const bringToFront = (uid) => {
    setActiveId(uid);
    setMaxZIndex(prev => {
      const nextZ = prev + 1;
      setCanvasItems(items => items.map(i => i.uniqueId === uid ? { ...i, zIndex: nextZ } : i));
      return nextZ;
    });
  };

  // --- PINCH ZOOM (ДВА ПАЛЬЦА) ---
  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && activeId) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (initialDist === null) {
        setInitialDist(dist);
      } else {
        const factor = dist / initialDist;
        setInitialDist(dist);
        setCanvasItems(prev => prev.map(item => {
          if (item.uniqueId === activeId) {
            return {
              ...item,
              width: Math.max(50, Math.min(400, item.width * factor)),
              height: Math.max(50, Math.min(400, item.height * factor))
            };
          }
          return item;
        }));
      }
    }
  };

  // --- ФИЛЬТРАЦИЯ ---
  const filteredWardrobe = wardrobeItems.filter(item => {
    if (canvasItems.some(cv => cv.id === item.id)) return false;
    
    const itemCat = (item.category || "").trim();
    const itemStyle = (item.style || "").trim();
    const itemColor = (item.color || "").trim().toLowerCase();

    if (prefOccasion?.default_style && itemStyle !== prefOccasion.default_style) return false;
    if (prefPalette && COLOR_GROUPS[prefPalette] && !COLOR_GROUPS[prefPalette].map(c => c.toLowerCase()).includes(itemColor)) return false;

    if (isMatchingMode && matchSourceItem) {
      const groups = {
        bottoms: ["Брюки", "Юбки", "Шорты", "Джинсы", "Леггинсы", "Платья"],
        shoes: ["Кроссовки", "Обувь", "Сандалии", "Ботинки", "Туфли на каблуке"]
      };
      const getGroup = (c) => Object.keys(groups).find(key => groups[key].includes(c));
      if (getGroup(itemCat) && getGroup(itemCat) === getGroup(matchSourceItem.category)) return false;
      if (!checkCompatibility(matchSourceItem, item)) return false;
    }

    if (!isMatchingMode) {
        if (filterCategory && item.category !== filterCategory) return false;
        if (filterColor && item.color !== filterColor) return false;
        if (filterSeason && item.season !== filterSeason) return false;
        if (filterFit && item.fit !== filterFit) return false;
    }
    return true;
  });

  const activeFiltersCount = [filterCategory, filterColor, filterSeason, filterFit, prefOccasion, prefPalette].filter(Boolean).length;

  const buildSrcCandidates = (item) => {
    const path = item?.image_path ? String(item.image_path).replace(/^\/+/, '') : '';
    return [`${API_URL}/${path}`, `/${path}`, path].filter(Boolean);
  };

  const handleImageError = (e, item) => {
    const img = e.target;
    let idx = parseInt(img.dataset.err || '0', 10);
    const cands = buildSrcCandidates(item);
    if (idx + 1 < cands.length) { img.dataset.err = String(idx + 1); img.src = cands[idx + 1]; }
  };

  const performSave = async () => {
    if (!capsuleName.trim()) return alert("Введите название!");
    setIsSaveModalOpen(false); setActiveId(null); setIsMatchingMode(false);
    setTimeout(async () => {
      try {
        const canvas = await html2canvas(canvasRef.current, { useCORS: true, backgroundColor: '#ffffff', scale: 2 });
        canvas.toBlob(async (blob) => {
          const formData = new FormData();
          formData.append('name', capsuleName);
          formData.append('occasion', selectedOccasionForSave); 
          formData.append('file', blob, 'capsule.png');
          formData.append('layout', JSON.stringify(canvasItems));
          formData.append('item_ids', JSON.stringify(canvasItems.map(i => i.id)));
          if (id) await api.put(`/capsules/${id}`, formData);
          else await api.post('/capsules/', formData);
          navigate('/capsules');
        });
      } catch (e) { alert("Ошибка сохранения"); }
    }, 200);
  };

  if (loading) return <div style={{padding: 50, textAlign:'center'}}>Загрузка гардероба...</div>;

  return (
    <div className="capsule-container" onTouchMove={handleTouchMove} onTouchEnd={() => setInitialDist(null)}>
      
      {/* ПАНЕЛЬ ИНСТРУМЕНТОВ */}
      <div style={{ position: 'absolute', top: 15, left: 0, right: 0, padding: '0 15px', display: 'flex', justifyContent: 'space-between', zIndex: 1000 }}>
        <div>
            {activeId && !isMatchingMode && (
                <button onClick={() => setIsMatchModalOpen(true)}
                  style={{ backgroundColor: 'white', border: '2px solid var(--primary-green)', borderRadius: '20px', padding: '8px 15px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--primary-green)', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}>
                  🪄 <span>Подсказать</span>
                </button>
            )}
        </div>
        <button className="auth-btn btn-primary" onClick={() => setIsSaveModalOpen(true)} style={{ width: 'auto', padding: '0 25px', height: '40px', borderRadius: '20px' }}>
            Сохранить
        </button>
      </div>

      {/* ХОЛСТ */}
      <div className="capsule-canvas" onPointerDown={() => { setActiveId(null); setIsMatchingMode(false); }}>
        <div ref={canvasRef} style={{ width: '100%', height: '100%', position: 'relative', background: 'white' }}>
            {canvasItems.map((item) => (
            <Rnd 
                key={item.uniqueId} 
                size={{ width: item.width, height: item.height }} 
                position={{ x: item.x, y: item.y }} 
                bounds="parent" 
                lockAspectRatio={true}
                onDragStart={() => bringToFront(item.uniqueId)}
                onDragStop={(e, d) => setCanvasItems(prev => prev.map(i => i.uniqueId === item.uniqueId ? { ...i, x: d.x, y: d.y } : i))}
                onResizeStop={(e, dir, ref, delta, pos) => setCanvasItems(prev => prev.map(i => i.uniqueId === item.uniqueId ? { ...i, width: parseInt(ref.style.width), height: parseInt(ref.style.height), ...pos } : i))}
                onMouseDown={() => bringToFront(item.uniqueId)}
                className={`rnd-item ${activeId === item.uniqueId ? 'active' : ''}`} 
                style={{ zIndex: item.zIndex }}
                resizeHandleComponent={{ bottomRight: activeId === item.uniqueId ? <div className="resize-handle" /> : null }}
            >
                <img src={buildSrcCandidates(item)[0]} onError={(e) => handleImageError(e, item)} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                {activeId === item.uniqueId && (
                    <div className="delete-handle" onPointerDown={(e) => { 
                      e.stopPropagation(); 
                      if (item.uniqueId === matchSourceItem?.uniqueId) setIsMatchingMode(false);
                      setCanvasItems(prev => prev.filter(i => i.uniqueId !== item.uniqueId)); 
                      setActiveId(null); 
                    }}>×</div>
                )}
            </Rnd>
            ))}
        </div>
      </div>

      {/* ГАРДЕРОБ (МАТРИЦА) */}
      <div className="capsule-wardrobe">
        <div style={{ padding: '10px 15px', display: 'flex', gap: '10px' }}>
           {isMatchingMode ? (
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'var(--light-green)', padding: '8px 15px', borderRadius: '12px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>✨ Подбор к: {matchSourceItem?.name}</span>
                <button onClick={() => setIsMatchingMode(false)} style={{ color: 'red', border: 'none', background: 'none', fontWeight: 'bold' }}>✕</button>
             </div>
           ) : (
             <>
                <button onClick={() => setIsFilterOpen(true)} style={{ flex: 1, backgroundColor: activeFiltersCount > 0 ? 'var(--primary-green)' : '#fff', color: activeFiltersCount > 0 ? '#fff' : '#333', border: '1px solid #ddd', borderRadius: '12px', fontWeight: '600' }}>
                    Вещи гардероба {activeFiltersCount > 0 ? `(${activeFiltersCount})` : '▼'}
                </button>
                <button onClick={() => setIsPrefModalOpen(true)} className="pref-btn" style={{ backgroundColor: prefOccasion || prefPalette ? 'var(--accent-pink)' : '#fff' }}>
                    ⚙️
                </button>
             </>
           )}
        </div>

        <div className="capsule-grid">
          {filteredWardrobe.map(item => (
            <div key={item.id} className="mini-card" onClick={() => {
                const nextZ = maxZIndex + 1;
                setMaxZIndex(nextZ);
                setCanvasItems([...canvasItems, { ...item, uniqueId: Math.random(), x: 50, y: 50, width: 140, height: 140, zIndex: nextZ }]);
            }}>
              <img src={buildSrcCandidates(item)[0]} onError={(e) => handleImageError(e, item)} />
            </div>
          ))}
        </div>
      </div>
      
      <BottomNav />

      {/* МОДАЛКА НАСТРОЕК ПОДБОРА */}
      {isMatchModalOpen && (
        <div className="filter-modal-overlay" onClick={() => setIsMatchModalOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <h3>Критерии подбора ✨</h3>
            <div style={{display:'flex', flexDirection:'column', gap:'15px', padding:'10px'}}>
                <label style={{display:'flex', alignItems:'center', gap:'12px', cursor:'pointer'}}>
                    <input type="checkbox" checked={matchCriteria.color} onChange={e => setMatchCriteria({...matchCriteria, color: e.target.checked})} style={{width:'20px', height:'20px'}} />
                    Гармония цветов
                </label>
                <label style={{display:'flex', alignItems:'center', gap:'12px', cursor:'pointer'}}>
                    <input type="checkbox" checked={matchCriteria.style} onChange={e => setMatchCriteria({...matchCriteria, style: e.target.checked})} style={{width:'20px', height:'20px'}} />
                    Единый стиль
                </label>
                <label style={{display:'flex', alignItems:'center', gap:'12px', cursor:'pointer'}}>
                    <input type="checkbox" checked={matchCriteria.fit} onChange={e => setMatchCriteria({...matchCriteria, fit: e.target.checked})} style={{width:'20px', height:'20px'}} />
                    Баланс объемов (Крой)
                </label>
            </div>
            <button className="auth-btn btn-primary" style={{marginTop:'20px'}} onClick={() => { const itm = canvasItems.find(i => i.uniqueId === activeId); setMatchSourceItem(itm); setIsMatchingMode(true); setIsMatchModalOpen(false); }}>Применить</button>
          </div>
        </div>
      )}

      {/* МОДАЛКА ПРЕДПОЧТЕНИЙ (⚙️) */}
      {isPrefModalOpen && (
        <div className="filter-modal-overlay" onClick={() => setIsPrefModalOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <h3>Предпочтения</h3>
            <label style={{fontSize:'13px', fontWeight:'bold'}}>Случай</label>
            <div style={{display:'flex', flexWrap:'wrap', gap:'8px', margin:'10px 0'}}>
                {dbOccasions.map(occ => (
                    <button key={occ.id} className="filter-chip" style={{ margin:0, background: prefOccasion?.id === occ.id ? 'var(--primary-green)' : '#f0f0f0', color: prefOccasion?.id === occ.id ? 'white' : 'black', border: 'none' }}
                        onClick={() => setPrefOccasion(prefOccasion?.id === occ.id ? null : occ)}>{occ.name}</button>
                ))}
            </div>
            <label style={{fontSize:'13px', fontWeight:'bold'}}>Палитра</label>
            <div style={{display:'flex', flexWrap:'wrap', gap:'10px', marginTop:'10px'}}>
              {[
                  {id:'light', n:'Пастель', c:'#f8edeb'}, 
                  {id:'bright', n:'Ярко', c:'#ffafcc'}, 
                  {id:'dark', n:'Темно', c:'#2b2d42'},
                  {id:'neutral', n:'Другое', c:'#e0e0e0'} // НОВАЯ КНОПКА
              ].map(p => (
                  <button 
                      key={p.id} 
                      onClick={() => setPrefPalette(prefPalette === p.id ? '' : p.id)} 
                      style={{ 
                          flex: '1 0 40%', // Чтобы кнопки красиво ложились в два ряда
                          height:'45px', 
                          borderRadius:'10px', 
                          border: prefPalette === p.id ? '3px solid var(--primary-green)' : '1px solid #ddd', 
                          background: p.c, 
                          color: p.id === 'dark' ? 'white' : 'black', 
                          fontWeight: 'bold' 
                      }}
                  >
                      {p.n}
                  </button>
              ))}
          </div>
            <button className="auth-btn btn-primary" style={{marginTop:'20px'}} onClick={() => setIsPrefModalOpen(false)}>Готово</button>
            <button className="auth-btn" style={{marginTop:'10px', color: 'red', background: 'none'}} onClick={() => { setPrefOccasion(null); setPrefPalette(''); }}>Сбросить</button>
          </div>
        </div>
      )}

      {/* МОДАЛКА ФИЛЬТРОВ */}
      {isFilterOpen && (
         <div className="filter-modal-overlay" onClick={() => setIsFilterOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <h3>Фильтры</h3>
            <SmartSelect options={dbData.categories} value={filterCategory} onChange={setFilterCategory} placeholder="Категория" />
            <SmartSelect options={dbData.colors} value={filterColor} onChange={setFilterColor} placeholder="Цвет" />
            <SmartSelect options={dbData.seasons} value={filterSeason} onChange={setFilterSeason} placeholder="Сезон" />
            <SmartSelect options={dbData.fits} value={filterFit} onChange={setFilterFit} placeholder="Крой" />
            <button className="auth-btn btn-primary" style={{marginTop:'15px'}} onClick={() => setIsFilterOpen(false)}>Показать</button>
            <button className="auth-btn" onClick={() => {setFilterCategory(''); setFilterColor(''); setFilterSeason(''); setFilterFit('');}} style={{marginTop: '10px', background: '#eee'}}>Очистить</button>
          </div>
        </div>
      )}

      {/* МОДАЛКА СОХРАНЕНИЯ */}
      {isSaveModalOpen && (
        <div className="confirm-modal-overlay" onClick={() => setIsSaveModalOpen(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Сохранить капсулу</h3>
            <input type="text" className="custom-input" placeholder="Название" value={capsuleName} onChange={e => setCapsuleName(e.target.value)} />
            <div style={{marginTop:'10px'}}>
                <SmartSelect options={dbOccasions.map(o => o.name)} value={selectedOccasionForSave} onChange={setSelectedOccasionForSave} placeholder="Событие" />
            </div>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
              <button className="auth-btn" onClick={() => setIsSaveModalOpen(false)} style={{background:'#f0f0f0'}}>Отмена</button>
              <button className="auth-btn btn-primary" onClick={performSave}>Готово</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Capsules;