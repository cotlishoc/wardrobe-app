import { useState, useEffect, useRef } from 'react'; // Добавили useRef
import api from '../api';
import { useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect';
import { API_URL } from '../config';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { CATEGORY_SEASON_MAP } from '../data/wardrobeRules';

function UploadItem() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [dbData, setDbData] = useState({ categories: [], colors: [], styles: [], seasons: [], fits: [] });

  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState('Повседневный');
  const [season, setSeason] = useState('Всесезон');
  const [fit, setFit] = useState('Базовый');

  const navigate = useNavigate();
  const fileInputRef = useRef(null); // Реф для инпута на ПК

  // Определяем платформу
  const isNative = window.Capacitor?.getPlatform() !== 'web' && !!window.Capacitor;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [c, cl, st, se, fi] = await Promise.all([
          api.get('/categories'), api.get('/colors'),
          api.get('/styles'), api.get('/seasons'), api.get('/fits')
        ]);
        setDbData({ categories: c.data, colors: cl.data, styles: st.data, seasons: se.data, fits: fi.data });
      } catch (e) { console.error("Ошибка справочников"); }
    };
    fetchData();
  }, []);

  const processAndAnalyze = async (fileObj) => {
    setFile(fileObj);
    setIsAnalyzing(true);
    const formData = new FormData();
    formData.append('file', fileObj);

    try {
      const res = await api.post('/items/analyze', formData);
      setCategory(res.data.category);
      setColor(res.data.color);
      setSeason(CATEGORY_SEASON_MAP[res.data.category] || "Всесезон");
      setPreview(`${API_URL}/${res.data.image_path}`);
      if (!name) setName(res.data.category || "Новая вещь");
    } catch (err) {
      console.error("Ошибка ИИ");
    } finally { setIsAnalyzing(false); }
  };

  // Вызывается на ПК
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setPreview(URL.createObjectURL(selectedFile));
    processAndAnalyze(selectedFile);
  };

  // Главная функция клика по области фото
  const handleImageAreaClick = () => {
    if (isNative) {
      takePhoto();
    } else {
      fileInputRef.current.click(); // На ПК открываем обычный выбор файла
    }
  };

  // Вызывается на смартфоне
  const takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt // Показывает выбор Камера/Галерея
      });
      setPreview(image.webPath);
      const response = await fetch(image.webPath);
      const blob = await response.blob();
      const fileObj = new File([blob], "item.jpg", { type: "image/jpeg" });
      processAndAnalyze(fileObj);
    } catch (e) { console.log("Отмена"); }
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
    <div className="page-padding">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} className="back-btn">←</button>
        <h2 style={{ margin: '0 auto', color: 'var(--primary-green)' }}>Новая вещь</h2>
      </div>

      <form onSubmit={handleSubmit} className="form-container">
        {/* Клик теперь вызывает нашу умную функцию */}
        <div className="upload-area" onClick={handleImageAreaClick} style={{ position: 'relative' }}>
          {isAnalyzing && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255, 196, 214, 0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '24px' }}>
              <div className="spinner"></div>
              <span style={{ color: 'var(--primary-green)', fontWeight: 'bold', marginTop: '10px' }}>ИИ анализирует...</span>
            </div>
          )}
          {preview ? (
            <img src={preview} alt="Preview" className="upload-preview" />
          ) : (
            <div style={{ textAlign: 'center', color: '#a87b89' }}>
              <p style={{ fontSize: '40px' }}>📸</p>
              <p>Нажми, чтобы добавить фото</p>
            </div>
          )}
          {/* Скрытый инпут для ПК */}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>НАЗВАНИЕ</label>
          <input type="text" className="custom-input" placeholder="Название" value={name} onChange={e => setName(e.target.value)} required />
          
          <SmartSelect options={dbData.categories} value={category} onChange={(v) => { setCategory(v); setSeason(CATEGORY_SEASON_MAP[v] || season); }} placeholder="Категория" />
          <SmartSelect options={dbData.colors} value={color} onChange={setColor} placeholder="Цвет" />
          <SmartSelect options={dbData.styles} value={style} onChange={setStyle} placeholder="Стиль" />
          <SmartSelect options={dbData.fits} value={fit} onChange={setFit} placeholder="Крой" />
          <SmartSelect options={dbData.seasons} value={season} onChange={setSeason} placeholder="Сезон" />
        </div>

        <button type="submit" className="auth-btn btn-primary" disabled={loading || isAnalyzing}>
          {loading ? 'Сохранение...' : 'Сохранить в гардероб'}
        </button>
      </form>
    </div>
  );
}

export default UploadItem;