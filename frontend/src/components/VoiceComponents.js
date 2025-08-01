import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import { Female, Male } from '@mui/icons-material';
import { US, GB, JP, CN, ES, FR, IN, IT, BR } from 'country-flag-icons/react/3x2';

// Language mapping based on voice ID prefixes with flag components
const LANGUAGE_MAP = {
  'a': { name: 'American English', flagComponent: US },
  'b': { name: 'British English', flagComponent: GB },
  'j': { name: 'Japanese', flagComponent: JP },
  'z': { name: 'Mandarin Chinese', flagComponent: CN },
  'e': { name: 'Spanish', flagComponent: ES },
  'f': { name: 'French', flagComponent: FR },
  'h': { name: 'Hindi', flagComponent: IN },
  'i': { name: 'Italian', flagComponent: IT },
  'p': { name: 'Portuguese', flagComponent: BR }
};

// Helper function to get flag component
export const getFlagComponent = (langCode) => {
  const language = LANGUAGE_MAP[langCode];
  if (language && language.flagComponent) {
    const FlagComponent = language.flagComponent;
    return <FlagComponent style={{ width: '20px', height: '15px', borderRadius: '2px' }} />;
  }
  return <span>🌍</span>;
};

// Extract language and gender from voice ID
export const parseVoiceId = (voiceId) => {
  // Handle undefined, null, or empty voiceId
  if (!voiceId || typeof voiceId !== 'string') {
    return {
      id: voiceId || 'unknown',
      name: 'Unknown',
      language: 'Unknown',
      languageFlag: <span>🌍</span>,
      gender: 'Unknown',
      displayName: 'Unknown Voice'
    };
  }

  // Handle malformed voice IDs that don't follow expected pattern
  if (voiceId.length < 2) {
    return {
      id: voiceId,
      name: voiceId,
      language: 'Unknown',
      languageFlag: <span>🌍</span>,
      gender: 'Unknown',
      displayName: voiceId
    };
  }

  const langCode = voiceId[0];
  const genderCode = voiceId[1];
  const nameParts = voiceId.split('_');
  const name = nameParts.length > 1 ? nameParts[1] : nameParts[0];
  
  const language = LANGUAGE_MAP[langCode] || { name: 'Unknown', flagComponent: null };
  const gender = genderCode === 'f' ? 'Female' : 'Male';
  
  // Handle cases where name might be undefined or empty
  const safeName = name || 'unknown';
  const displayName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
  
  return {
    id: voiceId,
    name: displayName,
    language: language.name,
    languageFlag: getFlagComponent(langCode),
    gender,
    displayName: displayName
  };
};

// Voice Option Component
export const VoiceOption = ({ voice, ...props }) => {
  return (
    <li {...props}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%', py: 0.5 }}>
        {/* Country Flag */}
        <Box sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 24
        }}>
          {voice.languageFlag}
        </Box>
        
        {/* Gender Icon */}
        <Box sx={{ 
          p: 0.4, 
          borderRadius: 1, 
          bgcolor: voice.gender === 'Female' ? '#fce4ec' : '#e3f2fd',
          border: `1px solid ${voice.gender === 'Female' ? '#f48fb1' : '#90caf9'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 28,
          height: 28
        }}>
          {voice.gender === 'Female' ? 
            <Female fontSize="small" sx={{ color: '#e91e63' }} /> : 
            <Male fontSize="small" sx={{ color: '#2196f3' }} />
          }
        </Box>
        
        {/* Voice Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
            {voice.displayName}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
            {voice.language} • {voice.gender}
          </Typography>
        </Box>
        
        {/* Voice ID Badge */}
        <Chip 
          label={voice.id}
          size="small"
          variant="outlined"
          sx={{ 
            borderRadius: 1,
            fontSize: '0.75rem',
            minWidth: 80,
            borderColor: 'divider',
            color: 'text.primary',
            bgcolor: 'background.paper'
          }}
        />
      </Box>
    </li>
  );
};

// Voice Info Panel Component
export const VoiceInfoPanel = ({ voiceInfo }) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
      <Box sx={{ 
        p: 0.7, 
        borderRadius: 1.5, 
        bgcolor: voiceInfo.gender === 'Female' ? '#fce4ec' : '#e3f2fd',
        border: `1px solid ${voiceInfo.gender === 'Female' ? '#f48fb1' : '#90caf9'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {voiceInfo.gender === 'Female' ? 
          <Female fontSize="small" sx={{ color: '#e91e63' }} /> : 
          <Male fontSize="small" sx={{ color: '#2196f3' }} />
        }
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          {voiceInfo.displayName}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {voiceInfo.gender} • {voiceInfo.language}
        </Typography>
      </Box>
    </Box>
  );
};

// Language Flag Display Component
export const LanguageFlagDisplay = ({ voiceInfo }) => {
  return (
    <Chip 
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {voiceInfo.languageFlag}
          <span>{voiceInfo.language}</span>
        </Box>
      }
      size="small"
      color="primary"
      variant="outlined"
      sx={{ fontSize: '0.75rem' }}
    />
  );
};

export { LANGUAGE_MAP };