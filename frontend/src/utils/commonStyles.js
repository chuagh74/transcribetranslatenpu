// utils/commonStyles.js
import { alpha } from '@mui/material/styles';

// Helper functions for themed colors
export const getThemedBgColor = (theme, color, opacity = 0.08) => {
  const colorValue = theme.palette[color]?.main || color;
  return alpha(colorValue, opacity);
};

export const getThemedBorderColor = (theme, color, opacity = 0.2) => {
  const colorValue = theme.palette[color]?.main || color;
  return alpha(colorValue, opacity);
};

// Common gradient styles
export const createGradientStyles = (theme) => ({
  gradientBackground: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
  gradientText: {
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  gradientIcon: {
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontSize: 'inherit'
  }
});

// Common paper styles
export const createPaperStyles = (theme) => ({
  standardPaper: {
    elevation: 1,
    sx: {
      p: 3,
      borderRadius: 2,
      bgcolor: 'background.paper',
      border: '1px solid',
      borderColor: 'divider'
    }
  },
  cardHover: {
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      boxShadow: 4,
      borderColor: 'primary.main'
    }
  }
});

// Common button styles
export const createButtonStyles = (theme) => ({
  primaryButton: {
    borderRadius: 1.5,
    textTransform: 'none',
    fontWeight: 600,
    minWidth: 120,
    height: 40
  },
  secondaryButton: {
    borderRadius: 1.5,
    textTransform: 'none',
    fontWeight: 500,
    minWidth: 100,
    height: 40
  },
  iconButton: (color = 'primary') => ({
    bgcolor: alpha(theme.palette[color].main, 0.08),
    '&:hover': {
      bgcolor: alpha(theme.palette[color].main, 0.12),
    }
  }),
  coloredIconButton: (color) => ({
    bgcolor: alpha(theme.palette[color].main, 0.1),
    '&:hover': {
      bgcolor: alpha(theme.palette[color].main, 0.2),
    }
  })
});

// Common flex layouts
export const createFlexStyles = () => ({
  centerFlex: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  spaceBetweenFlex: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  responsiveRow: {
    display: 'flex',
    flexDirection: { xs: 'column', md: 'row' },
    gap: 2
  },
  responsiveCol: {
    display: 'flex',
    flexDirection: { xs: 'column', lg: 'row' },
    gap: 2
  },
  flexContainer: {
    display: 'flex',
    flexDirection: { xs: 'column', lg: 'row' },
    gap: 2,
    alignItems: 'stretch'
  },
  actionButtonsContainer: {
    display: 'flex',
    gap: 1,
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
    flex: { xs: '1 1 100%', lg: '1 0 10%' },
    py: 2
  }
});

// Common header styles
export const createHeaderStyles = (theme) => ({
  pageHeader: {
    display: "flex",
    alignItems: "center",
    gap: 2,
    mb: 2
  },
  headerIcon: {
    p: 1.5,
    borderRadius: 2,
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    color: 'white'
  },
  headerTitle: {
    fontWeight: 700,
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent'
  }
});

// Common input styles
export const createInputStyles = () => ({
  roundedInput: {
    '& .MuiOutlinedInput-root': {
      borderRadius: 1.5
    }
  },
  borderlessInput: {
    '& .MuiOutlinedInput-root': {
      border: 'none',
      '& fieldset': { border: 'none' },
      '&:hover fieldset': { border: 'none' },
      '&.Mui-focused fieldset': { border: 'none' }
    }
  },
  textAreaField: {
    '& .MuiOutlinedInput-root': {
      padding: 0,
      '& fieldset': { border: 'none' },
      '&:hover fieldset': { border: 'none' },
      '&.Mui-focused fieldset': { border: 'none' }
    }
  },
  textAreaInput: {
    sx: {
      height: '100%',
      '& textarea': {
        height: '100% !important',
        resize: 'none',
        padding: '12px',
        fontSize: '0.95rem',
        lineHeight: 1.6
      }
    }
  }
});

// Dynamic background colors based on content state
export const createDynamicBgStyles = (theme) => ({
  inputBg: (hasContent) => ({
    bgcolor: theme.palette.mode === 'dark'
      ? (hasContent ? 'rgba(76, 175, 80, 0.08)' : 'background.default')
      : (hasContent ? '#f1f8e9' : '#f8f9fa'),
    borderColor: hasContent
      ? (theme.palette.mode === 'dark' ? 'rgba(76, 175, 80, 0.3)' : '#4caf50')
      : 'divider'
  }),
  outputBg: (hasContent) => ({
    bgcolor: theme.palette.mode === 'dark'
      ? (hasContent ? 'rgba(144, 202, 249, 0.08)' : 'background.default')
      : (hasContent ? '#f0f9ff' : '#f8f9fa'),
    borderColor: hasContent
      ? (theme.palette.mode === 'dark' ? 'rgba(144, 202, 249, 0.2)' : '#0ea5e9')
      : 'divider'
  }),
  errorBg: (hasContent) => ({
    bgcolor: theme.palette.mode === 'dark'
      ? (hasContent ? 'rgba(156, 39, 176, 0.08)' : 'background.default')
      : (hasContent ? '#fce4ec' : '#f8f9fa'),
    borderColor: hasContent
      ? (theme.palette.mode === 'dark' ? 'rgba(156, 39, 176, 0.2)' : '#e91e63')
      : 'divider'
  })
});

