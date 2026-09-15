import { useLayoutEffect, useRef, useState } from 'react'
import { Box, Button, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material'
import StarRounded from '@mui/icons-material/StarRounded'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'
import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { filesRoute } from '../utils'
import { useCloseOnHistoryNavigation } from '../modalNavigation'

const favoriteWidth = 120
const gap = 4
const overflowWidth = 44

export function FavoritesNav({ favorites }: { favorites: string[] }) {
  const { t } = useTranslation()
  const location = useLocation()
  const container = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(0)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  useCloseOnHistoryNavigation(Boolean(anchor), () => setAnchor(null))

  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const measure = () => { setWidth(element.getBoundingClientRect().width); setAnchor(null) }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const capacity = Math.floor((width + gap) / (favoriteWidth + gap))
  const visibleCount = favorites.length <= Math.min(5, capacity)
    ? favorites.length
    : Math.min(5, Math.max(0, Math.floor((width - overflowWidth) / (favoriteWidth + gap))))
  const overflow = favorites.slice(visibleCount)
  const label = (path: string) => path === '/' ? t('nav.home') : path.split('/').pop()

  return (
    <Box ref={container} component="nav" aria-label={t('nav.favorites')} sx={{ display: 'flex', alignItems: 'center', gap: `${gap}px`, flex: 1, minWidth: overflowWidth }}>
      {favorites.slice(0, visibleCount).map((path) => (
        <Tooltip key={path} title={path} describeChild>
          <Button component={NavLink} end to={filesRoute(path)} startIcon={<StarRounded fontSize="small" />} className="nav-button" sx={{ width: favoriteWidth, flexShrink: 0 }}>
            <Box component="span" className="file-name">{label(path)}</Box>
          </Button>
        </Tooltip>
      ))}
      {overflow.length > 0 && <Tooltip title={t('nav.moreFavorites')}>
        <IconButton aria-label={t('nav.moreFavorites')} aria-haspopup="menu" aria-expanded={Boolean(anchor)} aria-controls={anchor ? 'favorites-menu' : undefined} onClick={(event) => setAnchor(event.currentTarget)} sx={{ ml: 'auto' }}>
          <MoreVertRounded />
        </IconButton>
      </Tooltip>}
      <Menu id="favorites-menu" anchorEl={anchor} open={Boolean(anchor) && overflow.length > 0} onClose={() => setAnchor(null)}>
        {overflow.map((path) => (
          <MenuItem key={path} component={NavLink} end to={filesRoute(path)} selected={location.pathname === filesRoute(path)} onClick={() => setAnchor(null)} sx={{ maxWidth: 'min(480px, calc(100vw - 32px))' }}>
            <ListItemIcon><StarRounded /></ListItemIcon>
            <ListItemText primary={label(path)} secondary={path} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
          </MenuItem>
        ))}
      </Menu>
    </Box>
  )
}
