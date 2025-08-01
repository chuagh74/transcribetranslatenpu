// src/pages/LiveTranscriptionPage.js
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Container,
  Paper,
  Tooltip,
  Fade,
  Chip,
  useTheme,
  alpha,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import ClearIcon from "@mui/icons-material/Clear";
import RemoveCircleIcon from "@mui/icons-material/RemoveCircle";
import MaleIcon from "@mui/icons-material/Male";
import FemaleIcon from "@mui/icons-material/Female";
import MicIcon from "@mui/icons-material/Mic";
import MicOffIcon from "@mui/icons-material/MicOff";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import SaveIcon from "@mui/icons-material/Save";
import InfoIcon from "@mui/icons-material/Info";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import SettingsIcon from "@mui/icons-material/Settings";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteIcon from "@mui/icons-material/Delete";
import { LanguageSettings, languageOptions } from "../components/LanguageSettings";
import { floatTo16BitPCM, downsampleBuffer } from "../utils/audioUtils";
import { mapLangForServer } from "../utils/languageUtils";
import { useCommonStyles } from "../utils/commonStyles";

/* -------------------------------------------------------------------------- */
/* Environment                                                                */
/* -------------------------------------------------------------------------- */
const httpProto = window.location.protocol;
const wsProto = httpProto === "https:" ? "wss:" : "ws:";
const host = httpProto === "https:" ? window.location.host : "127.0.0.1:8000";
const WS_URL = `${wsProto}//${host}/v1/realtime/transcription_sessions`;
const DEFAULT_TTS_URL = `${httpProto}//${host}/v1/tts`;
const TRANS_URL = `${httpProto}//${host}/translate`;

/* -------------------------------------------------------------------------- */
/* edge_tts voice maps                                                          */
/* -------------------------------------------------------------------------- */
const MALE_VOICE = {
  en: "en-SG-WayneNeural",
  ja: "ja-JP-KeitaNeural",
  zh_CN: "zh-CN-YunjianNeural",
  zh_TW: "zh-TW-YunJheNeural",
  ms: "ms-MY-OsmanNeural",
  es: "es-AR-TomasNeural",
  fr: "fr-BE-GerardNeural",
  hi: "hi-IN-MadhurNeural",
  it: "it-IT-DiegoNeural",
  pt: "pt-BR-AntonioNeural",
  ko: "ko-KR-InJoonNeural",
  vi: "vi-VN-NamMinhNeural",
  ta: "ta-SG-AnbuNeural",
  th: "th-TH-NiwatNeural",
};
const FEMALE_VOICE = {
  en: "en-SG-LunaNeural",
  ja: "ja-JP-NanamiNeural",
  zh_CN: "zh-CN-XiaoxiaoNeural",
  zh_TW: "zh-TW-HsiaoChenNeural",
  ms: "ms-MY-YasminNeural",
  es: "es-AR-ElenaNeural",
  fr: "fr-BE-CharlineNeural",
  hi: "hi-IN-SwaraNeural",
  it: "it-IT-ElsaNeural",
  pt: "pt-BR-FranciscaNeural",
  ko: "ko-KR-SunHiNeural",
  vi: "vi-VN-HoaiMyNeural",
  ta: "ta-SG-VenbaNeural",
  th: "th-TH-PremwadeeNeural",
};

/* -------------------------------------------------------------------------- */
/* Kokoro voice maps                                                          */
/* -------------------------------------------------------------------------- */
const MALE_VOICE_KKR = {
  en: "am_michael",
  ja: "jf_alpha",
  // zh_CN: "zm_yunxi",
  // zh_TW: "zm_yunjian",
  es: "bm_george",
  fr: "hm_omega",
  hi: "hm_psi",
  it: "im_nicola",
  pt: "bm_lewis",
};
const FEMALE_VOICE_KKR = {
  en: "af_bella",
  ja: "jf_nezumi",
  // zh_CN: "zf_xiaoxiao",
  // zh_TW: "zf_xiaobei",
  es: "bf_isabella",
  fr: "ff_siwis",
  hi: "if_sara",
  it: "jf_gongitsune",
  pt: "pf_dora",
};
const getVoiceKey = (lang) => (lang.startsWith("zh") ? lang.replace("-", "_") : lang.slice(0, 2));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */
const translateText = async (text, src, tgt) => {
  const fd = new FormData();
  fd.append("text", text);
  fd.append("source_language", mapLangForServer(src));
  fd.append("target_language", mapLangForServer(tgt));
  try {
    const r = await fetch(TRANS_URL, { method: "POST", body: fd });
    if (!r.ok) throw new Error();
    const d = await r.json();
    return d.translated_text || d.text || text;
  } catch (e) {
    console.error("translate error", e);
    return text;
  }
};

