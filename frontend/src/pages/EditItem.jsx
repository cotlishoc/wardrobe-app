import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import SmartSelect from '../components/SmartSelect';
import { API_URL } from '../config';

function EditItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAILoading, setIsAILoading] = useState(false); // Для лоадера кнопок ИИ

  const [item, setItem] = useState(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState('');
  const [season, setSeason] = useState('');

  useEffect(() => {
    api.get(`/items/${id}`)
      .then(res => {
        const data = res.data;
        setItem(data);
        setName(data.name);
        setCategory(data.category);
        setColor(data.color);
        setStyle(data.style);
        setSeason(data.season);
        setLoading(false);
      })
      .catch(() => navigate('/wardrobe'));
  }, [id, navigate]);

  // --- ФУНКЦИЯ ВЫЗОВА ИИ ДЛЯ СУЩЕСТВУЮЩЕЙ ВЕЩИ ---
  const handleAIAnalyze = async (target) => {
    try {
      setIsAILoading(true);
      const res = await api.post(`/items/${id}/reanalyze`);
      
      if (target === 'category') setCategory(res.data.category);
      if (target === 'color') setColor(res.data.color);
      if (target === 'all') {
        setCategory(res.data.category);
        setColor(res.data.color);
      }
    } catch (err) {
      alert("Не удалось запустить ИИ");
    } finally {
      setIsAILoading(false);
    }
  };

  const handleSave = async () => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category || '');
    formData.append('color', color || '');
    formData.append('style', style || '');
    formData.append('season', season || '');

    try {
      await api.put(`/items/${id}`, formData);
      navigate('/wardrobe');
    } catch (error) {
      alert('Ошибка при сохранении');
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Удалить вещь безвозвратно?")) {
      try {
        await api.delete(`/items/${id}`);
        navigate('/wardrobe');
      } catch (error) {
        alert('Ошибка удаления');
      }
    }
  };

  if (loading) return null;

  return (
    <div className="page-padding">
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} className="back-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <h2 style={{margin: '0 auto', paddingRight: '34px'}}>Редактирование</h2>
      </div>

      {/* Фото */}
      <div className="upload-area" style={{marginBottom: '20px', position: 'relative'}}>
        <img src={`${API_URL}/${item.image_path}`} alt={item.name} className="upload-preview" />
        {/* Кнопка "Определить всё" прямо на фото */}
        <button 
          onClick={() => handleAIAnalyze('all')}
          disabled={isAILoading}
          style={{
            position: 'absolute', bottom: '15px', right: '15px',
            background: 'var(--primary-green)', color: 'white', border: 'none',
            borderRadius: '20px', padding: '8px 15px', fontSize: '12px', fontWeight: 'bold',
            boxShadow: '0 4px 10px rgba(0,0,0,0.2)', cursor: 'pointer', opacity: isAILoading ? 0.6 : 1
          }}
        >
          {isAILoading ? '🤖...' : '🪄 Определить всё'}
        </button>
      </div>

      <div className="flex-col-gap">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)' }}>Название</label>
          <input type="text" className="custom-input" value={name} onChange={e => setName(e.target.value)} />
        </div>

        {/* КАТЕГОРИЯ С КНОПКОЙ ИИ */}
        <div style={{ marginBottom: '15px', position: 'relative' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>Категория</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" className="custom-input" placeholder="Напр: Свитшот" 
              value={category} onChange={e => setCategory(e.target.value)} 
              style={{ flex: 1 }}
            />
            <button 
              type="button" onClick={() => handleAIAnalyze('category')}
              style={{ width: '50px', borderRadius: '16px', border: 'none', background: 'var(--light-green)', cursor: 'pointer' }}
              title="Определить ИИ"
            >
              🪄
            </button>
          </div>
        </div>

        {/* ЦВЕТ С КНОПКОЙ ИИ */}
        <div style={{ marginBottom: '15px', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <SmartSelect type="color" value={color} onChange={setColor} placeholder="Цвет" />
            </div>
            <button 
              type="button" onClick={() => handleAIAnalyze('color')}
              style={{ width: '50px', height: '50px', marginBottom: '15px', borderRadius: '16px', border: 'none', background: 'var(--light-green)', cursor: 'pointer' }}
              title="Определить цвет"
            >
              🪄
            </button>
          </div>
        </div>

        <SmartSelect type="style" value={style} onChange={setStyle} placeholder="Стиль" />
        <SmartSelect type="season" value={season} onChange={setSeason} placeholder="Сезон" />

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={handleSave} className="auth-btn btn-primary" style={{ flex: 2 }}>Сохранить</button>
          <button onClick={handleDelete} className="auth-btn btn-danger" style={{ flex: 1 }}>Удалить</button>
        </div>
      </div>
    </div>
  );
}

export default EditItem;