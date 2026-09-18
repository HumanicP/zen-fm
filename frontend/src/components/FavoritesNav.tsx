import { useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Snackbar, TextField, Tooltip, Typography } from '@mui/material'
import StarRounded from '@mui/icons-material/StarRounded'
import StarBorderRounded from '@mui/icons-material/StarBorderRounded'
import EditRounded from '@mui/icons-material/EditRounded'
import MoreVertRounded from '@mui/icons-material/MoreVertRounded'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { fileRoute, filesRoute } from '../utils'
import type { Settings } from '../api/types'
import { useCloseOnHistoryNavigation } from '../modalNavigation'

const favoriteWidth = 120
const gap = 4
const overflowWidth = 44

export function FavoritesNav({ favorites, favoriteTypes, favoriteLabels }: { favorites: string[]; favoriteTypes?: Settings['favoriteTypes']; favoriteLabels?: Settings['favoriteLabels'] }) {
  const { t } = useTranslation()
  const location = useLocation()
  const queryClient = useQueryClient()
  const container = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(0)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [contextMenu, setContextMenu] = useState<{ path: string; top: number; left: number } | null>(null)
  const [editing, setEditing] = useState<{ path: string; label: string } | null>(null)
  const [notice, setNotice] = useState('')
  const update = useMutation({
    mutationFn: api.settings.update,
    onSuccess: (next) => { queryClient.setQueryData(['settings'], next); setContextMenu(null); setEditing(null) },
    onError: (error) => setNotice(error.message),
  })
  useCloseOnHistoryNavigation(Boolean(anchor || contextMenu), () => { setAnchor(null); setContextMenu(null) })
  useCloseOnHistoryNavigation(Boolean(editing), () => { if (!update.isPending) setEditing(null) })

  const openContextMenu = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>, path: string) => {
    if ('key' in event && event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = event.currentTarget.getBoundingClientRect()
    setAnchor(null)
    setContextMenu({ path, top: 'clientY' in event ? event.clientY : bounds.bottom, left: 'clientX' in event ? event.clientX : bounds.left })
  }

  useLayoutEffect(() => {
    const element = container.current
    if (!element) return
    const measure = () => { setWidth(element.getBoundingClientRect().width); setAnchor(null); setContextMenu(null) }
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
  const label = (path: string) => favoriteLabels?.[path] || (path === '/' ? t('nav.home') : path.split('/').pop() || path)
  const route = (path: string) => favoriteTypes?.[path] === 'file' ? fileRoute(path) : filesRoute(path)
  const isActive = (path: string) => `${location.pathname}${location.search}` === route(path)

  return (
    <Box ref={container} component="nav" aria-label={t('nav.favorites')} sx={{ display: 'flex', alignItems: 'center', gap: `${gap}px`, flex: 1, minWidth: overflowWidth }}>
      {favorites.slice(0, visibleCount).map((path) => (
        <Tooltip key={path} title={path} describeChild>
          <Button component={Link} to={route(path)} onContextMenu={(event) => openContextMenu(event, path)} onKeyDown={(event) => openContextMenu(event, path)} aria-current={isActive(path) ? 'page' : undefined} startIcon={<StarRounded fontSize="small" />} className={`nav-button${isActive(path) ? ' active' : ''}`} sx={{ width: favoriteWidth, flexShrink: 0 }}>
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
          <MenuItem key={path} component={Link} to={route(path)} onContextMenu={(event) => openContextMenu(event, path)} onKeyDown={(event) => openContextMenu(event, path)} selected={isActive(path)} aria-current={isActive(path) ? 'page' : undefined} onClick={() => setAnchor(null)} sx={{ maxWidth: 'min(480px, calc(100vw - 32px))' }}>
            <ListItemIcon><StarRounded /></ListItemIcon>
            <ListItemText primary={label(path)} secondary={path} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
          </MenuItem>
        ))}
      </Menu>
      <Menu anchorReference="anchorPosition" anchorPosition={contextMenu ?? undefined} open={Boolean(contextMenu)} onClose={() => setContextMenu(null)}>
        <MenuItem disabled={update.isPending} onClick={() => { if (contextMenu) setEditing({ path: contextMenu.path, label: label(contextMenu.path) }); setContextMenu(null) }}><ListItemIcon><EditRounded /></ListItemIcon><ListItemText>{t('nav.editFavoriteLabel')}</ListItemText></MenuItem>
        <MenuItem disabled={update.isPending} onClick={() => { if (contextMenu) update.mutate({ favorites: favorites.filter((path) => path !== contextMenu.path) }) }}><ListItemIcon><StarBorderRounded /></ListItemIcon><ListItemText>{t('files.removeFavorite')}</ListItemText></MenuItem>
      </Menu>
      <Dialog open={Boolean(editing)} onClose={update.isPending ? undefined : () => setEditing(null)} maxWidth="xs">
        <Box component="form" onSubmit={(event) => { event.preventDefault(); if (editing && !update.isPending) update.mutate({ favoriteLabels: { ...favoriteLabels, [editing.path]: editing.label.trim() } }) }}>
          <DialogTitle>{t('nav.editFavoriteLabel')}</DialogTitle>
          <DialogContent sx={{ pt: 2, overflow: 'visible' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, overflowWrap: 'anywhere' }}>{editing?.path}</Typography>
            <TextField fullWidth autoFocus label={t('nav.favoriteLabel')} value={editing?.label ?? ''} onChange={(event) => setEditing((current) => current && { ...current, label: event.target.value })} inputProps={{ maxLength: 200 }} helperText={t('nav.favoriteLabelHint')} />
          </DialogContent>
          <DialogActions><Button disabled={update.isPending} onClick={() => setEditing(null)}>{t('common.cancel')}</Button><Button type="submit" variant="contained" disabled={update.isPending}>{t('files.save')}</Button></DialogActions>
        </Box>
      </Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={5000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}
