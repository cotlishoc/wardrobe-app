import { useEffect, useState, useRef } from 'react';
import api from '../api';
import { Rnd } from 'react-rnd';
import SmartSelect from '../components/SmartSelect';
import BottomNav from '../components/BottomNav';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { API_URL } from '../config';

// !!! ВАЖНО: Импортируем ВСЕ три константы !!!
import { COLOR_RULES, STYLE_RULES, COLOR_GROUPS } from '../data/wardrobeRules';

function Capsules() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [dbData, setDbData] = useState({ categories: [], colors: [], styles: [], seasons: [] });
  const [canvasItems, setCanvasItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [loading, setLoading] = useState(!!id);

  // Модалка сохранения
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [capsuleName, setCapsuleName] = useState('');

  // Режим подбора
  const [isMatchingMode, setIsMatchingMode] = useState(false);
  const [matchSourceItem, setMatchSourceItem] = useState(null);

  // Фильтры
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterStyle, setFilterStyle] = useState('');

  const canvasRef = useRef(null);

  // Определяем, запущено ли в Capacitor/APK (WebView)
  const isCapacitor = typeof window !== 'undefined' && (
    (window.location && window.location.protocol && window.location.protocol.startsWith('capacitor')) ||
    (navigator && navigator.userAgent && navigator.userAgent.includes('Capacitor')) ||
    Boolean(window.Capacitor)
  );

  const buildSrcCandidates = (item) => {
    const path = (item && item.image_path) ? String(item.image_path) : '';
    const clean = path.replace(/^\/+/, '');
    const candidates = [];
    if (API_URL) candidates.push(`${API_URL}/${clean}`);
    // абсолютный путь на сервере
    candidates.push(`/${clean}`);
    // относительный путь
    candidates.push(clean);
    // если в path был префикс static, пробуем без него
    if (clean.startsWith('static/')) candidates.push(clean.replace(/^static\//, ''));
    return Array.from(new Set(candidates.filter(Boolean)));
  };

  // Обработчик ошибок загрузки: цикл по кандидатам, затем placeholder
  const handleImageError = (e, item) => {
    try {
      const img = e.target;
      let attempts = parseInt(img.dataset.err || '0', 10);
      let candidates = [];
      try { candidates = img.dataset.cands ? JSON.parse(img.dataset.cands) : buildSrcCandidates(item); } catch(_) { candidates = buildSrcCandidates(item); }

      attempts += 1;
      img.dataset.err = String(attempts);
      img.dataset.cands = JSON.stringify(candidates);

      if (attempts < candidates.length) {
        img.src = candidates[attempts];
      } else {
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
      }
    } catch (err) {
      e.target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    }
  };

  // 1. Загрузка вещей
  
  useEffect(() => {
    // Вещи
    api.get('/items/')
      .then(res => setWardrobeItems(res.data))
      .catch(err => console.error(err));

    // --- ДОБАВЬ ЭТОТ БЛОК ДЛЯ ЗАГРУЗКИ ФИЛЬТРОВ ---
    const fetchFilters = async () => {
      try {
        const [c, cl, st, se] = await Promise.all([
          api.get('/categories'), 
          api.get('/colors'),
          api.get('/styles'), 
          api.get('/seasons')
        ]);
        setDbData({ 
          categories: c.data, 
          colors: cl.data, 
          styles: st.data, 
          seasons: se.data 
        });
      } catch (e) { 
        console.error("Ошибка загрузки справочников в капсулах:", e); 
      }
    };
    fetchFilters();
    // ----------------------------------------------
  }, []);

  // 2. Загрузка капсулы
  useEffect(() => {
    if (!id) return;
    api.get('/capsules/')
      .then(res => {
        const capsule = res.data.find(c => String(c.id) === String(id));
        if (capsule) {
          setCapsuleName(capsule.name);
          if (capsule.layout) {
            try {
              const savedItems = JSON.parse(capsule.layout);
              const restoredItems = savedItems.map(item => ({
                  ...item,
                  uniqueId: Date.now() + Math.random()
              }));
              setCanvasItems(restoredItems);
              const maxZ = Math.max(...restoredItems.map(i => i.zIndex || 10), 10);
              setMaxZIndex(maxZ);
            } catch (e) { console.error("Ошибка layout", e); }
          }
        }
        setLoading(false);
      })
      .catch(err => setLoading(false));
  }, [id]);

  // === ФУНКЦИЯ ПРОВЕРКИ СОВМЕСТИМОСТИ (ФИНАЛЬНАЯ) ===
  const checkCompatibility = (source, target) => {
    if (!source) return true;

    // Приводим к нижнему регистру для надежности
    const sColor = source.color ? source.color.toLowerCase().trim() : null;
    const tColor = target.color ? target.color.toLowerCase().trim() : null;
    
    const sStyle = source.style ? source.style.toLowerCase().trim() : null;
    const tStyle = target.style ? target.style.toLowerCase().trim() : null;

    // --- ПРОВЕРКА ЦВЕТА ---
    let colorMatch = false;

    // 1. Точное совпадение
    if (sColor === tColor) {
        colorMatch = true; 
    } 
    // 2. Проверка по правилам
    else if (sColor && COLOR_RULES[sColor] && tColor) {
        if (COLOR_RULES[sColor].includes(tColor)) {
            colorMatch = true;
        }
    }

    // 3. Проверка по ГРУППАМ (если точного правила нет)
    if (!colorMatch && sColor && tColor && COLOR_GROUPS) {
        const sGroup = Object.keys(COLOR_GROUPS).find(group => COLOR_GROUPS[group].includes(sColor));
        const tGroup = Object.keys(COLOR_GROUPS).find(group => COLOR_GROUPS[group].includes(tColor));

        if (sGroup && tGroup) {
            // Нейтральные ко всему
            if (sGroup === 'neutral' || tGroup === 'neutral') colorMatch = true;
            // Темное + Светлое
            if ((sGroup === 'dark' && tGroup === 'light') || (sGroup === 'light' && tGroup === 'dark')) colorMatch = true;
            // Пастель + Пастель
            if (sGroup === 'pastel' && tGroup === 'pastel') colorMatch = true;
            // Металлик + Темное
            if ((sGroup === 'metallic' && tGroup === 'dark') || (tGroup === 'metallic' && sGroup === 'dark')) colorMatch = true;
        }
    }

    // --- ПРОВЕРКА СТИЛЯ ---
    let styleMatch = false;
    if (sStyle === tStyle) {
        styleMatch = true;
    } else if (sStyle && STYLE_RULES[sStyle]) {
        if (tStyle && STYLE_RULES[sStyle].includes(tStyle)) {
            styleMatch = true;
        }
    }

    // ИТОГ: Или цвет, Или стиль
    return colorMatch || styleMatch;
  };

  const filteredWardrobe = wardrobeItems.filter(item => {
    // 1. Скрываем то, что уже перенесено на холст
    if (canvasItems.some(canvasItem => canvasItem.id === item.id)) return false;

    // Подготовка данных для сравнения (нормализация)
    const itemCategory = (item.category || "").trim().toLowerCase();
    const itemColor = (item.color || "").trim().toLowerCase();
    const itemSeason = (item.season || "").trim().toLowerCase();
    const itemStyle = (item.style || "").trim().toLowerCase();

    const selCategory = filterCategory.trim().toLowerCase();
    const selColor = filterColor.trim().toLowerCase();
    const selSeason = filterSeason.trim().toLowerCase();
    const selStyle = filterStyle.trim().toLowerCase();

    // 2. ЛОГИКА ИСКЛЮЧЕНИЯ СЛОТОВ (улучшенная)
    const categoriesOnCanvas = canvasItems.map(i => (i.category || "").trim().toLowerCase());
    
    const shoeCats = ['кроссовки', 'обувь', 'сандалии', 'ботинки', 'туфли на каблуке', 'шлепанцы', 'спортивная обувь'];
    const bottomCats = ['брюки', 'шорты', 'юбки', 'джинсы', 'леггинсы'];
    const topCats = ['верхняя одежда', 'куртки и пальто', 'бомберы', 'ветровки', 'стеганые куртки', 'кожаные куртки'];

    if (shoeCats.includes(itemCategory) && categoriesOnCanvas.some(c => shoeCats.includes(c))) return false;
    if (bottomCats.includes(itemCategory) && categoriesOnCanvas.some(c => bottomCats.includes(c) || c === 'платья')) return false;
    if (topCats.includes(itemCategory) && categoriesOnCanvas.some(c => topCats.includes(c))) return false;

    // 3. СОВМЕЩЕНИЕ РЕЖИМА ПОДБОРА И ФИЛЬТРОВ
    // Сначала проверяем на совместимость (если режим включен)
    if (isMatchingMode && matchSourceItem) {
      const isCompatible = checkCompatibility(matchSourceItem, item);
      if (!isCompatible) return false;
    }

    // 4. ПРИМЕНЕНИЕ РУЧНЫХ ФИЛЬТРОВ (теперь они работают вместе с ИИ)
    if (filterCategory && itemCategory !== selCategory) return false;
    if (filterColor && itemColor !== selColor) return false;
    if (filterSeason && itemSeason !== selSeason) return false;
    if (filterStyle && itemStyle !== selStyle) return false;

    return true;
  });

  const handleStartMatching = () => {
    const activeItem = canvasItems.find(i => i.uniqueId === activeId);
    if (!activeItem) return;
    setMatchSourceItem(activeItem);
    setIsMatchingMode(true);
    // Сбрасываем фильтры UI
    setFilterCategory(''); setFilterColor(''); setFilterSeason(''); setFilterStyle('');
  };

  const handleStopMatching = () => {
    setIsMatchingMode(false);
    setMatchSourceItem(null);
  };

  const clearFilters = () => {
    setFilterCategory(''); setFilterColor(''); setFilterSeason(''); setFilterStyle('');
    setIsFilterOpen(false);
  };
  const activeFiltersCount = [filterCategory, filterColor, filterSeason, filterStyle].filter(Boolean).length;

  // === УПРАВЛЕНИЕ ХОЛСТОМ ===
  const addToCanvas = (item) => {
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    const newItem = {
      uniqueId: Date.now() + Math.random(),
      ...item,
      x: 50, y: 50, width: 150, height: 150, zIndex: nextZ
    };
    setCanvasItems([...canvasItems, newItem]);
    setActiveId(newItem.uniqueId);
  };

  const updateItemState = (uniqueId, d) => {
    setCanvasItems(prev => prev.map(item => item.uniqueId === uniqueId ? { ...item, ...d } : item));
  };

  const bringToFront = (uniqueId) => {
    setActiveId(uniqueId);
    const item = canvasItems.find(i => i.uniqueId === uniqueId);
    if (item && item.zIndex === maxZIndex) return;
    const nextZ = maxZIndex + 1;
    setMaxZIndex(nextZ);
    setCanvasItems(prev => prev.map(i => i.uniqueId === uniqueId ? { ...i, zIndex: nextZ } : i));
  };

  const removeFromCanvas = (uniqueId) => {
    setCanvasItems(prev => prev.filter(i => i.uniqueId !== uniqueId));
    if (activeId === uniqueId) {
        setActiveId(null);
        handleStopMatching();
    }
  };

  const resetCanvas = () => {
    if (window.confirm("Очистить холст?")) {
        setCanvasItems([]);
        handleStopMatching();
    }
  };

const handleDeleteCapsule = async () => {
  if (!id) return; // Если мы создаем новую, удалять нечего
  if (window.confirm("Удалить эту капсулу навсегда?")) {
    try {
      // ПРОВЕРЬ ЭТУ СТРОКУ: слэш в начале и правильный ID
      await api.delete(`/capsules/${id}`); 
      alert("Капсула удалена");
      navigate('/capsules'); // Уходим в список всех капсул
    } catch (err) {
      console.error(err);
      alert("Не удалось удалить капсулу");
    }
  }
};

  const openSaveModal = () => {
    if (canvasItems.length === 0) return alert("Холст пуст!");
    setIsSaveModalOpen(true);
  };

  const performSave = async () => {
    if (!capsuleName.trim()) return alert("Введите название!");
    setIsSaveModalOpen(false);
    setActiveId(null);
    handleStopMatching();

    setTimeout(async () => {
      try {
        if (!canvasRef.current) return;
        const canvas = await html2canvas(canvasRef.current, {
            useCORS: true, allowTaint: true, backgroundColor: '#ffffff', scale: 2
        });
        canvas.toBlob(async (blob) => {
          if (!blob) return alert("Ошибка скриншота");
          const formData = new FormData();
          formData.append('name', capsuleName);
          formData.append('file', blob, 'capsule.png');
          formData.append('layout', JSON.stringify(canvasItems));
          formData.append('item_ids', JSON.stringify(canvasItems.map(i => i.id)));

          try {
            if (id) {
              await api.put(`/capsules/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
              alert('Обновлено!');
            } else {
              await api.post('/capsules/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
              alert('Создано!');
            }
            navigate('/capsules');
          } catch (e) { alert("Ошибка сохранения"); }
        }, 'image/png');
      } catch (err) { alert("Ошибка скриншота"); }
    }, 100);
  };

  const [touchPointers, setTouchPointers] = useState({});
  const [initialPinch, setInitialPinch] = useState(null);

  // Pinch handlers
  const onPointerDown = (e) => {
    if (e.pointerType === 'touch') {
      setTouchPointers(prev => ({ ...prev, [e.pointerId]: { x: e.clientX, y: e.clientY } }));
    }
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== 'touch') return;
    setTouchPointers(prev => {
      if (!prev[e.pointerId]) return prev;
      const updated = { ...prev, [e.pointerId]: { x: e.clientX, y: e.clientY } };
      const ids = Object.keys(updated);
      if (ids.length === 2 && activeId) {
        const p1 = updated[ids[0]];
        const p2 = updated[ids[1]];
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        if (!initialPinch) {
          setInitialPinch({ dist, item: activeId, size: canvasItems.find(i => i.uniqueId === activeId) });
        } else if (initialPinch && initialPinch.item === activeId) {
          const scale = dist / initialPinch.dist;
          const base = initialPinch.size;
          const newW = Math.max(50, Math.round(base.width * scale));
          const newH = Math.max(50, Math.round(base.height * scale));
          updateItemState(activeId, { width: newW, height: newH });
        }
      }
      return updated;
    });
  };
  const onPointerUp = (e) => {
    if (e.pointerType === 'touch') {
      setTouchPointers(prev => { const p = { ...prev }; delete p[e.pointerId]; return p; });
      setInitialPinch(null);
    }
  };

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
    };
  }, [canvasRef, activeId, canvasItems, initialPinch]);

  if (loading) return <div style={{padding: 20}}>Загрузка...</div>;

  return (
    <div className="capsule-container">
      
      {/* ХОЛСТ */}
      <div 
        className="capsule-canvas" 
        onPointerDown={() => { 
            setActiveId(null); 
            handleStopMatching(); 
        }}
      >
        
        {/* ЛЕВЫЙ ВЕРХНИЙ (ПОДОБРАТЬ) - Защита от клика */}
        <div style={{position: 'absolute', top: 15, left: 15, zIndex: 99999}} onPointerDown={(e) => e.stopPropagation()}>
           {activeId && !isMatchingMode && (
             <button 
                className="auth-btn" 
                onClick={(e) => { e.stopPropagation(); handleStartMatching(); }}
                style={{
                    width: 'auto', padding: '0 15px', height: '40px', fontSize: '14px', 
                    background: 'white', color: 'var(--primary-green)', 
                    border: '2px solid var(--primary-green)', borderRadius: '20px',
                    display: 'flex', alignItems: 'center', gap: '8px', 
                    boxShadow: '0 4px 10px rgba(0,0,0,0.15)', fontWeight: 'bold', cursor: 'pointer'
                }}
             >
                <span>🪄</span> Подобрать
             </button>
           )}
        </div>

        {/* ПРАВЫЙ ВЕРХНИЙ (СОХРАНИТЬ) - Защита от клика */}
        <div style={{position: 'absolute', top: 15, right: 15, zIndex: 99999, display: 'flex', gap: '10px'}} onPointerDown={(e) => e.stopPropagation()}>
           {id && (
             <button className="auth-btn" onClick={handleDeleteCapsule} style={{width: '40px', padding: 0, height: '40px', background: '#fff', color: 'red', border: '1px solid #ffcccc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', cursor: 'pointer'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
             </button>
           )}
           {canvasItems.length > 0 && !id && (
            <button className="auth-btn" onClick={resetCanvas} style={{width: 'auto', padding: '0 12px', height: '40px', background: '#fff', color: '#666', border: '1px solid #eee', fontSize: '13px', borderRadius: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', cursor: 'pointer'}}>
              Сброс
            </button>
           )}
           <button className="auth-btn btn-primary" onClick={openSaveModal} style={{width: 'auto', padding: '0 20px', height: '40px', fontSize: '14px', borderRadius: '20px', boxShadow: '0 4px 10px rgba(52, 94, 55, 0.3)', cursor: 'pointer'}}>
              Сохранить
           </button>
        </div>

        {/* ЗОНА ВЕЩЕЙ */}
        <div ref={canvasRef} className="capsule-canvas-content" style={{width: '100%', height: '100%', position: 'relative', background: 'white'}}>
            {canvasItems.length === 0 && (
                <div className="canvas-hint" style={{opacity: 0.5, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none'}}>
                    Добавьте вещи на холст
                </div>
            )}

            {canvasItems.map((item) => (
            <Rnd
                key={item.uniqueId}
                size={{ width: item.width, height: item.height }}
                position={{ x: item.x, y: item.y }}
                bounds="parent"
                enableResizing={{ bottomRight: true }}
                lockAspectRatio={true}
                minWidth={60} minHeight={60} // Немного увеличим минимум для мобилок
                
                /* Добавляем стили для области захвата, чтобы было легче попасть пальцем */
                resizeHandleStyles={{
                  bottomRight: {
                    width: '40px', 
                    height: '40px', 
                    right: '-15px', 
                    bottom: '-15px',
                    cursor: 'nwse-resize'
                  }
                }}
                
                /* Ваша текущая верстка ручки */
                resizeHandleComponent={{
                  bottomRight: activeId === item.uniqueId ? <div className="resize-handle" /> : null
                }}
                
                onDragStop={(e, d) => updateItemState(item.uniqueId, { x: d.x, y: d.y })}
                onResizeStop={(e, direction, ref, delta, position) => {
                  updateItemState(item.uniqueId, { 
                    width: parseInt(ref.style.width), 
                    height: parseInt(ref.style.height), 
                    ...position 
                  });
                }}
                
                /* Улучшаем фокус на предмете при касании */
                onMouseDown={(e) => { e.stopPropagation(); bringToFront(item.uniqueId); }}
                onTouchStart={(e) => { 
                    // На мобилках это событие важнее
                    e.stopPropagation(); 
                    bringToFront(item.uniqueId); 
                }}
                
                className={`rnd-item ${activeId === item.uniqueId ? 'active' : ''}`}
                style={{ zIndex: item.zIndex }}
            >
                <img 
                    // используем первый кандидат как начальный src
                    src={buildSrcCandidates(item)[0]}
                    alt="item" 
                    draggable="false" 
                    {...(isCapacitor ? {} : { crossOrigin: 'anonymous' })}
                    data-err="0"
                    data-cands={JSON.stringify(buildSrcCandidates(item))}
                    onError={(e) => handleImageError(e, item)}
                    style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain', 
                        pointerEvents: 'auto'
                    }} 
                />
                {activeId === item.uniqueId && (
                    <div 
                        className="delete-handle" 
                        style={{ width: '30px', height: '30px', fontSize: '20px' }} // Увеличим кнопку удаления
                        onPointerDown={(e) => { e.stopPropagation(); removeFromCanvas(item.uniqueId); }}
                    >
                        ×
                    </div>
                )}
            </Rnd>
            ))}
        </div>
      </div>

      {/* НИЖНЯЯ ПАНЕЛЬ */}
      <div className="capsule-wardrobe">
        <div className="capsule-wardrobe-header">
           {isMatchingMode ? (
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', padding:'0 5px'}}>
                <span style={{fontWeight:'bold', color: 'var(--primary-green)', fontSize: '14px'}}>
                    Подходит к: {matchSourceItem?.name}
                </span>
                <button onClick={handleStopMatching} style={{background:'none', border:'none', color:'#e05d82', fontWeight:'bold', fontSize:'13px', cursor: 'pointer'}}>
                    ✕ Отмена
                </button>
             </div>
           ) : (
             <button 
                className="filter-chip" 
                onClick={() => setIsFilterOpen(true)}
                style={{
                  width: '100%', justifyContent: 'center', marginBottom: 0,
                  backgroundColor: activeFiltersCount > 0 ? 'var(--primary-green)' : 'white',
                  color: activeFiltersCount > 0 ? 'white' : 'var(--primary-green)'
                }}
              >
                Вещи гардероба {activeFiltersCount > 0 ? `(${activeFiltersCount})` : '▼'}
              </button>
           )}
        </div>

        <div className="capsule-grid">
          {filteredWardrobe.map(item => (
            <div key={item.id} className="mini-card" onClick={() => addToCanvas(item)}>
              <img  src={buildSrcCandidates(item)[0]}  alt={item.name} {...(isCapacitor ? {} : { crossOrigin: 'anonymous' })} data-err="0" data-cands={JSON.stringify(buildSrcCandidates(item))} onError={(e) => handleImageError(e, item)} />
            </div>
          ))}
          {filteredWardrobe.length === 0 && (
             <p style={{textAlign: 'center', width: '100%', fontSize: '12px', color: '#888', marginTop: '20px'}}>
               {isMatchingMode ? "Нет подходящих вещей" : "Гардероб пуст"}
             </p>
          )}
        </div>
      </div>
      
      <BottomNav />

      {isSaveModalOpen && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <h3>{id ? 'Обновить капсулу' : 'Сохранить капсулу'}</h3>
            <input type="text" className="custom-input" placeholder="Название образа" value={capsuleName} onChange={e => setCapsuleName(e.target.value)} autoFocus />
            <div className="confirm-actions">
              <button className="auth-btn" onClick={() => setIsSaveModalOpen(false)} style={{background: '#f0f0f0', color: '#000'}}>Отмена</button>
              <button className="auth-btn btn-primary" onClick={performSave}>{id ? 'Обновить' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      {isFilterOpen && (
        <div className="filter-modal-overlay" onClick={() => setIsFilterOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
                <h3 style={{margin: 0}}>Фильтры</h3>
                <button onClick={() => setIsFilterOpen(false)} style={{background:'none', border:'none', fontSize:'28px', color: 'var(--primary-green)'}}>&times;</button>
            </div>

            {/* ПЕРЕДАЕМ ДАННЫЕ В OPTIONS ТАК ЖЕ, КАК В ГАРДЕРОБЕ */}
            <SmartSelect options={dbData.categories} value={filterCategory} onChange={setFilterCategory} placeholder="Категория" />
            <SmartSelect options={dbData.colors} value={filterColor} onChange={setFilterColor} placeholder="Цвет" />
            <SmartSelect options={dbData.seasons} value={filterSeason} onChange={setFilterSeason} placeholder="Сезон" />
            <SmartSelect options={dbData.styles} value={filterStyle} onChange={setFilterStyle} placeholder="Стиль" />

            <div className="filter-actions" style={{marginTop: '25px'}}>
              <button className="auth-btn btn-primary" onClick={() => setIsFilterOpen(false)}>Применить</button>
              <button className="auth-btn" onClick={clearFilters} style={{background: '#ffe0e9', color: '#e05d82', marginTop: '10px'}}>Сбросить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Capsules;