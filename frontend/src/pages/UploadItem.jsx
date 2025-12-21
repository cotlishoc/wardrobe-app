import { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect';

function UploadItem() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Данные
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState('');
  const [season, setSeason] = useState('');

  const navigate = useNavigate();
 
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Очищаем предыдущий objectURL, если был
      if (preview) URL.revokeObjectURL(preview);
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };
  
  // Очищаем objectURL при размонтировании
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
 
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Пожалуйста, добавьте фото!");

    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('color', color);
    formData.append('style', style);
    formData.append('season', season);

    try {
      setLoading(true);
      // Если файл приходит как объект с uri (в apk/webview), получаем blob
      if (file && file.uri) {
        const res = await fetch(file.uri);
        const blob = await res.blob();
        formData.append('file', blob, file.name || 'photo.jpg');
      } else {
        formData.append('file', file);
      }

      // НЕ указываем вручную Content-Type — axios/set browser установит правильный boundary
      await api.post('/items/', formData);

      // Пометка для других экранов/вкладок, чтобы они могли обновиться
      try {
        localStorage.setItem('items_updated', Date.now().toString());
        // dispatch события для текущего окна (storage событие не сработает в том же окне)
        window.dispatchEvent(new Event('items_updated'));
      } catch (e) { /* noop */ }

      navigate('/wardrobe');
    } catch (error) {
      alert('Ошибка при загрузке');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Главный контейнер страницы
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} className="back-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <h2 style={{ margin: '0 auto', paddingRight: '34px', color: 'var(--primary-green)' }}>Новая вещь</h2>
      </div>

      {/* ФОРМА - добавляем width: 100% */}
      <form 
        onSubmit={handleSubmit} 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '15px', 
          width: '100%', // <--- ВАЖНО: Форма на всю ширину
          flex: 1,
          paddingBottom: '120px'
        }}
      >
        
        {/* Зона загрузки фото */}
        <label className="upload-area">
          {preview ? (
            <img src={preview} alt="Preview" className="upload-preview" />
          ) : (
            <div className="upload-placeholder" style={{textAlign: 'center'}}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#767676" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span style={{display: 'block', marginTop: '10px', fontSize: '14px', color: '#888'}}>Нажми для фото</span>
            </div>
          )}
          <input type="file" onChange={handleFileChange} hidden accept="image/*" />
        </label>

        {/* Поля ввода */}
        <input 
          type="text" 
          className="custom-input"
          placeholder="Название" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          required 
        />

        {/* Selects автоматически растянутся, если у них нет жесткой ширины */}
        <SmartSelect type="category" value={category} onChange={setCategory} placeholder="Категория" />
        <SmartSelect type="color" value={color} onChange={setColor} placeholder="Цвет" />
        <SmartSelect type="style" value={style} onChange={setStyle} placeholder="Стиль" />
        <SmartSelect type="season" value={season} onChange={setSeason} placeholder="Сезон" />
        
        {/* Распорка */}
        <div style={{ flex: 1 }}></div>

        <button type="submit" className="auth-btn btn-primary" style={{ marginBottom: '20px' }} disabled={loading}>
          {loading ? 'Загрузка...' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}

export default UploadItem;