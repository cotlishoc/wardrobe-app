import { useEffect, useState, useRef } from 'react';
import api from '../api';
import { Rnd } from 'react-rnd';
import SmartSelect from '../components/SmartSelect';
import BottomNav from '../components/BottomNav';
import { useParams, useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';

function Capsules() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [wardrobeItems, setWardrobeItems] = useState([]);
  const [canvasItems, setCanvasItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [maxZIndex, setMaxZIndex] = useState(10);
  const [loading, setLoading] = useState(!!id);

  // Модалка сохранения
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [capsuleName, setCapsuleName] = useState('');

  // Фильтры
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSeason, setFilterSeason] = useState('');
  const [filterStyle, setFilterStyle] = useState('');

  const canvasRef = useRef(null);

  // 1. Загрузка вещей
  useEffect(() => {
    api.get('/items/')
      .then(res => setWardrobeItems(res.data))
      .catch(err => console.error(err));
  }, []);

  // 2. Загрузка капсулы (Редактирование)
  useEffect(() => {
    if (!id) return;
    api.get('/capsules/')
      .then(res => {
        const capsule = res.data.find(c => String(c.id) === String(id));
        if (capsule) {
          setCapsuleName(capsule.name); // Подставляем старое имя
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

  // Фильтрация
  const filteredWardrobe = wardrobeItems.filter(item => {
    const isOnCanvas = canvasItems.some(canvasItem => canvasItem.id === item.id);
    if (isOnCanvas) return false;
    if (filterCategory && item.category !== filterCategory) return false;
    if (filterColor && item.color !== filterColor) return false;
    if (filterSeason && item.season !== filterSeason) return false;
    if (filterStyle && item.style !== filterStyle) return false;
    return true;
  });

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
  };

  const resetCanvas = () => {
    if (window.confirm("Очистить холст?")) setCanvasItems([]);
  };

  // Удаление всей капсулы (кнопка вверху)
  const handleDeleteCapsule = async () => {
    if (!id) return;
    if (window.confirm("Вы точно хотите удалить эту капсулу?")) {
      try {
        await api.delete(`/capsules/${id}`);
        navigate('/capsules');
      } catch (err) {
        alert("Ошибка удаления");
      }
    }
  };

  // Кнопка "Сохранить" открывает модалку
  const openSaveModal = () => {
    if (canvasItems.length === 0) {
      alert("Холст пуст! Добавьте вещи.");
      return;
    }
    setIsSaveModalOpen(true);
  };

  // Реальное сохранение (после модалки)
  const performSave = async () => {
    if (!capsuleName.trim()) return alert("Введите название!");
    
    setIsSaveModalOpen(false); // Закрываем модалку
    setActiveId(null);         // Убираем рамки

    // Ждем, пока рамки исчезнут
    setTimeout(async () => {
      try {
        if (!canvasRef.current) return;

        const canvas = await html2canvas(canvasRef.current, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scale: 2
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
              // РЕДАКТИРОВАНИЕ (PUT)
              await api.put(`/capsules/${id}`, formData, {
                  headers: { 'Content-Type': 'multipart/form-data' }
              });
              alert('Капсула обновлена!');
            } else {
              // СОЗДАНИЕ (POST)
              await api.post('/capsules/', formData, {
                  headers: { 'Content-Type': 'multipart/form-data' }
              });
              alert('Капсула создана!');
            }
            navigate('/capsules');
          } catch (e) {
            console.error(e);
            alert("Ошибка сохранения");
          }
        }, 'image/png');
      } catch (err) {
        console.error(err);
        alert("Ошибка скриншота");
      }
    }, 100);
  };

  if (loading) return <div style={{padding: 20}}>Загрузка...</div>;

  return (
    <div className="capsule-container">
      
      {/* ХОЛСТ */}
      <div className="capsule-canvas" onPointerDown={() => setActiveId(null)}>
        
        {/* КНОПКИ ВЕРХНИЕ */}
        <div style={{position: 'absolute', top: 10, right: 10, zIndex: 99999, display: 'flex', gap: '8px'}}>
           {/* Если редактируем (есть id), показываем кнопку удаления */}
           {id && (
             <button className="auth-btn" onClick={handleDeleteCapsule} style={{width: '35px', padding: 0, height: '35px', background: '#fff', color: 'red', border: '1px solid red', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                {/* Иконка мусорки */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
             </button>
           )}
           
           {canvasItems.length > 0 && !id && (
            <button className="auth-btn" onClick={resetCanvas} style={{width: 'auto', padding: '0 10px', height: '35px', background: '#fff', color: '#666', border: '1px solid #ccc', fontSize: '12px'}}>
              Сброс
            </button>
           )}
           
           <button className="auth-btn btn-primary" onClick={openSaveModal} style={{width: 'auto', padding: '0 15px', height: '35px', fontSize: '12px'}}>
              Сохранить
           </button>
        </div>

        {/* ОБЛАСТЬ СКРИНШОТА */}
        <div 
            ref={canvasRef} 
            className="capsule-canvas-content" 
            style={{width: '100%', height: '100%', position: 'relative', background: 'white'}}
        >
            {canvasItems.length === 0 && (
                <div className="canvas-hint" style={{opacity: 0.5, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)'}}>
                    Добавьте вещи на холст
                </div>
            )}

            {canvasItems.map((item) => (
            <Rnd
                key={item.uniqueId}
                size={{ width: item.width, height: item.height }}
                position={{ x: item.x, y: item.y }}
                bounds="parent"
                
                // === НАСТРОЙКИ РЕСАЙЗА ===
                // Разрешаем тянуть только за нижний правый угол (самый удобный вариант)
                enableResizing={{ 
                  bottomRight: true, 
                  bottomLeft: false, 
                  topRight: false, 
                  topLeft: false, 
                  top: false,
                  bottom: false,
                  left: false,
                  right: false
                }}
                
                // Сохраняем пропорции картинки
                lockAspectRatio={true}
                
                // Передаем наш зеленый кружок как элемент управления
                resizeHandleComponent={{
                  bottomRight: activeId === item.uniqueId ? <div className="resize-handle" /> : null
                }}

                // Ограничения
                minWidth={50}
                minHeight={50}

                // Обработчики
                onDragStop={(e, d) => updateItemState(item.uniqueId, { x: d.x, y: d.y })}
                onResizeStop={(e, direction, ref, delta, position) => {
                   updateItemState(item.uniqueId, { width: ref.style.width, height: ref.style.height, ...position });
                }}
                
                onMouseDown={(e) => { e.stopPropagation(); bringToFront(item.uniqueId); }}
                onTouchStart={(e) => { e.stopPropagation(); bringToFront(item.uniqueId); }}
                
                className={`rnd-item ${activeId === item.uniqueId ? 'active' : ''}`}
                style={{ zIndex: item.zIndex }}
            >
                <img 
                    src={`/${item.image_path}`} 
                    alt="item" 
                    draggable="false" 
                    crossOrigin="anonymous" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
                />
                
                {activeId === item.uniqueId && (
                <div className="delete-handle" onPointerDown={(e) => { e.stopPropagation(); removeFromCanvas(item.uniqueId); }}>
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
        </div>

        <div className="capsule-grid">
          {filteredWardrobe.map(item => (
            <div key={item.id} className="mini-card" onClick={() => addToCanvas(item)}>
              <img src={`/${item.image_path}`} alt={item.name} crossOrigin="anonymous"/>
            </div>
          ))}
        </div>
      </div>
      
      <BottomNav />

      {/* МОДАЛКА СОХРАНЕНИЯ */}
      {isSaveModalOpen && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <h3>{id ? 'Обновить капсулу' : 'Сохранить капсулу'}</h3>
            <input 
              type="text" 
              className="custom-input" 
              placeholder="Название образа"
              value={capsuleName}
              onChange={e => setCapsuleName(e.target.value)}
              autoFocus
            />
            <div className="confirm-actions">
              <button className="auth-btn" onClick={() => setIsSaveModalOpen(false)} style={{background: '#f0f0f0', color: '#000'}}>
                Отмена
              </button>
              <button className="auth-btn btn-primary" onClick={performSave}>
                {id ? 'Обновить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* МОДАЛКА ФИЛЬТРОВ (без изменений) */}
      {isFilterOpen && (
         <div className="filter-modal-overlay" onClick={() => setIsFilterOpen(false)}>
          <div className="filter-modal" onClick={e => e.stopPropagation()}>
             {/* ... внутренности фильтра как были ... */}
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
                <h3 style={{margin: 0}}>Фильтры</h3>
                <button onClick={() => setIsFilterOpen(false)} style={{background:'none', border:'none', fontSize:'28px', color: 'var(--primary-green)'}}>&times;</button>
            </div>
            <SmartSelect type="category" value={filterCategory} onChange={setFilterCategory} placeholder="Категория" />
            <SmartSelect type="color" value={filterColor} onChange={setFilterColor} placeholder="Цвет" />
            <SmartSelect type="season" value={filterSeason} onChange={setFilterSeason} placeholder="Сезон" />
            <SmartSelect type="style" value={filterStyle} onChange={setFilterStyle} placeholder="Стиль" />
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