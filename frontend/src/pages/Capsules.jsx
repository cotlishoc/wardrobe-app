import { useEffect, useState, useRef } from 'react';
import api from '../api';
import { Rnd } from 'react-rnd';
import SmartSelect from '../components/SmartSelect';
import BottomNav from '../components/BottomNav';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { API_URL } from '../config';
import { COLOR_RULES, STYLE_RULES, COLOR_GROUPS } from '../data/wardrobeRules';

function Capsules() {
  const { id } = useParams();
  const navigate = useNavigate();

  // --- СОСТОЯНИЯ ---
  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [dbData, setDbData] = useState({ categories: [], colors: [], styles: [], seasons: [], fits: [] });
  const [dbOccasions, setDbOccasions] = useState([]);
  const [canvasItems, setCanvasItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [loading, setLoading] = useState(!!id);

  // Предпочтения (⚙️)
  const [isPrefModalOpen, setIsPrefModalOpen] = useState(false);
  const [prefOccasion, setPrefOccasion] = useState(null);
  const [prefPalette, setPrefPalette] = useState('');

  // Сохранение
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [capsuleName, setCapsuleName] = useState('');
  const [selectedOccasionForSave, setSelectedOccasionForSave] = useState('');

  // Режим подбора (🪄)
  const [isMatchingMode, setIsMatchingMode] = useState(false);
  const [matchSourceItem, setMatchSourceItem] = useState(null);

  // Фильтры гардероба
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSeason, setFilterSeason] = useState(''); // НОВОЕ
  const [filterFit, setFilterFit] = useState('');       // НОВОЕ

  const canvasRef = useRef(null);

  // --- ЛОГИКА ---
  const checkCompatibility = (source, target) => {
    if (!source || !target) return true;
    const sColor = (source.color || "").toLowerCase().trim();
    const tColor = (target.color || "").toLowerCase().trim();
    const sStyle = (source.style || "").toLowerCase().trim();
    const tStyle = (target.style || "").toLowerCase().trim();
    const colorMatch = sColor === tColor || (COLOR_RULES[sColor] && COLOR_RULES[sColor].includes(tColor));
    const styleMatch = sStyle === tStyle || (STYLE_RULES[sStyle] && STYLE_RULES[sStyle].includes(tStyle));
    return colorMatch || styleMatch;
  };

  useEffect(() => {
    api.get('/items/').then(res => setWardrobeItems(res.data)).catch(err => console.error(err));
    const fetchMetadata = async () => {
      try {
        const [c, cl, st, se, occ, fi] = await Promise.all([
          api.get('/categories'), api.get('/colors'),
          api.get('/styles'), api.get('/seasons'),
          api.get('/occasions'), api.get('/fits')
        ]);
        setDbData({ categories: c.data, colors: cl.data, styles: st.data, seasons: se.data, fits: fi.data });
        setDbOccasions(occ.data);
      } catch (e) { console.error(e); }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (!id) return;
    api.get('/capsules/').then(res => {
        const capsule = res.data.find(c => String(c.id) === String(id));
        if (capsule) {
          setCapsuleName(capsule.name);
          setSelectedOccasionForSave(capsule.occasion || '');
          if (capsule.layout) {
            try {
              const savedItems = JSON.parse(capsule.layout);
              setCanvasItems(savedItems.map(i => ({ ...i, uniqueId: Date.now() + Math.random() })));
            } catch (e) { console.error(e); }
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
  }, [id]);

  // --- ФИЛЬТРАЦИЯ ГАРДЕРОБА ---
  const filteredWardrobe = wardrobeItems.filter(item => {
    if (canvasItems.some(cv => cv.id === item.id)) return false;
    
    const itemCat = (item.category || "").trim().toLowerCase();
    const itemStyle = (item.style || "").trim();
    const itemColor = (item.color || "").trim().toLowerCase();
    const itemSeason = (item.season || "").trim(); // НОВОЕ
    const itemFit = (item.fit || "").trim();       // НОВОЕ

    // Предпочтения
    if (prefOccasion?.default_style && itemStyle !== prefOccasion.default_style) return false;
    if (prefPalette && COLOR_GROUPS[prefPalette] && !COLOR_GROUPS[prefPalette].includes(itemColor)) return false;

    // Слоты
    const onCanvasCats = canvasItems.map(i => (i.category || "").trim().toLowerCase());
    const shoeCats = ['кроссовки', 'обувь', 'сандалии', 'ботинки', 'туфли на каблуке', 'шлепанцы'];
    if (shoeCats.includes(itemCat) && onCanvasCats.some(c => shoeCats.includes(c))) return false;

    // Режим подбора
    if (isMatchingMode && matchSourceItem && !checkCompatibility(matchSourceItem, item)) return false;

    // РУЧНЫЕ ФИЛЬТРЫ (РАСШИРЕННЫЕ)
    if (filterCategory && item.category !== filterCategory) return false;
    if (filterColor && item.color !== filterColor) return false;
    if (filterSeason && itemSeason !== filterSeason) return false;
    if (filterFit && itemFit !== filterFit) return false;

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

  const addToCanvas = (item) => {
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    setCanvasItems([...canvasItems, { ...item, uniqueId: Date.now() + Math.random(), x: 50, y: 50, width: 140, height: 140, zIndex: nextZ }]);
  };

  const bringToFront = (uid) => {
    setActiveId(uid);
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    setCanvasItems(prev => prev.map(i => i.uniqueId === uid ? { ...i, zIndex: nextZ } : i));
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

  return (
    <div className="capsule-container">
      {/* ПАНЕЛЬ СОХРАНИТЬ/ПОДСКАЗАТЬ */}
      <div style={{ position: 'absolute', top: 15, left: 0, right: 0, padding: '0 15px', display: 'flex', justifyContent: 'space-between', zIndex: 1000 }}>
        <div>
            {activeId && !isMatchingMode && (
                <button onClick={() => { const itm = canvasItems.find(i => i.uniqueId === activeId); setMatchSourceItem(itm); setIsMatchingMode(true); }}
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
            <Rnd key={item.uniqueId} size={{ width: item.width, height: item.height }} position={{ x: item.x, y: item.y }} bounds="parent" lockAspectRatio={true}
                onDragStop={(e, d) => setCanvasItems(prev => prev.map(i => i.uniqueId === item.uniqueId ? { ...i, x: d.x, y: d.y } : i))}
                onResizeStop={(e, dir, ref, delta, pos) => setCanvasItems(prev => prev.map(i => i.uniqueId === item.uniqueId ? { ...i, width: parseInt(ref.style.width), height: parseInt(ref.style.height), ...pos } : i))}
                onMouseDown={(e) => { e.stopPropagation(); bringToFront(item.uniqueId); }}
                className={`rnd-item ${activeId === item.uniqueId ? 'active' : ''}`} style={{ zIndex: item.zIndex }}
                resizeHandleComponent={{ bottomRight: activeId === item.uniqueId ? <div className="resize-handle" /> : null }}
            >
                <img src={buildSrcCandidates(item)[0]} onError={(e) => handleImageError(e, item)} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                {activeId === item.uniqueId && (
                    <div className="delete-handle" onPointerDown={(e) => { e.stopPropagation(); setCanvasItems(prev => prev.filter(i => i.uniqueId !== item.uniqueId)); setActiveId(null); }}>×</div>
                )}
            </Rnd>
            ))}
        </div>
      </div>

      {/* ГАРДЕРОБ (МАТРИЦА) */}
      <div className="capsule-wardrobe" style={{ backgroundColor: '#fff', borderTop: '1px solid #eee', height: '42vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 15px', display: 'flex', gap: '10px' }}>
           {isMatchingMode ? (
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'var(--light-green)', padding: '8px 15px', borderRadius: '12px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>✨ Подходит к: {matchSourceItem?.name}</span>
                <button onClick={() => setIsMatchingMode(false)} style={{ color: 'red', border: 'none', background: 'none', fontWeight: 'bold' }}>✕</button>
             </div>
           ) : (
             <>
                <button onClick={() => setIsFilterOpen(true)} style={{ flex: 1, backgroundColor: activeFiltersCount > 0 ? 'var(--primary-green)' : '#fff', color: activeFiltersCount > 0 ? '#fff' : '#333', border: '1px solid #ddd', borderRadius: '12px', fontWeight: '600' }}>
                    Вещи гардероба {activeFiltersCount > 0 ? `(${activeFiltersCount})` : '▼'}
                </button>
                {/* Исправленная кнопка ⚙️ */}
                <button onClick={() => setIsPrefModalOpen(true)} style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: prefOccasion || prefPalette ? 'var(--accent-pink)' : '#fff', border: '1px solid #ddd', borderRadius: '12px', fontSize: '20px' }}>
                    ⚙️
                </button>
             </>
           )}
        </div>

        {/* СЕТКА ПИНТЕРЕСТ-СТАЙЛ (3 колонки) */}
        <div className="capsule-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '0 15px 120px 15px', overflowY: 'auto' }}>
          {filteredWardrobe.map(item => (
            <div key={item.id} className="mini-card" onClick={() => addToCanvas(item)} style={{ aspectRatio: '1', background: '#f9f9f9', borderRadius: '10px', overflow: 'hidden', border: '1px solid #eee' }}>
              <img src={buildSrcCandidates(item)[0]} onError={(e) => handleImageError(e, item)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          ))}
        </div>
      </div>
      
      <BottomNav />

      {/* МОДАЛКА ПРЕДПОЧТЕНИЙ (С кнопкой сброса) */}
      {isPrefModalOpen && (
        <div className="filter-modal-overlay" onClick={() => setIsPrefModalOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <h3>Предпочтения ✨</h3>
            <label style={{fontSize:'13px', fontWeight:'bold'}}>Куда вы собираетесь?</label>
            <div style={{display:'flex', flexWrap:'wrap', gap:'8px', margin:'10px 0 20px 0'}}>
                {dbOccasions.map(occ => (
                    <button key={occ.id} className="filter-chip" style={{ margin:0, background: prefOccasion?.id === occ.id ? 'var(--primary-green)' : '#f0f0f0', color: prefOccasion?.id === occ.id ? 'white' : 'black', border: 'none' }}
                        onClick={() => setPrefOccasion(prefOccasion?.id === occ.id ? null : occ)}>{occ.name}</button>
                ))}
            </div>
            <label style={{fontSize:'13px', fontWeight:'bold'}}>Настроение палитры</label>
            <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                {[{id:'light', n:'Пастель', c:'#f8edeb'}, {id:'bright', n:'Ярко', c:'#ffafcc'}, {id:'dark', n:'Темно', c:'#2b2d42'}].map(p => (
                    <button key={p.id} onClick={() => setPrefPalette(prefPalette === p.id ? '' : p.id)} style={{ flex:1, height:'50px', borderRadius:'10px', border: prefPalette === p.id ? '3px solid var(--primary-green)' : 'none', background: p.c, color: p.id==='dark'?'white':'black', fontWeight:'bold', fontSize: '12px' }}>{p.n}</button>
                ))}
            </div>
            <button className="auth-btn btn-primary" style={{marginTop:'25px'}} onClick={() => setIsPrefModalOpen(false)}>Применить</button>
            <button className="auth-btn" style={{marginTop:'10px', color: 'red', background: 'none'}} onClick={() => { setPrefOccasion(null); setPrefPalette(''); }}>Сбросить предпочтения</button>
          </div>
        </div>
      )}

      {/* МОДАЛКА ФИЛЬТРОВ (Расширенная) */}
      {isFilterOpen && (
         <div className="filter-modal-overlay" onClick={() => setIsFilterOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom:'15px'}}>Фильтры гардероба</h3>
            <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                <SmartSelect options={dbData.categories} value={filterCategory} onChange={setFilterCategory} placeholder="Категория" />
                <SmartSelect options={dbData.colors} value={filterColor} onChange={setFilterColor} placeholder="Цвет" />
                <SmartSelect options={dbData.seasons} value={filterSeason} onChange={setFilterSeason} placeholder="Сезон" />
                <SmartSelect options={dbData.fits} value={filterFit} onChange={setFilterFit} placeholder="Крой (Fit)" />
            </div>
            <button className="auth-btn btn-primary" style={{marginTop:'20px'}} onClick={() => setIsFilterOpen(false)}>Показать</button>
            <button className="auth-btn" onClick={() => {setFilterCategory(''); setFilterColor(''); setFilterSeason(''); setFilterFit('');}} style={{marginTop: '10px', background: '#eee'}}>Очистить всё</button>
          </div>
        </div>
      )}

      {/* МОДАЛКА СОХРАНЕНИЯ */}
      {isSaveModalOpen && (
        <div className="confirm-modal-overlay" onClick={() => setIsSaveModalOpen(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Сохранить образ</h3>
            <input type="text" className="custom-input" placeholder="Название" value={capsuleName} onChange={e => setCapsuleName(e.target.value)} />
            <div style={{marginTop:'15px'}}>
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