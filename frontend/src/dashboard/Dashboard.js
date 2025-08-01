// src/dashboard/Dashboard.js
import React, { useState, useEffect } from 'react';
import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  useTheme,
  LinearProgress,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText
} from '@mui/material';
import {
  Refresh,
  Dashboard as DashboardIcon,
  Translate,
  RecordVoiceOver,
  Hearing,
  Computer,
  Info,
  TrendingUp
} from '@mui/icons-material';
import { useCommonStyles } from '../utils/commonStyles';

const httpProtocol = window.location.protocol;
const host = httpProtocol === "https:" ? window.location.host : "127.0.0.1:8000";
const BASE_URL = `${httpProtocol}//${host}`;

const Dashboard = () => {
  const theme = useTheme();
  const styles = useCommonStyles(theme);
  const [modelsInfo, setModelsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchModelsInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/v1/models`);
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const data = await res.json();
      setModelsInfo(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModelsInfo();
  }, []);

  const getModelStatus = (model) => {
    if (!model) return { status: 'error', label: 'Not Available' };
    if (model.models?.length > 0 || model.model_type) return { status: 'success', label: 'Active' };
    return { status: 'warning', label: 'Configured' };
  };

  const renderStatusCard = (title, icon, status, description, color = 'primary') => {
    const statusInfo = getModelStatus(status);
    
    return (
      <Card elevation={2} sx={{ ...styles.cardHover, height: '100%', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', position: 'relative', overflow: 'hidden' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={styles.spaceBetweenFlex}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar sx={{ bgcolor: theme.palette.mode === 'dark' ? `rgba(${theme.palette[color].main.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)).join(', ')}, 0.2)` : `${theme.palette[color].light}30`, color: `${color}.main`, width: 48, height: 48, mr: 2 }}>
                {icon}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
              </Box>
            </Box>
            <Chip size="small" label={statusInfo.label} color={statusInfo.status === 'success' ? 'success' : statusInfo.status === 'warning' ? 'warning' : 'error'} />
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderQuickStats = () => {
    const devices = modelsInfo?.available_devices || [];
    const deviceArray = Array.isArray(devices) ? devices : Object.values(devices);
    const sttModels = modelsInfo?.stt?.models || [];
    const hasTranslation = modelsInfo?.translation?.model_type || 'Not configured';
    const hasTTS = modelsInfo?.tts?.model || 'Not configured';

    const stats = [
      { icon: <Computer />, value: deviceArray.length, label: 'Devices', color: 'primary' },
      { icon: <Hearing />, value: sttModels.length, label: 'STT Models', color: 'secondary' },
      { icon: <Translate />, value: hasTranslation !== 'Not configured' ? '1' : '0', label: 'Translation', color: 'info' },
      { icon: <RecordVoiceOver />, value: hasTTS !== 'Not configured' ? '1' : '0', label: 'TTS', color: 'success' }
    ];

    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {stats.map((stat, idx) => (
          <Box key={idx} sx={{ flex: '1 1 calc(25% - 12px)' }}>
            <Paper elevation={1} sx={{ p: 2, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', ...styles.cardHover }}>
              <Box sx={{ display: 'inline-flex', p: 1, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? `rgba(${theme.palette[stat.color].main.replace('#', '').match(/.{2}/g)?.map(x => parseInt(x, 16)).join(', ')}, 0.1)` : `${theme.palette[stat.color].light}20`, mb: 1 }}>
                {React.cloneElement(stat.icon, { color: stat.color })}
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, color: `${stat.color}.main`, mb: 0.5 }}>
                {stat.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
            </Paper>
          </Box>
        ))}
      </Box>
    );
  };

  const renderSystemOverview = () => {
    const devices = modelsInfo?.available_devices || [];
    const deviceArray = Array.isArray(devices) ? devices : Object.values(devices);
    const sttModels = modelsInfo?.stt?.models || [];
    const hasTranslation = modelsInfo?.translation?.model_type || 'Not configured';
    const hasTTS = modelsInfo?.tts?.model || 'Not configured';
    
    const healthScore = Math.round(((deviceArray.length > 0 ? 25 : 0) + (sttModels.length > 0 ? 25 : 0) + (hasTranslation !== 'Not configured' ? 25 : 0) + (hasTTS !== 'Not configured' ? 25 : 0)));

    return (
      <Paper elevation={1} sx={{ p: 3, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TrendingUp color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            System Overview
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          <Box sx={{ flex: '1 1 40%', minWidth: '250px', display: 'flex', alignItems: 'center' }}>
            <Box sx={{ textAlign: 'center', flex: 1 }}>
              <Typography variant="h2" sx={{ fontWeight: 700, color: 'primary.main', mb: 1 }}>
                {healthScore}%
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                System Health
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={healthScore} 
                sx={{ 
                  mt: 1, 
                  height: 8, 
                  borderRadius: 4, 
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', 
                  '& .MuiLinearProgress-bar': { 
                    borderRadius: 4, 
                    bgcolor: healthScore >= 75 ? 'success.main' : healthScore >= 50 ? 'warning.main' : 'error.main' 
                  } 
                }} 
              />
            </Box>
          </Box>
          
          <Box sx={{ flex: '1 1 40%', minWidth: '250px' }}>
            <List dense>
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: deviceArray.length > 0 ? 'success.light' : 'error.light' }}>
                    <Computer sx={{ fontSize: 16 }} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary="Computing Devices" secondary={`${deviceArray.length} available`} />
              </ListItem>
              
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: sttModels.length > 0 ? 'success.light' : 'error.light' }}>
                    <Hearing sx={{ fontSize: 16 }} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary="STT Models" secondary={`${sttModels.length} configured`} />
              </ListItem>
              
              <ListItem>
                <ListItemAvatar>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: hasTranslation ? 'success.light' : 'warning.light' }}>
                    <Translate sx={{ fontSize: 16 }} />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary="Translation" secondary={hasTranslation || 'Not configured'} />
              </ListItem>
            </List>
          </Box>
        </Box>
      </Paper>
    );
  };

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/v1/models`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setModelsInfo(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  return (
    <Container {...styles.mainContainer}>
      {/* Header */}
      <Box sx={styles.pageHeader}>
        <Box sx={styles.headerIcon}>
          <DashboardIcon sx={{ fontSize: 28, display: 'flex' }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={styles.headerTitle}>
            AI Translation Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor your speech-to-text, translation, and text-to-speech models
          </Typography>
          {lastUpdated && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <Info sx={{ fontSize: 14 }} />
              Last updated: {lastUpdated.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <Tooltip title="Refresh Dashboard">
            <IconButton onClick={fetchModels} disabled={loading} color="primary" sx={styles.iconButton()}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          Failed to load dashboard data: {error}
        </Alert>
      )}

      {/* Content */}
      {loading ? (
        <Paper elevation={1} sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography color="text.secondary">Loading dashboard...</Typography>
          </Box>
        </Paper>
      ) : modelsInfo ? (
        <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
          {/* Quick Stats */}
          <Box sx={{ flex: '1 0 50%', mb: 2 }}>
            {renderQuickStats()}
          </Box>

          {/* System Overview */}
          <Box sx={{ flex: '1 0 40%', mb: 2 }}>
            {renderSystemOverview()}
          </Box>

          {/* Model Status Cards */}
          <Typography variant="h5" sx={{ fontWeight: 600, width: '100%' }}>
            Model Status
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, width: '100%' }}>
            <Box sx={{ flex: '1 1 calc(50% - 12px)', minWidth: '300px' }}>
              {renderStatusCard('Speech Recognition', <Hearing />, modelsInfo.stt, 'Convert speech to text', 'primary')}
            </Box>
            <Box sx={{ flex: '1 1 calc(50% - 12px)', minWidth: '300px' }}>
              {renderStatusCard('Translation', <Translate />, modelsInfo.translation, 'Translate between languages', 'secondary')}
            </Box>
            <Box sx={{ flex: '1 1 calc(50% - 12px)', minWidth: '300px' }}>
              {renderStatusCard('Text-to-Speech', <RecordVoiceOver />, modelsInfo.tts, 'Generate natural speech', 'success')}
            </Box>
            <Box sx={{ flex: '1 1 calc(50% - 12px)', minWidth: '300px' }}>
              {renderStatusCard('Computing', <Computer />, { models: modelsInfo.available_devices }, 'Hardware acceleration', 'info')}
            </Box>
          </Box>
        </Box>
      ) : (
        <Paper elevation={1} sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" color="text.secondary">
            No dashboard data available
          </Typography>
        </Paper>
      )}
    </Container>
  );
};

export default Dashboard;
