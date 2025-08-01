// src/pages/ModelsPage.js
import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  CircularProgress, 
  Container, 
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Refresh,
  Memory,
  Translate,
  RecordVoiceOver,
  Hearing,
  ExpandMore,
  ModelTraining,
  Computer,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { useCommonStyles } from '../utils/commonStyles';

const httpProtocol = window.location.protocol;
const host = httpProtocol === "https:" ? window.location.host : "127.0.0.1:8000";
const BASE_URL = `${httpProtocol}//${host}`;

export default function ModelsPage() {
  const theme = useTheme();
  const styles = useCommonStyles(theme);
  const [models, setModels] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BASE_URL}/v1/models`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setModels(data);
    } catch (error) {
      console.error("Failed to fetch models:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const renderModelCard = (title, icon, data, color = 'primary') => (
    <Card elevation={2} sx={{ height: '100%', bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', ...styles.cardHover }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: theme.palette.mode === 'dark' ? `rgba(${theme.palette[color].main.replace('#', '').match(/.{2}/g).map(x => parseInt(x, 16)).join(', ')}, 0.1)` : `${theme.palette[color].light}20`, mr: 2 }}>
            {icon}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
        </Box>
        {data}
      </CardContent>
    </Card>
  );

  const codeBlockStyle = {
    fontFamily: 'monospace',
    bgcolor: 'background.default',
    p: 1,
    borderRadius: 1,
    fontSize: '0.75rem',
    wordBreak: 'break-all'
  };

  const renderSTTCard = () => {
    const stt = models?.stt || {};
    return renderModelCard(
      'Speech-to-Text',
      <Hearing color="primary" />,
      <Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Active Model
          </Typography>
          <Chip label={stt.model_type || 'Not configured'} color="primary" size="small" icon={<CheckCircle />} />
        </Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Available Models ({stt.models?.length || 0})
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {stt.models?.map((model, idx) => (
            <Chip key={idx} label={model} size="small" variant="outlined" />
          )) || <Typography variant="body2" color="text.secondary">None</Typography>}
        </Box>
      </Box>,
      'primary'
    );
  };

  const renderTranslationCard = () => {
    const translation = models?.translation || {};
    return renderModelCard(
      'Translation',
      <Translate color="secondary" />,
      <Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Model Type
          </Typography>
          <Chip label={translation.model_type || 'Not configured'} color="secondary" size="small" icon={<CheckCircle />} />
        </Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Model Path
        </Typography>
        <Typography variant="body2" sx={codeBlockStyle}>
          {translation.model_path || 'Not specified'}
        </Typography>
      </Box>,
      'secondary'
    );
  };

  const renderTTSCard = () => {
    const tts = models?.tts || {};
    return renderModelCard(
      'Text-to-Speech',
      <RecordVoiceOver color="success" />,
      <Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            Model
          </Typography>
          <Typography variant="body2" sx={codeBlockStyle}>
            {tts.model_path || 'Not configured'}
          </Typography>
        </Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
          Vocoder
        </Typography>
        <Typography variant="body2" sx={codeBlockStyle}>
          {tts.vocoder_path || 'Not configured'}
        </Typography>
      </Box>,
      'success'
    );
  };

  const renderDevicesCard = () => {
    const devices = models?.available_devices || [];
    const deviceArray = Array.isArray(devices) ? devices : [devices].filter(Boolean);
    
    return renderModelCard(
      'Computing Devices',
      <Computer color="warning" />,
      <Box>
        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
          Available for Inference ({deviceArray.length})
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {deviceArray.length > 0 ? (
            deviceArray.map((device, idx) => (
              <Chip key={idx} label={device} color="warning" size="small" icon={<Memory />} />
            ))
          ) : (
            <Typography variant="body2" color="text.secondary">
              No devices detected
            </Typography>
          )}
        </Box>
      </Box>,
      'warning'
    );
  };

  return (
    <Container {...styles.mainContainer}>
      {/* Header */}
      <Box sx={styles.pageHeader}>
        <Box sx={styles.headerIcon}>
          <ModelTraining sx={{ fontSize: 28, display: "flex" }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={styles.headerTitle}>
            Models Explorer
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View and manage AI models and system resources
          </Typography>
        </Box>
        <Box sx={{ ml: 'auto' }}>
          <Tooltip title="Refresh Models Info">
            <IconButton onClick={fetchModels} disabled={loading} color="primary" sx={styles.iconButton()}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          Failed to load models: {error}
        </Alert>
      )}

      {/* Loading State */}
      {loading ? (
        <Paper elevation={1} sx={{ ...styles.centerFlex, py: 8, ...styles.standardPaper.sx }}>
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography color="text.secondary">Loading models information...</Typography>
          </Box>
        </Paper>
      ) : models ? (
        <Box>
          {/* Model Cards Grid */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6} lg={3} sx={{ flex: '1 1 22.5%' }}>
              {renderSTTCard()}
            </Grid>
            <Grid item xs={12} md={6} lg={3} sx={{ flex: '1 1 22.5%' }}>
              {renderTranslationCard()}
            </Grid>
            <Grid item xs={12} md={6} lg={3} sx={{ flex: '1 1 22.5%' }}>
              {renderTTSCard()}
            </Grid>
            <Grid item xs={12} md={6} lg={3} sx={{ flex: '1 1 22.5%' }}>
              {renderDevicesCard()}
            </Grid>
          </Grid>

          {/* Raw Data Section */}
          <Paper elevation={1} sx={{ bgcolor: 'background.paper', borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Info color="action" />
                  <Typography variant="h6">Raw Model Data</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider', maxHeight: 500, overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.875rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(models, null, 2)}
                  </pre>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Paper>
        </Box>
      ) : (
        <Paper elevation={1} sx={{ p: 4, textAlign: 'center', ...styles.standardPaper.sx }}>
          <Typography variant="h6" color="text.secondary">
            No model data available
          </Typography>
        </Paper>
      )}
    </Container>
  );
}
