import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect';
import { API_URL } from '../config';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { CATEGORY_SEASON_MAP } from '../data/wardrobeRules';
import './styles/UploadItem.css';

function UploadItem() {
  const navigate = useNavigate();
  const uploaderRef = useRef(null);

  // Флаги и системные стейты
  const [saving, setSaving] = useState(false);
  const [visionLoading, setVisionLoading] = useState(false);
  const [dictionaries, setDictionaries] = useState({ categories: [], colors: [], styles: [], seasons: [], fits: [] });

  // Файлы
  const [rawFile, setRawFile] = useState(null);
  const [imgPreview, setImgPreview] = useState(null);

  // Поля формы
  const [title, setTitle] = useState('');
  const [cat, setCat] = useState('');
  const [col, setCol] = useState('');
  const [currentStyle, setCurrentStyle] = useState('');
  const [currentSeason, setCurrentSeason] = useState('');
  const [currentFit, setCurrentFit] = useState('');

  const isMobileApp = !!window.Capacitor && window.Capacitor?.getPlatform() !== 'web';

  useEffect(() => {
    let active = true;
    
    (async () => {
      try {
        const [resCat, resCol, resStyle, resSeason, resFit] = await Promise.all([
          api.get('/categories'), api.get('/colors'),
          api.get('/styles'), api.get('/seasons'), api.get('/fits')
        ]);
        
        if (active) {
          setDictionaries({ 
            categories: resCat.data, 
            colors: resCol.data, 
            styles: resStyle.data, 
            seasons: resSeason.data, 
            fits: resFit.data 
          });
        }
      } catch (err) { 
        console.warn("Meta dictionaries loading error:", err); 
      }
    })();

    return () => { active = false; };
  }, []);

  const runImageAnalysis = async (targetBlob) => {
    setRawFile(targetBlob);
    setVisionLoading(true);
    
    const pack = new FormData();
    pack.append('file', targetBlob);

    try {
      const { data } = await api.post('/items/analyze', pack);
      setCat(data.category);
      setCol(data.color);
      setCurrentSeason(CATEGORY_SEASON_MAP[data.category] || "Всесезон");
      setImgPreview(`${API_URL}/${data.image_path}`);
      
      if (!title) {
        setTitle(data.category || "Новая вещь");
      }
    } catch (apiErr) {
      console.error("AI analysis route error:", apiErr);
    } finally { 
      setVisionLoading(false); 
    }
  };

  const onFileSelection = (evt) => {
    const picked = evt.target.files?.[0];
    if (!picked) return;
    setImgPreview(URL.createObjectURL(picked));
    runImageAnalysis(picked);
  };

  const handleMediaTrigger = async () => {
    if (isMobileApp) {
      try {
        const nativeImg = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Uri,
          source: CameraSource.Prompt
        });
        
        setImgPreview(nativeImg.webPath);
        const webRes = await fetch(nativeImg.webPath);
        const chunk = await webRes.blob();
        const constructedFile = new File([chunk], "item.jpg", { type: "image/jpeg" });
        runImageAnalysis(constructedFile);
      } catch (cameraErr) { 
        console.log("User backed out from camera/gallery selection"); 
      }
    } else {
      uploaderRef.current?.click(); 
    }
  };

  const onFormSubmit = async (e) => {
    e.preventDefault();
    if (!rawFile) return alert("Добавьте фото!");
    
    setSaving(true);
    const formPayload = new FormData();
    formPayload.append('name', title);
    formPayload.append('category', cat);
    formPayload.append('color', col);
    formPayload.append('style', currentStyle);
    formPayload.append('season', currentSeason);
    formPayload.append('fit', currentFit);
    formPayload.append('file', rawFile);

    try {
      await api.post('/items/', formPayload);
      navigate('/wardrobe');
    } catch (err) { 
      alert(err.response?.data?.detail || 'Ошибка сохранения'); 
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="page-padding">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
        <button type="button" onClick={() => navigate(-1)} className="back-btn">←</button>
        <h2 style={{ margin: '0 auto', color: 'var(--primary-green)' }}>Новая вещь</h2>
      </div>

      <form onSubmit={onFormSubmit} className="form-container">
        <div className="upload-area" onClick={handleMediaTrigger} style={{ position: 'relative' }}>
          {visionLoading && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255, 196, 214, 0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10, borderRadius: '24px' }}>
              <div className="spinner"></div>
              <span style={{ color: 'var(--primary-green)', fontWeight: 'bold', marginTop: '10px' }}>ИИ анализирует...</span>
            </div>
          )}
          {imgPreview ? (
            <img src={imgPreview} alt="Preview" className="upload-preview" />
          ) : (
            <div style={{ textAlign: 'center', color: '#a87b89' }}>
              <p style={{ fontSize: '40px' }}></p>
              <p>Нажми, чтобы добавить фото</p>
            </div>
          )}
          <input type="file" ref={uploaderRef} onChange={onFileSelection} hidden accept="image/*" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', marginLeft: '5px' }}>НАЗВАНИЕ</label>
          <input type="text" className="custom-input" placeholder="Название" value={title} onChange={e => setTitle(e.target.value)} required />
          
          <SmartSelect options={dictionaries.categories} value={cat} onChange={(v) => { setCat(v); setCurrentSeason(CATEGORY_SEASON_MAP[v] || currentSeason); }} placeholder="Категория" />
          <SmartSelect options={dictionaries.colors} value={col} onChange={setCol} placeholder="Цвет" />
          <SmartSelect options={dictionaries.styles} value={currentStyle} onChange={setCurrentStyle} placeholder="Стиль" />
          <SmartSelect options={dictionaries.fits} value={currentFit} onChange={setCurrentFit} placeholder="Крой" />
          <SmartSelect options={dictionaries.seasons} value={currentSeason} onChange={setCurrentSeason} placeholder="Сезон" />
        </div>

        <button type="submit" className="auth-btn btn-primary" disabled={saving || visionLoading}>
          {saving ? 'Сохранение...' : 'Сохранить в гардероб'}
        </button>
      </form>
    </div>
  );
}

export default UploadItem;