const newCol = (over = {}) => ({
  id: Date.now().toString(),
  label: "Transcript",
  lang: "en",
  lines: [],
  ...over,
});

const LiveTranscriptionPage = () => {
  const theme = useTheme();
  const styles = useCommonStyles(theme);

  /* ------------------------------ state refs ------------------------------ */
  const [isLive, setIsLive] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [summaryExpanded, setSummaryExpanded] = useState(true);
  const [aiSummaryExpanded, setAiSummaryExpanded] = useState(true);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [openAiConfig, setOpenAiConfig] = useState({
    endpoint: localStorage.getItem('openai_endpoint') || 'http://127.0.0.1:8719/v1',
    apiKey: localStorage.getItem('openai_api_key') || '',
    model: localStorage.getItem('openai_model') || '/nfs/llm_models/Qwen/Qwen2-VL-2B-Instruct',
    ttsUrl: localStorage.getItem('tts_url') || 'http://127.0.0.1:8418/v1/tts',
    prompt: localStorage.getItem('openai_prompt') || `You are an expert assistant that analyzes meeting transcripts and conversations. Please provide a comprehensive summary with:
1. **Main Points**: Key topics and important information discussed
2. **Action Items**: Specific tasks, decisions, or follow-ups that need to be done
3. **Key Participants**: Who spoke and their main contributions (if identifiable)
4. **Important Decisions**: Any conclusions or resolutions made
5. **Next Steps**: What should happen after this conversation

Format your response in clear, organized sections with bullet points for easy reading.`
  });
  const [columns, setColumns] = useState([
    newCol({ id: "original", label: "Original", lang: "auto", isOriginal: true }),
  ]);
  const wsRef = useRef(null);
  const streamRef = useRef(null);
  const colsRef = useRef(columns);
  colsRef.current = columns;

  /* ----------------------------- socket logic ----------------------------- */
  const closeSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  };

  const stopLive = useCallback(() => {
    if (!isLive) return;
    setIsLive(false);
    closeSocket();
    const s = streamRef.current;
    if (s) {
      s.proc.disconnect();
      s.ctx.close();
      s.mediaStream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [isLive]);

  const openSocket = useCallback(
    (srcLang) => {
      closeSocket();
      const ws = new WebSocket(`${WS_URL}?src_lang=${encodeURIComponent(mapLangForServer(srcLang))}`);
      
      ws.onopen = () => {
        setWsConnected(true);
        console.log('WebSocket connected');
      };
      
      ws.onclose = () => {
        setWsConnected(false);
        console.log('WebSocket disconnected');
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
        stopLive();
      };
      
      ws.onmessage = async ({ data }) => {
        try {
          const { transcript } = JSON.parse(data);
          const raw = typeof transcript === "object" ? transcript?.text : transcript;
          if (!raw) return;

          setColumns((p) => p.map((c) => (c.isOriginal ? { ...c, lines: [...c.lines, raw] } : c)));

          colsRef.current.forEach(async (col) => {
            if (col.isOriginal) return;
            const translated = await translateText(raw, srcLang, col.lang);
            setColumns((p) => p.map((c) => (c.id === col.id ? { ...c, lines: [...c.lines, translated] } : c)));
          });
        } catch (err) {
          console.error(err);
        }
      };
      
      wsRef.current = ws;
    },
    [stopLive]
  );

  /* ------------------------------ mic stream ------------------------------ */
  const attachMic = useCallback(async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    ctx.createMediaStreamSource(mediaStream).connect(proc);
    proc.connect(ctx.destination);

    proc.onaudioprocess = ({ inputBuffer }) => {
      const down = downsampleBuffer(inputBuffer.getChannelData(0), ctx.sampleRate, 16000);
      const pcm = new Uint8Array(floatTo16BitPCM(down).buffer);
      for (let i = 0; i < pcm.length; i += 320) {
        const slice = pcm.slice(i, i + 320);
        wsRef.current && wsRef.current.readyState === 1 && wsRef.current.send(slice);
      }
    };
    streamRef.current = { mediaStream, ctx, proc };
  }, []);

  const startLive = async () => {
    if (isLive) return;
    setIsProcessing(true);
    const srcLang = columns.find((c) => c.isOriginal)?.lang || "auto";
    openSocket(srcLang);
    try {
      await attachMic();
      setIsLive(true);
    } catch (e) {
      alert(`Microphone error: ${e.message}`);
      closeSocket();
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => () => stopLive(), [stopLive]);

  /* ------------------------------- actions ------------------------------- */
  const clearOutputs = () => setColumns((p) => p.map((c) => ({ ...c, lines: [] })));
  const addColumn = () => {
    if (columns.filter((c) => !c.isOriginal).length >= 2) return alert("Max 2 targets");
    setColumns((p) => [...p, newCol()]);
  };
  const removeColumn = (id) => setColumns((p) => p.filter((c) => c.id !== id));
  const changeLang = (id, lang) => setColumns((p) => p.map((c) => (c.id === id ? { ...c, lang, lines: [] } : c)));
  const changeSrcLang = (lang) => {
    setColumns((p) => p.map((c) => (c.isOriginal ? { ...c, lang } : c)));
    stopLive();
    setTimeout(startLive, 200);
  };

  const deleteLine = (columnId, lineIndex) => {
    setColumns((p) => p.map((c) => 
      c.id === columnId 
        ? { ...c, lines: c.lines.filter((_, i) => i !== lineIndex) }
        : c
    ));
  };


  const playTTS = async (text, lang, gender) => {
    const voice = (gender === "male" ? MALE_VOICE : FEMALE_VOICE)[getVoiceKey(lang)];
    if (!voice || !text.trim()) return;

    try {
      const res = await fetch(openAiConfig.ttsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text,
          voice,
          language: lang,
          speed: 1.0  // optional but good to include
        })
      });

      if (!res.ok) {
        throw new Error(`TTS request failed: ${res.status}`);
      }

      const audioBlob = await res.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => URL.revokeObjectURL(audioUrl); // cleanup
    } catch (err) {
      console.error("TTS Error:", err);
    }
  };


  const playTTS_kokoro = async (text, lang, gender) => {
    const voice = (gender === "male" ? MALE_VOICE_KKR : FEMALE_VOICE_KKR)[getVoiceKey(lang)];
    if (!voice || !text.trim()) return;
    try {
      const res = await fetch(openAiConfig.ttsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, language: lang }),
      });
      if (!res.ok) throw new Error();
      new Audio(URL.createObjectURL(await res.blob())).play();
    } catch (err) {
      console.error(err);
    }
  };

  const saveTranscript = () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const content = columns.map(col => {
      const langLabel = col.isOriginal ? `${col.label} (${col.lang})` : `${col.label} (${col.lang})`;
      return `=== ${langLabel} ===\n${col.lines.join('\n')}`;
    }).join('\n\n');
    
    const summary = getTranscriptSummary();
    const fullContent = `Transcript saved on: ${new Date().toLocaleString()}\n\n${summary}\n\n${content}`;
    
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${timestamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getTranscriptSummary = () => {
    const originalCol = columns.find(c => c.isOriginal);
    const translationCols = columns.filter(c => !c.isOriginal);
    
    const totalLines = originalCol?.lines.length || 0;
    const totalWords = originalCol?.lines.reduce((acc, line) => acc + line.split(' ').length, 0) || 0;
    const totalChars = originalCol?.lines.reduce((acc, line) => acc + line.length, 0) || 0;
    
    return `=== TRANSCRIPT SUMMARY ===
Total Lines: ${totalLines}
Total Words: ${totalWords}
Total Characters: ${totalChars}
Source Language: ${originalCol?.lang || 'Unknown'}
Translation Languages: ${translationCols.map(c => c.lang).join(', ') || 'None'}
Recording Duration: ${isLive ? 'Still recording...' : 'Completed'}`;
  };

  const saveOpenAiConfig = () => {
    localStorage.setItem('openai_endpoint', openAiConfig.endpoint);
    localStorage.setItem('openai_api_key', openAiConfig.apiKey);
    localStorage.setItem('openai_model', openAiConfig.model);
    localStorage.setItem('tts_url', openAiConfig.ttsUrl);
    localStorage.setItem('openai_prompt', openAiConfig.prompt);
    setShowAiConfig(false);
  };

  const handleFollowUpQuestion = async () => {
    if (!followUpQuestion.trim()) return;

    const originalCol = columns.find(c => c.isOriginal);
    if (!originalCol?.lines.length) return;

    const fullTranscript = originalCol.lines.join('\n');
    setIsGeneratingAi(true);

    try {
      const response = await fetch(`${openAiConfig.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: openAiConfig.model,
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant analyzing a transcript. Base your answers on the transcript content only.'
            },
            {
              role: 'user',
              content: `Here is the transcript:\n\n${fullTranscript}\n\nQuestion: ${followUpQuestion}`
            }
          ],
          max_tokens: 1500,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const answer = data.choices?.[0]?.message?.content;
      
      if (!answer) {
        throw new Error('No answer generated from API response');
      }

      // Update the AI summary with the new question and answer
      setAiSummary(prev => ({
        ...prev,
        content: prev.content + '\n\n---\n\n**Q: ' + followUpQuestion + '**\n\n' + answer
      }));
      
      // Clear the question input
      setFollowUpQuestion('');
      
    } catch (error) {
      console.error('AI Follow-up Error:', error);
      alert(`Failed to generate answer: ${error.message}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const generateAiSummary = async () => {
    const originalCol = columns.find(c => c.isOriginal);
    if (!originalCol?.lines.length) return;

    const fullTranscript = originalCol.lines.join('\n');
    if (!openAiConfig.apiKey.trim()) {
      alert('Please configure your OpenAI API key first.');
      setShowAiConfig(true);
      return;
    }

    setIsGeneratingAi(true);
    try {
      const response = await fetch(`${openAiConfig.endpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: openAiConfig.model,
          messages: [
            {
              role: 'system',
              content: openAiConfig.prompt
            },
            {
              role: 'user',
              content: `Please analyze this transcript and provide a summary with main points and action items:\n\n${fullTranscript}`
            }
          ],
          max_tokens: 1500,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const summary = data.choices?.[0]?.message?.content;
      
      if (!summary) {
        throw new Error('No summary generated from OpenAI response');
      }

      setAiSummary({
        content: summary,
        timestamp: new Date().toLocaleString(),
        model: openAiConfig.model,
        wordCount: originalCol.lines.reduce((acc, line) => acc + line.split(' ').length, 0)
      });
      
    } catch (error) {
      console.error('AI Summary Error:', error);
      alert(`Failed to generate AI summary: ${error.message}`);
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const maxLines = Math.max(...columns.map((c) => c.lines.length));

  return (
    <Container {...styles.mainContainer}>
      {/* Header - Consistent with other pages */}
      <Box sx={styles.pageHeader}>
        <Box sx={styles.headerIcon}>
          <MicIcon sx={{ fontSize: 28, display: "flex" }} />
        </Box>
        <Box>
          <Typography variant="h4" sx={styles.headerTitle}>
            Live Transcription & Translation
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time speech-to-text with instant translation
          </Typography>
        </Box>
      </Box>

      {/* Status Bar */}
      <Paper 
        elevation={1}
        sx={{
          ...styles.standardPaper.sx,
          mb: 2,
          paddingBottom: 2,
        }}
      >
        <Typography variant="h6" gutterBottom sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          mb: 2.5,
          fontWeight: 600 
        }}>
          <MicIcon color="primary" />
          Recording Status
          
          {/* Status chips moved up beside the title - WebSocket first, then Recording */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, ml: 3 }}>
            <Chip
              icon={wsConnected ? <WifiIcon /> : <WifiOffIcon />}
              label={wsConnected ? "WebSocket Connected" : "WebSocket Disconnected"}
              color={wsConnected ? "info" : "error"}
              variant={wsConnected ? "filled" : "outlined"}
              size="small"
              sx={{ 
                ...(wsConnected && isLive && styles.pulse)
              }}
            />
            
            <Chip
              icon={isLive ? <MicIcon /> : <MicOffIcon />}
              label={isLive ? "Live Recording" : "Stopped"}
              color={isLive ? "success" : "default"}
              variant={isLive ? "filled" : "outlined"}
              size="small"
              sx={{ 
                ...(isLive && styles.pulse)
              }}
            />
          </Box>
        </Typography>

        {/* Controls - Recording buttons */}
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Button 
            variant="contained" 
            color="success"
            size="medium"
            startIcon={<MicIcon />}
            onClick={startLive} 
            disabled={isLive || isProcessing}
            sx={styles.primaryButton}
          >
            {isProcessing ? "Starting..." : "Start Recording"}
          </Button>
          <Button 
            variant="contained" 
            color="error"
            size="medium"
            startIcon={<MicOffIcon />}
            onClick={stopLive} 
            disabled={!isLive}
            sx={styles.primaryButton}
          >
            Stop Recording
          </Button>
          <Button 
            variant="outlined" 
            color="primary"
            size="medium"
            startIcon={<SaveIcon />}
            onClick={saveTranscript} 
            disabled={maxLines === 0}
            sx={styles.primaryButton}
          >
            Save Transcript
          </Button>
          <Button 
            variant="outlined" 
            color="info"
            size="medium"
            startIcon={<InfoIcon />}
            onClick={() => setShowSummary(!showSummary)} 
            disabled={maxLines === 0}
            sx={styles.primaryButton}
          >
            {showSummary ? "Hide Summary" : "Show Summary"}
          </Button>
          <Button 
            variant="outlined" 
            color="secondary"
            size="medium"
            startIcon={isGeneratingAi ? <CircularProgress size={16} /> : <SmartToyIcon />}
            onClick={generateAiSummary} 
            disabled={maxLines === 0 || isGeneratingAi}
            sx={styles.primaryButton}
          >
            {isGeneratingAi ? "Generating..." : "AI Summary"}
          </Button>
          <Button 
            variant="outlined" 
            color="default"
            size="medium"
            startIcon={<SettingsIcon />}
            onClick={() => setShowAiConfig(true)} 
            sx={styles.primaryButton}
          >
            AI & TTS Config
          </Button>
        </Box>
        
        {/* Action buttons row - X and + in separate positions */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1.5, height: 1.5 }}>
          <Tooltip title="Clear All Transcripts">
            <IconButton 
              onClick={clearOutputs} 
              size="small"
              sx={{ 
                color: 'text.secondary',
                bgcolor: 'transparent',
                border: 'none',
                '&:hover': {
                  bgcolor: alpha(theme.palette.warning.main, 0.08),
                  color: theme.palette.warning.main
                }
              }}
            >
              <ClearIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          <Tooltip title="Add Translation Column">
            <IconButton 
              onClick={addColumn} 
              size="small"
              sx={{ 
                color: 'text.secondary',
                bgcolor: 'transparent',
                border: 'none',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: theme.palette.primary.main
                }
              }}
            >
              <AddCircleIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Paper>

      {/* Summary Panel */}
      {showSummary && maxLines > 0 && (
        <Fade in={showSummary} timeout={300}>
          <Paper 
            elevation={1}
            sx={{
              ...styles.standardPaper.sx,
              mb: 2,
              bgcolor: alpha(theme.palette.info.main, 0.02),
              border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              p: 0,
              '&:hover': {
                bgcolor: alpha(theme.palette.info.main, 0.04)
              }
            }}
            onClick={() => setSummaryExpanded(!summaryExpanded)}
            >
              <Typography variant="h6" sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                fontWeight: 600,
                color: theme.palette.info.main,
                p: 2,
                pb: summaryExpanded ? 2 : 2
              }}>
                <InfoIcon />
                Transcript Summary
              </Typography>
              
              <IconButton 
                size="small"
                sx={{ 
                  mr: 1,
                  color: theme.palette.info.main,
                  transform: summaryExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            
            <Fade in={summaryExpanded} timeout={200}>
              <Box sx={{ 
                display: summaryExpanded ? 'block' : 'none',
                px: 2,
                pb: 2
              }}>
                <Box sx={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-line',
                  color: 'text.secondary'
                }}>
                  {getTranscriptSummary()}
                </Box>
              </Box>
            </Fade>
          </Paper>
        </Fade>
      )}

      {/* AI Summary Panel */}
      {aiSummary && (
        <Fade in={Boolean(aiSummary)} timeout={300}>
          <Paper 
            elevation={1}
            sx={{
              ...styles.standardPaper.sx,
              mb: 2,
              bgcolor: alpha(theme.palette.secondary.main, 0.02),
              border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`
            }}
          >
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              cursor: 'pointer',
              p: 0,
              '&:hover': {
                bgcolor: alpha(theme.palette.secondary.main, 0.04)
              }
            }}
            onClick={() => setAiSummaryExpanded(!aiSummaryExpanded)}
            >
              <Typography variant="h6" sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                fontWeight: 600,
                color: theme.palette.secondary.main,
                p: 2,
                pb: aiSummaryExpanded ? 2 : 2
              }}>
                <SmartToyIcon />
                AI-Generated Summary
                <Chip 
                  label={aiSummary.model} 
                  size="small" 
                  variant="outlined"
                  sx={{ ml: 1, fontSize: '0.75rem' }}
                />
              </Typography>
              
              <IconButton 
                size="small"
                sx={{ 
                  mr: 1,
                  color: theme.palette.secondary.main,
                  transform: aiSummaryExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>
            
            <Fade in={aiSummaryExpanded} timeout={200}>
              <Box sx={{ 
                display: aiSummaryExpanded ? 'block' : 'none',
                px: 2,
                pb: 2
              }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                  Generated on: {aiSummary.timestamp} | Words analyzed: {aiSummary.wordCount}
                </Typography>
                
                <Box sx={{ 
                  fontSize: '0.95rem',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-line',
                  color: 'text.primary',
                  '& strong': {
                    color: theme.palette.secondary.main,
                    fontWeight: 600
                  },
                  mb: 2
                }}>
                  {aiSummary.content}
                </Box>
                
                {/* Follow-up Question Section */}
                <Box sx={{ mt: 3, borderTop: 1, borderColor: 'divider', pt: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, color: theme.palette.secondary.main }}>
                    Ask a follow-up question
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Ask anything about the transcript..."
                    value={followUpQuestion}
                    onChange={(e) => setFollowUpQuestion(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleFollowUpQuestion()}
                    sx={{ mb: 1 }}
                  />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                    <Button 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setAiSummary(null);
                      }}
                      sx={{ color: 'text.secondary' }}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="secondary"
                      onClick={handleFollowUpQuestion}
                      disabled={!followUpQuestion.trim() || isGeneratingAi}
                      startIcon={isGeneratingAi ? <CircularProgress size={16} /> : <SmartToyIcon />}
                    >
                      {isGeneratingAi ? "Generating..." : "Ask"}
                    </Button>
                  </Box>
                </Box>
              </Box>
            </Fade>
          </Paper>
        </Fade>
      )}

      {/* OpenAI Configuration Dialog */}
      <Dialog 
        open={showAiConfig} 
        onClose={() => setShowAiConfig(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.08)
        }}>
          <SettingsIcon color="primary" />
          AI & TTS Configuration
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            fullWidth
            label="OpenAI API Endpoint"
            value={openAiConfig.endpoint}
            onChange={(e) => setOpenAiConfig(prev => ({ ...prev, endpoint: e.target.value }))}
            margin="normal"
            helperText="Default: https://api.openai.com/v1"
          />
          <TextField
            fullWidth
            label="OpenAI API Key"
            type="password"
            value={openAiConfig.apiKey}
            onChange={(e) => setOpenAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
            margin="normal"
            helperText="Your OpenAI API key (stored locally)"
          />
          <TextField
            fullWidth
            label="OpenAI Model"
            value={openAiConfig.model}
            onChange={(e) => setOpenAiConfig(prev => ({ ...prev, model: e.target.value }))}
            margin="normal"
            helperText="e.g., gpt-3.5-turbo, gpt-4, gpt-4-turbo"
          />
          <TextField
            fullWidth
            label="TTS Server URL"
            value={openAiConfig.ttsUrl}
            onChange={(e) => setOpenAiConfig(prev => ({ ...prev, ttsUrl: e.target.value }))}
            margin="normal"
            helperText="Text-to-Speech server endpoint for voice playback"
          />
          <TextField
            fullWidth
            label="System Prompt Template"
            value={openAiConfig.prompt}
            onChange={(e) => setOpenAiConfig(prev => ({ ...prev, prompt: e.target.value }))}
            margin="normal"
            multiline
            rows={8}
            helperText="Customize the AI prompt for transcript analysis. This defines how the AI will analyze and format the summary."
            sx={{ 
              '& .MuiInputBase-input': { 
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                lineHeight: 1.4
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAiConfig(false)}>Cancel</Button>
          <Button onClick={saveOpenAiConfig} variant="contained">Save Configuration</Button>
        </DialogActions>
      </Dialog>

      {/* Transcription Columns */}
      <Box sx={{ 
        display: "flex", 
        gap: 2, 
        flexGrow: 1, 
        overflowX: "auto",
        pb: 2
      }}>
        {columns.map((col, index) => {
          const key = getVoiceKey(col.lang);
          const male = MALE_VOICE[key];
          const female = FEMALE_VOICE[key];
          const rows = [...col.lines, ...Array(Math.max(0, maxLines - col.lines.length)).fill("")];
          
          return (
            <Paper 
              key={col.id} 
              elevation={1}
              sx={{ 
                ...styles.standardPaper.sx,
                flex: "1 1 300px", 
                display: "flex", 
                flexDirection: "column",
                overflow: 'hidden',
                p: 0
              }}
            >
              {/* Column Header */}
              <Box sx={{ 
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                p: 1.5 // Reduced padding for more compact header
              }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography 
                    variant="subtitle2" // Changed to subtitle2 for smaller text
                    sx={{ 
                      fontWeight: 600,
                      flex: '0 0 80px', // Reduced width for compact display
                      fontSize: '0.875rem'
                    }}
                  >
                    {col.label}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flex: 1 }}>
                    <LanguageSettings
                      label=""
                      value={col.lang}
                      onChange={(e) =>
                        col.isOriginal ? changeSrcLang(e.target.value) : changeLang(col.id, e.target.value)
                      }
                      options={col.isOriginal ? [{ label: "Auto Detect", value: "auto" }, ...languageOptions] : languageOptions}
                      compact={true} // Enable compact mode
                      sx={{ 
                        flex: 1,
                        minWidth: 100
                      }}
                    />
                  </Box>
                  
                  {!col.isOriginal && (
                    <Tooltip title="Remove Column">
                      <IconButton 
                        onClick={() => removeColumn(col.id)}
                        sx={styles.iconButton()}
                        size="small"
                      >
                        <RemoveCircleIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>

              {/* Transcription Content */}
              <Box sx={{ 
                flexGrow: 1, 
                overflow: "auto",
                minHeight: 300,
                maxHeight: 600,
                fontFamily: 'monospace',
                border: "none",
              }}>
                {rows.map((line, i) => (
                  <Fade key={i} in={Boolean(line)} timeout={300}>
                    <Box
                      sx={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 1, 
                        p: 1, 
                        border: 1,
                        borderColor: 'divider',
                        minHeight: 40,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04),
                        }
                      }}
                    >
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          flexGrow: 1, 
                          lineHeight: 1.5,
                          color: line ? 'text.primary' : 'transparent'
                        }}
                      >
                        {line || '\u00A0'}
                      </Typography>
                      
                      {line && (
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Delete Line">
                            <IconButton 
                              size="small" 
                              onClick={() => deleteLine(col.id, i)} 
                              sx={{ 
                                bgcolor: alpha(theme.palette.error.main, 0.08),
                                border: 'none',
                                color: theme.palette.error.main,
                                '&:hover': {
                                  bgcolor: alpha(theme.palette.error.main, 0.15),
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Play with Male Voice">
                            <IconButton 
                              size="small" 
                              onClick={() => playTTS(line, col.lang, "male")} 
                              disabled={!male || !line.trim()}
                              sx={{ 
                                bgcolor: male ? alpha(theme.palette.info.main, 0.08) : alpha(theme.palette.grey[400], 0.05),
                                border: 'none',
                                color: male ? theme.palette.info.main : theme.palette.grey[400],
                                '&:hover': male ? {
                                  bgcolor: alpha(theme.palette.info.main, 0.15),
                                } : {},
                                '&:disabled': {
                                  bgcolor: alpha(theme.palette.grey[400], 0.05),
                                }
                              }}
                            >
                              <MaleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Play with Female Voice">
                            <IconButton 
                              size="small" 
                              onClick={() => playTTS(line, col.lang, "female")} 
                              disabled={!female || !line.trim()}
                              sx={{ 
                                bgcolor: female ? alpha(theme.palette.secondary.main, 0.08) : alpha(theme.palette.grey[400], 0.05),
                                border: 'none',
                                color: female ? theme.palette.secondary.main : theme.palette.grey[400],
                                '&:hover': female ? {
                                  bgcolor: alpha(theme.palette.secondary.main, 0.15),
                                } : {},
                                '&:disabled': {
                                  bgcolor: alpha(theme.palette.grey[400], 0.05),
                                }
                              }}
                            >
                              <FemaleIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </Box>
                  </Fade>
                ))}
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Container>
  );
};

export default LiveTranscriptionPage;
