import { useEffect, useState, useRef } from 'react';
import api from '../api';
import { Rnd } from 'react-rnd';
import SmartSelect from '../components/SmartSelect';
import BottomNav from '../components/BottomNav';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { API_URL } from '../config';
import './styles/Capsules.css';

import { 
  COLOR_RULES, STYLE_RULES, FIT_RULES, COLOR_GROUPS, 
  STYLE_FORMALITY, CATEGORY_LAYERS, COLOR_TEMP, STYLE_COMPATIBILITY, SEASON_COMPATIBILITY 
} from '../data/wardrobeRules';

function Capsules() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Основной стейт конструктора
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ categories: [], colors: [], styles: [], seasons: [], fits: [] });
  const [occasions, setOccasions] = useState([]);
  const [board, setBoard] = useState([]);
  const [focusedId, setFocusedId] = useState(null);
  const [topZ, setTopZ] = useState(100);
  const [fetching, setFetching] = useState(true);

  // Умный подбор и модалки
  const [prefOpen, setPrefOpen] = useState(false);
  const [chosenOccasion, setChosenOccasion] = useState(null);
  const [chosenPalette, setChosenPalette] = useState('');
  const [matchModal, setMatchModal] = useState(false);
  const [matchRules, setMatchRules] = useState({ color: true, style: true, fit: true });
  const [smartMode, setSmartMode] = useState(false);
  const [rootItem, setRootItem] = useState(null);

  // Стейт панели фильтров гардероба
  const [filterOpen, setFilterOpen] = useState(false);
  const [catFilter, setCatFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('');
  const [fitFilter, setFitFilter] = useState('');

  // Сохранение капсулы
  const [saveModal, setSaveModal] = useState(false);
  const [title, setTitle] = useState('');
  const [saveOccasion, setSaveOccasion] = useState('');

  const areaRef = useRef(null);
  const [pinchDist, setPinchDist] = useState(null);

  // Валидация сочетаемости вещей
  const isCompatible = (src, tgt) => {
    if (!src || !tgt) return true;
    let [cValid, sValid, fValid] = [true, true, true];

    if (matchRules.color) {
      const srcT = Object.keys(COLOR_TEMP).find(k => COLOR_TEMP[k].includes(src.color)) || 'neutral';
      const tgtT = Object.keys(COLOR_TEMP).find(k => COLOR_TEMP[k].includes(tgt.color)) || 'neutral';
      cValid = src.color === tgt.color || srcT === tgtT || srcT === 'neutral' || tgtT === 'neutral';
    }

    if (matchRules.style) {
      sValid = STYLE_COMPATIBILITY[src.style]?.includes(tgt.style) || src.style === tgt.style;
    }

    if (matchRules.fit) {
      if (src.fit === "Оверсайз (Oversize)" && tgt.fit === "Оверсайз (Oversize)") fValid = false;
    }
    return cValid && sValid && fValid;
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        const [resItems, resCats, resCols, resStys, resSeas, resFits, resOccs] = await Promise.all([
          api.get('/items/'), api.get('/categories'), api.get('/colors'),
          api.get('/styles'), api.get('/seasons'), api.get('/fits'), api.get('/occasions')
        ]);
        
        if (!isMounted) return;

        setItems(resItems.data || []);
        setMeta({ 
          categories: resCats.data, 
          colors: resCols.data, 
          styles: resStys.data, 
          seasons: resSeas.data, 
          fits: resFits.data 
        });
        setOccasions(resOccs.data);

        if (id) {
          const { data: capsulesList } = await api.get('/capsules/');
          const targetCapsule = capsulesList.find(c => String(c.id) === String(id));
          if (targetCapsule) {
            setTitle(targetCapsule.name);
            setSaveOccasion(targetCapsule.occasion || '');
            if (targetCapsule.layout) {
              const parsed = JSON.parse(targetCapsule.layout).map(entry => ({
                ...entry, 
                uniqueId: entry.uniqueId || Math.random(), 
                zIndex: entry.zIndex || 10
              }));
              setBoard(parsed);
              setTopZ(Math.max(...parsed.map(i => i.zIndex), 10) + 1);
            }
          }
        }
      } catch (err) { 
        console.error("Critical dashboard load failure:", err); 
      } finally { 
        if (isMounted) setFetching(false); 
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [id]);

  const handleLayerFocus = (uid) => {
    setFocusedId(uid);
    const z = topZ + 1;
    setTopZ(z);
    setBoard(current => current.map(item => item.uniqueId === uid ? { ...item, zIndex: z } : item));
  };

  const handlePinchResize = (e) => {
    if (e.touches.length === 2 && focusedId) {
      const currentDist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX, 
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (pinchDist === null) {
        setPinchDist(currentDist);
      } else {
        const ratio = currentDist / pinchDist;
        setPinchDist(currentDist);
        setBoard(itemsList => itemsList.map(el => {
          if (el.uniqueId === focusedId) {
            return { 
              ...el, 
              width: Math.max(60, Math.min(500, el.width * ratio)), 
              height: Math.max(60, Math.min(500, el.height * ratio)) 
            };
          }
          return el;
        }));
      }
    }
  };

  const wardrobeFiltered = items.filter(el => {
    if (board.some(b => b.id === el.id)) return false;
    
    const cTag = (el.category || "").trim();
    const sTag = (el.style || "").trim();
    const colTag = (el.color || "").trim().toLowerCase();

    if (chosenOccasion?.default_style && sTag !== chosenOccasion.default_style) return false;
    if (chosenPalette && COLOR_GROUPS[chosenPalette]) {
       const mappedColors = COLOR_GROUPS[chosenPalette].map(c => c.toLowerCase());
       if (!mappedColors.includes(colTag)) return false;
    }

    if (smartMode && rootItem) {
      const rCat = rootItem.category || "";
      const mappings = {
        bottoms: ["Брюки", "Юбки", "Шорты", "Джинсы", "Леггинсы", "Платья"],
        shoes: ["Кроссовки", "Обувь", "Сандалии", "Ботинки", "Туфли на каблуке", "Шлепанцы"],
        swim: ["Купальники", "Плавки"]
      };
      const resolveType = (name) => Object.keys(mappings).find(k => mappings[k].includes(name));
      
      if (resolveType(cTag) && resolveType(cTag) === resolveType(rCat)) return false;
      if (resolveType(rCat) === 'swim' && !["Аксессуары", "Обувь"].includes(cTag)) return false;
      if (!isCompatible(rootItem, el)) return false;
    }

    if (!smartMode) {
      if (catFilter && el.category !== catFilter) return false;
      if (colorFilter && el.color !== colorFilter) return false;
      if (seasonFilter && el.season !== seasonFilter) return false;
      if (fitFilter && el.fit !== fitFilter) return false;
    }

    return true;
  });

  const activeFiltersCount = [catFilter, colorFilter, seasonFilter, fitFilter, chosenOccasion, chosenPalette].filter(Boolean).length;

  const handleSaveFlow = async () => {
    if (!title.trim()) {
      alert("Введите название!");
      return;
    }
    setSaveModal(false); 
    setFocusedId(null); 
    setSmartMode(false);

    try {
      const snap = await html2canvas(areaRef.current, { useCORS: true, backgroundColor: '#ffffff', scale: 2 });
      snap.toBlob(async (fileBlob) => {
        const payload = new FormData();
        payload.append('name', title);
        payload.append('occasion', saveOccasion); 
        payload.append('file', fileBlob, 'capsule.png');
        payload.append('layout', JSON.stringify(board));
        payload.append('item_ids', JSON.stringify(board.map(b => b.id)));

        try {
          if (id) await api.put(`/capsules/${id}`, payload);
          else await api.post('/capsules/', payload);
          navigate('/capsules');
        } catch (serverErr) { 
          alert("Ошибка при сохранении на сервере"); 
        }
      });
    } catch (canvasErr) {
      console.error("Canvas snapshot error:", canvasErr);
    }
  };

  const getMediaUrls = (target) => {
    const cleanPath = target?.image_path ? String(target.image_path).replace(/^\/+/, '') : '';
    return [`${API_URL}/${cleanPath}`, `/${cleanPath}`, cleanPath].filter(Boolean);
  };

  const onImgLoadError = (evt, target) => {
    const node = evt.target;
    let step = parseInt(node.dataset.err || '0', 10);
    const pool = getMediaUrls(target);
    if (step + 1 < pool.length) { 
      node.dataset.err = String(step + 1); 
      node.src = pool[step + 1]; 
    }
  };

  if (fetching) return <div style={{padding: 50, textAlign:'center'}}>Загрузка...</div>;

  return (
    <div className="capsule-container" onTouchMove={handlePinchResize} onTouchEnd={() => setPinchDist(null)}>
      
      <div style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          paddingTop: 'calc(env(safe-area-inset-top, 20px) + 15px)', 
          paddingLeft: '15px', 
          paddingRight: '15px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          zIndex: 2000, 
          pointerEvents: 'none' 
      }}>
        <div style={{ pointerEvents: 'auto' }}>
            {focusedId && !smartMode && (
                <button onClick={() => setMatchModal(true)}
                  style={{ 
                    backgroundColor: 'white', 
                    border: '2px solid var(--primary-green)', 
                    borderRadius: '20px', 
                    padding: '8px 18px', 
                    fontWeight: 'bold', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    color: 'var(--primary-green)', 
                    boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                    fontSize: '14px'
                  }}>
                  🪄 <span>Подсказать</span>
                </button>
            )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', pointerEvents: 'auto' }}>
            <button 
                className="auth-btn btn-primary" 
                onClick={() => setSaveModal(true)} 
                style={{ 
                    width: 'auto', 
                    padding: '0 25px', 
                    height: '42px', 
                    borderRadius: '21px',
                    fontSize: '14px',
                    boxShadow: '0 4px 15px rgba(52, 94, 55, 0.3)' 
                }}
            >
                Сохранить
            </button>
        </div>
      </div>

      <div className="capsule-canvas" onPointerDown={() => { setFocusedId(null); setSmartMode(false); }}>
        <div ref={areaRef} style={{ width: '100%', height: '100%', position: 'relative', background: 'white' }}>
            {board.map((item) => (
            <Rnd 
                key={item.uniqueId} 
                size={{ width: item.width, height: item.height }} 
                position={{ x: item.x, y: item.y }} 
                bounds="parent" 
                lockAspectRatio={true}
                onDragStart={() => handleLayerFocus(item.uniqueId)}
                onDragStop={(e, d) => setBoard(curr => curr.map(i => i.uniqueId === item.uniqueId ? { ...i, x: d.x, y: d.y } : i))}
                onResizeStop={(e, dir, ref, delta, pos) => setBoard(curr => curr.map(i => i.uniqueId === item.uniqueId ? { ...i, width: parseInt(ref.style.width), height: parseInt(ref.style.height), ...pos } : i))}
                onMouseDown={() => handleLayerFocus(item.uniqueId)}
                className={`rnd-item ${focusedId === item.uniqueId ? 'active' : ''}`} 
                style={{ zIndex: item.zIndex }}
                resizeHandleComponent={{ bottomRight: focusedId === item.uniqueId ? <div className="resize-handle" /> : null }}
            >
                <img src={getMediaUrls(item)[0]} onError={(e) => onImgLoadError(e, item)} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                {focusedId === item.uniqueId && (
                    <div className="delete-handle" onPointerDown={(e) => { 
                      e.stopPropagation(); 
                      if (item.uniqueId === rootItem?.uniqueId) setSmartMode(false);
                      setBoard(curr => curr.filter(i => i.uniqueId !== item.uniqueId)); 
                      setFocusedId(null); 
                    }}>×</div>
                )}
            </Rnd>
            ))}
        </div>
      </div>

      <div className="capsule-wardrobe">
        <div style={{ padding: '10px 15px', display: 'flex', gap: '10px' }}>
           {smartMode ? (
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'var(--light-green)', padding: '8px 15px', borderRadius: '12px' }}>
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Подбор к: {rootItem?.name}</span>
                <button onClick={() => setSmartMode(false)} style={{ color: 'red', border: 'none', background: 'none', fontWeight: 'bold' }}>✕</button>
             </div>
           ) : (
             <>
                <button onClick={() => setFilterOpen(true)} style={{ flex: 1, backgroundColor: activeFiltersCount > 0 ? 'var(--primary-green)' : '#fff', color: activeFiltersCount > 0 ? '#fff' : '#333', border: '1px solid #ddd', borderRadius: '12px', fontWeight: '600' }}>
                    Вещи гардероба {activeFiltersCount > 0 ? `(${activeFiltersCount})` : '▼'}
                </button>
                <button onClick={() => setPrefOpen(true)} className="pref-btn" style={{ backgroundColor: chosenOccasion || chosenPalette ? 'var(--accent-pink)' : '#fff' }}>
                    ⚙️
                </button>
             </>
           )}
        </div>
        <div className="capsule-grid">
          {wardrobeFiltered.map(item => (
            <div key={item.id} className="mini-card" onClick={() => {
                const z = topZ + 1; setTopZ(z);
                setBoard([...board, { ...item, uniqueId: Math.random(), x: 50, y: 50, width: 140, height: 140, zIndex: z }]);
            }}>
              <img src={getMediaUrls(item)[0]} onError={(e) => onImgLoadError(e, item)} />
            </div>
          ))}
        </div>
      </div>
      
      <BottomNav />

      {matchModal && (
        <div className="filter-modal-overlay" onClick={() => setMatchModal(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <h3>Критерии подбора</h3>
            <div style={{display:'flex', flexDirection:'column', gap:'15px', padding:'10px'}}>
                <label style={{display:'flex', alignItems:'center', gap:'12px', cursor:'pointer'}}>
                    <input type="checkbox" checked={matchRules.color} onChange={e => setMatchRules({...matchRules, color: e.target.checked})} style={{width:'20px', height:'20px'}} />
                    Гармония цветов
                </label>
                <label style={{display:'flex', alignItems:'center', gap:'12px', cursor:'pointer'}}>
                    <input type="checkbox" checked={matchRules.style} onChange={e => setMatchRules({...matchRules, style: e.target.checked})} style={{width:'22px', height:'22px'}} />
                    Единый стиль
                </label>
                <label style={{display:'flex', alignItems:'center', gap:'12px', cursor:'pointer'}}>
                    <input type="checkbox" checked={matchRules.fit} onChange={e => setMatchRules({...matchRules, fit: e.target.checked})} style={{width:'20px', height:'20px'}} />
                    Баланс объемов (Крой)
                </label>
            </div>
            <button className="auth-btn btn-primary" style={{marginTop:'25px'}} onClick={() => { 
                const itm = board.find(i => i.uniqueId === focusedId);
                setRootItem(itm); setSmartMode(true); setMatchModal(false); 
            }}>Найти пары</button>
          </div>
        </div>
      )}

      {prefOpen && (
        <div className="filter-modal-overlay" onClick={() => setPrefOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <h3>Предпочтения</h3>
            <label style={{fontSize:'13px', fontWeight:'bold'}}>Случай</label>
            <div style={{display:'flex', flexWrap:'wrap', gap:'8px', margin:'10px 0'}}>
                {occasions.map(occ => (
                    <button key={occ.id} className="filter-chip" style={{ margin:0, background: chosenOccasion?.id === occ.id ? 'var(--primary-green)' : '#f0f0f0', color: chosenOccasion?.id === occ.id ? 'white' : 'black', border: 'none' }}
                        onClick={() => setChosenOccasion(chosenOccasion?.id === occ.id ? null : occ)}>{occ.name}</button>
                ))}
            </div>
            <label style={{fontSize:'13px', fontWeight:'bold'}}>Палитра</label>
            <div style={{display:'flex', flexWrap:'wrap', gap:'10px', marginTop:'10px'}}>
              {[{id:'light', n:'Пастель', c:'#f8edeb'}, {id:'bright', n:'Ярко', c:'#ffafcc'}, {id:'dark', n:'Темно', c:'#2b2d42'}, {id:'neutral', n:'Другое', c:'#e0e0e0'}].map(p => (
                  <button key={p.id} onClick={() => setChosenPalette(chosenPalette === p.id ? '' : p.id)} style={{ flex: '1 0 40%', height:'45px', borderRadius:'10px', border: chosenPalette === p.id ? '3px solid var(--primary-green)' : '1px solid #ddd', background: p.c, color: p.id==='dark'?'white':'black', fontWeight:'bold' }}>{p.n}</button>
              ))}
            </div>
            <button className="auth-btn btn-primary" style={{marginTop:'25px'}} onClick={() => setPrefOpen(false)}>Готово</button>
            <button className="auth-btn" style={{marginTop:'10px', color: 'red', background: 'none'}} onClick={() => { setChosenOccasion(null); setChosenPalette(''); }}>Сбросить</button>
          </div>
        </div>
      )}

      {filterOpen && (
         <div className="filter-modal-overlay" onClick={() => setFilterOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <h3>Фильтры гардероба</h3>
            <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                <SmartSelect options={meta.categories} value={catFilter} onChange={setCatFilter} placeholder="Категория" />
                <SmartSelect options={meta.colors} value={colorFilter} onChange={setColorFilter} placeholder="Цвет" />
                <SmartSelect options={meta.seasons} value={seasonFilter} onChange={setSeasonFilter} placeholder="Сезон" />
                <SmartSelect options={meta.fits} value={fitFilter} onChange={setFitFilter} placeholder="Крой" />
            </div>
            <button className="auth-btn btn-primary" style={{marginTop:'20px'}} onClick={() => setFilterOpen(false)}>Показать</button>
            <button className="auth-btn" onClick={() => {setCatFilter(''); setColorFilter(''); setSeasonFilter(''); setFitFilter('');}} style={{marginTop: '10px', background: '#eee'}}>Очистить всё</button>
          </div>
        </div>
      )}

      {saveModal && (
        <div className="confirm-modal-overlay" onClick={() => setSaveModal(false)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <h3>Сохранить образ</h3>
            <input type="text" className="custom-input" placeholder="Название" value={title} onChange={e => setTitle(e.target.value)} />
            <div style={{marginTop:'15px'}}>
                <SmartSelect options={occasions.map(o => o.name)} value={saveOccasion} onChange={setSaveOccasion} placeholder="Событие" />
            </div>
            <div style={{display:'flex', gap:'10px', marginTop:'20px'}}>
              <button className="auth-btn" onClick={() => setSaveModal(false)} style={{background:'#f0f0f0'}}>Отмена</button>
              <button className="auth-btn btn-primary" onClick={handleSaveFlow}>Готово</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Capsules;