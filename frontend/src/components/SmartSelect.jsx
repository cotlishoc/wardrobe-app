import React from 'react';
import CreatableSelect from 'react-select/creatable';

function SmartSelect({ options, value, onChange, placeholder }) {
  // Добавляем (options || []), чтобы если пришел undefined, код не сломался
  const formattedOptions = (options || []).map(opt => ({ label: opt, value: opt }));
  const currentValue = value ? { label: value, value: value } : null;

  return (
    <div style={{ marginBottom: '15px' }}>
      <label style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', display: 'block', color: 'var(--primary-green)' }}>
        {placeholder}
      </label>
      <CreatableSelect
        isClearable
        options={formattedOptions}
        value={currentValue}
        onChange={(newValue) => onChange(newValue ? newValue.value : '')}
        onCreateOption={(inputValue) => onChange(inputValue)}
        placeholder="Выбрать..."
        styles={{
            control: (base) => ({
                ...base,
                backgroundColor: '#ffc4d6',
                borderRadius: '16px',
                border: 'none',
                padding: '2px 8px',
                boxShadow: 'none'
            })
        }}
      />
    </div>
  );
}

export default SmartSelect;