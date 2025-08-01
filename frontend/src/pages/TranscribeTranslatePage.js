// src/pages/TranscribeTranslatePage.js
import React, { useState, useCallback } from "react";
import {
  Typography,
  Button,
  Box,
  TextField,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Paper,
  IconButton,
  Tooltip,
  Container,
  Chip,
  Divider,
  useTheme,
} from "@mui/material";
import {
  Upload,
  Translate,
  ContentCopy,
  Clear,
  SwapHoriz,
  TextFields,
  AudioFile,
  CheckCircle,
  Language,
} from "@mui/icons-material";
import { LanguageSettings, languageOptions } from "../components/LanguageSettings";
import { mapLangForServer } from "../utils/languageUtils";
import { useCommonStyles } from "../utils/commonStyles";

const httpProtocol = window.location.protocol;
const host = httpProtocol === "https:" ? window.location.host : "127.0.0.1:8000";
const API_URL = `${httpProtocol}//${host}`;

// Reusable components
const TabPanel = ({ children, value, index }) => 
  value === index && <Box>{children}</Box>;

const LoadingButton = ({ loading, children, ...props }) => (
  <Button
    {...props}
    startIcon={loading ? <CircularProgress size={16} /> : props.startIcon}
    disabled={loading || props.disabled}
  >
    {loading ? (typeof children === 'string' ? `${children}...` : 'Loading...') : children}
  </Button>
);

