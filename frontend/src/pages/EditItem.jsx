import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import SmartSelect from '../components/SmartSelect';
import { API_URL } from '../config';

function EditItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Данные вещи
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
      .catch(err => {
        navigate('/wardrobe');
      });
  }, [id, navigate]);

  const handleSave = async () => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category || '');
    formData.append('color', color || '');
    formData.append('style', style || '');
    formData.append('season', season || '');

    try {
      await api.put(`/items/${id}`, formData);
      try { localStorage.setItem('items_updated', Date.now().toString()); window.dispatchEvent(new Event('items_updated')); } catch (e) {}
      navigate('/wardrobe');
    } catch (error) {
      alert('Ошибка при сохранении');
    }
  };
 
  const handleDelete = async () => {
    if (window.confirm("Удалить вещь безвозвратно?")) {
      try {
        await api.delete(`/items/${id}`);
        try { localStorage.setItem('items_updated', Date.now().toString()); window.dispatchEvent(new Event('items_updated')); } catch (e) {}
        navigate('/wardrobe');
      } catch (error) {
        alert('Ошибка удаления');
      }
    }
  };

  if (loading) return null;

  return (
    <div className="page-padding">
      {/* Шапка только со стрелкой */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} className="back-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <h2 style={{margin: '0 auto', paddingRight: '34px'}}>Редактирование</h2>
      </div>

      {/* Фото (не кликабельное тут, просто просмотр) */}
      <div className="upload-area" style={{marginBottom: '20px'}}>
        <img 
          src={`${API_URL}/${item.image_path}`} 
          alt={item.name} 
          className="upload-preview"
        />
      </div>

      <div className="flex-col-gap">
        <input 
          type="text" 
          className="custom-input"
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="Название"
        />

        <SmartSelect type="category" value={category} onChange={setCategory} placeholder="Категория" />
        <SmartSelect type="color" value={color} onChange={setColor} placeholder="Цвет" />
        <SmartSelect type="style" value={style} onChange={setStyle} placeholder="Стиль" />
        <SmartSelect type="season" value={season} onChange={setSeason} placeholder="Сезон" />

        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <button onClick={handleSave} className="auth-btn btn-primary" style={{ flex: 2 }}>
            Сохранить
          </button>
          <button onClick={handleDelete} className="auth-btn btn-danger" style={{ flex: 1 }}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditItem;