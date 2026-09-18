import { useEffect, useState } from 'react'
import { Alert, AppBar, Box, Button, Container, IconButton, Snackbar, Stack, Toolbar, Tooltip, useMediaQuery, useTheme } from '@mui/material'
import FolderRounded from '@mui/icons-material/FolderRounded'
import ShareIcon from '@mui/icons-material/Share'
import SettingsRounded from '@mui/icons-material/SettingsRounded'
import LogoutRounded from '@mui/icons-material/LogoutRounded'
import DarkModeRounded from '@mui/icons-material/DarkModeRounded'
import LightModeRounded from '@mui/icons-material/LightModeRounded'
import { NavLink, Outlet } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api, setClientTimeout } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { useThemeMode } from '../theme'
import { ZenMark } from './ZenMark'
import { FavoritesNav } from './FavoritesNav'

const nav = [
  { to: '/files', label: 'nav.files', icon: <FolderRounded fontSize="small" /> },
  { to: '/shares', label: 'nav.shares', icon: <ShareIcon fontSize="small" /> },
  { to: '/settings', label: 'nav.settings', icon: <SettingsRounded fontSize="small" /> },
] as const

export function AppShell() {
  const { t, i18n } = useTranslation()
  const { logout } = useAuth()
  const { preference, setPreference } = useThemeMode()
  const queryClient = useQueryClient()
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('sm'))
  const compact = useMediaQuery(theme.breakpoints.down('md'))
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings.get })
  const [showInsecureWarning, setShowInsecureWarning] = useState(() => window.location.protocol === 'http:')
  const favorites = settings.data?.favorites ?? []
  const themePreference = useMutation({
    mutationFn: (next: 'light' | 'dark') => api.settings.update({ theme: next }),
    onSuccess: (next) => queryClient.setQueryData(['settings'], next),
  })

  useEffect(() => {
    if (!settings.data) return
    setPreference(settings.data.theme)
    setClientTimeout(settings.data.clientTimeoutSeconds)
    void i18n.changeLanguage(settings.data.locale)
  }, [i18n, setPreference, settings.data])

  const dark = theme.palette.mode === 'dark'
  const toggleTheme = () => {
    const next = dark ? 'light' : 'dark'
    const previous = preference
    setPreference(next)
    themePreference.mutate(next, { onError: () => setPreference(previous) })
  }

  return (
    <Box className="app-shell" minHeight="100dvh" pb={mobile ? 10 : 0}>
      <AppBar position="sticky" color="transparent" sx={{ backdropFilter: 'blur(18px)', borderBottom: 1, borderColor: 'divider', backgroundImage: 'none' }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ gap: { xs: 1, md: 2 } }}>
            <ZenMark />
            {!mobile && (
              <Stack direction="row" gap={0.5} ml={compact ? 0 : 3} flexShrink={0}>
                {nav.map((item) => <Tooltip key={item.to} title={t(item.label)}><Button component={NavLink} to={item.to} aria-label={t(item.label)} startIcon={compact ? undefined : item.icon} className="nav-button" sx={{ minWidth: 44 }}>{compact ? item.icon : t(item.label)}</Button></Tooltip>)}
              </Stack>
            )}
            {favorites.length > 0 && <FavoritesNav favorites={favorites} favoriteTypes={settings.data?.favoriteTypes} favoriteLabels={settings.data?.favoriteLabels} />}
            <Stack direction="row" alignItems="center" gap={0.5} ml="auto" flexShrink={0}>
              <Tooltip title={t(dark ? 'nav.useLightMode' : 'nav.useDarkMode')}>
                <span>
                  <IconButton color="inherit" aria-label={t(dark ? 'nav.useLightMode' : 'nav.useDarkMode')} disabled={!settings.data || themePreference.isPending} onClick={toggleTheme}>
                    {dark ? <LightModeRounded /> : <DarkModeRounded sx={{ color: 'text.secondary' }} />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('nav.logout')}><Button onClick={() => void logout()} color="inherit" startIcon={compact ? undefined : <LogoutRounded />} aria-label={t('nav.logout')} sx={{ minWidth: 44 }}>{compact ? <LogoutRounded /> : t('nav.logout')}</Button></Tooltip>
            </Stack>
          </Toolbar>
        </Container>
      </AppBar>
      {settings.data?.advancedMode && <Container maxWidth="xl" sx={{ pt: 2 }}><Alert severity="error" variant="outlined">{t('warning.advanced')}</Alert></Container>}
      <Container component="main" maxWidth="xl" sx={{ py: { xs: 2.5, sm: 4 }, minHeight: 'calc(100dvh - 64px)', display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Container>
      {mobile && (
        <Box component="nav" className="bottom-nav" aria-label="Primary navigation">
          {nav.map((item) => (
            <Button key={item.to} component={NavLink} to={item.to} color="inherit" className="bottom-nav-button">
              {item.icon}<span>{t(item.label)}</span>
            </Button>
          ))}
        </Box>
      )}
      <Snackbar open={showInsecureWarning} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} autoHideDuration={4000} onClose={() => setShowInsecureWarning(false)}>
        <Alert severity="warning" variant="outlined" onClose={() => setShowInsecureWarning(false)} sx={{ width: 'min(92vw, 720px)', alignItems: 'center', bgcolor: 'warning.main', borderColor: 'warning.main', color: 'warning.contrastText', boxShadow: 6, '& .MuiAlert-icon, & .MuiAlert-action': { color: 'inherit', alignSelf: 'center', py: 0 }, '& .MuiAlert-message': { py: 0 } }}>{t('warning.http')}</Alert>
      </Snackbar>
    </Box>
  )
}