// Common container styles
export const createContainerStyles = () => ({
  mainContainer: {
    maxWidth: "xl",
    sx: { py: 3, width: '100%', flex: 1 }
  },
  flexContainer: (minHeight = 300) => ({
    flex: 1,
    p: 1.5,
    border: 1,
    borderRadius: 1,
    minHeight: { xs: 200, lg: minHeight },
    display: 'flex',
    flexDirection: 'column'
  })
});

// Animation styles
export const createAnimationStyles = () => ({
  pulse: {
    animation: 'pulse 2s infinite',
    '@keyframes pulse': {
      '0%': { transform: 'scale(1)' },
      '50%': { transform: 'scale(1.05)' },
      '100%': { transform: 'scale(1)' },
    }
  },
  fadeIn: {
    animation: 'fadeIn 0.3s ease-in-out',
    '@keyframes fadeIn': {
      '0%': { opacity: 0, transform: 'translateY(10px)' },
      '100%': { opacity: 1, transform: 'translateY(0)' }
    }
  }
});

// Tab styles
export const createTabStyles = () => ({
  customTabs: {
    '& .MuiTab-root': {
      textTransform: 'none',
      fontWeight: 500,
      fontSize: '0.95rem'
    }
  }
});

// Common menu/sidebar styles
export const createMenuStyles = (theme) => ({
  menuItem: {
    transition: 'all 0.2s ease-in-out',
    '& .MuiListItemIcon-root': {
      minWidth: '40px',
      '& svg': {
        fontSize: '20px',
        color: theme.palette.primary.main,
        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        transition: 'all 0.2s ease-in-out'
      }
    },
    '& .MuiListItemText-root': {
      margin: 0,
      '& .MuiListItemText-primary': {
        fontSize: '0.875rem',
        fontWeight: 500,
        transition: 'all 0.2s ease-in-out',
      }
    },
    '&:hover': {
      bgcolor: alpha(theme.palette.primary.main, 0.08),
      '& .MuiListItemIcon-root svg': {
        transform: 'scale(1.1)',
        filter: 'brightness(1.2)'
      },
      '& .MuiListItemText-primary': {
        fontWeight: 600,
        color: theme.palette.primary.main
      }
    },
    '&.RaMenuItemLink-active': {
      bgcolor: alpha(theme.palette.primary.main, 0.12),
      borderLeft: `3px solid ${theme.palette.primary.main}`,
      '& .MuiListItemIcon-root svg': {
        transform: 'scale(1.15)',
        filter: 'brightness(1.3)',
        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      },
      '& .MuiListItemText-primary': {
        fontWeight: 700,
        color: theme.palette.primary.main
      },
      '&:hover': {
        bgcolor: alpha(theme.palette.primary.main, 0.16)
      }
    }
  },
  gradientIcon: {
    fontSize: '20px !important',
    color: `${theme.palette.primary.main} !important`,
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}) !important`,
    backgroundClip: 'text !important',
    WebkitBackgroundClip: 'text !important',
    WebkitTextFillColor: 'transparent !important',
    transition: 'all 0.2s ease-in-out !important'
  },
  activeGradientIcon: {
    fontSize: '20px !important',
    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main}) !important`,
    backgroundClip: 'text !important',
    WebkitBackgroundClip: 'text !important',
    WebkitTextFillColor: 'transparent !important',
    transform: 'scale(1.15) !important',
    filter: 'brightness(1.3) !important'
  }
});

// Hook to use all common styles
export const useCommonStyles = (theme) => ({
  ...createGradientStyles(theme),
  ...createPaperStyles(theme),
  ...createButtonStyles(theme),
  ...createFlexStyles(),
  ...createHeaderStyles(theme),
  ...createInputStyles(),
  ...createDynamicBgStyles(theme),
  ...createContainerStyles(),
  ...createAnimationStyles(),
  ...createTabStyles(),
  ...createMenuStyles(theme),
  // Helper functions
  getThemedBgColor: (color, opacity = 0.08) => getThemedBgColor(theme, color, opacity),
  getThemedBorderColor: (color, opacity = 0.2) => getThemedBorderColor(theme, color, opacity)
});