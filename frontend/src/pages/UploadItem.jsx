import { useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';
import SmartSelect from '../components/SmartSelect';

function UploadItem() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  
  // Данные
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [style, setStyle] = useState('');
  const [season, setSeason] = useState('');

  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

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
      await api.post('/items/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate('/wardrobe');
    } catch (error) {
      alert('Ошибка при загрузке');
    }
  };

  return (
    // Используем класс page-padding и контейнер без лишних inline-стилей
    <div className="page-padding" style={{ padding: '20px' }}>
      
      {/* Шапка как в дизайне, используя .top-bar для выравнивания */}
      <div className="top-bar top-bar--start">
        <button onClick={() => navigate(-1)} className="back-btn back-btn--no-pad">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        </button>
        <h2 style={{ margin: '0 auto', transform: 'translateX(-12px)' }}>Новая вещь</h2>
      </div>

      <form onSubmit={handleSubmit} className="flex-col-gap">
        
        <label className="upload-area">
          {preview ? (
            <img src={preview} alt="Preview" className="upload-preview" />
          ) : (
            <div className="upload-placeholder">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#767676" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
              <span style={{marginTop: '10px', color: '#767676', fontSize: '14px'}}>Нажми для фото</span>
            </div>
          )}
          <input type="file" onChange={handleFileChange} hidden accept="image/*" />
        </label>

        <input 
          type="text" 
          className="custom-input"
          placeholder="Название" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          required 
        />

        <SmartSelect type="category" value={category} onChange={setCategory} placeholder="Категория" />
        <SmartSelect type="color" value={color} onChange={setColor} placeholder="Цвет" />
        <SmartSelect type="style" value={style} onChange={setStyle} placeholder="Стиль" />
        <SmartSelect type="season" value={season} onChange={setSeason} placeholder="Сезон" />
        
        <button type="submit" className="auth-btn btn-primary" style={{marginTop: '20px', marginBottom: '20px'}}>
          Сохранить
        </button>
      </form>
    </div>
  );
}

export default UploadItem;