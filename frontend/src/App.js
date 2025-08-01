// src/App.js
import React from 'react';
import { Admin, CustomRoutes, Layout } from 'react-admin';
import { Route } from 'react-router-dom';
import { createTheme } from '@mui/material/styles';
import { blue } from '@mui/material/colors';
import Dashboard from './dashboard/Dashboard';
import TranscribeTranslatePage from './pages/TranscribeTranslatePage';
import SpeechPage from './pages/SpeechPage';
import LiveTranscriptionPage from './pages/LiveTranscriptionPage';
import ModelsPage from './pages/ModelsPage';
import AppMenu from './AppMenu';

const AppLayout = props => <Layout {...props} menu={AppMenu} />;

const lightTheme = createTheme({
  palette: {
    primary: blue,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        colorSecondary: {
          backgroundColor: blue[600],
        },
      },
    },
  },
});
const darkTheme  = createTheme({ palette: { mode: 'dark'  } });

const App = () => (
  <Admin
    theme={lightTheme}     // default
    darkTheme={darkTheme}  // enables the toggle
    dashboard={Dashboard}
    layout={AppLayout}
  >
    <CustomRoutes>
      <Route path="/transcribe-translate" element={<TranscribeTranslatePage />} />
      <Route path="/speech" element={<SpeechPage />} />
      <Route path="/live-transcription" element={<LiveTranscriptionPage />} />
      <Route path="/models" element={<ModelsPage />} />
    </CustomRoutes>
  </Admin>
);

export default App;
