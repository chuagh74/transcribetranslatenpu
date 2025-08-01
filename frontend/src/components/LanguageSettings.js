// src/components/LanguageSettings.js
import React from 'react';
import { Select, MenuItem } from '@mui/material';

export const languageOptions = [
{ value: "ar", label: "Arabic (العربية)" },
{ value: "bn", label: "Bengali (বাংলা)" },
{ value: "zh_CN", label: "Chinese Simplified (简体中文)" },
{ value: "zh_TW", label: "Chinese Traditional (繁体中文)" },
{ value: "en", label: "English (English)" },
{ value: "fr", label: "French (Français)" },
{ value: "de", label: "German (Deutsch)" },
{ value: "hi", label: "Hindi (हिन्दी)" },
{ value: "it", label: "Italian (Italiano)" },
{ value: "ja", label: "Japanese (日本語)" },
{ value: "jv", label: "Javanese (Basa Jawa)" },
{ value: "ko", label: "Korean (한국어)" },
{ value: "ms", label: "Malay (Bahasa Melayu)" },
{ value: "ml", label: "Malayalam (മലയാളം)" },
{ value: "mr", label: "Marathi (मराठी)" },
{ value: "pt", label: "Portuguese (Português)" },
{ value: "ru", label: "Russian (Русский)" },
{ value: "es", label: "Spanish (Español)" },
{ value: "ta", label: "Tamil (தமிழ்)" },
{ value: "te", label: "Telugu (తెలుగు)" },
{ value: "th", label: "Thai (ไทย)" },
{ value: "vi", label: "Vietnamese (Tiếng Việt)" },
];

export function LanguageSettings({
  label,
  value,
  onChange,
  options = languageOptions,
  disabled = false,
  size = "small", // Changed to small for more compact display
  compact = false, // New prop for even more compact display
  ...props
}) {
  return (
    <Select
      value={value}
      label={label}
      onChange={onChange}
      disabled={disabled}
      size={size}
      sx={{ 
        flex: 1, 
        minWidth: compact ? 120 : 160, // Smaller minimum width when compact
        '& .MuiSelect-select': {
          py: compact ? 0.5 : 1, // Reduced padding when compact
          fontSize: compact ? '0.75rem' : '0.875rem', // Smaller font when compact
        },
        '& .MuiOutlinedInput-root': {
          height: compact ? 32 : 36, // Reduced height when compact
        },
        ...props.sx 
      }}
      {...props}
    >
      {options.map((option) => (
        <MenuItem 
          key={option.value} 
          value={option.value}
          sx={{
            fontSize: compact ? '0.75rem' : '0.875rem', // Smaller font in menu items when compact
            py: compact ? 0.5 : 1, // Reduced padding in menu items when compact
          }}
        >
          {compact ? option.label.split('(')[0].trim() : option.label} {/* Show only language name when compact */}
        </MenuItem>
      ))}
    </Select>
  );
}