const ContentBox = ({ title, hasContent, color = 'primary', children, actionButton, styles }) => (
  <Box sx={{
    flex: { xs: '1 1 100%', lg: '1 1 40%' },
    display: 'flex',
    flexDirection: 'column',
    bgcolor: hasContent ? styles.getThemedBgColor(color, 0.08) : 'background.default',
    border: '1px solid',
    borderColor: 'rgba(0, 0, 0, 0.12)',
    borderRadius: 1.5,
    minHeight: { xs: 200, lg: 300 },
    p: 2
  }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {actionButton}
    </Box>
    {children}
  </Box>
);

const ResultBox = ({ hasContent, color = 'primary', styles, children, ...props }) => (
  <Box
    sx={{
      flex: 1,
      p: 1.5,
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 1,
      bgcolor: 'background.paper',
      overflow: 'auto',
      ...props.sx
    }}
  >
    {children}
  </Box>
);

export default function TranscribeTranslatePage() {
  const theme = useTheme();
  const styles = useCommonStyles(theme);

  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("zh_CN");
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioResult, setAudioResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTranslatingAudio, setIsTranslatingAudio] = useState(false);
  const [error, setError] = useState(null);

  // Helper functions
  const getLangLabel = useCallback((code) => 
    code === "auto" ? "Auto Detect" : languageOptions.find((o) => o.value === code)?.label || code, 
    []
  );

  const copyToClipboard = useCallback((text) => {
    navigator.clipboard.writeText(text);
  }, []);

  const clearResults = useCallback(() => {
    setTranslatedText("");
    setAudioResult(null);
    setError(null);
  }, []);

  const swapLanguages = useCallback(() => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
  }, [sourceLanguage, targetLanguage]);

  // API calls
  const handleTextTranslation = useCallback(async () => {
    if (!inputText.trim()) {
      setError("Please enter some text to translate");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("text", inputText.trim());
      formData.append("source_language", mapLangForServer(sourceLanguage));
      formData.append("target_language", mapLangForServer(targetLanguage));

      const response = await fetch(`${API_URL}/translate`, { 
        method: "POST", 
        body: formData 
      });

      if (!response.ok) throw new Error(response.statusText);

      const data = await response.json();
      const translation = data.translated_text || data.translation || data.text || "";
      
      if (!translation) throw new Error("Server returned empty translation");
      
      setTranslatedText(translation);
    } catch (error) {
      setError(`Translation failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, sourceLanguage, targetLanguage]);

  const handleAudioTranslation = useCallback(async () => {
    if (!selectedFile) {
      setError("Please select an audio file");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Transcribe audio
      const transcribeFormData = new FormData();
      transcribeFormData.append("file", selectedFile);
      transcribeFormData.append("model", "whisper-1");
      if (sourceLanguage !== "auto") {
        transcribeFormData.append("language", mapLangForServer(sourceLanguage));
      }

      const transcribeResponse = await fetch(`${API_URL}/v1/audio/transcriptions`, {
        method: "POST",
        body: transcribeFormData
      });

      if (!transcribeResponse.ok) throw new Error(transcribeResponse.statusText);

      const transcribeData = await transcribeResponse.json();
      const transcription = transcribeData.text?.trim() || "";
      
      if (!transcription) throw new Error("No speech detected or transcription empty");
      
      setAudioResult({ transcription, text: "" });
      setIsLoading(false);

      // Step 2: Translate transcription
      setIsTranslatingAudio(true);
      
      const translateFormData = new FormData();
      translateFormData.append("text", transcription);
      translateFormData.append("source_language", mapLangForServer(sourceLanguage));
      translateFormData.append("target_language", mapLangForServer(targetLanguage));

      const translateResponse = await fetch(`${API_URL}/translate`, {
        method: "POST",
        body: translateFormData
      });

      if (!translateResponse.ok) throw new Error(translateResponse.statusText);

      const translateData = await translateResponse.json();
      const translation = translateData.translated_text || translateData.translation || translateData.text || "";
      
      if (!translation) throw new Error("Translation returned empty");
      
      setAudioResult({ transcription, text: translation });
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
      setIsTranslatingAudio(false);
    }
  }, [selectedFile, sourceLanguage, targetLanguage]);

  const handleFileChange = useCallback((event) => {
    const file = event.target.files[0];
    if (file) setSelectedFile(file);
  }, []);

  return (
    <Container {...styles.mainContainer}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Page Header */}
      <Box sx={styles.pageHeader}>
        <Box sx={styles.headerIcon}>
          <Translate sx={{ fontSize: 28, display: 'flex' }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={styles.headerTitle}>
            Transcribe & Translate
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Translate text or audio files between multiple languages with ease.
          </Typography>
        </Box>
      </Box>

      {/* Language Settings */}
      <Paper elevation={1} sx={{ ...styles.standardPaper.sx, mb: 2 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Language color="primary" />
          Language Settings
        </Typography>
        
        <Box sx={styles.responsiveRow}>
          <FormControl sx={{ flex: 1 }}>
            <InputLabel>From</InputLabel>
            <LanguageSettings
              label="From"
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              options={[{ value: "auto", label: "Auto Detect" }, ...languageOptions]}
              sx={styles.roundedInput}
            />
          </FormControl>

          <Box sx={styles.centerFlex}>
            <IconButton onClick={swapLanguages} color="primary" sx={styles.iconButton()}>
              <SwapHoriz />
            </IconButton>
          </Box>

          <FormControl sx={{ flex: 1 }}>
            <InputLabel>To</InputLabel>
            <LanguageSettings
              label="To"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              options={languageOptions}
              sx={styles.roundedInput}
            />
          </FormControl>
        </Box>

        <Box sx={{ ...styles.centerFlex, mt: 2 }}>
          <Chip label={getLangLabel(sourceLanguage)} color="primary" variant="outlined" size="small" />
          <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>→</Typography>
          <Chip label={getLangLabel(targetLanguage)} color="secondary" variant="outlined" size="small" />
        </Box>
      </Paper>

      {/* Translation Tabs */}
      <Paper elevation={1} sx={{ ...styles.standardPaper.sx, overflow: 'hidden', padding: '0 16px' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={styles.customTabs}>
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TextFields />
                Text Translation
              </Box>
            } />
            <Tab label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AudioFile />
                Audio Translation
              </Box>
            } />
          </Tabs>
        </Box>

        {/* Text Translation Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ ...styles.flexContainer, border: 'none', display: 'flex', flexDirection: 'row', gap: 2, padding: '16px 0' }}>
            {/* Input Section */}
            <ContentBox
              title="Input Text"
              hasContent={inputText}
              color="success"
              styles={styles}
              actionButton={
                <Chip
                  label={`${inputText.length} chars`}
                  size="small"
                  variant="outlined"
                  color={inputText ? "primary" : "default"}
                />
              }
            >
              <TextField
                fullWidth
                multiline
                placeholder="Enter text to translate..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                variant="outlined"
                size="small"
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  '& .MuiOutlinedInput-root': {
                    padding: 0,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    flex: 1,
                    display: 'flex',
                    alignItems: 'stretch',
                    '& fieldset': { border: 'none' },
                    '&:hover fieldset': { border: 'none' },
                    '&.Mui-focused fieldset': { border: 'none' },
                    '&:hover': {
                      borderColor: 'divider'
                    },
                    '&.Mui-focused': {
                      borderColor: 'primary.main'
                    }
                  }
                }}
                InputProps={styles.textAreaInput}
              />
            </ContentBox>

            {/* Action Buttons */}
            <Box sx={styles.actionButtonsContainer}>
              <LoadingButton
                variant="contained"
                size="medium"
                startIcon={<Translate />}
                onClick={handleTextTranslation}
                disabled={!inputText.trim()}
                loading={isLoading}
                sx={styles.primaryButton}
              >
                Translate
              </LoadingButton>
              <Button
                variant="outlined"
                size="medium"
                startIcon={<Clear />}
                onClick={clearResults}
                disabled={isLoading || (!translatedText && !inputText)}
                sx={styles.secondaryButton}
              >
                Clear
              </Button>
            </Box>

            {/* Output Section */}
            <ContentBox
              title="Translation"
              hasContent={translatedText}
              color="primary"
              styles={styles}
              actionButton={
                translatedText && (
                  <Tooltip title="Copy Translation">
                    <IconButton onClick={() => copyToClipboard(translatedText)} size="small" color="primary">
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                )
              }
            >
              <ResultBox hasContent={translatedText} styles={styles} sx={{ ...styles.centerFlex, flexDirection: 'column' }}>
                {isLoading ? (
                  <Box sx={{ ...styles.centerFlex }}>
                    <CircularProgress size={20} />
                    <Typography color="text.secondary" sx={{ ml: 2 }}>Translating text...</Typography>
                  </Box>
                ) : translatedText ? (
                  <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, width: '100%', alignItems: 'flex-start', flex: 1 }}>
                    {translatedText}
                  </Typography>
                ) : (
                  <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Translation will appear here...
                  </Typography>
                )}
              </ResultBox>
            </ContentBox>
          </Box>
        </TabPanel>

        {/* Audio Translation Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ ...styles.flexContainer, border: 'none', display: 'flex', flexDirection: 'row', gap: 2, padding: '16px 0' }}>
            {/* File Upload Section */}
            <ContentBox
              title="Audio File"
              hasContent={selectedFile}
              color="secondary"
              styles={styles}
              actionButton={
                selectedFile && (
                  <Chip
                    label={`${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`}
                    size="small"
                    variant="outlined"
                    color="primary"
                  />
                )
              }
            >
              <Box
                component="label"
                htmlFor="audio-file-input"
                sx={{
                  flex: 1,
                  p: 1.5,
                  border: 1,
                  borderColor: selectedFile ? styles.getThemedBorderColor('secondary', 0.2) : 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 180,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: theme.palette.primary.main,
                    bgcolor: styles.getThemedBgColor('primary', 0.04),
                  }
                }}
              >
                <input
                  id="audio-file-input"
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                
                {selectedFile ? (
                  <Box sx={{ textAlign: 'center', width: '100%' }}>
                    <AudioFile sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 500, mb: 0.5 }}>
                      {selectedFile.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Click to change file
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                      <Chip label={selectedFile.type || 'Audio file'} size="small" />
                      <Chip 
                        label={new Date(selectedFile.lastModified).toLocaleDateString()} 
                        size="small" 
                        variant="outlined" 
                      />
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center' }}>
                    <Upload sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 500 }}>
                      Choose Audio File
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Drag and drop or click to select
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Supports: MP3, WAV, M4A, OGG, FLAC
                    </Typography>
                  </Box>
                )}
              </Box>
            </ContentBox>

            {/* Action Buttons */}
            <Box sx={styles.actionButtonsContainer}>
              <LoadingButton
                variant="contained"
                size="medium"
                startIcon={<Translate />}
                onClick={handleAudioTranslation}
                disabled={!selectedFile}
                loading={isLoading}
                sx={styles.primaryButton}
              >
                Process
              </LoadingButton>
              <Button
                variant="outlined"
                size="medium"
                startIcon={<Clear />}
                onClick={() => {
                  setSelectedFile(null);
                  clearResults();
                }}
                disabled={isLoading || (!selectedFile && !audioResult)}
                sx={styles.secondaryButton}
              >
                Clear
              </Button>
            </Box>

            {/* Results Section */}
            <ContentBox
              title="Results"
              hasContent={audioResult}
              color="primary"
              styles={styles}
              actionButton={
                audioResult && (
                  <Tooltip title="Copy Transcription">
                    <IconButton onClick={() => copyToClipboard(audioResult.transcription)} size="small" color="primary">
                      <ContentCopy />
                    </IconButton>
                  </Tooltip>
                )
              }
            >
              <ResultBox hasContent={audioResult} styles={styles} sx={{ ...styles.centerFlex, display: 'flex', flexDirection: 'row' }}>
                {isLoading ? (
                  <Box sx={{ ...styles.centerFlex, minHeight: 100, flex: 1 }}>
                    <CircularProgress size={24} />
                    <Typography color="text.secondary" sx={{ ml: 2 }}>
                      Processing audio file...
                    </Typography>
                  </Box>
                ) : audioResult ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    {/* Transcription */}
                    <Box>  
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Transcription
                        </Typography>
                        <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                      </Box>
                      <Paper sx={{
                        p: 1.5,
                        bgcolor: styles.getThemedBgColor('success', 0.08),
                        border: 1,
                        borderColor: styles.getThemedBorderColor('success', 0.2),
                        borderRadius: 1,
                      }}>
                        <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {audioResult.transcription}
                        </Typography>
                      </Paper>
                    </Box>

                    <Divider />

                    {/* Translation */}
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Translation
                        </Typography>
                        {isTranslatingAudio ? (
                          <CircularProgress size={16} />
                        ) : audioResult.text ? (
                          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : null}
                        {audioResult.text && (
                          <Tooltip title="Copy Translation">
                            <IconButton onClick={() => copyToClipboard(audioResult.text)} size="small" color="primary" sx={{ ml: 'auto' }}>
                              <ContentCopy />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                      <Paper sx={{
                        p: 1.5,
                        bgcolor: audioResult.text ? styles.getThemedBgColor('primary', 0.08) : 'background.default',
                        border: 1,
                        borderColor: audioResult.text ? styles.getThemedBorderColor('primary', 0.2) : 'divider',
                        borderRadius: 1,
                        minHeight: 60,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: audioResult.text ? 'flex-start' : 'center',
                      }}>
                        {isTranslatingAudio && !audioResult.text ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CircularProgress size={18} />
                            <Typography color="text.secondary">Translating...</Typography>
                          </Box>
                        ) : audioResult.text ? (
                          <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                            {audioResult.text}
                          </Typography>
                        ) : (
                          <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            Translation will appear here...
                          </Typography>
                        )}
                      </Paper>
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ ...styles.centerFlex, minHeight: 180 }}>
                    <Typography color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                      Upload an audio file and click "Process" to see transcription and translation results here
                    </Typography>
                  </Box>
                )}
              </ResultBox>
            </ContentBox>
          </Box>
        </TabPanel>
      </Paper>
    </Container>
  );
}
