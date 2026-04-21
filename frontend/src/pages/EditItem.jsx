import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import SmartSelect from '../components/SmartSelect';
import { API_URL } from '../config';

function EditItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [isAILoading, setIsAILoading] = useState(false);
  const [dbData, setDbData] = useState({ categories: [], colors: [], styles: [], seasons: [], fits: [] });

  // Состояния полей
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState('');
  const [season, setSeason] = useState('');
  const [fit, setFit] = useState('');
  const [imagePath, setImagePath] = useState('');

  useEffect(() => {
    const init = async () => {
        try {
            // 1. Загружаем все справочники и данные вещи ОДНОВРЕМЕННО
            const [c, cl, st, se, fi, itemRes] = await Promise.all([
                api.get('/categories'), api.get('/colors'),
                api.get('/styles'), api.get('/seasons'), api.get('/fits'),
                api.get(`/items/${id}`)
            ]);
            
            setDbData({ categories: c.data, colors: cl.data, styles: st.data, seasons: se.data, fits: fi.data });
            
            // 2. Устанавливаем текущие значения вещи
            const item = itemRes.data;
            setName(item.name || '');
            setCategory(item.category || '');
            setColor(item.color || '');
            setStyle(item.style || '');
            setSeason(item.season || '');
            setFit(item.fit || '');
            setImagePath(item.image_path);
            
            setLoading(false);
        } catch (e) { 
            console.error("Ошибка инициализации:", e);
            navigate('/wardrobe'); 
        }
    };
    init();
  }, [id, navigate]);

  // --- ФУНКЦИЯ ВЫЗОВА ИИ (ВОЛШЕБНАЯ ПАЛОЧКА) ---
  const handleAIAnalyze = async (target) => {
    try {
      setIsAILoading(true);
      const res = await api.post(`/items/${id}/reanalyze`);
      
      if (target === 'category' || target === 'all') setCategory(res.data.category);
      if (target === 'color' || target === 'all') setColor(res.data.color);
      
      alert("ИИ обновил данные!");
    } catch (err) {
      alert("Не удалось связаться с ИИ");
    } finally {
      setIsAILoading(false);
    }
  };

  const handleSave = async () => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('color', color);
    formData.append('style', style);
    formData.append('season', season);
    formData.append('fit', fit);

    try {
      await api.put(`/items/${id}`, formData);
      navigate('/wardrobe');
    } catch (error) {
      alert('Ошибка при сохранении');
    }
  };

  if (loading) return <div style={{padding: '50px', textAlign: 'center'}}>Загрузка данных...</div>;

  return (
    <div className="page-padding">
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} className="back-btn">←</button>
        <h2 style={{margin: '0 auto', paddingRight: '34px'}}>Редактирование</h2>
      </div>

      {/* Фото с кнопкой "Определить всё" */}
      <div className="upload-area" style={{marginBottom: '20px', position: 'relative'}}>
        <img src={`${API_URL}/${imagePath}`} alt={name} className="upload-preview" />
        <button 
          onClick={() => handleAIAnalyze('all')}
          disabled={isAILoading}
          style={{
            position: 'absolute', bottom: '15px', right: '15px',
            background: 'var(--primary-green)', color: 'white', border: 'none',
            borderRadius: '20px', padding: '8px 15px', fontSize: '12px', fontWeight: 'bold',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)', cursor: 'pointer'
          }}
        >
          {isAILoading ? '⌛...' : '🪄 Определить ИИ'}
        </button>
      </div>

      <div className="flex-col-gap">
        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)' }}>Название</label>
        <input type="text" className="custom-input" value={name} onChange={e => setName(e.target.value)} />

        {/* Категория с 🪄 */}
        <div style={{display: 'flex', gap: '8px', alignItems: 'flex-end'}}>
            <div style={{flex: 1}}>
                <SmartSelect options={dbData.categories} value={category} onChange={setCategory} placeholder="Категория" />
            </div>
            <button onClick={() => handleAIAnalyze('category')} style={{width:'50px', height:'50px', marginBottom:'15px', borderRadius:'16px', border:'none', background:'var(--light-green)'}}>🪄</button>
        </div>

        {/* Цвет с 🪄 */}
        <div style={{display: 'flex', gap: '8px', alignItems: 'flex-end'}}>
            <div style={{flex: 1}}>
                <SmartSelect options={dbData.colors} value={color} onChange={setColor} placeholder="Цвет" />
            </div>
            <button onClick={() => handleAIAnalyze('color')} style={{width:'50px', height:'50px', marginBottom:'15px', borderRadius:'16px', border:'none', background:'var(--light-green)'}}>🪄</button>
        </div>

        <SmartSelect options={dbData.styles} value={style} onChange={setStyle} placeholder="Стиль" />
        <SmartSelect options={dbData.seasons} value={season} onChange={setSeason} placeholder="Сезон" />
        <SmartSelect options={dbData.fits} value={fit} onChange={setFit} placeholder="Крой (Fit)" />

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={handleSave} className="auth-btn btn-primary" style={{ flex: 2 }}>Сохранить</button>
          <button onClick={() => api.delete(`/items/${id}`).then(() => navigate('/wardrobe'))} className="auth-btn btn-danger" style={{ flex: 1 }}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

export default EditItem;