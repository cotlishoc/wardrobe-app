import { useState, useEffect } from 'react';
import api from '../api';
import SmartSelect from '../components/SmartSelect';
import { API_URL } from '../config';
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
    category: '', 
    color: '', 
    style: '', 
    season: '', 
    fit: '',
    image_path: '' 
  });

  const [report, setReport] = useState(null);

  useEffect(() => {
    api.get('/items/').then(res => setWardrobe(res.data));
    api.get('/categories').then(res => setDbData(prev => ({...prev, categories: res.data})));
    api.get('/colors').then(res => setDbData(prev => ({...prev, colors: res.data})));
    api.get('/styles').then(res => setDbData(prev => ({...prev, styles: res.data})));
    api.get('/seasons').then(res => setDbData(prev => ({...prev, seasons: res.data})));
    api.get('/fits').then(res => setDbData(prev => ({...prev, fits: res.data})));
    api.get('/occasions').then(res => setDbOccasions(res.data));
  }, []);

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    setRawFile(selectedFile);
    setFile(URL.createObjectURL(selectedFile));
    setIsAnalyzing(true);
    setReport(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/items/analyze', formData);
      setTempItem(prev => ({
        ...prev,
        category: res.data.category,
        color: res.data.color,
        image_path: res.data.image_path,
        season: CATEGORY_SEASON_MAP[res.data.category] || "Всесезон"
      }));
      setFile(`${API_URL}/${res.data.image_path}`);
    } catch (err) { alert("Ошибка ИИ"); } finally { setIsAnalyzing(false); }
  };

    const isHardConflict = (s, t) => {
        const sCat = s.category || "";
        const tCat = t.category || "";

        // 1. Защита от одинаковых категорий (нельзя две футболки или двое брюк)
        if (sCat === tCat) return true;

        // 2. Определяем группы для обеих вещей
        const getGroup = (cat) => Object.keys(CATEGORY_GROUPS).find(key => CATEGORY_GROUPS[key].includes(cat));
        const sGroup = getGroup(sCat);
        const tGroup = getGroup(tCat);

        // 3. Если группы не определены (новая категория), разрешаем подбор
        if (!sGroup || !tGroup) return false;

        // 4. Проверяем матрицу совместимости групп
        // Если группа tGroup не входит в список разрешенных для sGroup — это конфликт
        const isCompatible = GROUP_COMPATIBILITY[sGroup]?.includes(tGroup);
        
        if (!isCompatible) return true;

        // 5. Детское vs Взрослое (оставляем старую проверку)
        const sIsKids = sCat.toLowerCase().includes("детск");
        const tIsKids = tCat.toLowerCase().includes("детск");
        if (sIsKids !== tIsKids) return true;

        return false;
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
      
      <label className="upload-area" style={{ height: '280px', position: 'relative' }}>
        {isAnalyzing && (
            <div className="filter-modal-overlay" style={{position:'absolute', borderRadius:'24px'}}>
                <div className="spinner"></div>
            </div>
        )}
        {file ? (
          <img src={file} className="upload-preview" alt="Preview" style={{ objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--primary-green)', opacity: 0.7 }}>
             <p style={{ fontSize: '30px' }}>📸</p>
             <p>Сфотографируйте вещь</p>
          </div>
        )}
        <input type="file" onChange={handleFileChange} hidden accept="image/*" />
      </label>

      <div className="form-container" style={{ marginTop: '20px', padding: '20px', background: '#fff', borderRadius: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <div style={{ marginBottom: '15px' }}>
            <label style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', color: '#888' }}>Название модели</label>
            <input type="text" className="custom-input" value={tempItem.name} onChange={e => setTempItem({...tempItem, name: e.target.value})} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <SmartSelect options={dbData.categories} value={tempItem.category} onChange={(v) => setTempItem({...tempItem, category: v})} placeholder="Категория" />
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
            <button className="filter-chip" style={{ background: 'var(--primary-green)', color: '#fff', margin: 0, padding: '10px 15px' }} onClick={handleSaveToWardrobe}>
               Купить и добавить +
            </button>
          </div>
          
          <p style={{ fontWeight: 'bold', fontSize: '14px' }}>📍 Рекомендуемые события:</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '25px' }}>
            {report.suitableOccasions.length > 0 ? (
                report.suitableOccasions.map(occ => (
                    <span key={occ.id} className="filter-chip" style={{ background: 'var(--light-green)', border: '1px solid var(--primary-green)', margin: 0 }}>
                        {occ.name}
                    </span>
                ))
            ) : ( <span style={{color: '#888', fontSize: '13px'}}>Универсальная вещь</span> )}
          </div>

          <p style={{ fontWeight: 'bold', fontSize: '14px' }}>👗 Сочетается с вашим шкафом:</p>
          
          {report.matches.length > 0 ? (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginTop: '10px' }}>
                {report.matches.map(match => (
                  <div key={match.id} className="card" style={{ height: 'auto', padding: '10px', background: '#fff' }}>
                    <div style={{ position: 'relative' }}>
                        <img src={`${API_URL}/${match.image_path}`} alt={match.name} style={{ height: '120px', objectFit: 'contain', width: '100%' }} />
                        <div style={{ 
                            position: 'absolute', top: '-5px', right: '-5px', 
                            background: match.analysis.score > 75 ? '#4CAF50' : '#FF9800',
                            color: 'white', padding: '4px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold'
                        }}>
                            {match.analysis.score}%
                        </div>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '12px', textAlign:'center', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {match.name}
                    </div>
                    <div style={{ marginTop: '5px', fontSize: '10px', display: 'flex', justifyContent: 'center', gap: '4px' }}>
                       {match.analysis.details.color && <span title="Цвет">🎨</span>}
                       {match.analysis.details.style && <span title="Стиль">👔</span>}
                       {match.analysis.details.fit && <span title="Крой">📏</span>}
                       {match.analysis.details.season && <span title="Сезон">☁️</span>}
                    </div>
                  </div>
                ))}
              </div>
          ) : (
              <div style={{ textAlign: 'center', padding: '30px', background: '#f8f0f2', borderRadius: '20px', marginTop: '10px', border: '1px dashed var(--deep-pink)' }}>
                  <p style={{ color: 'var(--deep-pink)', fontWeight: 'bold' }}>Нет идеальных сочетаний 🔎</p>
                  <p style={{ fontSize: '12px', color: '#888' }}>Ваш гардероб пока слишком мал для этой вещи.</p>
                  <button className="auth-btn btn-primary" style={{ marginTop: '15px', height: '40px' }} onClick={() => window.location.href='/upload'}>
                      Наполнить гардероб
                  </button>
              </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Preview;