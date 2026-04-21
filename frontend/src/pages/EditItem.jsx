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
            const [c, cl, st, se, fi, itemRes] = await Promise.all([
                api.get('/categories'), api.get('/colors'),
                api.get('/styles'), api.get('/seasons'), api.get('/fits'),
                api.get(`/items/${id}`)
            ]);
            
            setDbData({ categories: c.data, colors: cl.data, styles: st.data, seasons: se.data, fits: fi.data });
            
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

      {/* Основной контейнер с классом form-container для прокрутки */}
      <div className="form-container">
        
        {/* Фото */}
        <div className="upload-area" style={{ marginBottom: '10px', position: 'relative', flexShrink: 0 }}>
          <img src={`${API_URL}/${imagePath}`} alt={name} className="upload-preview" />
          <button 
            onClick={() => handleAIAnalyze('all')}
            disabled={isAILoading}
            className="auth-btn"
            style={{
              position: 'absolute', bottom: '15px', right: '15px',
              width: 'auto', padding: '0 15px', height: '35px', fontSize: '12px',
              background: 'var(--primary-green)', color: 'white', border: 'none',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
            }}
          >
            {isAILoading ? '⌛...' : '🪄 Определить ИИ'}
          </button>
        </div>

        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)' }}>Название</label>
        <input type="text" className="custom-input" value={name} onChange={e => setName(e.target.value)} />

        {/* Категория */}
        <div style={{display: 'flex', gap: '8px', alignItems: 'flex-end'}}>
            <div style={{flex: 1}}>
                <SmartSelect options={dbData.categories} value={category} onChange={setCategory} placeholder="Категория" />
            </div>
            <button onClick={() => handleAIAnalyze('category')} style={{width:'50px', height:'50px', marginBottom:'15px', borderRadius:'16px', border:'none', background:'var(--light-green)', fontSize:'20px'}}>🪄</button>
        </div>

        {/* Цвет */}
        <div style={{display: 'flex', gap: '8px', alignItems: 'flex-end'}}>
            <div style={{flex: 1}}>
                <SmartSelect options={dbData.colors} value={color} onChange={setColor} placeholder="Цвет" />
            </div>
            <button onClick={() => handleAIAnalyze('color')} style={{width:'50px', height:'50px', marginBottom:'15px', borderRadius:'16px', border:'none', background:'var(--light-green)', fontSize:'20px'}}>🪄</button>
        </div>

        <SmartSelect options={dbData.styles} value={style} onChange={setStyle} placeholder="Стиль" />
        <SmartSelect options={dbData.seasons} value={season} onChange={setSeason} placeholder="Сезон" />
        <SmartSelect options={dbData.fits} value={fit} onChange={setFit} placeholder="Крой (Fit)" />

        {/* Кнопки действий */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
          <button onClick={handleSave} className="auth-btn btn-primary" style={{ flex: 2 }}>Сохранить</button>
          <button onClick={() => { if(window.confirm("Удалить вещь?")) api.delete(`/items/${id}`).then(() => navigate('/wardrobe')) }} className="auth-btn btn-danger" style={{ flex: 1 }}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

export default EditItem;