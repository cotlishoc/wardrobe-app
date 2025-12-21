import React, { useState, useEffect } from 'react';
import CreatableSelect from 'react-select/creatable';
import { components } from 'react-select';
import { ALL_COLORS, ALL_STYLES } from '../data/wardrobeRules';

// Стартовые значения (если память пуста)
const initialOptions = {
  category: ['Верх', 'Низ', 'Обувь', 'Платья', 'Верхняя одежда', 'Аксессуары', 'Сумки'],
  color: ALL_COLORS, // Берем из файла
  style: ALL_STYLES, // Берем из файла
  season: ['Лето', 'Зима', 'Демисезон', 'Всесезон']
};

function SmartSelect({ type, value, onChange, placeholder }) {
  const [options, setOptions] = useState([]);
  const storageKey = `wardrobe_options_${type}`;

  // 1. Загрузка опций из LocalStorage при запуске
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setOptions(JSON.parse(saved));
    } else {
      // Превращаем массив строк в формат {label, value}
      const defaults = initialOptions[type].map(s => ({ label: s, value: s }));
      setOptions(defaults);
      localStorage.setItem(storageKey, JSON.stringify(defaults));
    }
  }, [type]);

  // 2. Создание новой опции
  const handleCreate = (inputValue) => {
    const newOption = { label: inputValue, value: inputValue };
    const newOptions = [...options, newOption];
    setOptions(newOptions);
    localStorage.setItem(storageKey, JSON.stringify(newOptions));
    onChange(inputValue); // Сразу выбираем её
  };

  // 3. Удаление опции
  const handleDeleteOption = (optionToDelete, e) => {
    e.stopPropagation(); // Чтобы список не закрылся и опция не выбралась
    e.preventDefault();
    
    if (window.confirm(`Удалить "${optionToDelete.label}" из списка?`)) {
      const newOptions = options.filter(o => o.value !== optionToDelete.value);
      setOptions(newOptions);
      localStorage.setItem(storageKey, JSON.stringify(newOptions));
      
      // Если удаленная опция была выбрана - сбрасываем выбор
      if (value === optionToDelete.value) {
        onChange('');
      }
    }
  };

  // 4. Кастомный вид опции (Текст + Крестик)
  const CustomOption = (props) => {
    return (
      <components.Option {...props}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{props.data.label}</span>
          <span 
            onClick={(e) => handleDeleteOption(props.data, e)}
            style={{ color: 'red', fontWeight: 'bold', cursor: 'pointer', paddingLeft: '10px' }}
          >
            ×
          </span>
        </div>
      </components.Option>
    );
  };

  // Текущее выбранное значение
  const currentValue = value ? { label: value, value: value } : null;

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>
        {placeholder}
      </label>
      <CreatableSelect
        isClearable
        options={options}
        value={currentValue}
        onChange={(newValue) => onChange(newValue ? newValue.value : '')}
        onCreateOption={handleCreate}
        components={{ Option: CustomOption }} // Подключаем наш дизайн опции
        placeholder={`Выбрать...`}
        formatCreateLabel={(val) => `Добавить "${val}"`}
        styles={{
        control: (base, state) => ({
          ...base,
          backgroundColor: '#ffc4d6', // Розовый фон
          borderColor: state.isFocused ? '#345e37' : 'transparent', // Зеленая обводка при фокусе
          borderRadius: '16px',
          padding: '2px 8px',
          boxShadow: 'none',
          color: '#345e37',
          '&:hover': { borderColor: 'transparent' }
        }),
        placeholder: (base) => ({
            ...base,
            color: '#a87b89' // Цвет плейсхолдера
        }),
        singleValue: (base) => ({
            ...base,
            color: '#345e37', // Зеленый текст выбранного значения
            fontWeight: '600'
        }),
        menu: (base) => ({ 
          ...base, 
          zIndex: 100,
          borderRadius: '16px',
          overflow: 'hidden',
          padding: '5px',
          backgroundColor: '#fff',
          border: '1px solid #ffc4d6'
        }),
        option: (base, state) => ({
          ...base,
          borderRadius: '8px',
          cursor: 'pointer',
          backgroundColor: state.isFocused ? '#e9f5eb' : 'white', // Светло-зеленый при наведении
          color: '#345e37',
          marginBottom: '2px'
        }),
        multiValue: (base) => ({
          ...base,
          backgroundColor: '#345e37',
          borderRadius: '12px',
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: 'white',
        })
      }}
      />
    </div>
  );
}

export default SmartSelect;