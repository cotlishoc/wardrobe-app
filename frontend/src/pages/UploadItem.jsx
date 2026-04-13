import { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect';
import { API_URL } from '../config';

function UploadItem() {
  const [file, setFile] = useState(null); // Здесь храним реальный файл для отправки
  const [preview, setPreview] = useState(null); // Ссылка для отображения картинки
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false); // Состояние сохранения
  const [isAnalyzing, setIsAnalyzing] = useState(false); // Состояние работы ИИ

  // Данные полей
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState('');
  const [season, setSeason] = useState('');

  const navigate = useNavigate();

  // --- МАГИЯ ИИ: ВЫБОР ФАЙЛА И МГНОВЕННЫЙ АНАЛИЗ ---
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // 1. Сразу сохраняем файл и показываем локальное превью
    if (preview) URL.revokeObjectURL(preview);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    
    // 2. Начинаем анализ
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Отправляем на новый эндпоинт анализа
      const res = await api.post('/items/analyze', formData);
      
      const { category: aiCat, color: aiColor, image_path } = res.data;

      // 3. Заполняем поля тем, что прислал ИИ
      if (aiCat) setCategory(aiCat);
      if (aiColor) setColor(aiColor);
      
      // Ставим имя файла в название (без расширения), если оно еще пустое
      if (!name) {
        const fileName = selectedFile.name.split('.')[0];
        setName(fileName);
      }

      // 4. Обновляем превью на картинку БЕЗ фона
      setPreview(`${API_URL}/${image_path}`);

    } catch (err) {
      console.error("Ошибка анализа ИИ:", err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (preview && preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  // --- СОХРАНЕНИЕ ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Пожалуйста, добавьте фото!");

    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('color', color);
    formData.append('style', style);
    formData.append('season', season);
    formData.append('file', file);

    try {
      setLoading(true);
      await api.post('/items/', formData);
      try { localStorage.setItem('items_updated', Date.now().toString()); } catch (e) {}
      navigate('/wardrobe');
    } catch (error) {
      alert('Ошибка при сохранении');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      {/* Шапка */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} className="back-btn">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <h2 style={{ margin: '0 auto', paddingRight: '34px', color: 'var(--primary-green)' }}>Новая вещь</h2>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', flex: 1, paddingBottom: '120px' }}>
        
        {/* Зона загрузки фото с лоадером анализа */}
        <label className="upload-area" style={{ position: 'relative' }}>
          {isAnalyzing && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(255, 196, 214, 0.7)', // Твой розовый с прозрачностью
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              zIndex: 10, borderRadius: '24px'
            }}>
              <div className="loader-spinner" style={{ 
                border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary-green)',
                borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite'
              }}></div>
              <span style={{ marginTop: '10px', fontWeight: 'bold', fontSize: '14px' }}>ИИ анализирует... ✨</span>
            </div>
          )}

          {preview ? (
            <img src={preview} alt="Preview" className="upload-preview" />
          ) : (
            <div className="upload-placeholder" style={{textAlign: 'center'}}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#767676" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span style={{display: 'block', marginTop: '10px', fontSize: '14px', color: '#888'}}>Нажми для фото</span>
            </div>
          )}
          <input type="file" onChange={handleFileChange} hidden accept="image/*" disabled={isAnalyzing} />
        </label>

        {/* Поля ввода */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)' }}>Название</label>
          <input 
            type="text" 
            className="custom-input"
            placeholder="Напр: Любимая футболка" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary-green)' }}>Категория</label>
          <input 
            type="text" 
            className="custom-input"
            placeholder="Определится автоматически..." 
            value={category} 
            onChange={e => setCategory(e.target.value)} 
          />
        </div>

        <SmartSelect type="color" value={color} onChange={setColor} placeholder="Цвет" />
        <SmartSelect type="style" value={style} onChange={setStyle} placeholder="Стиль" />
        <SmartSelect type="season" value={season} onChange={setSeason} placeholder="Сезон" />
        
        <div style={{ flex: 1 }}></div>

        <button 
            type="submit" 
            className="auth-btn btn-primary" 
            style={{ marginBottom: '20px' }} 
            disabled={loading || isAnalyzing}
        >
          {loading ? 'Сохранение...' : 'Добавить в гардероб'}
        </button>
      </form>

      {/* Добавляем стили для анимации спиннера */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default UploadItem;