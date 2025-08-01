// src/components/VoiceSelector.js
import React from "react";
import {
  TextField,
  Autocomplete,
  CircularProgress,
  Box,
} from "@mui/material";
import { Female, Male } from "@mui/icons-material";
import { parseVoiceId, VoiceOption } from "./VoiceComponents";

/**
 * VoiceSelector
 * ---------------------------------------------------------------------------
 * Autocomplete wrapper listing Kokoro voices. Accepts `sx` to style from parent.
 */
export default function VoiceSelector({
  voices = [],
  selectedVoice,
  onVoiceChange,
  loadingVoices = false,
  sx = {},
  ...autoProps
}) {
  const sel = parseVoiceId(selectedVoice);

  return (
    <Autocomplete
      options={voices}
      value={selectedVoice || null}
      onChange={(_, v) => v && onVoiceChange(v)}
      disableClearable
      disabled={loadingVoices}
      groupBy={(o) => {
        const v = parseVoiceId(o);
        return `${v.language} – ${v.gender}`;
      }}
      getOptionLabel={(o) => parseVoiceId(o).displayName}
      filterOptions={(opts, { inputValue }) =>
        opts.filter((o) => {
          const v = parseVoiceId(o);
          const t = inputValue.toLowerCase();
          return (
            v.displayName.toLowerCase().includes(t) ||
            v.language.toLowerCase().includes(t) ||
            v.gender.toLowerCase().includes(t) ||
            v.id.toLowerCase().includes(t)
          );
        })
      }
      renderOption={(props, o) => <VoiceOption {...props} voice={parseVoiceId(o)} key={o} />}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search voice"
          InputProps={{
            ...params.InputProps,
            startAdornment:
              selectedVoice && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mr: 1 }}>
                  {/* Country flag */}
                  {sel.languageFlag}
                  {/* Gender icon (original styling) */}
                  <Box
                    sx={{
                      p: 0.3,
                      borderRadius: 0.8,
                      bgcolor: sel.gender === "Female" ? "#fce4ec" : "#e3f2fd",
                      border: `1px solid ${sel.gender === "Female" ? "#f48fb1" : "#90caf9"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minWidth: 22,
                      height: 22,
                    }}
                  >
                    {sel.gender === "Female" ? (
                      <Female fontSize="small" sx={{ color: "#e91e63", fontSize: 14 }} />
                    ) : (
                      <Male fontSize="small" sx={{ color: "#2196f3", fontSize: 14 }} />
                    )}
                  </Box>
                </Box>
              ),
            endAdornment: (
              <>
                {loadingVoices && <CircularProgress size={20} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      sx={{ borderRadius: 1.5, ...sx }}
      {...autoProps}
    />
  );
}
