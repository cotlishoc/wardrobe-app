import { useState, useEffect, useRef } from 'react'; // Добавили useRef
import api from '../api';
import SmartSelect from '../components/SmartSelect';
import { API_URL } from '../config';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { 
  STYLE_COMPATIBILITY, SEASON_COMPATIBILITY,
  CATEGORY_LAYERS, COLOR_TEMP, CATEGORY_SEASON_MAP, FIT_RULES,
  CATEGORY_GROUPS, GROUP_COMPATIBILITY 
} from '../data/wardrobeRules';

function Preview() {
  const [file, setFile] = useState(null); 
  const [rawFile, setRawFile] = useState(null); 
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [wardrobe, setWardrobe] = useState([]);
  const [dbData, setDbData] = useState({ categories: [], colors: [], styles: [], seasons: [], fits: [] });
  const [dbOccasions, setDbOccasions] = useState([]);
  
  const [tempItem, setTempItem] = useState({ 
    name: 'Новая вещь',
    category: '', color: '', style: '', season: '', fit: '', image_path: '' 
  });

  const [report, setReport] = useState(null);
  const fileInputRef = useRef(null); // Реф для инпута на ПК

  const isNative = window.Capacitor?.getPlatform() !== 'web' && !!window.Capacitor;

  useEffect(() => {
    api.get('/items/').then(res => setWardrobe(res.data));
    const fetchData = async () => {
      const [c, cl, st, se, fi, occ] = await Promise.all([
        api.get('/categories'), api.get('/colors'), api.get('/styles'),
        api.get('/seasons'), api.get('/fits'), api.get('/occasions')
      ]);
      setDbData({ categories: c.data, colors: cl.data, styles: st.data, seasons: se.data, fits: fi.data });
      setDbOccasions(occ.data);
    };
    fetchData();
  }, []);

  const processAndAnalyze = async (fileObj) => {
    setRawFile(fileObj);
    setIsAnalyzing(true);
    setReport(null);
    const formData = new FormData();
    formData.append('file', fileObj);

    try {
      const res = await api.post('/items/analyze', formData);
      setTempItem(prev => ({
        ...prev,
        category: res.data.category,
        color: res.data.color,
        season: CATEGORY_SEASON_MAP[res.data.category] || "Всесезон",
        image_path: res.data.image_path
      }));
      setFile(`${API_URL}/${res.data.image_path}`);
    } catch (err) { console.error("Ошибка ИИ"); } finally { setIsAnalyzing(false); }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    setFile(URL.createObjectURL(selectedFile));
    processAndAnalyze(selectedFile);
  };

  const handleImageAreaClick = () => {
    if (isNative) {
      takePhoto();
    } else {
      fileInputRef.current.click();
    }
  };

  const takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 90, resultType: CameraResultType.Uri, source: CameraSource.Prompt
      });
      setFile(image.webPath);
      const response = await fetch(image.webPath);
      const blob = await response.blob();
      const fileObj = new File([blob], "preview.jpg", { type: "image/jpeg" });
      processAndAnalyze(fileObj);
    } catch (e) { console.log("Отмена"); }
  };

  const isHardConflict = (s, t) => {
    const sCat = s.category || "";
    const tCat = t.category || "";
    if (sCat === tCat) return true;
    const getGroup = (cat) => Object.keys(CATEGORY_GROUPS).find(key => CATEGORY_GROUPS[key].includes(cat));
    const sGroup = getGroup(sCat);
    const tGroup = getGroup(tCat);
    if (sGroup && tGroup && !GROUP_COMPATIBILITY[sGroup]?.includes(tGroup)) return true;
    const sIsKids = sCat.toLowerCase().includes("детск");
    const tIsKids = tCat.toLowerCase().includes("детск");
    return sIsKids !== tIsKids;
  };

  const calculateMatch = (source, target) => {
    if (isHardConflict(source, target)) return { score: 0, details: {} };
    let score = 0;
    const details = { style: false, color: false, fit: false, season: false };

    if (STYLE_COMPATIBILITY[source.style]?.includes(target.style) || source.style === target.style) {
      score += 25; details.style = true;
    }
    const sCol = (source.color || "").toLowerCase();
    const tCol = (target.color || "").toLowerCase();
    const sTemp = Object.keys(COLOR_TEMP).find(k => COLOR_TEMP[k].includes(source.color));
    const tTemp = Object.keys(COLOR_TEMP).find(k => COLOR_TEMP[k].includes(target.color));
    if (sCol === tCol || (sTemp && sTemp === tTemp) || sTemp === 'neutral' || tTemp === 'neutral') {
      score += 25; details.color = true;
    }
    if (FIT_RULES[source.fit]?.includes(target.fit) || source.fit === target.fit) {
      score += 25; details.fit = true;
    }
    if (SEASON_COMPATIBILITY[source.season]?.includes(target.season) || source.season === target.season) {
      score += 25; details.season = true;
    }
    return { score, details };
  };

  const generateReport = () => {
    if (!tempItem.category) return alert("Выберите категорию!");
    const matches = wardrobe.map(item => ({
      ...item,
      analysis: calculateMatch(tempItem, item)
    })).filter(m => m.analysis.score >= 50) 
       .sort((a, b) => b.analysis.score - a.analysis.score);
    
    const suitableOccasions = dbOccasions.filter(occ => occ.default_style === tempItem.style);
    setReport({ matches, suitableOccasions });
  };

  const handleSaveToWardrobe = async () => {
    if (!rawFile) return;
    const formData = new FormData();
    formData.append('name', tempItem.name);
    formData.append('category', tempItem.category);
    formData.append('color', tempItem.color);
    formData.append('style', tempItem.style);
    formData.append('season', tempItem.season);
    formData.append('fit', tempItem.fit);
    formData.append('file', rawFile);
    try {
      await api.post('/items/', formData);
      alert("Добавлено в гардероб!");
      setFile(null); setReport(null);
    } catch (e) { alert("Ошибка сохранения"); }
  };

  return (
    <div className="page-padding" style={{ paddingBottom: '140px' }}>
      <h2 style={{ color: 'var(--primary-green)', marginBottom: '20px' }}>Умная примерочная 📸</h2>
      
      <div className="upload-area" onClick={handleImageAreaClick} style={{ height: '280px', position: 'relative', overflow: 'hidden'}}>
        {isAnalyzing && (
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                borderRadius: '24px'
            }}>
                <div className="spinner"></div>
                <span style={{ 
                    color: 'var(--primary-green)', 
                    fontWeight: 'bold', 
                    marginTop: '15px',
                    fontSize: '14px' 
                }}>
                    ИИ анализирует вещь... ✨
                </span>
            </div>
        )}
        {file ? (
          <img src={file} className="upload-preview" alt="Preview" style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--primary-green)', opacity: 0.7 }}>
             <p style={{ fontSize: '30px' }}>📸</p>
             <p>Нажми для выбора фото</p>
          </div>
        )}
        <input type="file" ref={fileInputRef} onChange={handleFileChange} hidden accept="image/*" />
      </div>

      <div className="form-container" style={{ marginTop: '20px', padding: '20px', background: '#fff', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <SmartSelect options={dbData.categories} value={tempItem.category} onChange={(v) => { setTempItem({...tempItem, category: v, season: CATEGORY_SEASON_MAP[v] || tempItem.season }); }} placeholder="Категория" />
            <SmartSelect options={dbData.colors} value={tempItem.color} onChange={(v) => setTempItem({...tempItem, color: v})} placeholder="Цвет" />
            <SmartSelect options={dbData.styles} value={tempItem.style} onChange={(v) => setTempItem({...tempItem, style: v})} placeholder="Стиль" />
            <SmartSelect options={dbData.fits} value={tempItem.fit} onChange={(v) => setTempItem({...tempItem, fit: v})} placeholder="Крой" />
            <SmartSelect options={dbData.seasons} value={tempItem.season} onChange={(v) => setTempItem({...tempItem, season: v})} placeholder="Сезон" />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button className="auth-btn btn-primary" onClick={generateReport} disabled={!file || isAnalyzing} style={{ flex: 1 }}>✨ Анализ</button>
            <button className="auth-btn" onClick={() => { setFile(null); setReport(null); }} style={{ background: '#eee', width: '60px' }}>✕</button>
        </div>
      </div>

      {report && (
        <div style={{ marginTop: '30px', animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Результаты</h3>
            <button className="filter-chip" style={{ background: 'var(--primary-green)', color: '#fff', margin: 0 }} onClick={handleSaveToWardrobe}>Добавить +</button>
          </div>
          
          <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
            {report.matches.map(match => (
              <div key={match.id} className="card" style={{ height: 'auto', padding: '10px', background: '#fff' }}>
                <div style={{ position: 'relative' }}>
                    <img src={`${API_URL}/${match.image_path}`} alt={match.name} style={{ height: '100px', objectFit: 'contain', width: '100%' }} />
                    <div style={{ position: 'absolute', top: '-5px', right: '-5px', background: match.analysis.score > 75 ? '#4CAF50' : '#FF9800', color: 'white', padding: '4px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold' }}>
                        {match.analysis.score}%
                    </div>
                </div>
                <div style={{ marginTop: '5px', fontSize: '10px', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                   {match.analysis.details.color && <span>🎨</span>}
                   {match.analysis.details.style && <span>👔</span>}
                   {match.analysis.details.fit && <span>📏</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Preview;