// src/pages/SpeechPage.js
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react";
import {
  Typography,
  Button,
  TextField,
  Container,
  Paper,
  Box,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  useTheme,
} from "@mui/material";
import { VolumeUp, Download, RecordVoiceOver, CheckCircle } from "@mui/icons-material";
import VoiceSelector from "../components/VoiceSelector";
import { parseVoiceId, VoiceInfoPanel, LanguageFlagDisplay } from "../components/VoiceComponents";
import { useCommonStyles } from "../utils/commonStyles";

const API_URL = (() => {
  const proto = window.location.protocol;
  const host = proto === "https:" ? window.location.host : "127.0.0.1:8000";
  return `${proto}//${host}`;
})();

const LANG_MAP = {
  a: { code: "en-us", flag: "🇺🇸" },
  b: { code: "en-gb", flag: "🇬🇧" },
  j: { code: "ja-jp", flag: "🇯🇵" },
  z: { code: "zh-cn", flag: "🇨🇳" },
  e: { code: "es-es", flag: "🇪🇸" },
  f: { code: "fr-fr", flag: "🇫🇷" },
  h: { code: "hi-in", flag: "🇮🇳" },
  i: { code: "it-it", flag: "🇮🇹" },
  p: { code: "pt-br", flag: "🇧🇷" },
};

const langInfoFromVoice = (voiceId) => LANG_MAP[parseVoiceId(voiceId)?.region] || LANG_MAP.a;

export default function SpeechPage() {
  const theme = useTheme();
  const styles = useCommonStyles(theme);
  const ttsInput = useRef();
  const [voices, setVoices] = useState([]);
  const [voice, setVoice] = useState("am_michael");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/tts/voices`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        const list = data.voices || [];
        setVoices(list);
        setVoice(list.includes(data.default) ? data.default : list[0] || "am_michael");
      } catch {
        const fallback = ["af_bella", "am_michael"];
        setVoices(fallback);
        setVoice("am_michael");
        setErr("Could not fetch voices; using fallback list.");
      }
    })();
  }, []);

  const langInfo = useMemo(() => langInfoFromVoice(voice), [voice]);
  const handleTTS = useCallback(async () => {
    const text = ttsInput.current?.value.trim();
    if (!text) return setErr("Enter text to generate speech.");
    if (text.length > 1000) return setErr("Text exceeds 1000 characters.");

    setErr("");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/v1/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, language: langInfo.code }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || res.statusText);
      url && URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(await res.blob()));
    } catch (e) {
      setErr(e.message || "TTS failed");
    } finally {
      setBusy(false);
    }
  }, [voice, langInfo, url]);

  const charCount = ttsInput.current?.value.length || 0;
  const currentVoiceInfo = parseVoiceId(voice);

  return (
    <Container {...styles.mainContainer}>
      {/* Page Header */}
      <Box sx={styles.pageHeader}>
        <Box sx={styles.headerIcon}>
          <RecordVoiceOver sx={{ fontSize: 28, display: 'flex' }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={styles.headerTitle}>
            Text-to-Speech
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Convert text to natural speech using AI voices
          </Typography>
        </Box>
      </Box>

      {/* Voice Selection Section */}
      <Paper elevation={1} sx={{ ...styles.standardPaper.sx, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <RecordVoiceOver color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Voice Selection
          </Typography>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' },
          gap: 2,
          alignItems: 'stretch'
        }}>
          {/* Voice Selector - flex 1 1 70% */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 70%' } }}>
            <VoiceSelector 
              voices={voices} 
              selectedVoice={voice} 
              onVoiceChange={setVoice} 
              sx={{ width: '100%' }}
            />
          </Box>
          
          {/* Voice Info Panel - 300px wide with border */}
          <Box sx={{ 
            flex: { xs: '1 1 100%', md: '0 0 300px' },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1
          }}>
            <Box sx={{
              p: 2,
              borderRadius: 1,
              bgcolor: theme.palette.mode === 'dark' 
                ? 'rgba(255, 255, 255, 0.02)' 
                : 'rgba(0, 0, 0, 0.02)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 1
            }}>
              <VoiceInfoPanel voiceInfo={currentVoiceInfo} />
              <LanguageFlagDisplay voiceInfo={currentVoiceInfo} />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Text Input Section */}
      <Paper elevation={1} sx={styles.standardPaper.sx}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <VolumeUp color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Text Input
          </Typography>
        </Box>
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          alignItems: 'stretch'
        }}>
          {/* Text Field - flex 1 1 70% */}
          <Box sx={{ flex: { xs: '1 1 100%', sm: '1 1 70%' } }}>
            <TextField
              inputRef={ttsInput}
              label="Enter text"
              multiline
              rows={4}
              fullWidth
              helperText={
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  mt: 0.5
                }}>
                  <Typography variant="caption" color="text.secondary">
                    Best results with complete sentences and punctuation
                  </Typography>
                  <Chip 
                    label={`${charCount || 0}/1000`}
                    size="small"
                    color={
                      (charCount || 0) > 900 ? 'error' :
                      (charCount || 0) > 700 ? 'warning' : 'default'
                    }
                    variant="outlined"
                  />
                </Box>
              }
              sx={styles.roundedInput}
            />
          </Box>
          
          {/* Generate Button - 0 0 128px */}
          <Box sx={{ 
            flex: { xs: '1 1 100%', sm: '0 0 128px' },
            display: 'flex',
            alignItems: 'stretch'
          }}>
            <Button
              variant="contained"
              startIcon={busy ? <CircularProgress size={20} /> : <VolumeUp />}
              onClick={handleTTS}
              disabled={busy || !voices.length}
              sx={{
                ...styles.primaryButton,
                width: '100%',
                height: { xs: 56, sm: 'calc(100% - 32px)' }, // Full height minus margin bottom
                mb: 4, // Margin bottom of 4
                minHeight: 56,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5
              }}
            >
              {busy ? "Generating…" : "Generate Speech"}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Error Message Display */}
      {err && (
        <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>
          {err}
        </Alert>
      )}

      {/* Audio Output Section */}
      {url && (
        <Paper elevation={1} sx={{ ...styles.standardPaper.sx, mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircle color="success" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Speech Generated
              </Typography>
            </Box>
            <IconButton 
              color="primary" 
              href={url} 
              download="tts_output.wav"
              sx={styles.iconButton()}
            >
              <Download />
            </IconButton>
          </Box>
          <audio 
            controls 
            style={{ width: "100%", borderRadius: '8px' }} 
            src={url} 
          />
        </Paper>
      )}
    </Container>
  );
}
