// src/AppMenu.js
import React from 'react';
import { Menu, DashboardMenuItem } from 'react-admin';
import { useTheme } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import MicIcon from '@mui/icons-material/Mic';
import StorageIcon from '@mui/icons-material/Storage';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { useCommonStyles } from './utils/commonStyles';

const AppMenu = (props) => {
  const theme = useTheme();
  const styles = useCommonStyles(theme);

  return (
    <Menu {...props}>
      <DashboardMenuItem 
        leftIcon={<DashboardIcon sx={styles.gradientIcon} />}
        sx={styles.menuItem}
      />
      <Menu.Item
        to="/transcribe-translate"
        primaryText="Transcribe & Translate"
        leftIcon={<TranslateIcon sx={styles.gradientIcon} />}
        sx={styles.menuItem}
      />
      <Menu.Item
        to="/speech"
        primaryText="Speech"
        leftIcon={<RecordVoiceOverIcon sx={styles.gradientIcon} />}
        sx={styles.menuItem}
      />
      <Menu.Item
        to="/live-transcription"
        primaryText="Live Transcription"
        leftIcon={<MicIcon sx={styles.gradientIcon} />}
        sx={styles.menuItem}
      />
      <Menu.Item
        to="/models"
        primaryText="Models Explorer"
        leftIcon={<StorageIcon sx={styles.gradientIcon} />}
        sx={styles.menuItem}
      />
    </Menu>
  );
};

export default AppMenu;
