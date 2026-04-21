import { useState, useEffect } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect';
import { API_URL } from '../config';

function UploadItem() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [dbData, setDbData] = useState({ categories: [], colors: [], styles: [], seasons: [], fits: [] });

  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState('');
  const [season, setSeason] = useState('');
  const [fit, setFit] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [c, cl, st, se, fi] = await Promise.all([
                api.get('/categories'), api.get('/colors'),
                api.get('/styles'), api.get('/seasons'), api.get('/fits')
            ]);
            setDbData({ categories: c.data, colors: cl.data, styles: st.data, seasons: se.data, fits: fi.data });
        } catch (e) { console.error("Ошибка загрузки справочников"); }
    };
    fetchData();
  }, []);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setPreview(URL.createObjectURL(selectedFile));
    setFile(selectedFile);
    
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/items/analyze', formData);
      setCategory(res.data.category);
      setColor(res.data.color);
      setPreview(`${API_URL}/${res.data.image_path}`);
      if (!name) setName(selectedFile.name.split('.')[0]);
    } catch (err) { console.error(err); } finally { setIsAnalyzing(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return alert("Добавьте фото!");
    setLoading(true);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('category', category);
    formData.append('color', color);
    formData.append('style', style);
    formData.append('season', season);
    formData.append('fit', fit);
    formData.append('file', file);

    try {
      await api.post('/items/', formData);
      navigate('/wardrobe');
    } catch (error) { alert('Ошибка сохранения'); } finally { setLoading(false); }
  };

  return (
    /* 1. Добавляем page-padding для отступов от краев */
    <div className="page-padding">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} className="back-btn">←</button>
        <h2 style={{ margin: '0 auto', color: 'var(--primary-green)' }}>Новая вещь</h2>
      </div>

      {/* 2. ИСПОЛЬЗУЕМ className="form-container" (это обеспечит отступ снизу) */}
      <form onSubmit={handleSubmit} className="form-container">
        
        <label className="upload-area" style={{ position: 'relative' }}>
          {isAnalyzing && (
            <div style={{
              position: 'absolute', inset: 0,
              backgroundColor: 'rgba(255, 196, 214, 0.8)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', zIndex: 10
            }}>
              <div className="spinner"></div>
              <span style={{ color: 'var(--primary-green)', fontWeight: 'bold', marginTop: '10px' }}>ИИ анализирует...</span>
            </div>
          )}

          {preview ? (
            <img src={preview} alt="Preview" className="upload-preview" />
          ) : (
            <div style={{ textAlign: 'center', color: '#a87b89' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <p style={{marginTop: '10px'}}>Нажми для фото</p>
            </div>
          )}
          <input type="file" onChange={handleFileChange} hidden accept="image/*" disabled={isAnalyzing} />
        </label>

        <input type="text" className="custom-input" placeholder="Название" value={name} onChange={e => setName(e.target.value)} required />
        
        <SmartSelect options={dbData.categories} value={category} onChange={setCategory} placeholder="Категория" />
        <SmartSelect options={dbData.colors} value={color} onChange={setColor} placeholder="Цвет" />
        <SmartSelect options={dbData.styles} value={style} onChange={setStyle} placeholder="Стиль" />
        <SmartSelect options={dbData.seasons} value={season} onChange={setSeason} placeholder="Сезон" />
        <SmartSelect options={dbData.fits} value={fit} onChange={setFit} placeholder="Крой (Fit)" />

        <button type="submit" className="auth-btn btn-primary" disabled={loading || isAnalyzing}>
          {loading ? 'Загрузка...' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}

export default UploadItem;